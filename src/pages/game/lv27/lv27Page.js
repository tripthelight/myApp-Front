import lv27Style from "../../../assets/scss/game/lv27/common.scss?inline";
import lv27Template from "./lv27.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv27Beat,
  playLv27Finish,
  playLv27Touch,
  playStartSound,
  readySound,
  stopLv27Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv27Sound.js";

const SCENES = Object.freeze([
  { key: "loading", elementId: "lv27LoadingScene", name: "LOADING" },
  { key: "monster", elementId: "lv27MonsterScene", name: "MONSTER HP" },
  { key: "saber", elementId: "lv27SaberScene", name: "ENERGY BLADE" },
  { key: "volume", elementId: "lv27VolumeScene", name: "VOLUME" },
]);
const TOTAL_SCENES = SCENES.length;
const BEAT_MIN_MS = 520;
const BEAT_MAX_MS = 1120;
const LEAD_IN_MS = 820;
const BEAT_GAP_MS = 150;
const JUDGE_EARLY_MS = 190;
const JUDGE_LATE_MS = 210;
const SCENE_GAP_MS = 1050;

let gameToken = 0;
let running = false;
let lessonRunning = false;
let pattern = [];
let sceneOrder = [];
let sceneIndex = 0;
let beatIndex = 0;
let sceneStartTime = 0;
let expectedTimes = [];
let successCount = 0;
let failCount = 0;
let beatResults = [];
let timers = new Set();
let animationFrame = 0;
let judgeTimer = 0;
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let mountedPathname = "";
let routeWatchTimer = 0;

export function renderPage() {
  destroyPage();
  renderView(lv27Template, lv27Style);
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv27Page")) destroyPage();
  }, 100);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv27Page");
    if (!page) return;
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    page.style.setProperty("--lv27-vw", `${width}px`);
    page.style.setProperty("--lv27-vh", `${height}px`);
    page.classList.toggle("is-compact", height < 620 || width < 480);
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
  document.getElementById("lv27StartButton")?.addEventListener("click", startFromLesson, { signal });
  document.getElementById("lv27RetryButton")?.addEventListener("click", retryGame, { signal });
  document.getElementById("lv27NextButton")?.addEventListener("click", () => {
    cancelGame();
    navigate("lv28", { replace: true });
  }, { signal });
  document.getElementById("lv27HomeButton")?.addEventListener("click", () => {
    cancelGame();
    navigate("home", { replace: true });
  }, { signal });
  document.getElementById("lv27TouchLayer")?.addEventListener("pointerdown", handleTouch, { signal });
  document.getElementById("lv27Page")?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

function prepareReadyState() {
  running = false;
  lessonRunning = false;
  pattern = [];
  sceneOrder = [];
  successCount = 0;
  failCount = 0;
  resetStage();
  setText("lv27Phase", "READY");
  setText("lv27Round", `0 / ${TOTAL_SCENES}`);
  setRoundProgress(0);
  hide("lv27Lesson");
  hide("lv27Result");
  show("lv27Ready");
}

async function startFromLesson() {
  cancelGame();
  const token = ++gameToken;
  lessonRunning = true;
  hide("lv27Ready");
  hide("lv27Result");
  show("lv27Lesson");
  await readySound();
  if (!isActive(token)) return;
  playStartSound();
  runLesson(token);
}

function runLesson(token) {
  const steps = [
    { title: "LISTEN", text: "간격이 다른 네 박자를 기억하세요", className: "is-listen", delay: 1750 },
    { title: "REMEMBER", text: "소리가 끝나면 같은 리듬을 떠올리세요", className: "is-remember", delay: 1750 },
    { title: "TAP", text: "네 장면에서 네 번씩 화면을 터치하세요", className: "is-tap", delay: 1850 },
  ];
  let index = 0;
  const next = () => {
    if (!isActive(token) || !lessonRunning) return;
    if (index >= steps.length) {
      hide("lv27Lesson");
      lessonRunning = false;
      beginGame(token);
      return;
    }
    const step = steps[index++];
    const lesson = document.getElementById("lv27Lesson");
    lesson?.classList.remove("is-listen", "is-remember", "is-tap", "is-entering");
    void lesson?.offsetWidth;
    lesson?.classList.add(step.className, "is-entering");
    setText("lv27LessonTitle", step.title);
    setText("lv27LessonText", step.text);
    if (step.className === "is-listen") {
      [0, 1, 2, 3].forEach((beat, beatOffset) => schedule(() => playLv27Beat(beat, true), 280 + beatOffset * 330));
    }
    schedule(next, step.delay);
  };
  next();
}

