import lv12Style from "../../../assets/scss/game/lv12/common.scss?inline";
import lv12Template from "./lv12.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv12ApproachSound,
  playLv12FailSound,
  playLv12SuccessSound,
  playStartSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/sound.js";

const CONFIG = Object.freeze({
  targetCount: 12,
  flyDurationMinMs: 2500,
  flyDurationMaxMs: 3400,
  spawnIntervalMinMs: 520,
  spawnIntervalMaxMs: 940,
  longSpawnGapChance: 0.24,
  longSpawnGapMinMs: 1080,
  longSpawnGapMaxMs: 1480,
  hitOpenRatio: 0.18,
  minSwipeDistance: 42,
  directionDotMin: 0.68,
  hitPaddingMin: 22,
});

const POSITIONS = [
  { name: "left-top", x: -0.34, y: -0.29 },
  { name: "left-center", x: -0.38, y: 0 },
  { name: "left-bottom", x: -0.34, y: 0.29 },
  { name: "right-top", x: 0.34, y: -0.29 },
  { name: "right-center", x: 0.38, y: 0 },
  { name: "right-bottom", x: 0.34, y: 0.29 },
];

const DIRECTIONS = {
  up: { x: 0, y: -1, glyph: "➜", rotation: -90 },
  down: { x: 0, y: 1, glyph: "➜", rotation: 90 },
  left: { x: -1, y: 0, glyph: "➜", rotation: 180 },
  right: { x: 1, y: 0, glyph: "➜", rotation: 0 },
};

const COLORS = ["#f2b8c9", "#a8ddcf", "#abc9ee", "#cbb9ea", "#f4d58d", "#efbea4"];

let gameId = 0;
let timers = new Set();
let viewportController = null;
let running = false;
let sequence = [];
let activeTargets = new Map();
let spawnedCount = 0;
let resolvedCount = 0;
let completedFlightCount = 0;
let successCount = 0;
let hadFailure = false;
let pointerState = null;

export function renderPage() {
  cancelGame();
  renderView(lv12Template, lv12Style);
  bindViewportHeight();
  bindPage();
}

function bindViewportHeight() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv12Page");
    if (!page) return;
    const height = window.visualViewport?.height ?? window.innerHeight;
    page.style.setProperty("--lv12-viewport-height", `${Math.round(height)}px`);
  };
  sync();
  window.addEventListener("resize", sync, { passive: true, signal });
  window.addEventListener("orientationchange", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true, signal });
}

function bindPage() {
  const start = document.getElementById("lv12StartButton");
  const retry = document.getElementById("lv12RetryButton");
  const next = document.getElementById("lv12NextButton");
  const home = document.getElementById("lv12HomeButton");
  const arena = document.getElementById("lv12Arena");
  if (!start || !retry || !next || !home || !arena) return;

  unlockSoundOnNextGesture();
  start.addEventListener("click", startGame);
  retry.addEventListener("click", startGame);
  next.addEventListener("click", () => {
    cancelGame();
    navigate("lv13", { replace: true });
  });
  home.addEventListener("click", () => {
    cancelGame();
    navigate("home", { replace: true });
  });

  arena.addEventListener("pointerdown", handlePointerDown);
  arena.addEventListener("pointermove", handlePointerMove);
  arena.addEventListener("pointerup", handlePointerUp);
  arena.addEventListener("pointercancel", clearPointer);
}

async function startGame() {
  cancelGame();
  const id = ++gameId;
  running = true;
  sequence = createSequence();
  activeTargets = new Map();
  spawnedCount = 0;
  resolvedCount = 0;
  completedFlightCount = 0;
  successCount = 0;
  hadFailure = false;
  pointerState = null;

  document.getElementById("lv12Ready")?.setAttribute("hidden", "");
  document.getElementById("lv12Result")?.setAttribute("hidden", "");
  document.getElementById("lv12NodeLayer")?.replaceChildren();
  document.getElementById("lv12SlashLayer")?.replaceChildren();
  setText("lv12RoundText", "GET READY");
  setText("lv12ScoreText", `0 / ${CONFIG.targetCount}`);
  setText("lv12StatusText", "노드는 멈추지 않습니다. 날아오는 순서대로 베어 주세요.");

  await readySound();
  if (!isActive(id)) return;
  playStartSound();
  scheduleSequence(id, 620);
}

