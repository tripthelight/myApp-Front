import lv22Style from "../../../assets/scss/game/lv22/common.scss?inline";
import lv22Template from "./lv22.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv22Fail,
  playLv22Finish,
  playLv22Note,
  playLv22Success,
  playStartSound,
  readySound,
  stopLv22Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv22Sound.js";

const BLOCK_COUNT = 5;
const ROUND_BEATS = Object.freeze([1000, 800, 600, 400, 200]);
const BETWEEN_PASSES = 80;
const RESULT_HOLD = 520;
const ROUND_TRANSITION_DURATION = 1180;
const COLOR_SETS = Object.freeze([
  ["#f7b7c6", "#c76d87", "#ffe3eb"], ["#9ed9e8", "#508fa9", "#def6fb"],
  ["#acdca9", "#609d69", "#e4f7e2"], ["#f2d18d", "#aa7e38", "#fff0c9"],
  ["#c9b4ec", "#8066b6", "#f0e8ff"], ["#96ddcb", "#4f9784", "#ddf8f0"],
  ["#f3b49a", "#ad6a51", "#ffe4d8"], ["#afc4ef", "#667db5", "#e5ecff"],
]);

let gameToken = 0;
let running = false;
let acceptingInput = false;
let currentRound = 0;
let currentOrder = [];
let audibleSlots = new Set();
let noteOrder = [0, 1, 2, 3, 4];
let targetBlock = -1;
let targetSlotAudible = true;
let targetTime = 0;
let roundResolved = false;
let failures = 0;
let successes = 0;
let timers = new Set();
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let mountedPathname = "";
let routeWatchTimer = 0;
let resizeFrame = 0;
let roundSerial = 0;

export function renderPage() {
  destroyPage();
  renderView(lv22Template, lv22Style);
  mountedPathname = window.location.pathname;
  bindLifecycle();
  bindViewport();
  bindControls();
  prepareBoard();
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv22Page")) destroyPage();
  }, 100);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv22Page");
    if (!page) return;
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    page.style.setProperty("--lv22-vw", `${width}px`);
    page.style.setProperty("--lv22-vh", `${height}px`);
    page.classList.toggle("is-portrait", height > width);
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      page.style.setProperty("--lv22-ui-scale", String(Math.min(1, Math.max(.78, Math.min(width / 900, height / 680)))));
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
  document.getElementById("lv22StartButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv22RetryButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv22NextButton")?.addEventListener("click", () => { cancelGame(); navigate("lv23", { replace: true }); }, { signal });
  document.getElementById("lv22HomeButton")?.addEventListener("click", () => { cancelGame(); navigate("home", { replace: true }); }, { signal });
  document.getElementById("lv22Blocks")?.addEventListener("pointerdown", handleBlockPress, { signal });
  document.getElementById("lv22Blocks")?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

function prepareBoard() {
  const colors = shuffle([...COLOR_SETS]).slice(0, BLOCK_COUNT);
  document.querySelectorAll(".lv22-block").forEach((block, index) => {
    const [base, deep, glow] = colors[index];
    block.style.setProperty("--block-base", base);
    block.style.setProperty("--block-deep", deep);
    block.style.setProperty("--block-glow", glow);
    block.className = "lv22-block";
    block.disabled = true;
  });
  noteOrder = createRandomNoteOrder();
  currentRound = 0;
  failures = 0;
  successes = 0;
  acceptingInput = false;
  roundResolved = false;
  setProgress(0);
  setText("lv22PhaseText", "READY");
  setText("lv22RoundText", "ROUND 1 / 5");
  setText("lv22Cue", "LISTEN");
}

async function startGame() {
  cancelGame();
  prepareBoard();
  const token = ++gameToken;
  running = true;
  hide("lv22Ready");
  hide("lv22Result");
  await readySound();
  if (!isActive(token)) return;
  playStartSound();
  schedule(() => beginRound(token, 0, false), 420);
}

function beginRound(token, roundIndex, withTransition = true) {
  if (!isActive(token)) return;
  if (withTransition) {
    showRoundTransition(token, roundIndex);
    return;
  }
  launchRound(token, roundIndex);
}