function retryGame() {
  cancelGame();
  const token = ++gameToken;
  hide("lv27Result");
  hide("lv27Ready");
  playStartSound();
  schedule(() => beginGame(token), 620);
}

function beginGame(token) {
  if (!isActive(token)) return;
  running = true;
  pattern = createPattern();
  sceneOrder = shuffle([...SCENES]);
  sceneIndex = 0;
  successCount = 0;
  failCount = 0;
  document.getElementById("lv27Page")?.classList.add("is-playing", "is-listening");
  show("lv27Blank");
  hide("lv27Scene");
  setText("lv27Phase", "LISTEN");
  setText("lv27Round", `0 / ${TOTAL_SCENES}`);
  setText("lv27Hint", "네 박자의 간격을 기억하세요");
  setRoundProgress(0);
  playPattern(token);
}

function playPattern(token) {
  let elapsed = 520;
  pattern.forEach((duration, index) => {
    elapsed += duration;
    schedule(() => {
      if (!isActive(token) || !running) return;
      pulseListenBeat(index);
      playLv27Beat(index, true);
    }, elapsed);
    if (index < pattern.length - 1) elapsed += BEAT_GAP_MS;
  });
  schedule(() => {
    if (!isActive(token) || !running) return;
    setText("lv27Phase", "REMEMBER");
    setText("lv27Hint", "잠시 떠올려 보세요");
    document.getElementById("lv27Page")?.classList.remove("is-listening");
  }, elapsed + 100);
  schedule(() => startScene(token), elapsed + 1050);
}

function startScene(token) {
  if (!isActive(token) || !running) return;
  if (sceneIndex >= sceneOrder.length) {
    finishGame(token);
    return;
  }
  const scene = sceneOrder[sceneIndex];
  beatIndex = 0;
  beatResults = new Array(4).fill(null);
  resetSceneVisuals();
  show("lv27Scene");
  hide("lv27Blank");
  SCENES.forEach((item) => hide(item.elementId));
  show(scene.elementId);
  setText("lv27SceneIndex", `SCENE ${sceneIndex + 1}`);
  setText("lv27SceneName", scene.name);
  setText("lv27Round", `${sceneIndex + 1} / ${TOTAL_SCENES}`);
  setText("lv27Phase", "PLAY");
  setText("lv27SceneHint", "기억한 타이밍에 화면을 터치하세요");
  setRoundProgress(sceneIndex / TOTAL_SCENES);
  updateRhythmMarkers();
  const touchLayer = document.getElementById("lv27TouchLayer");
  if (touchLayer) touchLayer.disabled = false;

  sceneStartTime = performance.now() + LEAD_IN_MS;
  let timelineDuration = 0;
  expectedTimes = pattern.map((duration, index) => {
    timelineDuration += duration;
    const expectedTime = sceneStartTime + timelineDuration;
    if (index < pattern.length - 1) timelineDuration += BEAT_GAP_MS;
    return expectedTime;
  });
  schedule(() => runSceneAnimation(token, scene, timelineDuration), LEAD_IN_MS);
  expectedTimes.forEach((expected, index) => {
    const missAt = expected - performance.now() + JUDGE_LATE_MS;
    schedule(() => markMissedBeat(token, index), Math.max(0, missAt));
  });
  schedule(() => completeScene(token), LEAD_IN_MS + timelineDuration + JUDGE_LATE_MS + 420);
}

