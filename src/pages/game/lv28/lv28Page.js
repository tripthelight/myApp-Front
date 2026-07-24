import lv28Style from "../../../assets/scss/game/lv28/common.scss?inline";
import lv28Template from "./lv28.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv28Catch,
  playLv28Finish,
  playLv28Note,
  playStartSound,
  readySound,
  stopLv28Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv28Sound.js";

const ROUND_COUNTS = [2, 3, 4, 5];
const NOTES = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5", "G5"];
const LISTEN_LEAD_MS = 620;
const ROUND_GAP_MS = 980;
const MIN_NOTE_MS = 280;
const MAX_NOTE_MS = 620;
const MIN_GAP_MS = 300;
const MAX_GAP_MS = 700;

let gameToken = 0;
let running = false;
let lessonRunning = false;
let currentRound = 0;
let expectedIndex = 0;
let currentPattern = [];
let currentBars = [];
let successCount = 0;
let failCount = 0;
let timers = new Set();
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let mountedPathname = "";
let routeWatchTimer = 0;

export function renderPage() {
  destroyPage();
  renderView(lv28Template, lv28Style);
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv28Page")) destroyPage();
  }, 100);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv28Page");
    if (!page) return;
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    page.style.setProperty("--lv28-vw", `${width}px`);
    page.style.setProperty("--lv28-vh", `${height}px`);
    page.classList.toggle("is-compact", height < 620 || width < 460);
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
  document.getElementById("lv28StartButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv28RetryButton")?.addEventListener("click", retryGame, { signal });
  document.getElementById("lv28NextButton")?.addEventListener("click", () => {
    cancelGame();
    navigate("lv29", { replace: true });
  }, { signal });
  document.getElementById("lv28HomeButton")?.addEventListener("click", () => {
    cancelGame();
    navigate("home", { replace: true });
  }, { signal });
  document.getElementById("lv28Page")?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

function prepareReadyState() {
  running = false;
  lessonRunning = false;
  currentRound = 0;
  expectedIndex = 0;
  successCount = 0;
  failCount = 0;
  currentPattern = [];
  currentBars = [];
  clearStage();
  setText("lv28Phase", "READY");
  setText("lv28Round", "0 / 4");
  setText("lv28Hint", "먼저 리듬을 기억하세요");
  setProgress(0);
  hide("lv28Lesson");
  hide("lv28Result");
  show("lv28Ready");
}

async function startGame() {
  cancelGame();
  const token = ++gameToken;
  lessonRunning = true;
  currentRound = 0;
  successCount = 0;
  failCount = 0;
  hide("lv28Ready");
  hide("lv28Result");
  await readySound();
  playStartSound();
  await runLesson(token);
  if (!isActive(token)) return;
  lessonRunning = false;
  running = true;
  document.getElementById("lv28Page")?.classList.add("is-playing");
  runRound(token, 0);
}

function retryGame() {
  hide("lv28Result");
  startGameWithoutLesson();
}

async function startGameWithoutLesson() {
  cancelGame();
  const token = ++gameToken;
  currentRound = 0;
  successCount = 0;
  failCount = 0;
  await readySound();
  playStartSound();
  if (!isActive(token)) return;
  running = true;
  document.getElementById("lv28Page")?.classList.add("is-playing");
  runRound(token, 0);
}

async function runLesson(token) {
  show("lv28Lesson");
  const lesson = document.getElementById("lv28Lesson");
  lesson?.classList.add("is-listen");
  setText("lv28LessonTitle", "LISTEN");
  setText("lv28LessonText", "두 음의 순서와 간격을 기억하세요");
  playLv28Note("C5", 280, "lesson-1");
  await wait(620, token);
  playLv28Note("G5", 430, "lesson-2");
  await wait(1050, token);
  if (!isActive(token)) return;
  lesson?.classList.remove("is-listen");
  lesson?.classList.add("is-catch");
  setText("lv28LessonTitle", "CATCH");
  setText("lv28LessonText", "떨어진 막대를 들었던 순서대로 터치하세요");
  await wait(1600, token);
  lesson?.classList.remove("is-catch");
  hide("lv28Lesson");
}

function runRound(token, roundIndex) {
  if (!isActive(token) || !running) return;
  currentRound = roundIndex;
  expectedIndex = 0;
  const count = ROUND_COUNTS[roundIndex];
  currentPattern = createPattern(count);
  renderBars(currentPattern);
  setText("lv28Round", `${roundIndex + 1} / 4`);
  setText("lv28Phase", "LISTEN");
  setText("lv28Hint", `${count}개의 음을 기억하세요`);
  setProgress(roundIndex / ROUND_COUNTS.length);
  document.getElementById("lv28Page")?.classList.remove("is-dropping");
  document.getElementById("lv28Page")?.classList.add("is-listening");

  let cursor = LISTEN_LEAD_MS;
  currentPattern.forEach((item, index) => {
    schedule(() => {
      if (!isActive(token) || !running) return;
      playLv28Note(item.note, item.noteDuration, `round-${roundIndex}-listen-${index}`);
      item.element?.classList.add("is-hearing");
      schedule(() => item.element?.classList.remove("is-hearing"), Math.min(item.noteDuration, 420));
    }, cursor);
    cursor += item.gapAfter;
  });

  schedule(() => beginDropPhase(token), cursor + 520);
}

