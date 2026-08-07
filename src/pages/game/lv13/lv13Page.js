import "Propeller";
import lv13Style from "../../../assets/scss/game/lv13/common.scss?inline";
import lv13Template from "./lv13.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv13FailSound,
  playLv13NodeSound,
  playLv13SpinSound,
  playLv13SuccessSound,
  playStartSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv13Sound.js";

const CONFIG = Object.freeze({
  nodeCount: 12,
  fallDurationMinMs: 3900,
  fallDurationMaxMs: 4750,
  initialDelayMs: 650,
  // 판정 구간(노드가 회전 영역을 통과하는 구간) 사이에 반드시 전환 시간을 둡니다.
  // 이전 노드가 끝나기 전에 다음 노드가 같은 영역에 진입하지 않도록
  // 실제 fall duration을 기준으로 spawn 시점을 역산합니다.
  judgmentStartProgress: 0.72,
  judgmentEndProgress: 0.88,
  transitionGapMinMs: 360,
  transitionGapMaxMs: 560,
  visualNodeGapMs: 120,
  // 약한 스와이프도 방향 입력으로 인식하되, 미세한 손떨림은 제외합니다.
  spinThreshold: 0.055,
  // 실제 플래터처럼 손을 놓은 뒤 충분히 오래 회전하도록 감쇠를 완만하게 합니다.
  propellerInertia: 0.995,
  propellerMinimalSpeed: 0.008,
  propellerMaxReferenceSpeed: 18,
  // Propeller 내부 감쇠가 적용되기 전의 마지막 드래그 속도를 기준으로
  // 릴리스 관성을 새로 부여해, 반복 조작에도 같은 스와이프는 같은 속도를 냅니다.
  releaseVelocityMultiplier: 2.25,
  releaseVelocityMax: 32,
  releaseSampleMaxAgeMs: 160,
});

const COLORS = ["#f3b8cb", "#a9ddd1", "#b2ccef", "#cebce9", "#f3d68d", "#efbea8"];
const DIRECTION = Object.freeze({ left: -1, right: 1 });

let gameId = 0;
let running = false;
let timers = new Set();
let viewportController = null;
let frameId = 0;
let propellerInstance = null;
let angularVelocity = 0;
let latestDragVelocity = 0;
let latestDragVelocityAt = 0;
let sequence = [];
let activeNodes = new Map();
let resolvedCheckpoints = 0;
let totalCheckpoints = 0;
let finishedNodes = 0;
let hadFailure = false;
let feedbackTimer = 0;

export function renderPage() {
  cancelGame();
  renderView(lv13Template, lv13Style);
  bindViewportHeight();
  bindPage();
}

function bindViewportHeight() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv13Page");
    if (!page) return;
    const height = window.visualViewport?.height ?? window.innerHeight;
    page.style.setProperty("--lv13-viewport-height", `${Math.round(height)}px`);
  };
  sync();
  window.addEventListener("resize", sync, { passive: true, signal });
  window.addEventListener("orientationchange", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true, signal });
}

function bindPage() {
  const start = document.getElementById("lv13StartButton");
  const retry = document.getElementById("lv13RetryButton");
  const next = document.getElementById("lv13NextButton");
  const home = document.getElementById("lv13HomeButton");
  const turntable = document.getElementById("lv13Turntable");
  const spinInputZone = document.getElementById("lv13SpinInputZone");
  if (!start || !retry || !next || !home || !turntable || !spinInputZone) return;

  unlockSoundOnNextGesture();
  start.addEventListener("click", startGame);
  retry.addEventListener("click", startGame);
  next.addEventListener("click", () => {
    cancelGame();
    navigate("lv14", { replace: true });
  });
  home.addEventListener("click", () => {
    cancelGame();
    navigate("home", { replace: true });
  });

  createTurntablePropeller(turntable, spinInputZone);
}

async function startGame() {
  cancelGame();
  const id = ++gameId;
  running = true;
  sequence = createSequence();
  activeNodes = new Map();
  resolvedCheckpoints = 0;
  totalCheckpoints = sequence.reduce((sum, item) => sum + item.checkpoints.length, 0);
  finishedNodes = 0;
  hadFailure = false;
  resetTurntablePropeller();

  document.getElementById("lv13Ready")?.setAttribute("hidden", "");
  document.getElementById("lv13Result")?.setAttribute("hidden", "");
  document.getElementById("lv13NodeLayer")?.replaceChildren();
  document.getElementById("lv13Arena")?.classList.remove("is-success", "is-fail");
  setText("lv13RoundText", "GET READY");
  setText("lv13ScoreText", `0 / ${totalCheckpoints}`);
  setText("lv13StatusText", "노드가 판정선에 닿을 때 회전 방향을 맞춰 주세요.");

  await readySound();
  if (!isActive(id)) return;
  playStartSound();
  propellerInstance?.bind();
  frameId = requestAnimationFrame((time) => gameLoop(id, time));
  scheduleSequence(id);
}

