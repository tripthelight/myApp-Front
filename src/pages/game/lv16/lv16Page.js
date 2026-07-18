import lv16Style from "../../../assets/scss/game/lv16/common.scss?inline";
import lv16Template from "./lv16.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv16PreviewSound,
  startLv16HoldSound,
  stopLv16HoldSound,
  playLv16SuccessSound,
  playLv16FailSound,
  stopLv16Sounds,
  playStartSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv16Sound.js";

const COLORS = Object.freeze([
  { bg: "#efbfd0", bar: "#f8dce7", deep: "#d990aa" },
  { bg: "#b9cdef", bar: "#dce9ff", deep: "#88a9dc" },
  { bg: "#addfce", bar: "#d8f5ea", deep: "#78bda6" },
  { bg: "#d0c1ee", bar: "#e9e1fb", deep: "#a48bd2" },
  { bg: "#f2d3ad", bar: "#fff0d8", deep: "#d9aa70" },
  { bg: "#b8dfeb", bar: "#dff5fb", deep: "#78b8ca" },
]);
const EASINGS = Object.freeze(["ease", "linear", "ease-in", "ease-out", "ease-in-out"]);
const STEP_COUNT = 4;
const PREVIEW_GAP = 320;
const TOLERANCE_PX_MIN = 7;
const TOLERANCE_RATIO = 0.035;
const STEP_TIME_LIMITS = Object.freeze([16, 15, 14, 13]);

let runId = 0;
let timers = new Set();
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let blocks = [];
let previewOrder = [];
let expectedIndex = 0;
let currentStep = 0;
let stepMistakes = 0;
let totalMistakes = 0;
let activeHold = null;
let running = false;
let acceptingInput = false;
let mountedPathname = "";
let routeWatchTimer = 0;
let stepTimerFrame = 0;
let stepDeadline = 0;

export function renderPage() {
  destroyPage();
  renderView(lv16Template, lv16Style);
  mountedPathname = window.location.pathname;
  bindLifecycle();
  bindViewport();
  bindControls();
  unlockSoundOnNextGesture();
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv16Page")) destroyPage();
  }, 90);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const sync = () => {
    const page = document.getElementById("lv16Page");
    if (!page) return;
    const height = window.visualViewport?.height ?? window.innerHeight;
    page.style.setProperty("--lv16-vh", `${Math.round(height)}px`);
  };
  sync();
  const { signal } = viewportController;
  window.addEventListener("resize", sync, { passive: true, signal });
  window.addEventListener("orientationchange", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true, signal });
}

function bindControls() {
  inputController?.abort();
  inputController = new AbortController();
  const { signal } = inputController;
  document.getElementById("lv16Start")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv16Retry")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv16Next")?.addEventListener("click", () => { cancelRun(); navigate("lv17", { replace: true }); }, { signal });
  document.getElementById("lv16Home")?.addEventListener("click", () => { cancelRun(); navigate("home", { replace: true }); }, { signal });
  const holder = document.getElementById("lv16Blocks");
  holder?.addEventListener("pointerdown", onPointerDown, { signal });
  holder?.addEventListener("pointerup", onPointerUp, { signal });
  holder?.addEventListener("pointercancel", onPointerUp, { signal });
  holder?.addEventListener("lostpointercapture", onPointerUp, { signal });
}

async function startGame() {
  cancelRun();
  const id = ++runId;
  running = true;
  currentStep = 0;
  totalMistakes = 0;
  document.getElementById("lv16Ready")?.setAttribute("hidden", "");
  document.getElementById("lv16Result")?.setAttribute("hidden", "");
  setText("lv16Phase", "GET READY");
  setText("lv16Guide", "4 STEP의 홀드 리듬을 준비하세요");
  updateProgress(0, 0);
  await readySound();
  if (!isActive(id)) return;
  playStartSound();
  schedule(() => beginStep(id), 650);
}

function beginStep(id) {
  if (!isActive(id)) return;
  acceptingInput = false;
  expectedIndex = 0;
  stepMistakes = 0;
  blocks = createBlocks();
  previewOrder = shuffle([...blocks]);
  renderBlocks();
  setText("lv16Phase", `STEP ${currentStep + 1}`);
  setText("lv16Guide", "BAR가 차오르는 순서와 길이를 기억하세요");
  updateProgress(currentStep, 0);
  schedule(() => playPreview(id, 0), 520);
}

