import lv14Style from "../../../assets/scss/game/lv14/common.scss?inline";
import lv14Template from "./lv14.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv14FailSound,
  playLv14HitSound,
  playLv14StepSound,
  playStartSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/sound.js";

const DIRECTIONS = ["left", "down", "up", "right"];
const GLYPHS = { left: "←", down: "↓", up: "↑", right: "→" };
const COLORS = {
  left: "#f1abc4",
  down: "#a8dcca",
  up: "#b1c9ef",
  right: "#d0b9eb",
};

const STEPS = Object.freeze([
  { number: 1, count: 6, duration: 3300, gapMin: 780, gapMax: 1120 },
  { number: 2, count: 7, duration: 2920, gapMin: 680, gapMax: 980 },
  { number: 3, count: 8, duration: 2580, gapMin: 590, gapMax: 860 },
  { number: 4, count: 9, duration: 2260, gapMin: 510, gapMax: 760 },
]);

let gameId = 0;
let running = false;
let timers = new Set();
let frameId = 0;
let viewportController = null;
let inputController = null;
let activeNodes = new Map();
let sequence = [];
let resolvedCount = 0;
let completedCount = 0;
let successfulCount = 0;
let hadFailure = false;
let feedbackTimer = 0;

export function renderPage() {
  cancelGame();
  renderView(lv14Template, lv14Style);
  bindViewportHeight();
  bindPage();
}

function bindViewportHeight() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv14Page");
    if (!page) return;
    const height = window.visualViewport?.height ?? window.innerHeight;
    page.style.setProperty("--lv14-viewport-height", `${Math.round(height)}px`);
  };
  sync();
  window.addEventListener("resize", sync, { passive: true, signal });
  window.addEventListener("orientationchange", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true, signal });
}

function bindPage() {
  inputController?.abort();
  inputController = new AbortController();
  const { signal } = inputController;
  const start = document.getElementById("lv14StartButton");
  const retry = document.getElementById("lv14RetryButton");
  const next = document.getElementById("lv14NextButton");
  const home = document.getElementById("lv14HomeButton");
  const receptors = document.getElementById("lv14Receptors");
  if (!start || !retry || !next || !home || !receptors) return;

  unlockSoundOnNextGesture();
  start.addEventListener("click", startGame);
  retry.addEventListener("click", startGame);
  next.addEventListener("click", () => {
    cancelGame();
    navigate("lv15", { replace: true });
  });
  home.addEventListener("click", () => {
    cancelGame();
    navigate("home", { replace: true });
  });
  receptors.addEventListener("pointerdown", handleReceptorInput, { signal });
  document.addEventListener("keydown", handleKeyboardInput, { signal });
}

async function startGame() {
  cancelGame();
  const id = ++gameId;
  running = true;
  sequence = createSequence();
  activeNodes = new Map();
  resolvedCount = 0;
  completedCount = 0;
  successfulCount = 0;
  hadFailure = false;

  document.getElementById("lv14Ready")?.setAttribute("hidden", "");
  document.getElementById("lv14Result")?.setAttribute("hidden", "");
  document.getElementById("lv14NodeLayer")?.replaceChildren();
  setArenaStep(1);
  setText("lv14StepText", "GET READY");
  setText("lv14ScoreText", `0 / ${sequence.length}`);
  setText("lv14StatusText", "첫 화살표를 기다려 주세요.");

  await readySound();
  if (!isActive(id)) return;
  playStartSound();
  frameId = requestAnimationFrame((time) => gameLoop(id, time));
  scheduleSequence(id);
}

function createSequence() {
  const items = [];
  let previousDirection = "";
  let globalIndex = 0;

  STEPS.forEach((step) => {
    for (let index = 0; index < step.count; index += 1) {
      let direction = DIRECTIONS[randomInt(0, DIRECTIONS.length - 1)];
      if (direction === previousDirection && Math.random() < 0.72) {
        direction = DIRECTIONS[(DIRECTIONS.indexOf(direction) + randomInt(1, 3)) % DIRECTIONS.length];
      }
      previousDirection = direction;
      items.push({
        globalIndex,
        step: step.number,
        stepIndex: index,
        direction,
        duration: step.duration,
        gapAfter: randomInt(step.gapMin, step.gapMax),
      });
      globalIndex += 1;
    }
  });
  return items;
}

