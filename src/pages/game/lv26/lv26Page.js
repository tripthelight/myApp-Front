import lv26Style from "../../../assets/scss/game/lv26/common.scss?inline";
import lv26Template from "./lv26.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv26Fail,
  playLv26Finish,
  playLv26Lane,
  playLv26Success,
  playStartSound,
  readySound,
  stopLv26Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv26Sound.js";

const GAME_DURATION_MS = 60_000;
const LESSON_LANES = Object.freeze([0, 1, 2]);
const LANE_NAMES = Object.freeze(["LEFT", "CENTER", "RIGHT"]);
const LANE_HINTS = Object.freeze(["왼쪽 길", "가운데 길", "오른쪽 길"]);
const MIN_INTERVAL_MS = 1030;
const MAX_INTERVAL_MS = 1450;
const ROAD_START_DURATION_MS = 1250;

let gameToken = 0;
let running = false;
let lessonRunning = false;
let gameStartedAt = 0;
let successCount = 0;
let failCount = 0;
let currentCue = null;
let previousLanes = [];
let timers = new Set();
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let mountedPathname = "";
let routeWatchTimer = 0;
let animationFrame = 0;
let judgeTimer = 0;
let viewportFrame = 0;

export function renderPage() {
  destroyPage();
  renderView(lv26Template, lv26Style);
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv26Page")) destroyPage();
  }, 100);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv26Page");
    if (!page) return;
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    page.style.setProperty("--lv26-vw", `${width}px`);
    page.style.setProperty("--lv26-vh", `${height}px`);
    page.style.setProperty("--lv26-scale", String(Math.min(1, Math.max(.72, Math.min(width / 980, height / 760)))));
    page.classList.toggle("is-compact", height < 620 || width < 520);
    window.cancelAnimationFrame(viewportFrame);
    viewportFrame = window.requestAnimationFrame(() => {
      const runner = document.getElementById("lv26Runner");
      if (runner && currentCue) setRunnerLane(currentCue.selectedLane ?? 1, false);
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
  document.getElementById("lv26StartButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv26RetryButton")?.addEventListener("click", retryGame, { signal });
  document.getElementById("lv26NextButton")?.addEventListener("click", () => {
    cancelGame();
    navigate("lv27", { replace: true });
  }, { signal });
  document.getElementById("lv26HomeButton")?.addEventListener("click", () => {
    cancelGame();
    navigate("home", { replace: true });
  }, { signal });
  document.querySelectorAll("#lv26Page .lv26-lane").forEach((lane) => {
    lane.addEventListener("pointerdown", handleLanePress, { signal });
  });
  document.getElementById("lv26Page")?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

function prepareReadyState() {
  running = false;
  lessonRunning = false;
  successCount = 0;
  failCount = 0;
  currentCue = null;
  previousLanes = [];
  setRunnerLane(1, false);
  clearLaneStates();
  setText("lv26Phase", "READY");
  setText("lv26Time", "01:00");
  setText("lv26Hint", "세 가지 길의 소리를 기억하세요");
  setProgress(0);
  setRoadSpeed(0);
  hide("lv26Lesson");
  hide("lv26Result");
  show("lv26Ready");
}

async function startGame() {
  cancelGame();
  const token = ++gameToken;
  lessonRunning = true;
  successCount = 0;
  failCount = 0;
  previousLanes = [];
  hide("lv26Ready");
  hide("lv26Result");
  show("lv26Lesson");
  document.getElementById("lv26Page")?.classList.add("is-playing", "is-lesson");
  setProgress(0);
  setText("lv26Time", "01:00");
  setText("lv26Phase", "LISTEN");
  setText("lv26Hint", "각 길의 고유한 음을 기억하세요");
  await readySound();
  if (!isActive(token)) return;
  playStartSound();
  schedule(() => runLesson(token, 0), 520);
}

function retryGame() {
  cancelGame();
  const token = ++gameToken;
  successCount = 0;
  failCount = 0;
  previousLanes = [];
  hide("lv26Result");
  hide("lv26Ready");
  hide("lv26Lesson");
  document.getElementById("lv26Page")?.classList.add("is-playing");
  setRunnerLane(1, true);
  setProgress(0);
  setText("lv26Time", "01:00");
  setText("lv26Phase", "READY");
  setText("lv26Hint", "소리를 듣고 같은 길을 터치하세요");
  playStartSound();
  schedule(() => beginRun(token), 720);
}

function runLesson(token, index) {
  if (!isActive(token) || !lessonRunning) return;
  if (index >= LESSON_LANES.length) {
    finishLesson(token);
    return;
  }
  const lane = LESSON_LANES[index];
  clearLaneStates();
  setLaneState(lane, "is-cue", true);
  setRunnerLane(lane, true);
  setText("lv26LessonTitle", LANE_NAMES[lane]);
  setText("lv26LessonStep", `${index + 1} / 3`);
  setText("lv26Hint", `${LANE_HINTS[lane]}의 소리입니다`);
  playLv26Lane(lane, true);
  schedule(() => setLaneState(lane, "is-cue", false), 620);
  schedule(() => runLesson(token, index + 1), 1050);
}

function finishLesson(token) {
  if (!isActive(token)) return;
  clearLaneStates();
  setRunnerLane(1, true);
  setText("lv26LessonTitle", "READY");
  setText("lv26LessonStep", "소리를 듣고 길을 터치하세요");
  setText("lv26Hint", "들린 음과 같은 길을 빠르게 터치하세요");
  playStartSound();
  schedule(() => {
    if (!isActive(token)) return;
    hide("lv26Lesson");
    document.getElementById("lv26Page")?.classList.remove("is-lesson");
    lessonRunning = false;
    beginRun(token);
  }, 900);
}

function beginRun(token) {
  if (!isActive(token)) return;
  running = true;
  gameStartedAt = performance.now();
  currentCue = null;
  setText("lv26Phase", "DRIVE");
  setText("lv26Hint", "소리를 듣고 같은 길을 터치하세요");
  tick(token);
  scheduleNextCue(token, 420);
}

function tick(token) {
  if (!isActive(token) || !running) return;
  const elapsed = performance.now() - gameStartedAt;
  const progress = Math.min(1, elapsed / GAME_DURATION_MS);
  const remaining = Math.max(0, GAME_DURATION_MS - elapsed);
  setProgress(progress);
  setRoadSpeed(progress);
  setText("lv26Time", formatTime(remaining));
  if (elapsed >= GAME_DURATION_MS) {
    finishGame(token);
    return;
  }
  animationFrame = window.requestAnimationFrame(() => tick(token));
}

function scheduleNextCue(token, delay = getCueInterval()) {
  schedule(() => emitCue(token), delay);
}

function emitCue(token) {
  if (!isActive(token) || !running) return;
  if (performance.now() - gameStartedAt >= GAME_DURATION_MS) {
    finishGame(token);
    return;
  }
  if (currentCue && !currentCue.resolved) resolveCue(false, "late");

  const lane = chooseLane();
  const interval = getCueInterval();
  const hitWindow = Math.max(300, Math.min(620, interval * .58));
  const cue = {
    lane,
    openedAt: performance.now(),
    hitWindow,
    resolved: false,
    selectedLane: null,
    timeoutId: 0,
  };
  currentCue = cue;
  setText("lv26Phase", "LISTEN");
  setText("lv26Hint", "지금 들린 길을 터치하세요");
  setLaneState(lane, "is-cue", true);
  playLv26Lane(lane);
  cue.timeoutId = schedule(() => {
    if (currentCue === cue && !cue.resolved) resolveCue(false, "late");
  }, hitWindow);
  scheduleNextCue(token, interval);
}

function handleLanePress(event) {
  event.preventDefault();
  const lane = Number(event.currentTarget.dataset.lane);
  pulseLane(lane);
  setRunnerLane(lane, true);

  if (!running || lessonRunning) return;
  const cue = currentCue;
  if (!cue || cue.resolved) {
    registerLooseFailure(lane);
    return;
  }

  cue.selectedLane = lane;
  const reaction = performance.now() - cue.openedAt;
  const correct = lane === cue.lane && reaction <= cue.hitWindow;
  resolveCue(correct, correct ? "success" : "wrong");
}

function resolveCue(success, reason) {
  const cue = currentCue;
  if (!cue || cue.resolved) return;
  cue.resolved = true;
  if (cue.timeoutId) clearScheduled(cue.timeoutId);
  setLaneState(cue.lane, "is-cue", false);

  if (success) {
    successCount += 1;
    setLaneState(cue.lane, "is-success", true);
    setText("lv26Phase", "PERFECT");
    setText("lv26Hint", "정확합니다");
    showJudge("PERFECT", true);
    playLv26Success();
    schedule(() => setLaneState(cue.lane, "is-success", false), 260);
  } else {
    failCount += 1;
    setLaneState(cue.lane, "is-fail", true);
    setText("lv26Phase", reason === "late" ? "TOO LATE" : "MISS");
    setText("lv26Hint", reason === "late" ? `${LANE_HINTS[cue.lane]}을 놓쳤습니다` : `${LANE_HINTS[cue.lane]}의 음이었습니다`);
    showJudge(reason === "late" ? "TOO LATE" : "MISS", false);
    playLv26Fail();
    schedule(() => setLaneState(cue.lane, "is-fail", false), 300);
  }
}

function registerLooseFailure(lane) {
  failCount += 1;
  setLaneState(lane, "is-fail", true);
  setText("lv26Phase", "MISS");
  setText("lv26Hint", "소리가 난 뒤에 한 번만 터치하세요");
  showJudge("MISS", false);
  playLv26Fail();
  schedule(() => setLaneState(lane, "is-fail", false), 260);
}

function finishGame(token) {
  if (!isActive(token) || !running) return;
  running = false;
  window.cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  if (currentCue && !currentCue.resolved) resolveCue(false, "late");
  clearLaneStates();
  currentCue = null;
  setProgress(1);
  setText("lv26Time", "00:00");
  setText("lv26Phase", "FINISH");
  setText("lv26Hint", "1분 주행이 끝났습니다");
  const perfect = failCount === 0;
  playLv26Finish(perfect);
  setText("lv26ResultTitle", perfect ? "PERFECT DRIVE" : "TRY AGAIN");
  setText("lv26ResultText", perfect
    ? "모든 도로음을 정확한 타이밍에 따라갔습니다."
    : `${failCount}번 놓쳤습니다. 세 가지 음을 다시 기억하고 도전하세요.`);
  setText("lv26SuccessCount", String(successCount));
  setText("lv26FailCount", String(failCount));
  toggleHidden("lv26NextButton", !perfect);
  toggleHidden("lv26RetryButton", perfect);
  schedule(() => show("lv26Result"), 560);
}

function chooseLane() {
  let candidates = [0, 1, 2];
  if (previousLanes.length >= 2 && previousLanes.at(-1) === previousLanes.at(-2)) {
    candidates = candidates.filter((lane) => lane !== previousLanes.at(-1));
  }
  const lane = candidates[Math.floor(Math.random() * candidates.length)];
  previousLanes.push(lane);
  if (previousLanes.length > 3) previousLanes.shift();
  return lane;
}

function getCueInterval() {
  const progress = getGameProgress();
  const base = getBaseCueInterval(progress);
  return Math.round(base * randomBetween(.9, 1.1));
}

function getGameProgress() {
  if (!gameStartedAt) return 0;
  return Math.min(1, Math.max(0, (performance.now() - gameStartedAt) / GAME_DURATION_MS));
}

function getTempoProgress(progress) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, progress)), 1.45);
}