function createSequence() {
  const sequenceItems = [];
  const iphone = isIPhone();
  let previousPosition = -1;

  for (let index = 0; index < CONFIG.targetCount; index += 1) {
    let positionIndex = randomInt(0, POSITIONS.length - 1);
    if (positionIndex === previousPosition) {
      positionIndex = (positionIndex + randomInt(1, POSITIONS.length - 1)) % POSITIONS.length;
    }
    previousPosition = positionIndex;

    const pair = Math.random() < 0.46;
    const layout = pair && Math.random() < 0.5 ? "vertical" : "horizontal";
    const allowedDirections = pair
      ? layout === "vertical"
        ? ["up", "down"]
        : iphone ? ["left"] : ["left", "right"]
      : iphone ? ["up", "down", "left"] : Object.keys(DIRECTIONS);
    const direction = allowedDirections[randomInt(0, allowedDirections.length - 1)];

    sequenceItems.push({
      index,
      position: POSITIONS[positionIndex],
      direction,
      pair,
      layout,
      diamond: Math.random() < 0.46,
      pairTilt: pair ? (Math.random() < 0.5 ? 45 : -45) : 0,
      color: COLORS[index % COLORS.length],
      duration: randomInt(CONFIG.flyDurationMinMs, CONFIG.flyDurationMaxMs),
    });
  }
  return sequenceItems;
}

function scheduleSequence(id, initialDelay) {
  let elapsed = initialDelay;
  sequence.forEach((item, index) => {
    schedule(() => spawnTarget(id, item), elapsed);
    if (index < sequence.length - 1) elapsed += createSpawnGap();
  });
}

function createSpawnGap() {
  if (Math.random() < CONFIG.longSpawnGapChance) {
    return randomInt(CONFIG.longSpawnGapMinMs, CONFIG.longSpawnGapMaxMs);
  }
  return randomInt(CONFIG.spawnIntervalMinMs, CONFIG.spawnIntervalMaxMs);
}

function spawnTarget(id, item) {
  if (!isActive(id)) return;
  const arena = document.getElementById("lv12Arena");
  const layer = document.getElementById("lv12NodeLayer");
  if (!arena || !layer) return;

  const rect = arena.getBoundingClientRect();
  const laneX = item.position.x * rect.width;
  const laneY = item.position.y * rect.height;
  const outwardFactor = 2.85;
  const endX = laneX * outwardFactor;
  const endY = laneY * outwardFactor;

  const group = document.createElement("div");
  group.className = "lv12-node-group";
  group.dataset.targetIndex = String(item.index);

  const nodeSet = document.createElement("div");
  nodeSet.className = `lv12-node-set${item.layout === "vertical" ? " is-vertical" : ""}${item.pair ? " is-pair" : ""}`;
  const pairRotation = item.pair && item.diamond ? item.pairTilt : 0;
  nodeSet.style.setProperty("--set-rotation", `${pairRotation}deg`);

  const count = item.pair ? 2 : 1;
  for (let index = 0; index < count; index += 1) {
    const node = document.createElement("div");
    node.className = "lv12-node";
    node.style.setProperty("--node-color", item.color);
    node.style.setProperty("--shape-rotation", !item.pair && item.diamond ? "45deg" : "0deg");
    node.style.setProperty("--set-counter-rotation", `${-pairRotation}deg`);
    node.style.setProperty("--arrow-rotation", `${DIRECTIONS[item.direction].rotation}deg`);
    node.innerHTML = `<b>${DIRECTIONS[item.direction].glyph}</b>`;
    nodeSet.appendChild(node);
  }
  group.appendChild(nodeSet);

  layer.appendChild(group);
  const startedAt = performance.now();
  const target = {
    id: item.index,
    item,
    group,
    startedAt,
    hitOpenAt: startedAt + item.duration * CONFIG.hitOpenRatio,
    resolved: false,
    flightCompleted: false,
    animation: null,
  };

  activeTargets.set(target.id, target);
  refreshTargetPriorities();
  spawnedCount += 1;
  setText("lv12RoundText", `FLYING ${spawnedCount} / ${CONFIG.targetCount}`);
  setText("lv12StatusText", item.pair
    ? `${item.layout === "vertical" ? "세로" : "가로"} 쌍을 한 번의 스와이프로 베어 주세요.`
    : "비행 중인 노드를 화살표 방향으로 베어 주세요.");
  playLv12ApproachSound(item.index, item.pair);

  target.animation = group.animate([
    {
      opacity: 0,
      filter: "blur(6px)",
      transform: "translate(-50%, -50%) translate3d(0, 0, 0) scale(.07)",
      offset: 0,
    },
    {
      opacity: 1,
      filter: "blur(1.5px)",
      transform: `translate(-50%, -50%) translate3d(${laneX * 0.56}px, ${laneY * 0.56}px, 0) scale(.62)`,
      offset: 0.42,
    },
    {
      opacity: 1,
      filter: "blur(0)",
      transform: `translate(-50%, -50%) translate3d(${laneX}px, ${laneY}px, 0) scale(1)`,
      offset: 0.7,
    },
    {
      opacity: 0.2,
      filter: "blur(1px)",
      transform: `translate(-50%, -50%) translate3d(${endX}px, ${endY}px, 0) scale(1.58)`,
      offset: 1,
    },
  ], {
    duration: item.duration,
    easing: "linear",
    fill: "forwards",
  });

  target.animation.onfinish = () => finishFlight(id, target);
  target.animation.oncancel = () => {};
}