function scheduleSequence(id) {
  let elapsed = 720;
  sequence.forEach((item, index) => {
    schedule(() => spawnNode(id, item), elapsed);
    if (index < sequence.length - 1) elapsed += item.gapAfter;
  });
}

function spawnNode(id, item) {
  if (!isActive(id)) return;
  const layer = document.getElementById("lv14NodeLayer");
  if (!layer) return;

  setArenaStep(item.step);
  setText("lv14StepText", `STEP ${item.step} · ${item.stepIndex + 1}/${STEPS[item.step - 1].count}`);
  setText("lv14StatusText", stepMessage(item.step));
  playLv14StepSound(item.globalIndex, item.step);

  const node = document.createElement("div");
  node.className = `lv14-node is-${item.direction}`;
  node.dataset.nodeIndex = String(item.globalIndex);
  node.dataset.direction = item.direction;
  node.style.setProperty("--node-color", COLORS[item.direction]);
  node.innerHTML = `<span>${GLYPHS[item.direction]}</span><i></i>`;
  layer.appendChild(node);

  activeNodes.set(item.globalIndex, {
    item,
    node,
    startedAt: performance.now(),
    resolved: false,
    completed: false,
  });
}

function gameLoop(id, time) {
  if (!isActive(id)) return;
  activeNodes.forEach((state) => updateNode(id, state, time));
  frameId = requestAnimationFrame((nextTime) => gameLoop(id, nextTime));
}

function updateNode(id, state, time) {
  if (state.completed || !state.node.isConnected) return;
  const arena = document.getElementById("lv14Arena");
  const receptor = document.querySelector(`.lv14-receptor[data-direction="${state.item.direction}"]`);
  if (!arena || !receptor) return;

  const arenaRect = arena.getBoundingClientRect();
  const receptorRect = receptor.getBoundingClientRect();
  const nodeHeight = state.node.getBoundingClientRect().height || receptorRect.height;
  const startY = -nodeHeight - 12;
  const endY = arenaRect.height + nodeHeight * 0.45;
  const progress = Math.min(1, (time - state.startedAt) / state.item.duration);
  const y = startY + (endY - startY) * progress;
  state.node.style.transform = `translate3d(0, ${y}px, 0)`;
  state.node.style.opacity = String(Math.min(1, progress * 9));

  if (!state.resolved) {
    const overlap = overlapRatio(state.node.getBoundingClientRect(), receptorRect);
    const passed = state.node.getBoundingClientRect().top > receptorRect.bottom;
    if (passed) resolveNode(state, false, "MISS");
  }

  if (progress >= 1) {
    state.completed = true;
    completedCount += 1;
    state.node.classList.add("is-finished");
    schedule(() => state.node.remove(), 260);
    if (completedCount >= sequence.length) schedule(() => finishGame(id), 620);
  }
}

function handleReceptorInput(event) {
  const button = event.target.closest(".lv14-receptor");
  if (!button || !running) return;
  event.preventDefault();
  processReceptorInput(button);
}

function handleKeyboardInput(event) {
  if (!running || event.repeat) return;

  const directionByKey = {
    ArrowLeft: "left",
    ArrowDown: "down",
    ArrowUp: "up",
    ArrowRight: "right",
  };
  const direction = directionByKey[event.key];
  if (!direction) return;

  event.preventDefault();
  const button = document.querySelector(`.lv14-receptor[data-direction="${direction}"]`);
  if (button) processReceptorInput(button);
}

function processReceptorInput(button) {
  const direction = button.dataset.direction;
  const receptorRect = button.getBoundingClientRect();
  const candidates = [...activeNodes.values()]
    .filter((state) => !state.resolved && state.item.direction === direction && state.node.isConnected)
    .map((state) => ({ state, ratio: overlapRatio(state.node.getBoundingClientRect(), receptorRect) }))
    .sort((a, b) => b.ratio - a.ratio);

  const best = candidates[0];
  if (best?.ratio >= 0.5) {
    resolveNode(best.state, true, "PERFECT");
    pulseReceptor(button, true);
    return;
  }

  hadFailure = true;
  pulseReceptor(button, false);
  showFeedback(false, "TOO EARLY / LATE", direction);
  playLv14FailSound(resolvedCount + 1, direction);
}