function createBlocks() {
  const palette = shuffle([...COLORS]).slice(0, 4);
  return palette.map((color, index) => ({
    id: `b${currentStep}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    color,
    ratio: randomBetween(0.24, 0.76),
    duration: randomBetween(920, 1780),
    easing: EASINGS[Math.floor(Math.random() * EASINGS.length)],
    used: false,
    success: false,
    targetVisible: false,
  }));
}

function renderBlocks() {
  const holder = document.getElementById("lv16Blocks");
  if (!holder) return;
  holder.innerHTML = blocks.map((block) => blockMarkup(block)).join("");
}

function blockMarkup(block) {
  const lineTop = `${(1 - block.ratio) * 50}%`;
  return `<button type="button" class="lv16-block${block.targetVisible ? " has-target" : ""}" data-block-id="${block.id}" data-order="" style="--block-bg:${block.color.bg};--bar:${block.color.bar};--bar-deep:${block.color.deep};--line-top:${lineTop}" aria-label="홀드 블럭">
    <span class="lv16-bar"></span><i class="lv16-target-line top"></i><i class="lv16-target-line bottom"></i>
  </button>`;
}

function playPreview(id, index) {
  if (!isActive(id)) return;
  if (index >= previewOrder.length) {
    schedule(() => hideBarsAndShuffle(id), 620);
    return;
  }
  const block = previewOrder[index];
  const el = blockElement(block.id);
  const bar = el?.querySelector(".lv16-bar");
  if (!el || !bar) return;
  el.classList.add("is-preview");
  el.dataset.order = String(index + 1);
  playLv16PreviewSound(index, block.duration);
  const targetHeight = block.ratio * 100;
  const animation = bar.animate(
    [{ height: "0%" }, { height: `${targetHeight}%` }],
    { duration: block.duration, easing: block.easing, fill: "forwards" },
  );
  animation.onfinish = () => {
    if (!isActive(id)) return;
    el.classList.remove("is-preview");
    block.targetVisible = true;
    el.classList.add("has-target");
    schedule(() => playPreview(id, index + 1), PREVIEW_GAP);
  };
}

function hideBarsAndShuffle(id) {
  if (!isActive(id)) return;
  document.querySelectorAll("#lv16Page .lv16-bar").forEach((bar) => {
    bar.getAnimations().forEach((animation) => animation.cancel());
    bar.style.height = "0%";
  });
  setText("lv16Guide", `${currentStep + 1}개의 블럭이 움직입니다`);
  const oldRects = new Map(blocks.map((block) => [block.id, blockElement(block.id)?.getBoundingClientRect()]));
  blocks = shuffledForStep(blocks, currentStep + 1);
  renderBlocks();
  requestAnimationFrame(() => {
    blocks.forEach((block) => {
      const el = blockElement(block.id);
      const oldRect = oldRects.get(block.id);
      const newRect = el?.getBoundingClientRect();
      if (!el || !oldRect || !newRect) return;
      const delta = oldRect.left - newRect.left;
      if (Math.abs(delta) > 1) el.animate([{ transform: `translateX(${delta}px)` }, { transform: "translateX(0)" }], { duration: 760, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
  });
  schedule(() => countdown(id, 3), 980);
}

function shuffledForStep(list, moveCount) {
  const result = [...list];
  if (moveCount === 1) {
    const from = Math.floor(Math.random() * result.length);
    const direction = from === 0 ? 1 : from === result.length - 1 ? -1 : (Math.random() < .5 ? -1 : 1);
    const [item] = result.splice(from, 1);
    result.splice(from + direction, 0, item);
    return result;
  }
  const indices = shuffle([0, 1, 2, 3]).slice(0, moveCount);
  const selected = indices.map((index) => result[index]);
  const rotated = [...selected.slice(1), selected[0]];
  indices.forEach((index, i) => { result[index] = rotated[i]; });
  if (result.every((block, i) => block.id === list[i].id)) return shuffle(result);
  return result;
}

function countdown(id, value) {
  if (!isActive(id)) return;
  const layer = document.getElementById("lv16Countdown");
  if (!layer) return;
  if (value === 0) {
    layer.setAttribute("hidden", "");
    startPlayerTurn();
    return;
  }
  layer.removeAttribute("hidden");
  const strong = layer.querySelector("strong");
  if (strong) {
    strong.textContent = String(value);
    strong.style.animation = "none";
    void strong.offsetWidth;
    strong.style.animation = "";
  }
  schedule(() => countdown(id, value - 1), 860);
}

function startPlayerTurn() {
  acceptingInput = true;
  expectedIndex = 0;
  setText("lv16Guide", currentStep === 0
    ? "숫자 순서대로 누르고 라인에서 정확히 손을 떼세요"
    : "기억한 순서대로 누르고 라인에서 정확히 손을 떼세요");
  startStepTimer(runId);
  markExpected();
}

function markExpected() {
  document.querySelectorAll("#lv16Page .lv16-block").forEach((el) => {
    el.classList.remove("is-expected");
    el.dataset.order = "";
  });
  if (currentStep !== 0) return;
  const expected = previewOrder[expectedIndex];
  const el = expected && blockElement(expected.id);
  if (el) {
    el.classList.add("is-expected");
    el.dataset.order = String(expectedIndex + 1);
  }
}

function onPointerDown(event) {
  if (!acceptingInput || activeHold) return;
  const el = event.target.closest(".lv16-block");
  if (!el) return;
  const block = blocks.find((item) => item.id === el.dataset.blockId);
  if (!block || block.used) return;
  event.preventDefault();
  el.setPointerCapture?.(event.pointerId);
  const expected = previewOrder[expectedIndex];
  const orderCorrect = expected?.id === block.id;
  block.used = true;
  el.classList.add("is-holding");
  el.classList.remove("is-expected");
  const bar = el.querySelector(".lv16-bar");
  const startedAt = performance.now();
  activeHold = { pointerId: event.pointerId, block, el, bar, startedAt, orderCorrect, frame: 0, ratio: 0 };
  startLv16HoldSound(expectedIndex);
  activeHold.frame = requestAnimationFrame(updateHold);
}

function updateHold(now) {
  if (!activeHold) return;
  const { block, bar, startedAt } = activeHold;
  const elapsed = now - startedAt;
  const raw = Math.min(elapsed / block.duration, 1.16);
  const eased = easingValue(block.easing, Math.min(raw, 1));
  const visualRatio = raw <= 1 ? eased * block.ratio : block.ratio + (raw - 1) * .32;
  activeHold.ratio = visualRatio;
  if (bar) bar.style.height = `${Math.min(visualRatio * 100, 100)}%`;
  activeHold.frame = requestAnimationFrame(updateHold);
}

function onPointerUp(event) {
  if (!activeHold || event.pointerId !== activeHold.pointerId) return;
  event.preventDefault();
  const hold = activeHold;
  activeHold = null;
  cancelAnimationFrame(hold.frame);
  stopLv16HoldSound();
  const rect = hold.el.getBoundingClientRect();
  const tolerance = Math.max(TOLERANCE_PX_MIN, rect.height * TOLERANCE_RATIO);
  const targetPx = hold.block.ratio * rect.height;
  const actualPx = hold.ratio * rect.height;
  const lengthCorrect = Math.abs(actualPx - targetPx) <= tolerance;
  const success = hold.orderCorrect && lengthCorrect;
  hold.block.success = success;
  hold.el.classList.remove("is-holding");
  hold.el.classList.add(success ? "is-success" : "is-fail", "is-locked");
  if (success) {
    playLv16SuccessSound(expectedIndex);
    showFeedback(true, "PERFECT", "정확한 길이입니다");
  } else {
    stepMistakes += 1;
    totalMistakes += 1;
    playLv16FailSound(expectedIndex);
    const message = hold.orderCorrect ? (actualPx < targetPx ? "조금 부족했습니다" : "라인을 넘었습니다") : "순서가 달랐습니다";
    showFeedback(false, "MISS", message);
  }
  expectedIndex += 1;
  updateProgress(currentStep, expectedIndex);
  if (expectedIndex >= previewOrder.length) {
    acceptingInput = false;
    stopStepTimer();
    schedule(() => finishStep(runId), 820);
  } else {
    markExpected();
  }
}

function startStepTimer(id) {
  stopStepTimer();
  const duration = STEP_TIME_LIMITS[currentStep] ?? STEP_TIME_LIMITS.at(-1);
  stepDeadline = performance.now() + duration * 1000;
  const timer = document.getElementById("lv16Timer");
  timer?.classList.remove("is-urgent");

  const tick = (now) => {
    if (!isActive(id) || !acceptingInput) return;
    const remaining = Math.max(0, stepDeadline - now);
    const seconds = Math.ceil(remaining / 1000);
    setText("lv16TimerValue", String(seconds));
    if (timer) {
      timer.style.setProperty("--time-progress", String(remaining / (duration * 1000)));
      timer.classList.toggle("is-urgent", remaining <= 4000);
    }
    if (remaining <= 0) {
      handleStepTimeout(id);
      return;
    }
    stepTimerFrame = requestAnimationFrame(tick);
  };
  stepTimerFrame = requestAnimationFrame(tick);
}

function stopStepTimer() {
  cancelAnimationFrame(stepTimerFrame);
  stepTimerFrame = 0;
  stepDeadline = 0;
  const timer = document.getElementById("lv16Timer");
  timer?.classList.remove("is-urgent");
}

function handleStepTimeout(id) {
  if (!isActive(id) || !acceptingInput) return;
  acceptingInput = false;
  stopStepTimer();
  stopLv16HoldSound();
  const unfinishedCount = previewOrder.filter((block) => !block.used).length + (activeHold ? 1 : 0);
  if (activeHold) {
    cancelAnimationFrame(activeHold.frame);
    activeHold.el.classList.remove("is-holding");
    activeHold.el.classList.add("is-fail", "is-locked");
    activeHold.block.success = false;
    activeHold = null;
  }
  const addedMistakes = Math.max(1, unfinishedCount);
  stepMistakes += addedMistakes;
  totalMistakes += addedMistakes;
  document.querySelectorAll("#lv16Page .lv16-block:not(.is-success)").forEach((el) => {
    el.classList.add("is-fail", "is-locked");
    el.classList.remove("is-expected");
    el.dataset.order = "";
  });
  playLv16FailSound(expectedIndex);
  showFeedback(false, "TIME OUT", "제한시간이 끝났습니다");
  setText("lv16Guide", "남은 입력은 실패로 기록하고 다음 STEP으로 이동합니다");
  schedule(() => finishStep(id), 1100);
}

function finishStep(id) {
  if (!isActive(id)) return;
  currentStep += 1;
  if (currentStep >= STEP_COUNT) {
    finishGame();
    return;
  }
  setText("lv16Guide", stepMistakes ? "실수가 있어도 다음 STEP은 계속됩니다" : "좋습니다. 다음 STEP으로 이동합니다");
  schedule(() => beginStep(id), 900);
}

function finishGame() {
  stopStepTimer();
  running = false;
  acceptingInput = false;
  const success = totalMistakes === 0;
  const result = document.getElementById("lv16Result");
  const next = document.getElementById("lv16Next");
  const retry = document.getElementById("lv16Retry");
  result?.removeAttribute("hidden");
  next?.toggleAttribute("hidden", !success);
  retry?.toggleAttribute("hidden", success);
  setText("lv16ResultKicker", success ? "HOLD COMPLETE" : "RHYTHM REVIEW");
  setText("lv16ResultTitle", success ? "완벽한 컨트롤입니다" : "한 번 더 감각을 맞춰보세요");
  setText("lv16ResultText", success ? "모든 STEP의 순서와 길이를 정확히 기억했습니다." : `총 ${totalMistakes}번의 실수가 있었습니다. RETRY를 누르면 설명 없이 바로 다시 시작합니다.`);
}

function showFeedback(success, title, detail) {
  const el = document.getElementById("lv16Feedback");
  if (!el) return;
  el.className = `lv16-feedback ${success ? "good" : "bad"}`;
  el.querySelector("strong").textContent = title;
  el.querySelector("small").textContent = detail;
  void el.offsetWidth;
  el.classList.add("show");
}

function easingValue(name, t) {
  if (name === "linear") return t;
  if (name === "ease-in") return t * t;
  if (name === "ease-out") return 1 - (1 - t) ** 2;
  if (name === "ease-in-out") return t < .5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  return t < .5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
}

function updateProgress(step, item) {
  const totalDone = step * 4 + item;
  const total = STEP_COUNT * 4;
  const bar = document.getElementById("lv16Progress");
  if (bar) bar.style.transform = `scaleX(${totalDone / total})`;
  setText("lv16Score", `${Math.min(step + 1, STEP_COUNT)} / ${STEP_COUNT}`);
}

function blockElement(id) { return document.querySelector(`#lv16Page .lv16-block[data-block-id="${id}"]`); }
function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
function randomBetween(min, max) { return min + Math.random() * (max - min); }
function shuffle(list) { for (let i = list.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; }
function schedule(fn, delay) { const timer = window.setTimeout(() => { timers.delete(timer); fn(); }, delay); timers.add(timer); return timer; }
function isActive(id) { return running && id === runId && Boolean(document.getElementById("lv16Page")); }

function cancelRun() {
  running = false;
  acceptingInput = false;
  runId += 1;
  timers.forEach((timer) => clearTimeout(timer));
  stopStepTimer();
  timers.clear();
  if (activeHold) cancelAnimationFrame(activeHold.frame);
  activeHold = null;
  document.querySelectorAll("#lv16Page *").forEach((el) => el.getAnimations?.().forEach((animation) => animation.cancel()));
  stopLv16Sounds();
}

function destroyPage() {
  cancelRun();
  lifecycleController?.abort();
  inputController?.abort();
  viewportController?.abort();
  lifecycleController = null;
  inputController = null;
  viewportController = null;
  window.clearInterval(routeWatchTimer);
  routeWatchTimer = 0;
}