function createSequence() {
  return Array.from({ length: CONFIG.nodeCount }, (_, index) => {
    const direction = Math.random() < 0.5 ? "left" : "right";
    const duration = randomInt(CONFIG.fallDurationMinMs, CONFIG.fallDurationMaxMs);
    const height = randomInt(82, 168);
    const checkpointCount = randomInt(2, 4);
    const checkpoints = Array.from({ length: checkpointCount }, (_, checkpointIndex) => ({
      progress: CONFIG.judgmentStartProgress
        + (checkpointIndex / Math.max(1, checkpointCount - 1))
          * (CONFIG.judgmentEndProgress - CONFIG.judgmentStartProgress),
      direction,
      resolved: false,
    }));

    return {
      index,
      type: "wide",
      direction,
      duration,
      height,
      color: COLORS[index % COLORS.length],
      checkpoints,
    };
  });
}

function scheduleSequence(id) {
  let spawnAt = CONFIG.initialDelayMs;

  sequence.forEach((item, index) => {
    schedule(() => spawnNode(id, item), spawnAt);

    const nextItem = sequence[index + 1];
    if (!nextItem) return;

    // 현재 노드의 판정 구간이 완전히 끝난 뒤에만 다음 노드의 판정 구간이
    // 시작되도록 각 노드의 실제 낙하 시간을 기준으로 spawn 간격을 계산합니다.
    // fall duration이 서로 달라도 빠른 뒤쪽 노드가 앞 노드를 따라잡지 않습니다.
    const currentWindowEndAt = spawnAt
      + item.duration * CONFIG.judgmentEndProgress;
    const nextWindowLeadTime = nextItem.duration * CONFIG.judgmentStartProgress;
    const transitionGap = randomInt(
      CONFIG.transitionGapMinMs,
      CONFIG.transitionGapMaxMs,
    );

    const judgmentSafeSpawnAt = currentWindowEndAt
      + transitionGap
      - nextWindowLeadTime;
    const visualSafeSpawnAt = spawnAt
      + getVisualNodeSeparationMs(item, nextItem);

    // 판정 구간뿐 아니라 실제 화면의 wide node 사각형도 서로 포개지지 않게
    // 두 조건 중 더 늦은 시점을 다음 spawn 시점으로 사용합니다.
    spawnAt = Math.max(judgmentSafeSpawnAt, visualSafeSpawnAt);
  });
}

function getVisualNodeSeparationMs(currentItem, nextItem) {
  const viewportHeight = Math.max(1, window.visualViewport?.height ?? window.innerHeight);
  const travelDistance = viewportHeight * 1.05;

  // CSS의 이동식: -25vh -> +80vh (총 105vh).
  // 뒤 노드의 하단이 앞 노드의 상단을 따라잡지 않도록 필요한 최소 시간차를
  // 두 노드의 서로 다른 fall duration까지 포함해 계산합니다.
  const separationAtNextSpawn = currentItem.duration
    * (nextItem.height / travelDistance);
  const separationBeforeCurrentExit = currentItem.duration
    - nextItem.duration
    + nextItem.duration * (nextItem.height / travelDistance);

  return Math.max(
    0,
    separationAtNextSpawn,
    separationBeforeCurrentExit,
  ) + CONFIG.visualNodeGapMs;
}

function spawnNode(id, item) {
  if (!isActive(id)) return;
  const layer = document.getElementById("lv13NodeLayer");
  if (!layer) return;

  const node = document.createElement("div");
  node.className = `lv13-node is-${item.type}`;
  node.dataset.nodeIndex = String(item.index);
  node.style.setProperty("--node-color", item.color);
  node.style.setProperty("--fall-duration", `${item.duration}ms`);

  node.style.setProperty("--wide-height", `${item.height}px`);
  node.innerHTML = `<div class="lv13-arrow-stream is-${item.direction}">${Array.from({ length: 11 }, () => "<span>➜</span>").join("")}</div>`;

  layer.appendChild(node);
  activeNodes.set(item.index, {
    item,
    node,
    startedAt: performance.now(),
    completed: false,
  });
  setText("lv13RoundText", `ARROW ${item.index + 1} / ${CONFIG.nodeCount}`);
  setText("lv13StatusText", `${item.direction === "left" ? "왼쪽" : "오른쪽"} 화살표 흐름을 유지하세요.`);
  playLv13NodeSound(item.index, false);
}