function resolveNode(state, success, label) {
  if (state.resolved) return;
  state.resolved = true;
  resolvedCount += 1;

  if (success) {
    successfulCount += 1;
    state.node.classList.add("is-hit");
    showFeedback(true, label, state.item.direction);
    playLv14HitSound(successfulCount, state.item.direction, state.item.step);
  } else {
    hadFailure = true;
    state.node.classList.add("is-miss");
    showFeedback(false, label, state.item.direction);
    playLv14FailSound(resolvedCount, state.item.direction);
  }

  setText("lv14ScoreText", `${resolvedCount} / ${sequence.length}`);
}

function finishGame(id) {
  if (!isActive(id)) return;
  running = false;
  cancelAnimationFrame(frameId);
  frameId = 0;

  const perfect = !hadFailure && successfulCount === sequence.length;
  setText("lv14ResultKicker", perfect ? "ALL PERFECT" : "RHYTHM COMPLETE");
  setText("lv14ResultTitle", perfect ? "완벽한 스텝입니다" : "리듬을 다시 맞춰 볼까요?");
  setText(
    "lv14ResultDescription",
    perfect
      ? `${sequence.length}개의 화살표를 모두 정확한 타이밍에 터치했습니다.`
      : `${successfulCount} / ${sequence.length} 성공 · 한 번이라도 놓치면 RETRY입니다.`,
  );

  const next = document.getElementById("lv14NextButton");
  const retry = document.getElementById("lv14RetryButton");
  if (next) next.hidden = !perfect;
  if (retry) retry.hidden = perfect;
  document.getElementById("lv14Result")?.removeAttribute("hidden");
}

function setArenaStep(step) {
  const arena = document.getElementById("lv14Arena");
  if (!arena) return;
  arena.classList.remove("is-step-1", "is-step-2", "is-step-3", "is-step-4");
  arena.classList.add(`is-step-${step}`);
}

function stepMessage(step) {
  if (step === 1) return "화살표의 전체 이동을 보고 리듬을 익혀 주세요.";
  if (step === 2) return "하단이 완전히 가려집니다. 속도와 방향을 기억하세요.";
  if (step === 3) return "상단이 완전히 가려집니다. 나타난 순간의 흐름을 이어가세요.";
  return "상·하단이 완전히 가려집니다. 중앙에서 리듬을 읽어 주세요.";
}

function overlapRatio(nodeRect, receptorRect) {
  const overlapHeight = Math.max(0, Math.min(nodeRect.bottom, receptorRect.bottom) - Math.max(nodeRect.top, receptorRect.top));
  return overlapHeight / Math.max(1, nodeRect.height);
}

function pulseReceptor(button, success) {
  button.classList.remove("is-good", "is-bad");
  void button.offsetWidth;
  button.classList.add(success ? "is-good" : "is-bad");
  schedule(() => button.classList.remove("is-good", "is-bad"), 420);
}

function showFeedback(success, label, direction) {
  const feedback = document.getElementById("lv14Feedback");
  if (!feedback) return;
  window.clearTimeout(feedbackTimer);
  feedback.classList.remove("is-good", "is-bad", "is-showing");
  void feedback.offsetWidth;
  feedback.querySelector("strong").textContent = success ? label : "MISS";
  feedback.querySelector("span").textContent = success ? `${GLYPHS[direction]} BEAUTIFUL TIMING` : label;
  feedback.classList.add(success ? "is-good" : "is-bad", "is-showing");
  feedbackTimer = window.setTimeout(() => feedback.classList.remove("is-showing"), 520);
}

function cancelGame() {
  running = false;
  gameId += 1;
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  window.clearTimeout(feedbackTimer);
  if (frameId) cancelAnimationFrame(frameId);
  frameId = 0;
  activeNodes.forEach((state) => state.node.remove());
  activeNodes.clear();
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

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
