import lv29Style from "../../../assets/scss/game/lv29/common.scss?inline";
import lv29Template from "./lv29.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv29Finish,
  playLv29Judge,
  playLv29Tick,
  playStartSound,
  readySound,
  stopLv29Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv29Sound.js";

const GAME_DURATION_MS = 30000;
const TARGET_ANGLE = 90;
const START_SPEED = 28;
const END_SPEED = 60;
const START_NODE_COUNT = 3;
const END_NODE_COUNT = 10;
const HIT_WINDOW_DEG = 8;
const MIN_NODE_GAP_DEG = 24;
const RING_COUNT = 4;
const INPUT_EVENT_GRACE_MS = 100;
const ROTATION_HISTORY_MS = 240;
const CENTER_EMPTY_DIAMETER_RATIO = 1 / 3;
const CENTER_EMPTY_RADIUS_RATIO = CENTER_EMPTY_DIAMETER_RATIO;
const RING_THICKNESS_RATIO = (1 - CENTER_EMPTY_RADIUS_RATIO) / RING_COUNT;
const RING_RADII = Array.from(
  { length: RING_COUNT },
  (_, index) => CENTER_EMPTY_RADIUS_RATIO + RING_THICKNESS_RATIO * (index + 0.5),
);

let gameToken = 0;
let running = false;
let lessonRunning = false;
let rotation = 0;
let rotationTotal = 0;
let currentSpeed = START_SPEED;
let rotationHistory = [];
let nodes = [];
let successCount = 0;
let failCount = 0;
let startTime = 0;
let lastFrameTime = 0;
let animationFrame = 0;
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let mountedPathname = "";
let routeWatchTimer = 0;
let lessonTimers = new Set();
let lastTickBucket = -1;

export function renderPage() {
  destroyPage();
  renderView(lv29Template, lv29Style);
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv29Page")) destroyPage();
  }, 100);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv29Page");
    if (!page) return;
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    page.style.setProperty("--lv29-vw", `${width}px`);
    page.style.setProperty("--lv29-vh", `${height}px`);
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
  document.getElementById("lv29StartButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv29RetryButton")?.addEventListener("click", startGameWithoutLesson, { signal });
  document.getElementById("lv29NextButton")?.addEventListener("click", () => {
    cancelGame();
    navigate("lv30", { replace: true });
  }, { signal });
  document.getElementById("lv29HomeButton")?.addEventListener("click", () => {
    cancelGame();
    navigate("home", { replace: true });
  }, { signal });
  document.getElementById("lv29Page")?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

function prepareReadyState() {
  running = false;
  lessonRunning = false;
  rotation = 0;
  rotationTotal = 0;
  currentSpeed = START_SPEED;
  rotationHistory = [];
  nodes = [];
  successCount = 0;
  failCount = 0;
  lastTickBucket = -1;
  document.getElementById("lv29Disc")?.style.setProperty("transform", "rotate(0deg)");
  document.getElementById("lv29Nodes")?.replaceChildren();
  setText("lv29Phase", "READY");
  setText("lv29Time", "30.0");
  setText("lv29Hint", "라인에 도착하는 노드를 터치하세요");
  setProgress(0);
  hide("lv29Lesson");
  hide("lv29Result");
  show("lv29Ready");
}

async function startGame() {
  cancelGame();
  const token = ++gameToken;
  lessonRunning = true;
  hide("lv29Ready");
  hide("lv29Result");
  await readySound();
  playStartSound();
  await runLesson(token);
  if (!isActive(token)) return;
  lessonRunning = false;
  beginGame(token);
}

async function startGameWithoutLesson() {
  cancelGame();
  const token = ++gameToken;
  hide("lv29Result");
  await readySound();
  playStartSound();
  if (!isActive(token)) return;
  beginGame(token);
}