function getBaseCueInterval(progress) {
  const eased = getTempoProgress(progress);
  return MAX_INTERVAL_MS + (MIN_INTERVAL_MS - MAX_INTERVAL_MS) * eased;
}

function setRoadSpeed(progress) {
  const page = document.getElementById("lv26Page");
  if (!page) return;

  const cueInterval = getBaseCueInterval(progress);
  const duration = ROAD_START_DURATION_MS * (cueInterval / MAX_INTERVAL_MS);
  page.style.setProperty("--road-speed", `${Math.round(duration)}ms`);
}

function setRunnerLane(lane, animate) {
  const runner = document.getElementById("lv26Runner");
  if (!runner) return;
  runner.classList.toggle("is-moving", animate);
  runner.classList.remove("lane-0", "lane-1", "lane-2");
  runner.classList.add(`lane-${Math.max(0, Math.min(2, lane))}`);
}

function pulseLane(lane) {
  const element = document.querySelector(`#lv26Page .lv26-lane[data-lane="${lane}"]`);
  if (!element) return;
  element.classList.remove("is-pressed");
  void element.offsetWidth;
  element.classList.add("is-pressed");
  schedule(() => element.classList.remove("is-pressed"), 220);
}

function showJudge(text, success) {
  const judge = document.getElementById("lv26Judge");
  if (!judge) return;
  window.clearTimeout(judgeTimer);
  judge.textContent = text;
  judge.classList.remove("is-success", "is-fail", "is-visible");
  void judge.offsetWidth;
  judge.classList.add(success ? "is-success" : "is-fail", "is-visible");
  judgeTimer = window.setTimeout(() => judge.classList.remove("is-visible"), 420);
}