function createPattern(count) {
  const laneOrder = shuffle(Array.from({ length: count }, (_, index) => index));
  let previousNote = "";
  return laneOrder.map((laneIndex, orderIndex) => {
    let note = NOTES[randomInt(0, NOTES.length - 1)];
    while (note === previousNote && NOTES.length > 1) note = NOTES[randomInt(0, NOTES.length - 1)];
    previousNote = note;
    return {
      id: `${currentRound}-${laneIndex}-${orderIndex}-${Math.random().toString(36).slice(2)}`,
      laneIndex,
      orderIndex,
      note,
      noteDuration: randomInt(MIN_NOTE_MS, MAX_NOTE_MS),
      gapAfter: randomInt(MIN_GAP_MS, MAX_GAP_MS),
      barHeight: randomInt(62, 132),
      barWidth: randomInt(16, 28),
      dropDuration: randomInt(1550, 3000),
      state: "hanging",
      element: null,
      missTimer: 0,
    };
  });
}

function renderBars(pattern) {
  const grid = document.getElementById("lv28LaneGrid");
  if (!grid) return;
  grid.replaceChildren();
  grid.style.setProperty("--lv28-lane-count", String(pattern.length));
  const byLane = [...pattern].sort((a, b) => a.laneIndex - b.laneIndex);
  byLane.forEach((item) => {
    const lane = document.createElement("div");
    lane.className = "lv28-lane";
    lane.dataset.lane = String(item.laneIndex);
    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = "lv28-bar";
    bar.setAttribute("aria-label", `${item.laneIndex + 1}번 막대`);
    bar.style.setProperty("--lv28-bar-height", `${item.barHeight}px`);
    bar.style.setProperty("--lv28-bar-width", `${item.barWidth}px`);
    bar.style.setProperty("--lv28-drop-duration", `${item.dropDuration}ms`);
    bar.style.setProperty("--lv28-bar-hue", String((item.laneIndex * 47 + currentRound * 23) % 160));
    bar.addEventListener("pointerdown", (event) => handleBarPress(event, item));
    lane.append(bar);
    grid.append(lane);
    item.element = bar;
  });
  currentBars = pattern;
}

function beginDropPhase(token) {
  if (!isActive(token) || !running) return;
  setText("lv28Phase", "CATCH");
  setText("lv28Hint", "떨어지는 막대를 순서대로 터치하세요");
  document.getElementById("lv28Page")?.classList.remove("is-listening");
  document.getElementById("lv28Page")?.classList.add("is-dropping");

  let cursor = 220;
  currentPattern.forEach((item, index) => {
    schedule(() => launchBar(token, item, index), cursor);
    cursor += item.gapAfter;
  });
  const longestDrop = Math.max(...currentPattern.map((item) => item.dropDuration));
  schedule(() => finishRound(token), cursor + longestDrop + 420);
}

function launchBar(token, item, index) {
  if (!isActive(token) || !running || item.state !== "hanging") return;
  item.state = "falling";
  item.element?.classList.add("is-falling");
  playLv28Note(item.note, Math.min(item.noteDuration, 360), `round-${currentRound}-drop-${index}`);
  item.missTimer = schedule(() => missBar(item), item.dropDuration + 80);
}

function handleBarPress(event, item) {
  event.preventDefault();
  if (!running || lessonRunning || item.state === "caught" || item.state === "missed") return;
  const expected = currentPattern[expectedIndex];
  if (item.state !== "falling") {
    registerFailure(item, "TOO EARLY");
    return;
  }
  if (!expected || expected.id !== item.id) {
    registerFailure(item, "WRONG ORDER");
    return;
  }
  catchBar(item);
}

function catchBar(item) {
  item.state = "caught";
  clearScheduled(item.missTimer);
  freezeBarPosition(item.element);
  item.element?.classList.remove("is-falling", "is-fail");
  item.element?.classList.add("is-caught");
  successCount += 1;
  expectedIndex += 1;
  playLv28Catch(true);
  showJudge("NICE", true);
  advanceExpectedPastResolved();
}

function missBar(item) {
  if (!running || item.state !== "falling") return;
  item.state = "missed";
  item.element?.classList.remove("is-falling");
  item.element?.classList.add("is-missed");
  failCount += 1;
  playLv28Catch(false);
  showJudge("MISS", false);
  advanceExpectedPastResolved();
}