function showRoundTransition(token, roundIndex) {
  if (!isActive(token)) return;
  acceptingInput = false;
  document.querySelectorAll(".lv22-block").forEach((block) => { block.disabled = true; });
  clearBlockStates();
  setText("lv22TransitionRound", `ROUND ${roundIndex + 1}`);
  setText("lv22TransitionTempo", `${ROUND_BEATS[roundIndex] / 1000}s BEAT`);
  const transition = document.getElementById("lv22RoundTransition");
  if (transition) {
    transition.hidden = false;
    transition.classList.remove("is-entering");
    void transition.offsetWidth;
    transition.classList.add("is-entering");
  }
  schedule(() => {
    if (!isActive(token)) return;
    if (transition) {
      transition.hidden = true;
      transition.classList.remove("is-entering");
    }
    launchRound(token, roundIndex);
  }, ROUND_TRANSITION_DURATION);
}

function launchRound(token, roundIndex) {
  if (!isActive(token)) return;
  const serial = ++roundSerial;
  currentRound = roundIndex;
  currentOrder = createUniqueBlockOrder();
  targetBlock = currentOrder[BLOCK_COUNT - 1];
  audibleSlots = chooseAudibleSlots(BLOCK_COUNT - roundIndex);
  targetSlotAudible = audibleSlots.has(BLOCK_COUNT - 1);
  roundResolved = false;
  acceptingInput = false;
  clearBlockStates();
  setText("lv22RoundText", `ROUND ${roundIndex + 1} / 5`);
  setText("lv22PhaseText", "LISTEN");
  setText("lv22Cue", "LISTEN");
  setProgress(roundIndex / BLOCK_COUNT);
  playSequence(token, serial, 0);
}

function playSequence(token, serial, passIndex) {
  if (!isRoundActive(token, serial)) return;
  const beat = ROUND_BEATS[currentRound];
  if (passIndex === 1) {
    setText("lv22PhaseText", "TOUCH THE LAST");
    setText("lv22Cue", "PLAY");
    targetTime = performance.now() + (BLOCK_COUNT - 1) * beat;
    acceptingInput = true;
    document.querySelectorAll(".lv22-block").forEach((block) => { block.disabled = false; });
  }
  for (let slot = 0; slot < BLOCK_COUNT; slot += 1) {
    schedule(() => triggerBeat(token, serial, passIndex, slot, beat), slot * beat);
  }
  const passDuration = BLOCK_COUNT * beat;
  if (passIndex === 0) {
    schedule(() => playSequence(token, serial, 1), passDuration + BETWEEN_PASSES);
  } else {
    schedule(() => resolveMiss(token, serial), passDuration + Math.max(70, beat * .18));
  }
}

function triggerBeat(token, serial, passIndex, slot, beat) {
  if (!isRoundActive(token, serial)) return;
  const blockIndex = currentOrder[slot];
  flashBlock(blockIndex, beat);
  if (audibleSlots.has(slot)) playLv22Note(noteOrder[slot], beat);
  if (passIndex === 1 && slot === BLOCK_COUNT - 1) {
    setText("lv22Cue", "NOW");
  }
}

function handleBlockPress(event) {
  const block = event.target.closest(".lv22-block");
  if (!block || !running || !acceptingInput || roundResolved) return;
  event.preventDefault();
  const pressed = Number(block.dataset.block);
  const beat = ROUND_BEATS[currentRound];
  const elapsed = performance.now() - targetTime;
  const withinWindow = elapsed >= -Math.max(35, beat * .12) && elapsed <= Math.max(115, beat * .58);
  const success = pressed === targetBlock && withinWindow;
  resolveRound(success, pressed, success ? "CLEAR" : pressed !== targetBlock ? "ORDER" : "TIMING");
}

function resolveMiss(token, serial) {
  if (!isRoundActive(token, serial) || roundResolved) return;
  resolveRound(false, targetBlock, "MISS", true);
}

function resolveRound(success, pressedBlock, reason, missed = false) {
  if (!running || roundResolved) return;
  roundResolved = true;
  acceptingInput = false;
  document.querySelectorAll(".lv22-block").forEach((block) => { block.disabled = true; });
  const pressed = document.querySelector(`.lv22-block[data-block="${pressedBlock}"]`);
  const answer = document.querySelector(`.lv22-block[data-block="${targetBlock}"]`);
  if (success) {
    successes += 1;
    pressed?.classList.add("is-success");
    playLv22Success(noteOrder[BLOCK_COUNT - 1], !targetSlotAudible);
    setText("lv22Cue", "PERFECT");
  } else {
    failures += 1;
    pressed?.classList.add("is-fail");
    if (!missed && pressedBlock !== targetBlock) answer?.classList.add("is-answer");
    if (missed) answer?.classList.add("is-fail", "is-answer");
    playLv22Fail();
    setText("lv22Cue", reason === "ORDER" ? "WRONG BLOCK" : "TOO LATE");
  }
  setProgress((currentRound + 1) / BLOCK_COUNT);
  const resolvedSerial = roundSerial;
  schedule(() => {
    if (!isRoundActive(gameToken, resolvedSerial)) return;
    clearBlockStates();
    const nextRound = currentRound + 1;
    if (nextRound < BLOCK_COUNT) beginRound(gameToken, nextRound, true);
    else finishGame(gameToken);
  }, RESULT_HOLD);
}

