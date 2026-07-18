import lv19Style from "../../../assets/scss/game/lv19/common.scss?inline";
import lv19Template from "./lv19.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv19BeatSound,
  playLv19FailSound,
  playLv19FinishSound,
  playLv19SelectSound,
  playLv19SuccessSound,
  playStartSound,
  readySound,
  stopLv19Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/sound.js";

const TOTAL_STEPS = 4;
const BEAT_MS = 1000;
const MEMORY_MS = 2200;
const SELECT_MS = 980;
const TRANSITION_MS = 650;
const STEP_GAP_MS = 1050;
const COLOR_PALETTES = Object.freeze([
  ["#ff9fb8", "#f3c875", "#9fd9ad", "#84cddd", "#aebbf0"],
  ["#f29dc6", "#f0b982", "#8ed5bd", "#8bbde8", "#c2a5e8"],
  ["#ffad9f", "#e9cf75", "#9bd2a4", "#8fd4cf", "#b8a9ed"],
]);
const BACKGROUND_PALETTES = Object.freeze([
  ["#eadcf4", "#dcecf7", "#e4efd9", "#f7e5d7", "#e3e1f6"],
  ["#f2dfe8", "#dce8f4", "#dcefe8", "#f3e7d5", "#e9e0f4"],
]);

let gameToken = 0;
let running = false;
let currentStep = 0;
let currentSequence = [];
let expectedIndex = 0;
let stepFailed = false;
let totalFailures = 0;
let totalCorrect = 0;
let beatTimer = 0;
let feedbackTimer = 0;
let timers = new Set();
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let routeWatchTimer = 0;
let resizeFrame = 0;
let mountedPathname = "";

export function renderPage() {
  destroyPage();
  renderView(lv19Template, lv19Style);
  mountedPathname = window.location.pathname;
  bindLifecycle();
  bindViewport();
  bindControls();
  renderIdleBoard();
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv19Page")) destroyPage();
  }, 100);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv19Page");
    if (!page) return;
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    page.style.setProperty("--lv19-vh", `${Math.round(height)}px`);
    page.classList.toggle("is-portrait", height > width);
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      document.getElementById("lv19Board")?.style.setProperty("--count", String(Math.max(2, currentSequence.length || currentStep + 2)));
    });
  };
  sync();
  window.addEventListener("resize", sync, { passive: true, signal });
  window.addEventListener("orientationchange", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true, signal });
}