function gameLoop(id, time) {
  if (!isActive(id)) return;
  angularVelocity = propellerInstance?.speed ?? 0;
  activeNodes.forEach((state) => updateNode(id, state, time));
  frameId = requestAnimationFrame((nextTime) => gameLoop(id, nextTime));
}

function updateNode(id, state, time) {
  if (state.completed || !state.node.isConnected) return;
  const progress = Math.min(1, (time - state.startedAt) / state.item.duration);
  state.node.style.setProperty("--fall-progress", String(progress));

  state.item.checkpoints.forEach((checkpoint, checkpointIndex) => {
    if (!checkpoint.resolved && progress >= checkpoint.progress) {
      checkpoint.resolved = true;
      judgeCheckpoint(state, checkpoint, checkpointIndex);
    }
  });

  if (progress >= 1) {
    state.completed = true;
    state.node.classList.add("is-finished");
    schedule(() => state.node.remove(), 420);
    finishedNodes += 1;
    if (finishedNodes >= sequence.length) schedule(() => finishGame(id), 650);
  }
}

function judgeCheckpoint(state, checkpoint) {
  const currentDirection = Math.abs(angularVelocity) >= CONFIG.spinThreshold
    ? (angularVelocity > 0 ? "right" : "left")
    : "none";
  const success = currentDirection === checkpoint.direction;
  resolvedCheckpoints += 1;
  setText("lv13ScoreText", `${resolvedCheckpoints} / ${totalCheckpoints}`);

  if (success) {
    state.node.classList.remove("is-miss");
    state.node.classList.add("is-hit");
    schedule(() => state.node.classList.remove("is-hit"), 320);
    showFeedback(true, checkpoint.direction);
    playLv13SuccessSound(resolvedCheckpoints, false);
  } else {
    hadFailure = true;
    state.node.classList.add("is-miss");
    showFeedback(false, checkpoint.direction);
    playLv13FailSound(resolvedCheckpoints);
  }
}

function createTurntablePropeller(turntable, spinInputZone) {
  destroyTurntablePropeller();

  const PropellerConstructor = window.Propeller;
  if (typeof PropellerConstructor !== "function") {
    throw new Error("Propeller.js를 불러오지 못했습니다.");
  }

  propellerInstance = new PropellerConstructor(turntable.querySelector(".lv13-platter"), {
    angle: 0,
    speed: 0,
    inertia: CONFIG.propellerInertia,
    minimalSpeed: CONFIG.propellerMinimalSpeed,
    touchElement: `#${spinInputZone.id}`,
    onRotate: handlePropellerRotate,
    onDragStart: handlePropellerDragStart,
    onDragStop: handlePropellerDragStop,
  });

  // START 전에는 설명 화면 뒤에서 조작되지 않도록 입력만 잠급니다.
  propellerInstance.unbind();
}

function handlePropellerRotate() {
  angularVelocity = this.speed;

  if (!this.active || Math.abs(this.speed) < CONFIG.propellerMinimalSpeed) return;

  // Propeller는 updateAngleToMouse()에서 드래그 속도를 계산한 직후 같은 프레임에
  // inertia를 곱합니다. 감쇠 전 입력 속도를 복원해 두었다가 손을 놓을 때 사용합니다.
  latestDragVelocity = this.speed / CONFIG.propellerInertia;
  latestDragVelocityAt = performance.now();
}

function handlePropellerDragStart() {
  // 이전 관성과 이전 스와이프의 속도 기록을 모두 제거합니다.
  // stop()은 active 상태까지 해제하므로 사용하지 않습니다.
  this.speed = 0;
  angularVelocity = 0;
  latestDragVelocity = 0;
  latestDragVelocityAt = 0;

  if (!running) return;
}

function handlePropellerDragStop() {
  if (!running || !propellerInstance) return;

  const sampleAge = performance.now() - latestDragVelocityAt;
  const hasFreshReleaseVelocity = latestDragVelocityAt > 0
    && sampleAge <= CONFIG.releaseSampleMaxAgeMs;

  if (hasFreshReleaseVelocity) {
    const releaseVelocity = clamp(
      latestDragVelocity * CONFIG.releaseVelocityMultiplier,
      -CONFIG.releaseVelocityMax,
      CONFIG.releaseVelocityMax,
    );
    propellerInstance.speed = releaseVelocity;
  } else {
    // 움직이지 않고 잡았다 놓은 경우에는 정지 상태를 유지합니다.
    propellerInstance.speed = 0;
  }

  angularVelocity = propellerInstance.speed;
  latestDragVelocity = 0;
  latestDragVelocityAt = 0;

  if (Math.abs(angularVelocity) < CONFIG.spinThreshold) return;

  const direction = angularVelocity > 0 ? "right" : "left";
  const power = clamp(
    Math.abs(angularVelocity) / CONFIG.propellerMaxReferenceSpeed,
    0.2,
    1,
  );

  playLv13SpinSound(direction, power);
  pulseTurntable(direction);

  // 방향 전환을 위해 플래터를 잡고 다시 놓는 동작 자체는 실패가 아닙니다.
  // 성공/실패는 내려오는 노드의 checkpoint에서만 판정합니다.
}

