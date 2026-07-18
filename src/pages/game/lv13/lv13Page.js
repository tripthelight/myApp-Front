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
  spawnGapMinMs: 900,
  spawnGapMaxMs: 1550,
  initialDelayMs: 650,
  spinThreshold: 0.12,
  propellerInertia: 0.985,
  propellerMinimalSpeed: 0.035,
  propellerMaxReferenceSpeed: 18,
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
    const checkpointCount = randomInt(2, 4);
    const checkpoints = Array.from({ length: checkpointCount }, (_, checkpointIndex) => ({
      progress: 0.72 + (checkpointIndex / Math.max(1, checkpointCount - 1)) * 0.16,
      direction,
      resolved: false,
    }));

    return {
      index,
      type: "wide",
      direction,
      duration,
      color: COLORS[index % COLORS.length],
      checkpoints,
    };
  });
}

function scheduleSequence(id) {
  let elapsed = CONFIG.initialDelayMs;
  sequence.forEach((item, index) => {
    schedule(() => spawnNode(id, item), elapsed);
    if (index < sequence.length - 1) {
      // 화살표 노드는 화면 안에 여러 개가 이어서 보일 수 있지만,
      // 판정 구간이 겹쳐 서로 반대 방향을 동시에 요구하지 않도록 간격을 둡니다.
      elapsed += randomInt(CONFIG.spawnGapMinMs, CONFIG.spawnGapMaxMs);
    }
  });
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

  node.style.setProperty("--wide-height", `${randomInt(82, 168)}px`);
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
}

function handlePropellerDragStart() {
  if (!running) {
    this.stop();
    return;
  }
  angularVelocity = 0;
}

function handlePropellerDragStop() {
  if (!running || !propellerInstance) return;

  angularVelocity = propellerInstance.speed;
  if (Math.abs(angularVelocity) < CONFIG.spinThreshold) return;

  const direction = angularVelocity > 0 ? "right" : "left";
  const power = clamp(
    Math.abs(angularVelocity) / CONFIG.propellerMaxReferenceSpeed,
    0.2,
    1,
  );

  playLv13SpinSound(direction, power);
  pulseTurntable(direction);

  if (!hasPendingHitWindow()) {
    hadFailure = true;
    showFeedback(false, "early");
    playLv13FailSound(resolvedCheckpoints + 1);
  }
}

function resetTurntablePropeller() {
  angularVelocity = 0;
  if (!propellerInstance) return;
  propellerInstance.speed = 0;
  propellerInstance.angle = 0;
}

function destroyTurntablePropeller() {
  if (!propellerInstance) return;
  propellerInstance.unbind();
  propellerInstance.speed = 0;
  propellerInstance = null;
}

function hasPendingHitWindow() {
  const now = performance.now();
  return [...activeNodes.values()].some((state) => {
    if (state.completed) return false;
    const progress = (now - state.startedAt) / state.item.duration;
    return state.item.checkpoints.some((checkpoint) => !checkpoint.resolved && Math.abs(progress - checkpoint.progress) <= 0.16);
  });
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