function registerFailure(item, label) {
  if (item.state === "failed" || item.state === "caught" || item.state === "missed") return;
  item.state = "failed";
  clearScheduled(item.missTimer);
  if (item.element?.classList.contains("is-falling")) freezeBarPosition(item.element);
  item.element?.classList.remove("is-falling");
  item.element?.classList.add("is-fail");
  failCount += 1;
  playLv28Catch(false);
  showJudge(label, false);
  advanceExpectedPastResolved();
}

function advanceExpectedPastResolved() {
  while (expectedIndex < currentPattern.length) {
    const state = currentPattern[expectedIndex].state;
    if (state === "caught" || state === "failed" || state === "missed") expectedIndex += 1;
    else break;
  }
}

function finishRound(token) {
  if (!isActive(token) || !running) return;
  currentPattern.forEach((item) => {
    if (item.state === "hanging" || item.state === "falling") missBar(item);
  });
  document.getElementById("lv28Page")?.classList.remove("is-dropping");
  setProgress((currentRound + 1) / ROUND_COUNTS.length);
  if (currentRound < ROUND_COUNTS.length - 1) {
    setText("lv28Phase", "ROUND CLEAR");
    setText("lv28Hint", "다음 리듬을 준비하세요");
    schedule(() => runRound(token, currentRound + 1), ROUND_GAP_MS);
    return;
  }
  schedule(() => finishGame(token), 700);
}

function finishGame(token) {
  if (!isActive(token)) return;
  running = false;
  document.getElementById("lv28Page")?.classList.remove("is-playing", "is-listening", "is-dropping");
  const perfect = failCount === 0;
  setText("lv28Phase", "COMPLETE");
  setText("lv28ResultTitle", perfect ? "PERFECT CATCH" : "TRY AGAIN");
  setText("lv28ResultText", perfect
    ? "모든 막대를 정확한 순서로 잡았습니다."
    : "놓치거나 순서가 어긋난 막대가 있었습니다.");
  setText("lv28SuccessCount", String(successCount));
  setText("lv28FailCount", String(failCount));
  toggleHidden("lv28NextButton", !perfect);
  toggleHidden("lv28RetryButton", perfect);
  playLv28Finish(perfect);
  show("lv28Result");
}

function freezeBarPosition(element) {
  if (!element) return;
  const matrix = new DOMMatrixReadOnly(window.getComputedStyle(element).transform);
  element.style.top = `${element.offsetTop + matrix.m42}px`;
  element.style.transform = "translateX(-50%)";
}

function showJudge(text, success) {
  const judge = document.getElementById("lv28Judge");
  if (!judge) return;
  judge.textContent = text;
  judge.className = `lv28-judge ${success ? "is-success" : "is-fail"}`;
  void judge.offsetWidth;
  judge.classList.add("is-visible");
  schedule(() => judge.classList.remove("is-visible"), 520);
}

function clearStage() {
  document.getElementById("lv28LaneGrid")?.replaceChildren();
  currentBars = [];
}

function cancelGame() {
  running = false;
  lessonRunning = false;
  clearAllTimers();
  currentBars.forEach((item) => clearScheduled(item.missTimer));
  stopLv28Sounds();
  const page = document.getElementById("lv28Page");
  page?.classList.remove("is-playing", "is-listening", "is-dropping");
}

function destroyPage() {
  gameToken += 1;
  cancelGame();
  lifecycleController?.abort();
  inputController?.abort();
  viewportController?.abort();
  lifecycleController = null;
  inputController = null;
  viewportController = null;
  window.clearInterval(routeWatchTimer);
  routeWatchTimer = 0;
}

function isActive(token) {
  return token === gameToken && Boolean(document.getElementById("lv28Page"));
}

function wait(delay, token) {
  return new Promise((resolve) => schedule(() => resolve(isActive(token)), delay));
}

function schedule(callback, delay) {
  const id = window.setTimeout(() => {
    timers.delete(id);
    callback();
  }, Math.max(0, delay));
  timers.add(id);
  return id;
}

function clearScheduled(id) {
  if (!id) return;
  window.clearTimeout(id);
  timers.delete(id);
}

function clearAllTimers() {
  timers.forEach((id) => window.clearTimeout(id));
  timers.clear();
}

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setProgress(value) {
  document.getElementById("lv28Progress")?.style.setProperty("transform", `scaleX(${Math.max(0, Math.min(1, value))})`);
}

function show(id) {
  const element = document.getElementById(id);
  if (element) element.hidden = false;
}

function hide(id) {
  const element = document.getElementById(id);
  if (element) element.hidden = true;
}

function toggleHidden(id, hidden) {
  const element = document.getElementById(id);
  if (element) element.hidden = hidden;
}