function bindControls() {
  inputController?.abort();
  inputController = new AbortController();
  const { signal } = inputController;
  unlockSoundOnNextGesture();
  document.getElementById("lv19StartButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv19RetryButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv19NextButton")?.addEventListener("click", () => { cancelGame(); navigate("lv20", { replace: true }); }, { signal });
  document.getElementById("lv19HomeButton")?.addEventListener("click", () => { cancelGame(); navigate("home", { replace: true }); }, { signal });
  document.getElementById("lv19Board")?.addEventListener("pointerdown", handleTilePress, { signal });
  document.getElementById("lv19Board")?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

async function startGame() {
  cancelGame();
  const token = ++gameToken;
  running = true;
  currentStep = 0;
  currentSequence = [];
  expectedIndex = 0;
  stepFailed = false;
  totalFailures = 0;
  totalCorrect = 0;
  hide("lv19Ready");
  hide("lv19Result");
  setProgress(0);
  setText("lv19PhaseText", "GET READY");
  setText("lv19StepText", "1 / 4");
  await readySound();
  if (!isActive(token)) return;
  playStartSound();
  schedule(() => beginStep(token, 0), 620);
}

function beginStep(token, stepIndex) {
  if (!isActive(token)) return;
  currentStep = stepIndex;
  expectedIndex = 0;
  stepFailed = false;
  const count = stepIndex + 2;
  const setup = makeStepSetup(count);
  currentSequence = setup.selectedColors;
  setText("lv19PhaseText", "MEMORIZE");
  setText("lv19StepText", `${stepIndex + 1} / ${TOTAL_STEPS}`);
  setProgress(stepIndex / TOTAL_STEPS);
  renderMemoryBoard(setup);
  schedule(() => selectMemoryTile(token, setup), MEMORY_MS);
}

function makeStepSetup(count) {
  const numberPalette = shuffled([...COLOR_PALETTES[randomInt(0, COLOR_PALETTES.length - 1)]]).slice(0, count);
  const backgrounds = shuffled([...BACKGROUND_PALETTES[randomInt(0, BACKGROUND_PALETTES.length - 1)]]);
  const tiles = Array.from({ length: count }, (_, tileIndex) => {
    const colors = tileIndex === 0 ? [...numberPalette] : shuffled([...numberPalette]);
    return { colors, background: backgrounds[tileIndex % backgrounds.length] };
  });
  const selectedIndex = randomInt(0, count - 1);
  return { count, tiles, selectedIndex, selectedColors: [...tiles[selectedIndex].colors] };
}

function renderMemoryBoard(setup) {
  const board = document.getElementById("lv19Board");
  if (!board) return;
  board.className = "lv19-board";
  board.style.setProperty("--count", String(setup.count));
  board.innerHTML = setup.tiles.map((tile, tileIndex) => `
    <article class="lv19-tile lv19-memory-tile" data-memory-index="${tileIndex}" style="--tile-color:${tile.background}">
      <div class="lv19-number-row">
        ${tile.colors.map((color, numberIndex) => `<b class="lv19-number" style="--number-color:${color}">${numberIndex + 1}</b>`).join("")}
      </div>
    </article>`).join("");
}

function selectMemoryTile(token, setup) {
  if (!isActive(token)) return;
  setText("lv19PhaseText", "SIGNAL");
  document.querySelectorAll(".lv19-memory-tile").forEach((tile, index) => {
    tile.classList.add(index === setup.selectedIndex ? "is-selected" : "is-unselected");
  });
  playLv19SelectSound(currentStep);
  schedule(() => transitionToAnswer(token, setup), SELECT_MS);
}

function transitionToAnswer(token, setup) {
  if (!isActive(token)) return;
  const board = document.getElementById("lv19Board");
  board?.classList.add("is-folding");
  schedule(() => {
    if (!isActive(token)) return;
    renderAnswerBoard(setup);
    schedule(() => startInputPhase(token), TRANSITION_MS);
  }, 380);
}

function renderAnswerBoard(setup) {
  const board = document.getElementById("lv19Board");
  if (!board) return;
  const answerColors = shuffled(setup.selectedColors.map((color, order) => ({ color, order })));
  board.className = "lv19-board is-revealing";
  board.style.setProperty("--count", String(setup.count));
  board.innerHTML = answerColors.map((item, index) => `
    <button class="lv19-tile lv19-answer-tile" type="button" data-order="${item.order}" style="--tile-color:${item.color};--index:${index}" aria-label="색상 블럭 ${index + 1}"></button>`).join("");
}

function startInputPhase(token) {
  if (!isActive(token)) return;
  expectedIndex = 0;
  setText("lv19PhaseText", "PLAY");
  document.getElementById("lv19BeatRail")?.classList.add("is-active");
  startBeat(token);
}

function startBeat(token) {
  window.clearTimeout(beatTimer);
  if (!isActive(token) || expectedIndex >= currentSequence.length) return;
  playLv19BeatSound(expectedIndex, currentStep);
  beatTimer = window.setTimeout(() => {
    if (!isActive(token)) return;
    registerMiss(token);
  }, BEAT_MS);
}

function handleTilePress(event) {
  const tile = event.target.closest(".lv19-answer-tile");
  if (!tile || !running || expectedIndex >= currentSequence.length) return;
  event.preventDefault();
  window.clearTimeout(beatTimer);
  const pressedOrder = Number(tile.dataset.order);
  const correct = pressedOrder === expectedIndex;
  tile.classList.add(correct ? "is-good" : "is-bad", "is-used");
  if (correct) {
    totalCorrect += 1;
    playLv19SuccessSound(expectedIndex, currentStep);
    showFeedback(true, "BEAUTIFUL", `${expectedIndex + 1}번째 색을 정확히 눌렀습니다`);
  } else {
    stepFailed = true;
    totalFailures += 1;
    playLv19FailSound(expectedIndex, currentStep);
    showFeedback(false, "MISTAKE", `${expectedIndex + 1}번째 색의 순서가 다릅니다`);
  }
  expectedIndex += 1;
  schedule(() => continueOrFinishStep(gameToken), 190);
}

function registerMiss(token) {
  if (!isActive(token)) return;
  const expectedTile = document.querySelector(`.lv19-answer-tile[data-order="${expectedIndex}"]`);
  expectedTile?.classList.add("is-bad", "is-used");
  stepFailed = true;
  totalFailures += 1;
  playLv19FailSound(expectedIndex, currentStep);
  showFeedback(false, "TOO LATE", "1초 박자를 놓쳤습니다");
  expectedIndex += 1;
  schedule(() => continueOrFinishStep(token), 190);
}

function continueOrFinishStep(token) {
  if (!isActive(token)) return;
  if (expectedIndex < currentSequence.length) {
    startBeat(token);
    return;
  }
  finishStep(token);
}

function finishStep(token) {
  if (!isActive(token)) return;
  window.clearTimeout(beatTimer);
  document.getElementById("lv19BeatRail")?.classList.remove("is-active");
  setProgress((currentStep + 1) / TOTAL_STEPS);
  if (!stepFailed) showFeedback(true, "STEP CLEAR", `${currentStep + 2}개의 색을 모두 기억했습니다`);
  else showFeedback(false, "STEP COMPLETE", "실수가 기록되었지만 다음 STEP으로 진행합니다");
  if (currentStep + 1 < TOTAL_STEPS) {
    setText("lv19PhaseText", "NEXT STEP");
    schedule(() => beginStep(token, currentStep + 1), STEP_GAP_MS);
  } else {
    schedule(() => finishGame(token), STEP_GAP_MS);
  }
}

function finishGame(token) {
  if (!isActive(token)) return;
  running = false;
  stopLv19Sounds();
  const success = totalFailures === 0;
  playLv19FinishSound(success);
  setProgress(1);
  setText("lv19PhaseText", "COMPLETE");
  setText("lv19ResultKicker", success ? "PERFECT SEQUENCE" : "SEQUENCE COMPLETE");
  setText("lv19ResultTitle", success ? "완벽한 컬러 리듬입니다" : "색의 흐름을 한 번 더 기억해보세요");
  setText("lv19ResultDescription", success
    ? "4개의 STEP, 총 14개의 컬러 순서를 모두 정확한 박자로 터치했습니다."
    : `총 14개의 입력 중 ${totalCorrect}개 성공 · ${totalFailures}번의 실수가 있었습니다.`);
  toggleHidden("lv19NextButton", !success);
  toggleHidden("lv19RetryButton", success);
  show("lv19Result");
}

function renderIdleBoard() {
  const board = document.getElementById("lv19Board");
  if (!board) return;
  board.style.setProperty("--count", "2");
  board.innerHTML = `
    <article class="lv19-tile" style="--tile-color:#eadcf4"><div class="lv19-number-row"><b class="lv19-number" style="--number-color:#ff9fb8">1</b><b class="lv19-number" style="--number-color:#88cfe0">2</b></div></article>
    <article class="lv19-tile" style="--tile-color:#dcecf7"><div class="lv19-number-row"><b class="lv19-number" style="--number-color:#a9d89c">1</b><b class="lv19-number" style="--number-color:#d5a9ed">2</b></div></article>`;
}

function showFeedback(success, title, detail) {
  const feedback = document.getElementById("lv19Feedback");
  if (!feedback) return;
  window.clearTimeout(feedbackTimer);
  feedback.className = `lv19-feedback is-visible ${success ? "is-good" : "is-bad"}`;
  feedback.querySelector("strong").textContent = title;
  feedback.querySelector("small").textContent = detail;
  feedbackTimer = window.setTimeout(() => feedback.classList.remove("is-visible"), 780);
}

function shuffled(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function setProgress(value) { const element = document.getElementById("lv19ProgressBar"); if (element) element.style.width = `${Math.min(1, Math.max(0, value)) * 100}%`; }
function hide(id) { document.getElementById(id)?.setAttribute("hidden", ""); }
function show(id) { document.getElementById(id)?.removeAttribute("hidden"); }
function toggleHidden(id, hidden) { const element = document.getElementById(id); if (element) element.hidden = hidden; }
function isActive(token) { return running && token === gameToken && Boolean(document.getElementById("lv19Page")); }
function schedule(callback, delay) { const timer = window.setTimeout(() => { timers.delete(timer); callback(); }, delay); timers.add(timer); return timer; }

function cancelGame() {
  running = false;
  gameToken += 1;
  window.clearTimeout(beatTimer);
  window.clearTimeout(feedbackTimer);
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  document.getElementById("lv19BeatRail")?.classList.remove("is-active");
  stopLv19Sounds();
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
}