function resetTurntablePropeller() {
  angularVelocity = 0;
  latestDragVelocity = 0;
  latestDragVelocityAt = 0;
  if (!propellerInstance) return;
  propellerInstance.speed = 0;
  propellerInstance.angle = 0;
}

function destroyTurntablePropeller() {
  latestDragVelocity = 0;
  latestDragVelocityAt = 0;
  if (!propellerInstance) return;
  propellerInstance.unbind();
  propellerInstance.speed = 0;
  propellerInstance = null;
}

function pulseTurntable(direction) {
  const wrap = document.getElementById("lv13TurntableWrap");
  if (!wrap) return;
  wrap.classList.remove("spin-left", "spin-right");
  void wrap.offsetWidth;
  wrap.classList.add(direction === "left" ? "spin-left" : "spin-right");
  schedule(() => wrap.classList.remove("spin-left", "spin-right"), 520);
}


function showFeedback(success, direction) {
  const feedback = document.getElementById("lv13Feedback");
  const arena = document.getElementById("lv13Arena");
  if (!feedback || !arena) return;
  window.clearTimeout(feedbackTimer);
  feedback.className = `lv13-feedback is-visible ${success ? "is-success" : "is-fail"}`;
  const title = feedback.querySelector("strong");
  const subtitle = feedback.querySelector("span");
  if (title) title.textContent = success ? "NICE SPIN" : "SOFT MISS";
  if (subtitle) subtitle.textContent = success
    ? (direction === "left" ? "LEFT FLOW PERFECT" : "RIGHT FLOW PERFECT")
    : (direction === "early" ? "WAIT FOR THE SPIN ZONE" : "MATCH THE ARROW");
  arena.classList.remove("is-success", "is-fail");
  void arena.offsetWidth;
  arena.classList.add(success ? "is-success" : "is-fail");
  feedbackTimer = window.setTimeout(() => {
    feedback.className = "lv13-feedback";
    arena.classList.remove("is-success", "is-fail");
  }, 680);
}

function finishGame(id) {
  if (!isActive(id)) return;
  running = false;
  if (propellerInstance) propellerInstance.speed *= 0.45;
  setText("lv13RoundText", "COMPLETE");
  setText("lv13StatusText", hadFailure ? "모든 노드가 지나갔습니다. 흐름을 다시 맞춰 보세요." : "모든 회전 흐름을 정확히 연결했습니다.");

  const result = document.getElementById("lv13Result");
  const next = document.getElementById("lv13NextButton");
  const retry = document.getElementById("lv13RetryButton");
  if (!result || !next || !retry) return;

  if (hadFailure) {
    setText("lv13ResultKicker", "ONE MORE FLOW");
    setText("lv13ResultTitle", "조금만 더 부드럽게");
    setText("lv13ResultDescription", "실패한 구간이 있습니다. 화살표가 판정선에 닿는 동안 같은 방향으로 돌려 주세요.");
    next.setAttribute("hidden", "");
    retry.removeAttribute("hidden");
  } else {
    setText("lv13ResultKicker", "ALL COMPLETE");
    setText("lv13ResultTitle", "완벽한 스핀입니다");
    setText("lv13ResultDescription", "연속해서 내려온 모든 화살표의 흐름을 정확하게 이어냈습니다.");
    retry.setAttribute("hidden", "");
    next.removeAttribute("hidden");
  }
  result.removeAttribute("hidden");
}

function cancelGame() {
  running = false;
  latestDragVelocity = 0;
  latestDragVelocityAt = 0;
  gameId += 1;
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  if (frameId) cancelAnimationFrame(frameId);
  frameId = 0;
  window.clearTimeout(feedbackTimer);
  activeNodes.forEach((state) => state.node.remove());
  activeNodes.clear();
  if (propellerInstance) {
    propellerInstance.unbind();
    propellerInstance.speed = 0;
  }
}

function schedule(callback, delay) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
  return timer;
}

function isActive(id) {
  return running && id === gameId;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}