function runSceneAnimation(token, scene, timelineDuration) {
  if (!isActive(token) || !running) return;
  const start = performance.now();
  const motionDuration = pattern.reduce((sum, duration) => sum + duration, 0);
  const segments = [];
  let timelineCursor = 0;
  let motionCursor = 0;

  pattern.forEach((duration, index) => {
    const activeStart = timelineCursor;
    const activeEnd = activeStart + duration;
    const pauseEnd = activeEnd + (index < pattern.length - 1 ? BEAT_GAP_MS : 0);
    segments.push({ index, duration, activeStart, activeEnd, pauseEnd, motionStart: motionCursor });
    timelineCursor = pauseEnd;
    motionCursor += duration;
  });

  const frame = (now) => {
    if (!isActive(token) || !running || scene !== sceneOrder[sceneIndex]) return;
    const elapsed = Math.min(timelineDuration, Math.max(0, now - start));
    const state = getSegmentProgress(elapsed, segments, motionDuration);
    updateSceneProgress(scene.key, state.progress);
    document.getElementById("lv27Page")?.style.setProperty("--lv27-current-beat", String(state.beatIndex));

    if (elapsed < timelineDuration) animationFrame = window.requestAnimationFrame(frame);
    else updateSceneProgress(scene.key, 1);
  };
  animationFrame = window.requestAnimationFrame(frame);
}

function getSegmentProgress(elapsed, segments, motionDuration) {
  if (!motionDuration || !segments.length) return { progress: 1, beatIndex: 3 };

  for (const segment of segments) {
    if (elapsed <= segment.activeEnd) {
      const localProgress = Math.min(1, Math.max(0,
        (elapsed - segment.activeStart) / segment.duration,
      ));
      const easedProgress = localProgress * localProgress * localProgress;
      return {
        progress: (segment.motionStart + segment.duration * easedProgress) / motionDuration,
        beatIndex: segment.index,
      };
    }
    if (elapsed < segment.pauseEnd) {
      return {
        progress: (segment.motionStart + segment.duration) / motionDuration,
        beatIndex: segment.index,
      };
    }
  }

  return { progress: 1, beatIndex: 3 };
}

function handleTouch(event) {
  event.preventDefault();
  if (!running || sceneIndex >= sceneOrder.length || beatIndex >= 4) return;
  const now = performance.now();
  while (beatIndex < 4 && beatResults[beatIndex] !== null) beatIndex += 1;
  if (beatIndex >= 4) return;
  const expected = expectedTimes[beatIndex];
  const difference = now - expected;
  if (difference < -JUDGE_EARLY_MS) {
    registerFailure(beatIndex, "TOO EARLY");
    return;
  }
  if (difference <= JUDGE_LATE_MS) {
    registerSuccess(beatIndex);
    return;
  }
  registerFailure(beatIndex, "TOO LATE");
}

function markMissedBeat(token, index) {
  if (!isActive(token) || !running || beatResults[index] !== null) return;
  registerFailure(index, "MISS");
}

function registerSuccess(index) {
  if (beatResults[index] !== null) return;
  beatResults[index] = true;
  successCount += 1;
  setBeatDot(index, "is-success");
  showJudge("PERFECT", true);
  playLv27Touch(true);
  beatIndex = index + 1;
}

function registerFailure(index, label) {
  if (beatResults[index] !== null) return;
  beatResults[index] = false;
  failCount += 1;
  setBeatDot(index, "is-fail");
  showJudge(label, false);
  playLv27Touch(false);
  beatIndex = index + 1;
}

function completeScene(token) {
  if (!isActive(token) || !running) return;
  for (let index = 0; index < 4; index += 1) {
    if (beatResults[index] === null) registerFailure(index, "MISS");
  }
  const scenePerfect = beatResults.every(Boolean);
  setText("lv27Phase", scenePerfect ? "PERFECT" : "COMPLETE");
  setText("lv27SceneHint", scenePerfect ? "장면을 완벽하게 완성했습니다" : "다음 장면도 계속 진행됩니다");
  const touchLayer = document.getElementById("lv27TouchLayer");
  if (touchLayer) touchLayer.disabled = true;
  sceneIndex += 1;
  setRoundProgress(sceneIndex / TOTAL_SCENES);
  schedule(() => startScene(token), SCENE_GAP_MS);
}