function handlePointerDown(event) {
  if (!running || pointerState) return;
  const target = findTargetAtPoint(event.clientX, event.clientY);
  if (!target) return;

  event.preventDefault();
  event.currentTarget.setPointerCapture?.(event.pointerId);
  pointerState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    target,
  };
}

function findTargetAtPoint(x, y) {
  const now = performance.now();
  const candidates = [...activeTargets.values()]
    .filter((target) => !target.resolved && !target.flightCompleted && now >= target.hitOpenAt)
    .sort((a, b) => a.id - b.id);

  return candidates.find((target) => {
    const rect = target.group.getBoundingClientRect();
    const padding = Math.max(CONFIG.hitPaddingMin, Math.min(rect.width, rect.height) * 0.18);
    return x >= rect.left - padding && x <= rect.right + padding
      && y >= rect.top - padding && y <= rect.bottom + padding;
  }) ?? null;
}

function handlePointerMove(event) {
  if (!pointerState || pointerState.pointerId !== event.pointerId) return;
  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;
}

function handlePointerUp(event) {
  if (!pointerState || pointerState.pointerId !== event.pointerId) return;
  event.preventDefault();
  const state = pointerState;
  pointerState = null;
  const target = state.target;
  if (!target || target.resolved || target.flightCompleted) return;

  const dx = event.clientX - state.startX;
  const dy = event.clientY - state.startY;
  const distance = Math.hypot(dx, dy);
  const unitX = distance > 0 ? dx / distance : 0;
  const unitY = distance > 0 ? dy / distance : 0;
  const expected = DIRECTIONS[target.item.direction];
  const directionScore = unitX * expected.x + unitY * expected.y;
  const earliest = getEarliestUnresolvedTarget();
  const correctOrder = earliest?.id === target.id;
  const correctDirection = distance >= CONFIG.minSwipeDistance && directionScore >= CONFIG.directionDotMin;

  if (correctOrder && correctDirection) {
    resolveTarget(target, true, {
      startX: state.startX,
      startY: state.startY,
      endX: event.clientX,
      endY: event.clientY,
      distance,
    });
    return;
  }

  resolveTarget(target, false, null, correctOrder ? "direction" : "order");
}

function getEarliestUnresolvedTarget() {
  return [...activeTargets.values()]
    .filter((target) => !target.resolved && !target.flightCompleted)
    .sort((a, b) => a.id - b.id)[0] ?? null;
}

function refreshTargetPriorities() {
  const orderedTargets = [...activeTargets.values()]
    .filter((target) => !target.resolved && !target.flightCompleted)
    .sort((a, b) => a.id - b.id);

  activeTargets.forEach((target) => {
    target.group.classList.remove("is-current-target", "is-next-target", "is-later-target");
  });

  orderedTargets.forEach((target, index) => {
    if (index === 0) {
      target.group.classList.add("is-current-target");
      return;
    }
    if (index === 1) {
      target.group.classList.add("is-next-target");
      return;
    }
    target.group.classList.add("is-later-target");
  });
}

function isIPhone() {
  return /iPhone/i.test(navigator.userAgent);
}

function clearPointer() {
  pointerState = null;
}

function resolveTarget(target, success, swipe = null, failReason = "miss") {
  if (!target || target.resolved) return;
  target.resolved = true;
  resolvedCount += 1;
  refreshTargetPriorities();

  if (success) {
    successCount += 1;
    target.animation?.pause();
    target.group.classList.add("is-hit");
    target.fadeAnimation = target.group.animate([
      { opacity: 1, filter: "blur(0)" },
      { opacity: 0, filter: "blur(5px)" },
    ], {
      duration: 380,
      easing: "cubic-bezier(.2,.8,.2,1)",
      fill: "forwards",
    });
    showFeedback("BEAUTIFUL!", target.item.pair ? "ONE SWIPE · DOUBLE SLASH" : "CLEAN PASTEL SLASH", true);
    playLv12SuccessSound(target.id, target.item.pair);
    createSlash(swipe, target.item.color);
    pulseArena(true);
    schedule(() => target.group.classList.add("is-clearing"), 40);
    schedule(() => completeSuccessfulTarget(target), 410);
  } else {
    hadFailure = true;
    target.group.classList.add("is-failed-in-flight");
    const feedback = failReason === "order"
      ? ["TOO EARLY", "SLASH IN FLYING ORDER"]
      : failReason === "direction"
        ? ["OOPS!", "FOLLOW THE ARROW"]
        : ["MISSED", "THE NODE FLEW AWAY"];
    showFeedback(feedback[0], feedback[1], false);
    playLv12FailSound(target.id);
    pulseArena(false);
  }

  setText("lv12ScoreText", `${successCount} / ${CONFIG.targetCount}`);
}

