import lv25Style from "../../../assets/scss/game/lv25/common.scss?inline";
import lv25Template from "./lv25.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv25Fail,
  playLv25Finish,
  playLv25Move,
  playLv25Success,
  playStartSound,
  readySound,
  stopLv25Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv25Sound.js";

const ROUND_COUNTS = Object.freeze([3, 4, 5]);
const PASTELS = Object.freeze([
  "#a9d9f2", "#c7b5ed", "#a9dfcd", "#efb8c8", "#f2d292",
  "#b8c8f2", "#d7b5e7", "#b9e1a8", "#efc2a6", "#9fdedb",
]);
const ROUND_INTRO_MS = 1050;
const BETWEEN_ROUNDS_MS = 1050;
const ROUND_MOTION = Object.freeze([
  Object.freeze({ durationBase: 920, durationViewportRatio: .16, nextGap: 165 }),
  Object.freeze({ durationBase: 790, durationViewportRatio: .13, nextGap: 15 }),
  Object.freeze({ durationBase: 660, durationViewportRatio: .10, nextGap: 0 }),
]);

let gameToken = 0;
let running = false;
let currentRound = 0;
let totalFailures = 0;
let roundState = null;
let timers = new Set();
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let mountedPathname = "";
let routeWatchTimer = 0;
let resizeFrame = 0;
let layoutMode = "landscape";
let layoutRestartTimer = 0;
let viewportWidth = 0;
let viewportHeight = 0;

export function renderPage() {
  destroyPage();
  renderView(lv25Template, lv25Style);
  mountedPathname = window.location.pathname;
  bindLifecycle();
  bindViewport();
  bindControls();
  prepareReadyState();
}

function bindLifecycle() {
  lifecycleController?.abort();
  lifecycleController = new AbortController();
  const { signal } = lifecycleController;
  const leave = () => destroyPage();
  window.addEventListener("popstate", leave, { signal });
  window.addEventListener("pagehide", leave, { signal });
  window.addEventListener("beforeunload", leave, { signal });
  window.clearInterval(routeWatchTimer);
  routeWatchTimer = window.setInterval(() => {
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv25Page")) destroyPage();
  }, 100);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv25Page");
    if (!page) return;
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    const nextMode = height > width ? "portrait" : "landscape";
    const hadViewport = viewportWidth > 0 && viewportHeight > 0;
    const sizeChanged = hadViewport
      && (Math.abs(width - viewportWidth) > 1 || Math.abs(height - viewportHeight) > 1);

    viewportWidth = width;
    viewportHeight = height;
    page.style.setProperty("--lv25-vw", `${width}px`);
    page.style.setProperty("--lv25-vh", `${height}px`);
    page.classList.toggle("is-portrait", nextMode === "portrait");
    page.classList.toggle("is-landscape", nextMode === "landscape");
    layoutMode = nextMode;

    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      page.style.setProperty("--lv25-scale", String(Math.min(1, Math.max(.72, Math.min(width / 980, height / 720)))));
      if (sizeChanged) queueCurrentRoundLayoutRestart();
      else updateDirectionCopy();
    });
  };
  sync();
  window.addEventListener("resize", sync, { passive: true, signal });
  window.addEventListener("orientationchange", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true, signal });
}

function queueCurrentRoundLayoutRestart() {
  if (!running || !roundState || roundState.finalized) {
    updateDirectionCopy();
    return;
  }

  const state = roundState;
  state.layoutRestartPending = true;
  state.targetMoving = false;
  clearRoundTimers(state);
  state.animation?.pause();
  setText("lv25Phase", "ADJUST");
  setText("lv25Hint", layoutMode === "portrait"
    ? "화면 크기에 맞춰 아래에서 위로 다시 정렬합니다"
    : "화면 크기에 맞춰 오른쪽에서 왼쪽으로 다시 정렬합니다");

  window.clearTimeout(layoutRestartTimer);
  const token = gameToken;
  const roundIndex = currentRound;
  layoutRestartTimer = window.setTimeout(() => {
    layoutRestartTimer = 0;
    if (!isActive(token)) return;

    const activeState = roundState;
    if (activeState) {
      activeState.finalized = true;
      activeState.layoutRestartPending = false;
      clearRoundTimers(activeState);
      activeState.animation?.cancel();
    }
    roundState = null;
    clearStage();
    beginRound(token, roundIndex);
  }, 180);
}

function updateDirectionCopy() {
  if (running) return;
  setText("lv25Hint", layoutMode === "portrait"
    ? "마지막 사각형이 가운데 가로 영역을 지날 때 터치하세요"
    : "마지막 사각형이 가운데 세로 영역을 지날 때 터치하세요");
}