async function runLesson(token) {
  show("lv29Lesson");
  const lesson = document.getElementById("lv29Lesson");
  setText("lv29LessonTitle", "WATCH");
  setText("lv29LessonText", "회전하는 노드를 바라보세요");
  lesson?.classList.add("is-watch");
  await wait(1500, token);
  if (!isActive(token)) return;
  lesson?.classList.remove("is-watch");
  lesson?.classList.add("is-touch");
  setText("lv29LessonTitle", "TOUCH");
  setText("lv29LessonText", "노드가 세로 라인과 겹치는 순간 터치하세요");
  playLv29Tick();
  await wait(1800, token);
  lesson?.classList.remove("is-touch");
  hide("lv29Lesson");
}

function beginGame(token) {
  running = true;
  rotation = 0;
  rotationTotal = 0;
  currentSpeed = START_SPEED;
  rotationHistory = [];
  nodes = [];
  successCount = 0;
  failCount = 0;
  lastTickBucket = -1;
  startTime = performance.now();
  lastFrameTime = startTime;
  recordRotationSample(startTime, rotationTotal);
  document.getElementById("lv29Nodes")?.replaceChildren();
  document.getElementById("lv29Page")?.classList.add("is-playing");
  setText("lv29Phase", "PLAY");
  setText("lv29Hint", "라인에 닿는 순간 노드를 터치하세요");
  for (let index = 0; index < START_NODE_COUNT; index += 1) spawnNode(index * (360 / START_NODE_COUNT) + 145);
  animationFrame = window.requestAnimationFrame((time) => updateGame(time, token));
}

function updateGame(now, token) {
  if (!running || !isActive(token)) return;
  const elapsed = Math.min(GAME_DURATION_MS, now - startTime);
  const progress = elapsed / GAME_DURATION_MS;
  const deltaSeconds = Math.min(0.05, Math.max(0, now - lastFrameTime) / 1000);
  lastFrameTime = now;
  currentSpeed = lerp(START_SPEED, END_SPEED, easeInQuad(progress));
  rotationTotal += currentSpeed * deltaSeconds;
  rotation = normalizeAngle(rotationTotal);
  recordRotationSample(now, rotationTotal);
  const disc = document.getElementById("lv29Disc");
  if (disc) disc.style.transform = `rotate(${rotation}deg)`;

  updateNodes(now);
  adjustNodeCount(progress);
  setProgress(progress);
  setText("lv29Time", ((GAME_DURATION_MS - elapsed) / 1000).toFixed(1));

  const tickBucket = Math.floor(rotation / 45);
  if (tickBucket !== lastTickBucket) {
    lastTickBucket = tickBucket;
    if (progress > 0.18) playLv29Tick();
  }

  if (elapsed >= GAME_DURATION_MS) {
    finishGame(token);
    return;
  }
  animationFrame = window.requestAnimationFrame((time) => updateGame(time, token));
}

function updateNodes(now) {
  [...nodes].forEach((node) => {
    const worldAngle = normalizeAngle(node.angle + rotation);
    const distance = forwardDistance(worldAngle, TARGET_ANGLE);
    const absoluteDistance = angularDistance(worldAngle, TARGET_ANGLE);
    node.element?.classList.toggle("is-near", absoluteDistance <= node.hitWindowDeg + 10);

    const crossedTarget = distance > node.previousDistance + 180;
    if (crossedTarget) node.hasCrossedTarget = true;

    if (node.hasCrossedTarget) {
      const passedDistance = 360 - distance;
      if (passedDistance > node.hitWindowDeg) {
        if (node.missEligibleAt === null) node.missEligibleAt = now + INPUT_EVENT_GRACE_MS;
        if (now >= node.missEligibleAt) {
          resolveNode(node, false, "MISS");
          return;
        }
      } else {
        node.missEligibleAt = null;
      }
    }

    node.previousDistance = distance;
  });
}

function adjustNodeCount(progress) {
  const desired = Math.round(lerp(START_NODE_COUNT, END_NODE_COUNT, progress));
  while (nodes.length < desired) spawnNode();
}