function finishGame(token) {
  if (!isActive(token) || !running) return;
  running = false;
  window.cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  hide("lv27Scene");
  show("lv27Blank");
  setText("lv27Phase", "FINISH");
  setText("lv27Round", `${TOTAL_SCENES} / ${TOTAL_SCENES}`);
  setText("lv27Hint", "네 장면이 모두 끝났습니다");
  setRoundProgress(1);
  const perfect = failCount === 0;
  playLv27Finish(perfect);
  setText("lv27ResultTitle", perfect ? "PERFECT MEMORY" : "TRY AGAIN");
  setText("lv27ResultText", perfect
    ? "네 장면의 모든 박자를 정확한 타이밍에 완성했습니다."
    : `${failCount}번의 타이밍을 놓쳤습니다. 같은 네 박자를 다시 기억해 보세요.`);
  setText("lv27SuccessCount", String(successCount));
  setText("lv27FailCount", String(failCount));
  toggleHidden("lv27NextButton", !perfect);
  toggleHidden("lv27RetryButton", perfect);
  schedule(() => show("lv27Result"), 620);
}

function createPattern() {
  const values = Array.from({ length: 4 }, () => Math.round(randomBetween(BEAT_MIN_MS, BEAT_MAX_MS) / 20) * 20);
  const spread = Math.max(...values) - Math.min(...values);
  if (spread < 260) {
    values[0] = BEAT_MIN_MS + Math.round(Math.random() * 5) * 20;
    values[2] = BEAT_MAX_MS - Math.round(Math.random() * 5) * 20;
  }
  return shuffle(values);
}

function updateRhythmMarkers() {
  const totalDuration = pattern.reduce((sum, duration) => sum + duration, 0);
  if (!totalDuration) return;

  let cumulative = 0;
  const forwardPositions = pattern.map((duration) => {
    cumulative += duration;
    return cumulative / totalDuration;
  });

  document.querySelectorAll("#lv27Page .lv27-rhythm-markers").forEach((guide) => {
    const isReverse = guide.dataset.direction === "reverse";
    guide.querySelectorAll("i[data-marker]").forEach((marker, index) => {
      const forward = forwardPositions[index] ?? 1;
      const position = isReverse ? 1 - forward : forward;
      marker.style.setProperty("--lv27-marker-position", String(position));
      marker.classList.toggle("is-edge", position <= 0.001 || position >= 0.999);
    });
  });

  const volumeBars = [...document.querySelectorAll("#lv27VolumeBars i[data-volume-bar]")];
  volumeBars.forEach((bar) => bar.classList.remove("is-rhythm-marker"));
  const usedIndexes = new Set();
  forwardPositions.forEach((position) => {
    let targetIndex = Math.round(position * (volumeBars.length - 1));
    while (usedIndexes.has(targetIndex) && targetIndex < volumeBars.length - 1) targetIndex += 1;
    while (usedIndexes.has(targetIndex) && targetIndex > 0) targetIndex -= 1;
    usedIndexes.add(targetIndex);
    volumeBars[targetIndex]?.classList.add("is-rhythm-marker");
  });
}

function updateSceneProgress(key, progress) {
  const value = Math.min(1, Math.max(0, progress));
  if (key === "loading") {
    document.getElementById("lv27LoadingFill")?.style.setProperty("transform", `scaleX(${value})`);
    setText("lv27LoadingPercent", `${Math.round(value * 100)}%`);
  } else if (key === "monster") {
    const remaining = 1 - value;
    document.getElementById("lv27HpFill")?.style.setProperty("transform", `scaleX(${remaining})`);
    setText("lv27HpPercent", `${Math.round(remaining * 100)}%`);
    document.getElementById("lv27Monster")?.style.setProperty("transform", `translateY(${value * 5}px) scale(${1 - value * 0.08})`);
    updateMonsterExpression(value);
  } else if (key === "saber") {
    document.getElementById("lv27SaberBlade")?.style.setProperty("transform", `scaleX(${value})`);
  } else if (key === "volume") {
    const bars = document.querySelectorAll("#lv27VolumeBars i[data-volume-bar]");
    const activeCount = Math.round(value * bars.length);
    bars.forEach((bar, index) => bar.classList.toggle("is-active", index < activeCount));
    setText("lv27VolumePercent", `${Math.round(value * 100)}%`);
  }
}