function bindControls() {
  inputController?.abort();
  inputController = new AbortController();
  const { signal } = inputController;
  unlockSoundOnNextGesture();
  document.getElementById("lv25StartButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv25RetryButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv25NextButton")?.addEventListener("click", () => { cancelGame(); navigate("lv26", { replace: true }); }, { signal });
  document.getElementById("lv25HomeButton")?.addEventListener("click", () => { cancelGame(); navigate("home", { replace: true }); }, { signal });
  document.getElementById("lv25Page")?.addEventListener("pointerdown", handleScreenPress, { signal });
  document.getElementById("lv25Page")?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

function prepareReadyState() {
  setText("lv25Phase", "READY");
  setText("lv25RoundText", "ROUND 1 / 3");
  setText("lv25Hint", layoutMode === "portrait"
    ? "마지막 사각형이 가운데 가로 영역을 지날 때 터치하세요"
    : "마지막 사각형이 가운데 세로 영역을 지날 때 터치하세요");
  setProgress(0);
  clearStage();
}

async function startGame() {
  cancelGame();
  const token = ++gameToken;
  running = true;
  currentRound = 0;
  totalFailures = 0;
  hide("lv25Ready");
  hide("lv25Result");
  hide("lv25RoundOverlay");
  document.getElementById("lv25Page")?.classList.add("is-playing");
  setProgress(0);
  setText("lv25Phase", "FOCUS");
  await readySound();
  if (!isActive(token)) return;
  playStartSound();
  schedule(() => beginRound(token, 0), 620);
}

function beginRound(token, roundIndex) {
  if (!isActive(token)) return;
  currentRound = roundIndex;
  clearStage();
  const count = ROUND_COUNTS[roundIndex];
  const data = createRoundData(count, roundIndex);
  const runners = renderRound(data);
  roundState = {
    roundIndex,
    count,
    runners,
    targetRunner: runners[runners.length - 1],
    activeIndex: -1,
    targetMoving: false,
    targetHit: false,
    tapped: false,
    failed: false,
    animation: null,
    finalized: false,
    layoutRestartPending: false,
    roundToken: Symbol(`lv25-round-${roundIndex + 1}`),
    roundTimers: new Set(),
  };
  setText("lv25Phase", "WATCH");
  setText("lv25RoundText", `ROUND ${roundIndex + 1} / 3`);
  setText("lv25Hint", layoutMode === "portrait"
    ? "아래의 사각형은 보내고, 마지막 같은 색만 기다리세요"
    : "오른쪽의 사각형은 보내고, 마지막 같은 색만 기다리세요");
  setProgress(roundIndex / ROUND_COUNTS.length);
  scheduleRound(roundState, () => moveRunner(token, 0, roundState.roundToken), roundIndex === 0 ? 850 : 520);
}

function createRoundData(count, roundIndex) {
  const stage = document.getElementById("lv25Stage");
  const axisLength = layoutMode === "portrait"
    ? (stage?.clientHeight || window.innerHeight)
    : (stage?.clientWidth || window.innerWidth);
  const waitingAreaLength = axisLength / 3;
  const edgePadding = Math.max(8, Math.min(18, axisLength * .018));
  const gap = getPackGap(axisLength, count);
  const sizeBudget = Math.max(count * 10, waitingAreaLength - edgePadding * 2 - gap * (count - 1));
  const minSize = Math.max(16, Math.round(axisLength * .036));
  const maxSize = Math.max(minSize + 10, Math.round(axisLength * (roundIndex === 2 ? .082 : .102)));
  const sizes = createDistinctSizes(count, minSize, maxSize, sizeBudget);
  const colors = shuffled(PASTELS).slice(0, count);
  return sizes.map((size, index) => ({ size, color: colors[index], isTarget: index === count - 1 }));
}

function getPackGap(axisLength, count) {
  const waitingAreaLength = axisLength / 3;
  return Math.max(3, Math.min(10, waitingAreaLength * .035, axisLength / Math.max(28, count * 18)));
}

function createDistinctSizes(count, minSize, maxSize, sizeBudget) {
  const safeBudget = Math.max(count * 10, sizeBudget);
  const targetTotal = Math.min(safeBudget, Math.max(count * 12, safeBudget * randomBetween(.82, .94)));
  const shuffledSteps = shuffled(Array.from({ length: count }, (_, index) => index));
  const weights = shuffledSteps.map((step) => {
    if (count === 1) return 1;
    return .68 + (step / (count - 1)) * .64;
  });
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  let sizes = weights.map((weight) => Math.round(targetTotal * weight / weightTotal));

  const preferredMin = Math.min(minSize, Math.floor(safeBudget / count));
  const preferredMax = Math.max(preferredMin, maxSize);
  sizes = sizes.map((size) => clamp(size, Math.max(10, preferredMin), preferredMax));

  let total = sizes.reduce((sum, value) => sum + value, 0);
  if (total > safeBudget) {
    const scale = safeBudget / total;
    sizes = sizes.map((size) => Math.max(10, Math.floor(size * scale)));
    total = sizes.reduce((sum, value) => sum + value, 0);
  }

  let remaining = Math.floor(safeBudget - total);
  const growOrder = shuffled(Array.from({ length: count }, (_, index) => index));
  let cursor = 0;
  while (remaining > 0 && growOrder.length) {
    const index = growOrder[cursor % growOrder.length];
    if (sizes[index] < preferredMax) {
      sizes[index] += 1;
      remaining -= 1;
    }
    cursor += 1;
    if (cursor > safeBudget * count) break;
  }
  return sizes;
}

function renderRound(data) {
  const layer = document.getElementById("lv25RunnerLayer");
  const target = document.getElementById("lv25Target");
  if (!layer || !target) return [];
  const axisLength = layoutMode === "portrait"
    ? (layer.clientHeight || window.innerHeight)
    : (layer.clientWidth || window.innerWidth);
  const gap = getPackGap(axisLength, data.length);
  const waitingAreaStart = axisLength * 2 / 3;
  const edgePadding = Math.max(8, Math.min(18, axisLength * .018));
  const packLength = data.reduce((sum, item) => sum + item.size, 0) + gap * Math.max(0, data.length - 1);
  const waitingAreaLength = axisLength / 3;
  const freeSpace = Math.max(0, waitingAreaLength - edgePadding * 2 - packLength);
  const packOrigin = waitingAreaStart + edgePadding + freeSpace / 2;
  let offset = 0;
  const elements = data.map((item, index) => {
    const element = document.createElement("div");
    element.className = `lv25-runner${item.isTarget ? " is-target-runner" : ""}`;
    element.dataset.index = String(index);
    element.style.setProperty("--runner-size", `${item.size}px`);
    element.style.setProperty("--runner-color", item.color);
    element.style.setProperty("--pack-offset", `${offset}px`);
    element.style.setProperty("--pack-origin", `${packOrigin}px`);
    element.style.transform = layoutMode === "portrait"
      ? `translate3d(0, ${packOrigin + offset}px, 0)`
      : `translate3d(${packOrigin + offset}px, 0, 0)`;
    layer.appendChild(element);
    offset += item.size + gap;
    return element;
  });
  const targetItem = data[data.length - 1];
  target.style.setProperty("--target-size", `${targetItem.size}px`);
  target.style.setProperty("--target-color", targetItem.color);
  target.classList.remove("is-hot", "is-success", "is-fail");
  return elements;
}

function moveRunner(token, index, expectedRoundToken) {
  const state = roundState;
  if (!isRoundActive(token, state, expectedRoundToken) || index >= state.runners.length) return;
  const runner = state.runners[index];
  const isTarget = index === state.runners.length - 1;
  state.activeIndex = index;
  state.targetMoving = isTarget;
  runner.classList.add("is-moving");
  if (isTarget) {
    runner.classList.add("is-final");
    setText("lv25Phase", "NOW");
    setText("lv25Hint", layoutMode === "portrait"
      ? "마지막 사각형이 가운데 가로 영역을 지날 때 터치하세요"
      : "마지막 사각형이 가운데 세로 영역을 지날 때 터치하세요");
  } else {
    setText("lv25Phase", "PASS");
  }
  playLv25Move(index, isTarget);

  const stage = document.getElementById("lv25Stage");
  const axisLength = layoutMode === "portrait"
    ? (stage?.clientHeight || window.innerHeight)
    : (stage?.clientWidth || window.innerWidth);
  const rect = runner.getBoundingClientRect();
  const size = layoutMode === "portrait" ? rect.height : rect.width;
  const packOffset = Number.parseFloat(runner.style.getPropertyValue("--pack-offset") || "0");
  const packOrigin = Number.parseFloat(runner.style.getPropertyValue("--pack-origin") || String(axisLength * 2 / 3));
  const start = packOrigin + packOffset;
  const end = -size - axisLength * .04;
  const motion = ROUND_MOTION[currentRound] ?? ROUND_MOTION[0];
  const duration = Math.round(motion.durationBase + axisLength * motion.durationViewportRatio);
  const fromTransform = layoutMode === "portrait"
    ? `translate3d(0, ${start}px, 0)`
    : `translate3d(${start}px, 0, 0)`;
  const toTransform = layoutMode === "portrait"
    ? `translate3d(0, ${end}px, 0)`
    : `translate3d(${end}px, 0, 0)`;

  state.animation = runner.animate([
    { transform: fromTransform },
    { transform: toTransform },
  ], { duration, easing: "cubic-bezier(.36,.02,.34,1)", fill: "forwards" });

  const target = document.getElementById("lv25Target");
  const middleStart = axisLength / 3;
  const middleEnd = axisLength * 2 / 3;
  const path = start - end;
  const enterProgress = clamp((start - middleEnd) / path, 0, 1);
  const leaveProgress = clamp((start + size - middleStart) / path, 0, 1);
  if (isTarget) {
    scheduleRound(state, () => {
      if (isRoundActive(token, state, expectedRoundToken)) target?.classList.add("is-hot");
    }, duration * enterProgress);
    scheduleRound(state, () => {
      if (isRoundActive(token, state, expectedRoundToken)) target?.classList.remove("is-hot");
    }, duration * leaveProgress);
  }

  state.animation.finished.then(() => {
    if (!isRoundActive(token, state, expectedRoundToken)) return;
    runner.classList.add("is-passed");
    if (isTarget) {
      state.targetMoving = false;
      target?.classList.remove("is-hot");
      if (!state.targetHit) markRoundFailure(false);
      finishRound(token);
    } else {
      scheduleRound(state, () => moveRunner(token, index + 1, expectedRoundToken), motion.nextGap);
    }
  }).catch(() => {});
}

function handleScreenPress(event) {
  if (!running || event.target.closest("button, .lv25-overlay")) return;
  event.preventDefault();
  showTouchPulse(event.clientX, event.clientY);
  const state = roundState;
  if (!state || state.finalized || state.layoutRestartPending || state.tapped) {
    if (state && !state.layoutRestartPending) markRoundFailure(true);
    return;
  }
  state.tapped = true;

  const runner = state.targetRunner;
  const target = document.getElementById("lv25Target");
  if (!state.targetMoving || !runner || !target) {
    markRoundFailure(true);
    return;
  }
  const runnerRect = runner.getBoundingClientRect();
  const stage = document.getElementById("lv25Stage");
  const stageRect = stage?.getBoundingClientRect();
  if (!stageRect) {
    markRoundFailure(true);
    return;
  }

  const isInsideMiddleArea = layoutMode === "portrait"
    ? runnerRect.bottom > stageRect.top + stageRect.height / 3
      && runnerRect.top < stageRect.top + stageRect.height * 2 / 3
    : runnerRect.right > stageRect.left + stageRect.width / 3
      && runnerRect.left < stageRect.left + stageRect.width * 2 / 3;

  if (isInsideMiddleArea) {
    state.targetHit = true;
    runner.classList.add("is-success");
    target.classList.remove("is-hot");
    target.classList.add("is-success");
    setText("lv25Phase", "PERFECT");
    setText("lv25Hint", "정확합니다. 흐름은 계속됩니다");
    playLv25Success();
  } else {
    markRoundFailure(true);
  }
}

function markRoundFailure(playSound = true) {
  const state = roundState;
  if (!state || state.failed) return;
  state.failed = true;
  totalFailures += 1;
  state.targetRunner?.classList.add("is-fail");
  document.getElementById("lv25Target")?.classList.add("is-fail");
  setText("lv25Phase", "MISS");
  setText("lv25Hint", "타이밍을 놓쳤지만 다음 ROUND까지 계속됩니다");
  if (playSound) playLv25Fail();
}

function finishRound(token) {
  const state = roundState;
  if (!isActive(token) || !state || state.finalized) return;
  state.finalized = true;
  state.targetMoving = false;
  clearRoundTimers(state);
  setProgress((state.roundIndex + 1) / ROUND_COUNTS.length);
  if (state.roundIndex < ROUND_COUNTS.length - 1) {
    schedule(() => showRoundTransition(token, state.roundIndex + 1), BETWEEN_ROUNDS_MS);
  } else {
    schedule(() => finishGame(token), BETWEEN_ROUNDS_MS);
  }
}

function showRoundTransition(token, nextRound) {
  if (!isActive(token)) return;
  const overlay = document.getElementById("lv25RoundOverlay");
  setText("lv25RoundTitle", `ROUND ${nextRound + 1}`);
  setText("lv25RoundSub", `${ROUND_COUNTS[nextRound]} RECTANGLES`);
  show("lv25RoundOverlay");
  overlay?.classList.remove("is-showing");
  void overlay?.offsetWidth;
  overlay?.classList.add("is-showing");
  schedule(() => {
    hide("lv25RoundOverlay");
    overlay?.classList.remove("is-showing");
    beginRound(token, nextRound);
  }, ROUND_INTRO_MS);
}

function finishGame(token) {
  if (!isActive(token)) return;
  running = false;
  roundState = null;
  document.getElementById("lv25Page")?.classList.remove("is-playing");
  const success = totalFailures === 0;
  setText("lv25Phase", success ? "COMPLETE" : "FINISHED");
  setText("lv25ResultTitle", success ? "PERFECT PASS" : "TRY THE FLOW AGAIN");
  setText("lv25ResultText", success
    ? "3개의 ROUND에서 마지막 사각형을 모두 정확한 순간에 잡았습니다."
    : `3개의 ROUND 중 ${totalFailures}번의 타이밍 실패가 기록되었습니다.`);
  toggleHidden("lv25NextButton", !success);
  toggleHidden("lv25RetryButton", success);
  show("lv25Result");
  playLv25Finish(success);
}

function showTouchPulse(x, y) {
  const pulse = document.getElementById("lv25TouchPulse");
  if (!pulse) return;
  pulse.style.left = `${x}px`;
  pulse.style.top = `${y}px`;
  pulse.classList.remove("is-visible");
  void pulse.offsetWidth;
  pulse.classList.add("is-visible");
}

function clearStage() {
  if (roundState) {
    roundState.finalized = true;
    clearRoundTimers(roundState);
  }
  const layer = document.getElementById("lv25RunnerLayer");
  if (layer) layer.replaceChildren();
  const target = document.getElementById("lv25Target");
  target?.classList.remove("is-hot", "is-success", "is-fail");
  roundState?.animation?.cancel();
  roundState = null;
}

function cancelGame() {
  running = false;
  gameToken += 1;
  window.clearTimeout(layoutRestartTimer);
  layoutRestartTimer = 0;
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  if (roundState) {
    roundState.finalized = true;
    clearRoundTimers(roundState);
    roundState.animation?.cancel();
  }
  roundState = null;
  stopLv25Sounds();
  document.getElementById("lv25Page")?.classList.remove("is-playing");
}

function destroyPage() {
  cancelGame();
  lifecycleController?.abort();
  inputController?.abort();
  viewportController?.abort();
  lifecycleController = null;
  inputController = null;
  viewportController = null;
  window.clearInterval(routeWatchTimer);
  window.cancelAnimationFrame(resizeFrame);
  routeWatchTimer = 0;
  viewportWidth = 0;
  viewportHeight = 0;
}

function scheduleRound(state, callback, delay) {
  if (!state || state.finalized) return 0;
  const timer = window.setTimeout(() => {
    state.roundTimers?.delete(timer);
    timers.delete(timer);
    if (!state.finalized && roundState === state) callback();
  }, Math.max(0, delay));
  state.roundTimers?.add(timer);
  timers.add(timer);
  return timer;
}

function clearRoundTimers(state) {
  state?.roundTimers?.forEach((timer) => {
    window.clearTimeout(timer);
    timers.delete(timer);
  });
  state?.roundTimers?.clear();
}

function isRoundActive(gameTokenValue, state, expectedRoundToken) {
  return Boolean(
    isActive(gameTokenValue)
    && state
    && !state.finalized
    && roundState === state
    && state.roundToken === expectedRoundToken
  );
}

function schedule(callback, delay) {
  const timer = window.setTimeout(() => { timers.delete(timer); callback(); }, Math.max(0, delay));
  timers.add(timer);
  return timer;
}
function isActive(token) { return running && token === gameToken && document.getElementById("lv25Page"); }
function setText(id, text) { const element = document.getElementById(id); if (element) element.textContent = text; }
function setProgress(value) { const element = document.getElementById("lv25Progress"); if (element) element.style.transform = `scaleX(${clamp(value, 0, 1)})`; }
function hide(id) { const element = document.getElementById(id); if (element) element.hidden = true; }
function show(id) { const element = document.getElementById(id); if (element) element.hidden = false; }
function toggleHidden(id, hidden) { const element = document.getElementById(id); if (element) element.hidden = hidden; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomBetween(min, max) { return min + Math.random() * (max - min); }
function shuffled(values) { return [...values].sort(() => Math.random() - .5); }