function spawnNode(preferredWorldAngle = null) {
  const layer = randomInt(0, RING_RADII.length - 1);
  const node = document.createElement("button");
  node.type = "button";
  node.className = `lv29-node is-ring-${layer + 1}`;
  node.setAttribute("aria-label", `${layer + 1}단계 원형 구간 노드`);
  const worldAngle = chooseSafeWorldAngle(preferredWorldAngle);
  const baseAngle = normalizeAngle(worldAngle - rotation);
  const radius = RING_RADII[layer];
  const hue = randomInt(0, 3);
  const radians = baseAngle * (Math.PI / 180);
  node.style.setProperty("--lv29-node-left", `${50 + Math.cos(radians) * radius * 50}%`);
  node.style.setProperty("--lv29-node-top", `${50 + Math.sin(radians) * radius * 50}%`);
  node.style.setProperty("--lv29-node-size", `${RING_THICKNESS_RATIO * 50}%`);
  node.style.setProperty("--lv29-node-hue", String(hue));
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    angle: baseAngle,
    layer,
    element: node,
    hitWindowDeg: getNodeHitWindowDeg(layer),
    previousDistance: forwardDistance(worldAngle, TARGET_ANGLE),
    hasCrossedTarget: false,
    resolved: false,
    missEligibleAt: null,
  };
  node.addEventListener("pointerdown", (event) => handleNodePress(event, item));
  document.getElementById("lv29Nodes")?.append(node);
  nodes.push(item);
}

function getNodeHitWindowDeg(layer) {
  const orbitRadius = RING_RADII[layer];
  const nodeRadius = RING_THICKNESS_RATIO / 2;
  const overlapHalfAngle = Math.asin(Math.min(1, nodeRadius / orbitRadius)) * (180 / Math.PI);
  return Math.max(HIT_WINDOW_DEG, overlapHalfAngle);
}

function chooseSafeWorldAngle(preferred = null) {
  const existingAngles = nodes.map((node) => normalizeAngle(node.angle + rotation));
  const candidates = [];
  if (preferred !== null) candidates.push(normalizeAngle(preferred));
  for (let index = 0; index < 32; index += 1) candidates.push(randomFloat(118, 350));
  const safe = candidates.find((candidate) => {
    const targetGap = angularDistance(candidate, TARGET_ANGLE);
    if (targetGap < 28) return false;
    return existingAngles.every((angle) => angularDistance(candidate, angle) >= MIN_NODE_GAP_DEG);
  });
  if (safe !== undefined) return safe;
  let bestAngle = 180;
  let bestGap = -1;
  for (let angle = 110; angle < 360; angle += 4) {
    const gap = existingAngles.length
      ? Math.min(...existingAngles.map((existing) => angularDistance(angle, existing)))
      : 360;
    if (gap > bestGap) {
      bestGap = gap;
      bestAngle = angle;
    }
  }
  return bestAngle;
}

function handleNodePress(event, node) {
  event.preventDefault();
  event.stopPropagation();
  if (!running || node.resolved) return;

  const eventTime = normalizeEventTime(event.timeStamp);
  const rotationAtPress = getRotationTotalAt(eventTime);
  const worldAngle = normalizeAngle(node.angle + rotationAtPress);
  const distance = angularDistance(worldAngle, TARGET_ANGLE);

  if (distance <= node.hitWindowDeg) {
    resolveNode(node, true, "NICE");
    return;
  }

  const forward = forwardDistance(worldAngle, TARGET_ANGLE);
  const hasAlreadyPassed = forward > 180;
  resolveNode(node, false, hasAlreadyPassed ? "MISS" : "TOO EARLY");
}

function recordRotationSample(time, totalRotation) {
  rotationHistory.push({ time, totalRotation });
  const cutoff = time - ROTATION_HISTORY_MS;
  while (rotationHistory.length > 2 && rotationHistory[1].time < cutoff) rotationHistory.shift();
}