function updateMonsterExpression(progress) {
  const monster = document.getElementById("lv27Monster");
  if (!monster) return;

  const totalDuration = pattern.reduce((sum, duration) => sum + duration, 0);
  const firstBoundary = totalDuration ? pattern[0] / totalDuration : 0.25;
  const secondBoundary = totalDuration ? (pattern[0] + pattern[1]) / totalDuration : 0.5;

  let state = "is-normal";
  if (progress >= 0.999) state = "is-dead";
  else if (progress >= secondBoundary) state = "is-critical";
  else if (progress >= firstBoundary) state = "is-hurt";

  monster.classList.remove("is-normal", "is-hurt", "is-critical", "is-dead");
  monster.classList.add(state);
  monster.dataset.expression = state.replace("is-", "");
}

function resetSceneVisuals() {
  updateSceneProgress("loading", 0);
  updateSceneProgress("monster", 0);
  updateSceneProgress("saber", 0);
  updateSceneProgress("volume", 0);
  document.querySelectorAll("#lv27Page .lv27-beat-dots i").forEach((dot) => dot.className = "");
}

function resetStage() {
  resetSceneVisuals();
  show("lv27Blank");
  hide("lv27Scene");
  const touchLayer = document.getElementById("lv27TouchLayer");
  if (touchLayer) touchLayer.disabled = true;
  document.getElementById("lv27Page")?.classList.remove("is-playing", "is-listening");
}

function pulseListenBeat(index) {
  const dots = document.querySelectorAll("#lv27Page .lv27-listen-orbit i");
  const dot = dots[index];
  if (!dot) return;
  dot.classList.remove("is-active");
  void dot.offsetWidth;
  dot.classList.add("is-active");
  schedule(() => dot.classList.remove("is-active"), 360);
}

function setBeatDot(index, className) {
  const dot = document.querySelector(`#lv27Page .lv27-beat-dots i[data-beat="${index}"]`);
  if (!dot) return;
  dot.classList.remove("is-success", "is-fail");
  dot.classList.add(className);
}

function showJudge(text, success) {
  const judge = document.getElementById("lv27Judge");
  if (!judge) return;
  window.clearTimeout(judgeTimer);
  judge.textContent = text;
  judge.classList.remove("is-success", "is-fail", "is-visible");
  void judge.offsetWidth;
  judge.classList.add(success ? "is-success" : "is-fail", "is-visible");
  judgeTimer = window.setTimeout(() => judge.classList.remove("is-visible"), 430);
}

function cancelGame() {
  running = false;
  lessonRunning = false;
  expectedTimes = [];
  clearAllTimers();
  window.cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  window.clearTimeout(judgeTimer);
  judgeTimer = 0;
  stopLv27Sounds();
  const touchLayer = document.getElementById("lv27TouchLayer");
  if (touchLayer) touchLayer.disabled = true;
  document.getElementById("lv27Page")?.classList.remove("is-playing", "is-listening");
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
  return token === gameToken && Boolean(document.getElementById("lv27Page"));
}

function schedule(callback, delay) {
  const id = window.setTimeout(() => {
    timers.delete(id);
    callback();
  }, delay);
  timers.add(id);
  return id;
}

function clearAllTimers() {
  timers.forEach((id) => window.clearTimeout(id));
  timers.clear();
}

function setRoundProgress(value) {
  document.getElementById("lv27RoundProgress")?.style.setProperty("transform", `scaleX(${Math.min(1, Math.max(0, value))})`);
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
  return items;
}

function randomBetween(min, max) { return min + Math.random() * (max - min); }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function show(id) { const element = document.getElementById(id); if (element) element.hidden = false; }
function hide(id) { const element = document.getElementById(id); if (element) element.hidden = true; }
function toggleHidden(id, hidden) { const element = document.getElementById(id); if (element) element.hidden = hidden; }