function finishGame(token) {
  if (!isActive(token)) return;
  running = false;
  acceptingInput = false;
  stopLv22Sounds();
  const success = failures === 0;
  playLv22Finish(success);
  setText("lv22PhaseText", "COMPLETE");
  setText("lv22Cue", "COMPLETE");
  setText("lv22ResultKicker", success ? "PERFECT ECHO PULSE" : "ECHO PULSE COMPLETE");
  setText("lv22ResultTitle", success ? "완벽한 마지막 박자입니다" : "마지막 박자를 한 번 더 잡아보세요");
  setText("lv22ResultDescription", success
    ? "다섯 라운드의 마지막 블록을 모두 정확한 순서와 타이밍으로 터치했습니다."
    : `5 ROUND 중 ${successes}번 성공 · ${failures}번의 실수가 기록되었습니다.`);
  toggleHidden("lv22NextButton", !success);
  toggleHidden("lv22RetryButton", success);
  show("lv22Result");
}

function createUniqueBlockOrder() {
  const order = shuffle(Array.from({ length: BLOCK_COUNT }, (_, index) => index));
  if (new Set(order).size !== BLOCK_COUNT) {
    return Array.from({ length: BLOCK_COUNT }, (_, index) => index);
  }
  return order;
}

function createRandomNoteOrder() {
  const notes = Array.from({ length: BLOCK_COUNT }, (_, index) => index);
  let order = shuffle([...notes]);
  while (order.every((note, index) => note === index)) {
    order = shuffle([...notes]);
  }
  return order;
}

function chooseAudibleSlots(count) {
  return new Set(shuffle([0, 1, 2, 3, 4]).slice(0, count));
}

function flashBlock(index, beat) {
  const block = document.querySelector(`.lv22-block[data-block="${index}"]`);
  if (!block) return;
  block.style.setProperty("--flash-duration", `${Math.max(130, beat * .72)}ms`);
  block.classList.remove("is-flashing");
  void block.offsetWidth;
  block.classList.add("is-flashing");
  schedule(() => block.classList.remove("is-flashing"), Math.max(130, beat * .72));
  const rail = document.getElementById("lv22BeatRail");
  rail?.style.setProperty("--beat-duration", `${beat}ms`);
  rail?.classList.remove("is-running");
  void rail?.offsetWidth;
  rail?.classList.add("is-running");
}

function clearBlockStates() {
  document.querySelectorAll(".lv22-block").forEach((block) => block.classList.remove("is-flashing", "is-success", "is-fail", "is-answer"));
}

function setProgress(value) {
  const bar = document.getElementById("lv22ProgressBar");
  if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
}
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function show(id) { const element = document.getElementById(id); if (element) element.hidden = false; }
function hide(id) { const element = document.getElementById(id); if (element) element.hidden = true; }
function toggleHidden(id, hidden) { const element = document.getElementById(id); if (element) element.hidden = hidden; }
function shuffle(values) { for (let index = values.length - 1; index > 0; index -= 1) { const next = Math.floor(Math.random() * (index + 1)); [values[index], values[next]] = [values[next], values[index]]; } return values; }
function schedule(callback, delay) { const id = window.setTimeout(() => { timers.delete(id); callback(); }, delay); timers.add(id); return id; }
function isActive(token) { return running && token === gameToken && document.getElementById("lv22Page"); }
function isRoundActive(token, serial) { return isActive(token) && serial === roundSerial; }
function clearTimers() { timers.forEach((id) => window.clearTimeout(id)); timers.clear(); }
function cancelGame() { running = false; acceptingInput = false; roundResolved = true; gameToken += 1; roundSerial += 1; clearTimers(); stopLv22Sounds(); }
function destroyPage() {
  cancelGame();
  lifecycleController?.abort(); lifecycleController = null;
  inputController?.abort(); inputController = null;
  viewportController?.abort(); viewportController = null;
  window.clearInterval(routeWatchTimer); routeWatchTimer = 0;
  window.cancelAnimationFrame(resizeFrame); resizeFrame = 0;
}