function getRotationTotalAt(time) {
  if (!rotationHistory.length) return rotationTotal;
  if (time <= rotationHistory[0].time) return rotationHistory[0].totalRotation;

  for (let index = 1; index < rotationHistory.length; index += 1) {
    const previous = rotationHistory[index - 1];
    const next = rotationHistory[index];
    if (time <= next.time) {
      const span = Math.max(1, next.time - previous.time);
      const ratio = Math.max(0, Math.min(1, (time - previous.time) / span));
      return lerp(previous.totalRotation, next.totalRotation, ratio);
    }
  }

  const latest = rotationHistory[rotationHistory.length - 1];
  const extrapolationSeconds = Math.max(0, Math.min(INPUT_EVENT_GRACE_MS, time - latest.time)) / 1000;
  return latest.totalRotation + currentSpeed * extrapolationSeconds;
}

function normalizeEventTime(timeStamp) {
  if (!Number.isFinite(timeStamp)) return performance.now();
  if (timeStamp > performance.timeOrigin) return timeStamp - performance.timeOrigin;
  return timeStamp;
}

function resolveNode(node, success, label) {
  if (node.resolved) return;
  node.resolved = true;
  if (success) successCount += 1;
  else failCount += 1;
  playLv29Judge(success, node.layer);
  showJudge(label, success);
  node.element?.classList.add(success ? "is-hit" : "is-miss");
  nodes = nodes.filter((item) => item.id !== node.id);
  window.setTimeout(() => node.element?.remove(), 280);
  if (running) spawnNode();
}

function finishGame(token) {
  if (!isActive(token)) return;
  running = false;
  window.cancelAnimationFrame(animationFrame);
  document.getElementById("lv29Page")?.classList.remove("is-playing");
  setText("lv29Phase", "COMPLETE");
  setText("lv29Time", "0.0");
  setProgress(1);
  const perfect = failCount === 0;
  setText("lv29ResultTitle", perfect ? "PERFECT SPIN" : "TRY AGAIN");
  setText("lv29ResultText", perfect
    ? "모든 노드를 정확한 타이밍에 터치했습니다."
    : "놓치거나 너무 일찍 터치한 노드가 있었습니다.");
  setText("lv29SuccessCount", String(successCount));
  setText("lv29FailCount", String(failCount));
  toggleHidden("lv29NextButton", !perfect);
  toggleHidden("lv29RetryButton", perfect);
  playLv29Finish(perfect);
  show("lv29Result");
}

function showJudge(text, success) {
  const judge = document.getElementById("lv29Judge");
  if (!judge) return;
  judge.textContent = text;
  judge.className = `lv29-judge ${success ? "is-success" : "is-fail"}`;
  void judge.offsetWidth;
  judge.classList.add("is-visible");
}

function cancelGame() {
  running = false;
  lessonRunning = false;
  window.cancelAnimationFrame(animationFrame);
  lessonTimers.forEach((id) => window.clearTimeout(id));
  lessonTimers.clear();
  stopLv29Sounds();
  document.getElementById("lv29Page")?.classList.remove("is-playing");
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

function wait(delay, token) {
  return new Promise((resolve) => {
    const id = window.setTimeout(() => {
      lessonTimers.delete(id);
      resolve(isActive(token));
    }, delay);
    lessonTimers.add(id);
  });
}

function isActive(token) {
  return token === gameToken && Boolean(document.getElementById("lv29Page"));
}

function forwardDistance(from, to) {
  return normalizeAngle(to - from);
}

function angularDistance(a, b) {
  const delta = Math.abs(normalizeAngle(a - b));
  return Math.min(delta, 360 - delta);
}

function normalizeAngle(value) {
  return ((value % 360) + 360) % 360;
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function easeInQuad(value) {
  return value * value;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setProgress(value) {
  document.getElementById("lv29Progress")?.style.setProperty("transform", `scaleX(${Math.max(0, Math.min(1, value))})`);
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