function setLaneState(lane, className, enabled) {
  document.querySelector(`#lv26Page .lv26-lane[data-lane="${lane}"]`)?.classList.toggle(className, enabled);
}

function clearLaneStates() {
  document.querySelectorAll("#lv26Page .lv26-lane").forEach((lane) => {
    lane.classList.remove("is-cue", "is-success", "is-fail", "is-pressed");
  });
}

function cancelGame() {
  running = false;
  lessonRunning = false;
  currentCue = null;
  gameStartedAt = 0;
  clearAllTimers();
  window.cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  window.clearTimeout(judgeTimer);
  judgeTimer = 0;
  clearLaneStates();
  stopLv26Sounds();
  const page = document.getElementById("lv26Page");
  page?.classList.remove("is-playing", "is-lesson");
  setRoadSpeed(0);
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
  window.cancelAnimationFrame(viewportFrame);
  viewportFrame = 0;
}

function isActive(token) {
  return token === gameToken && Boolean(document.getElementById("lv26Page"));
}

function schedule(callback, delay) {
  const id = window.setTimeout(() => {
    timers.delete(id);
    callback();
  }, delay);
  timers.add(id);
  return id;
}

function clearScheduled(id) {
  window.clearTimeout(id);
  timers.delete(id);
}

function clearAllTimers() {
  timers.forEach((id) => window.clearTimeout(id));
  timers.clear();
}

function setProgress(value) {
  document.getElementById("lv26Progress")?.style.setProperty("transform", `scaleX(${Math.min(1, Math.max(0, value))})`);
}

function formatTime(milliseconds) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
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