function finishFlight(id, target) {
  if (!isActive(id) || target.flightCompleted) return;
  if (!target.resolved) resolveTarget(target, false, null, "miss");
  completeFlight(target);
}

function completeSuccessfulTarget(target) {
  if (!target || target.flightCompleted) return;
  target.animation?.cancel();
  target.fadeAnimation?.cancel();
  target.group.remove();
  completeFlight(target);
}

function completeFlight(target) {
  if (!target || target.flightCompleted) return;
  target.flightCompleted = true;
  completedFlightCount += 1;
  activeTargets.delete(target.id);
  target.group.remove();
  refreshTargetPriorities();
  checkRoundComplete();
}

function checkRoundComplete() {
  if (!running) return;
  if (spawnedCount < CONFIG.targetCount || completedFlightCount < CONFIG.targetCount) return;
  schedule(() => showResult(gameId), 520);
}

function createSlash(swipe, color) {
  if (!swipe) return;
  const arena = document.getElementById("lv12Arena");
  const layer = document.getElementById("lv12SlashLayer");
  if (!arena || !layer) return;
  const rect = arena.getBoundingClientRect();
  const sx = swipe.startX - rect.left;
  const sy = swipe.startY - rect.top;
  const angle = Math.atan2(swipe.endY - swipe.startY, swipe.endX - swipe.startX);
  const length = Math.max(swipe.distance, 90);

  const slash = document.createElement("i");
  slash.className = "lv12-slash";
  slash.style.setProperty("--sx", `${sx}px`);
  slash.style.setProperty("--sy", `${sy}px`);
  slash.style.setProperty("--length", `${length}px`);
  slash.style.setProperty("--angle", `${angle}rad`);
  slash.style.setProperty("--slash-color", color);
  layer.appendChild(slash);

  const particles = document.createElement("div");
  particles.className = "lv12-particles";
  particles.style.setProperty("--px", `${(swipe.startX + swipe.endX) / 2 - rect.left}px`);
  particles.style.setProperty("--py", `${(swipe.startY + swipe.endY) / 2 - rect.top}px`);
  particles.style.setProperty("--particle-color", color);
  particles.innerHTML = Array.from({ length: 10 }, (_, index) => `<i style="--i:${index}"></i>`).join("");
  layer.appendChild(particles);
  schedule(() => slash.remove(), 520);
  schedule(() => particles.remove(), 780);
}

function showFeedback(title, subtitle, success) {
  const feedback = document.getElementById("lv12Feedback");
  if (!feedback) return;
  feedback.querySelector("strong").textContent = title;
  feedback.querySelector("span").textContent = subtitle;
  feedback.className = `lv12-feedback ${success ? "is-success" : "is-fail"}`;
  void feedback.offsetWidth;
  feedback.classList.add("is-visible");
}

function pulseArena(success) {
  const arena = document.getElementById("lv12Arena");
  if (!arena) return;
  arena.classList.remove("is-success", "is-fail");
  void arena.offsetWidth;
  arena.classList.add(success ? "is-success" : "is-fail");
}

function showResult(id) {
  if (!isActive(id)) return;
  running = false;
  const success = !hadFailure && successCount === CONFIG.targetCount;
  setText("lv12ResultKicker", success ? "ALL PERFECT" : "SLASH COMPLETE");
  setText("lv12ResultTitle", success ? "정말 잘 베어냈어요" : "조금만 더 또렷하게 베어 볼까요?");
  setText("lv12ResultDescription", success
    ? `${CONFIG.targetCount}개의 노드를 날아오는 순서와 방향에 맞춰 모두 베어냈습니다.`
    : `${CONFIG.targetCount}개의 노드 중 ${successCount}개를 정확하게 베어냈습니다. 놓친 노드도 멈추지 않고 그대로 화면 밖으로 날아갔습니다.`);
  document.getElementById("lv12NextButton")?.toggleAttribute("hidden", !success);
  document.getElementById("lv12RetryButton")?.toggleAttribute("hidden", success);
  document.getElementById("lv12Result")?.removeAttribute("hidden");
}

function cancelGame() {
  running = false;
  gameId += 1;
  pointerState = null;
  activeTargets.forEach((target) => {
    target.animation?.cancel();
    target.fadeAnimation?.cancel();
  });
  activeTargets.clear();
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  document.getElementById("lv12NodeLayer")?.replaceChildren();
  document.getElementById("lv12SlashLayer")?.replaceChildren();
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
  return running && id === gameId && Boolean(document.getElementById("lv12Page"));
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
