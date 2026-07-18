import lv18Style from "../../../assets/scss/game/lv18/common.scss?inline";
import lv18Template from "./lv18.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv18FailSound,
  playLv18FinishSound,
  playLv18HoldEndSound,
  playLv18HoldStartSound,
  playLv18SuccessSound,
  playStartSound,
  readySound,
  stopLv18Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv18Sound.js";

const WHITE_KEY_WIDTH = 70;
const BLACK_KEY_WIDTH = 43;
const CENTER_WHITE_START = 0;
const CENTER_WHITE_END = 7;
const WHITE_NOTES = Object.freeze(["C", "D", "E", "F", "G", "A", "B"]);
const SOLFEGE = Object.freeze(["도", "레", "미", "파", "솔", "라", "시"]);
const SHARP_AFTER = new Set(["C", "D", "F", "G", "A"]);
const GAME_DURATION = 60_000;
const START_TOLERANCE = 210;
const RELEASE_TOLERANCE = 250;
const MISS_GRACE = 310;
const MIN_NODE_GAP = 170;
const PALETTE = Object.freeze([
  ["#ffb7cf", "#ffc9aa", "#ffe09d", "#b8e5bd", "#9fded5", "#a9d6ff", "#c5c0ff", "#e1b8f2"],
  ["#ffadc7", "#ffd0a3", "#f7e594", "#a8e1c2", "#95d8e8", "#9ec8ff", "#c7b4f4", "#efaedc"],
  ["#f9bad6", "#ffc0b1", "#f5df9f", "#b3e5a8", "#99dfcf", "#add3f8", "#babef3", "#deb6ef"],
]);

let gameToken = 0;
let running = false;
let startedAt = 0;
let animationFrame = 0;
let spawnTimer = 0;
let endTimer = 0;
let timers = new Set();
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let routeWatchTimer = 0;
let resizeFrame = 0;
let mountedPathname = "";
let renderedKeys = [];
let keyDefinitions = new Map();
let playableKeys = [];
let nodes = [];
let activeHold = null;
let failures = 0;
let successes = 0;
let totalNodes = 0;
let feedbackTimer = 0;
let colorMap = new Map();
let lastSpawnTarget = 0;

export function renderPage() {
  destroyPage();
  renderView(lv18Template, lv18Style);
  mountedPathname = window.location.pathname;
  bindLifecycle();
  bindViewport();
  configureKeyboard();
  bindControls();
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv18Page")) destroyPage();
  }, 100);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv18Page");
    if (!page) return;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    page.style.setProperty("--lv18-vh", `${Math.round(viewportHeight)}px`);
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      configureKeyboard();
      refreshPendingNodeKeys();
      positionNodes(performance.now());
    });
  };
  sync();
  window.addEventListener("resize", sync, { passive: true, signal });
  window.addEventListener("orientationchange", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true, signal });
}

function configureKeyboard() {
  const keyboard = document.getElementById("lv18Keyboard");
  if (!keyboard) return;
  const width = Math.max(1, Math.round(keyboard.getBoundingClientRect().width || window.innerWidth));
  const extra = 3;
  const minIndex = Math.floor((-width / 2) / WHITE_KEY_WIDTH + 3.5) - extra;
  const maxIndex = Math.ceil((width / 2) / WHITE_KEY_WIDTH + 3.5) + extra;
  renderedKeys = [];
  keyDefinitions = new Map();

  for (let index = minIndex; index <= maxIndex; index += 1) {
    const white = createWhiteKey(index);
    renderedKeys.push(white);
    keyDefinitions.set(white.id, white);
    if (SHARP_AFTER.has(white.label)) {
      const black = createBlackKey(index, white);
      renderedKeys.push(black);
      keyDefinitions.set(black.id, black);
    }
  }

  keyboard.innerHTML = `<div class="lv18-keyboard-track">
    ${renderedKeys.filter((key) => key.type === "white").map((key) => {
      const left = (key.whiteIndex - 3.5) * WHITE_KEY_WIDTH;
      return `<button class="lv18-key lv18-white-key" type="button" data-key-id="${key.id}" style="--key-left:${left}px;--key-color:${colorFor(key.id)}" aria-label="${key.solfege} ${key.note} 건반"></button>`;
    }).join("")}
    ${renderedKeys.filter((key) => key.type === "black").map((key) => {
      const left = (key.whiteIndex - 3.5 + 1) * WHITE_KEY_WIDTH;
      return `<button class="lv18-key lv18-black-key" type="button" data-key-id="${key.id}" style="--key-left:${left}px" aria-label="${key.solfege} ${key.note} 검은 건반"></button>`;
    }).join("")}
  </div>`;
  selectPlayableWhiteKeys(width);
}

function createWhiteKey(index) {
  const cycle = positiveModulo(index, 7);
  const octave = 4 + Math.floor(index / 7);
  return { id: `w:${index}`, type: "white", whiteIndex: index, label: WHITE_NOTES[cycle], solfege: SOLFEGE[cycle], note: `${WHITE_NOTES[cycle]}${octave}` };
}

function createBlackKey(index, white) {
  return { id: `b:${index}`, type: "black", whiteIndex: index, label: `${white.label}#`, solfege: `${white.solfege}#`, note: `${white.label}#${white.note.slice(-1)}` };
}

function selectPlayableWhiteKeys(viewportWidth) {
  const centralWidth = (CENTER_WHITE_END - CENTER_WHITE_START + 1) * WHITE_KEY_WIDTH;
  if (viewportWidth >= centralWidth) {
    playableKeys = renderedKeys.filter((key) => key.type === "white" && key.whiteIndex >= CENTER_WHITE_START && key.whiteIndex <= CENTER_WHITE_END);
    return;
  }
  const keyboardRect = document.getElementById("lv18Keyboard")?.getBoundingClientRect();
  playableKeys = renderedKeys.filter((key) => {
    if (key.type !== "white") return false;
    const rect = keyElement(key.id)?.getBoundingClientRect();
    return rect && keyboardRect && rect.left >= keyboardRect.left - .5 && rect.right <= keyboardRect.right + .5;
  });
  if (!playableKeys.length) playableKeys = renderedKeys.filter((key) => key.type === "white").slice(0, 1);
}

function bindControls() {
  inputController?.abort();
  inputController = new AbortController();
  const { signal } = inputController;
  unlockSoundOnNextGesture();
  document.getElementById("lv18StartButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv18RetryButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv18NextButton")?.addEventListener("click", () => { cancelGame(); navigate("lv19", { replace: true }); }, { signal });
  document.getElementById("lv18HomeButton")?.addEventListener("click", () => { cancelGame(); navigate("home", { replace: true }); }, { signal });
  const keyboard = document.getElementById("lv18Keyboard");
  keyboard?.addEventListener("pointerdown", handlePointerDown, { signal });
  keyboard?.addEventListener("pointerup", handlePointerUp, { signal });
  keyboard?.addEventListener("pointercancel", handlePointerUp, { signal });
  keyboard?.addEventListener("lostpointercapture", handlePointerUp, { signal });
  keyboard?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

async function startGame() {
  cancelGame();
  randomizeColors();
  configureKeyboard();
  const token = ++gameToken;
  running = true;
  failures = 0;
  successes = 0;
  totalNodes = 0;
  nodes = [];
  activeHold = null;
  lastSpawnTarget = 0;
  clearNodeElements();
  clearKeyStates();
  hide("lv18Ready");
  hide("lv18Result");
  setText("lv18PhaseText", "GET READY");
  setText("lv18TimeText", "01:00");
  setProgress(0);
  await readySound();
  if (!isActive(token)) return;
  playStartSound();
  schedule(() => beginRun(token), 620);
}

function beginRun(token) {
  if (!isActive(token)) return;
  startedAt = performance.now();
  setText("lv18PhaseText", "PLAY");
  scheduleNextNode(token, 320);
  animationFrame = window.requestAnimationFrame(gameLoop);
  endTimer = window.setTimeout(() => finishSpawning(token), GAME_DURATION);
}

function scheduleNextNode(token, delay) {
  window.clearTimeout(spawnTimer);
  spawnTimer = window.setTimeout(() => {
    if (!isActive(token) || performance.now() - startedAt >= GAME_DURATION) return;
    spawnNode(token);
    const progress = clamp((performance.now() - startedAt) / GAME_DURATION, 0, 1);
    const minGap = lerp(1350, 480, progress);
    const variance = lerp(1000, 360, progress);
    scheduleNextNode(token, minGap + Math.random() * variance);
  }, delay);
}

function spawnNode(token) {
  if (!isActive(token) || !playableKeys.length) return;
  const now = performance.now();
  const progress = clamp((now - startedAt) / GAME_DURATION, 0, 1);
  const speed = lerp(145, 270, progress);
  const holdDuration = randomHoldDuration(progress);
  const fieldHeight = Math.max(120, document.getElementById("lv18LaneField")?.clientHeight ?? 400);
  const travelMs = ((fieldHeight + holdDuration * speed / 1000) / speed) * 1000;
  let targetStart = now + travelMs;
  targetStart = Math.max(targetStart, lastSpawnTarget + MIN_NODE_GAP);
  lastSpawnTarget = targetStart + holdDuration;
  const key = playableKeys[randomInt(0, playableKeys.length - 1)];
  const node = {
    id: `${token}:${totalNodes + 1}`,
    keyId: key.id,
    note: key.note,
    targetStart,
    targetEnd: targetStart + holdDuration,
    holdDuration,
    speed,
    state: "falling",
    judged: false,
    element: null,
  };
  totalNodes += 1;
  nodes.push(node);
  createNodeElement(node);
}

function randomHoldDuration(progress) {
  const short = 160 + Math.random() * 210;
  const medium = 430 + Math.random() * 430;
  const long = 900 + Math.random() * lerp(450, 900, progress);
  const roll = Math.random();
  if (roll < lerp(.66, .42, progress)) return short;
  if (roll < lerp(.93, .78, progress)) return medium;
  return long;
}

function createNodeElement(node) {
  const container = document.getElementById("lv18Nodes");
  if (!container) return;
  const element = document.createElement("div");
  element.className = "lv18-node";
  element.dataset.nodeId = node.id;
  element.style.setProperty("--node-color", colorFor(node.keyId));
  container.appendChild(element);
  node.element = element;
  updateNodeGeometry(node);
}

function gameLoop(now) {
  if (!running) return;
  const elapsed = now - startedAt;
  setProgress(clamp(elapsed / GAME_DURATION, 0, 1));
  setText("lv18TimeText", formatTime(Math.max(0, GAME_DURATION - elapsed)));
  positionNodes(now);
  detectMisses(now);
  animationFrame = window.requestAnimationFrame(gameLoop);
}

function positionNodes(now) {
  const field = document.getElementById("lv18LaneField");
  if (!field) return;
  const hitY = field.clientHeight;
  nodes.forEach((node) => {
    if (!node.element || node.state === "removed") return;
    const height = node.pixelHeight ?? Math.max(26, node.holdDuration * node.speed / 1000);
    const bottom = hitY - ((node.targetStart - now) * node.speed / 1000);
    const y = bottom - height;
    node.element.style.setProperty("--node-y", `${y.toFixed(3)}px`);
    if (y > hitY + 34 && node.judged) removeNode(node);
  });
}

function updateNodeGeometry(node) {
  const key = keyElement(node.keyId);
  const field = document.getElementById("lv18LaneField");
  if (!key || !field || !node.element) return;
  const keyRect = key.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  const x = keyRect.left - fieldRect.left + 4;
  const width = Math.max(22, keyRect.width - 8);
  const height = Math.max(26, node.holdDuration * node.speed / 1000);
  node.pixelHeight = height;
  node.element.style.setProperty("--node-x", `${x.toFixed(3)}px`);
  node.element.style.setProperty("--node-w", `${width.toFixed(3)}px`);
  node.element.style.setProperty("--node-h", `${height.toFixed(3)}px`);
  node.element.style.setProperty("--node-color", colorFor(node.keyId));
}

function refreshPendingNodeKeys() {
  const now = performance.now();
  const visibleIds = new Set(playableKeys.map((key) => key.id));
  nodes.forEach((node) => {
    if (node.judged || node.targetStart <= now + 300 || visibleIds.has(node.keyId) || !playableKeys.length) return;
    const replacement = playableKeys[randomInt(0, playableKeys.length - 1)];
    node.keyId = replacement.id;
    node.note = replacement.note;
    updateNodeGeometry(node);
  });
}

function handlePointerDown(event) {
  const key = event.target.closest(".lv18-key");
  if (!key || !running || activeHold) return;
  event.preventDefault();
  key.setPointerCapture?.(event.pointerId);
  const keyId = key.dataset.keyId;
  const definition = keyDefinitions.get(keyId);
  const now = performance.now();
  key.classList.add("is-active");
  playLv18HoldStartSound(definition?.note ?? "C4");

  const candidate = nearestUnjudgedNode(now);
  const matching = nodes
    .filter((node) => !node.judged && node.keyId === keyId)
    .sort((a, b) => Math.abs(a.targetStart - now) - Math.abs(b.targetStart - now))[0];
  const correctStart = matching && Math.abs(now - matching.targetStart) <= START_TOLERANCE;
  const node = correctStart ? matching : (candidate && Math.abs(now - candidate.targetStart) <= START_TOLERANCE ? candidate : null);

  activeHold = {
    pointerId: event.pointerId,
    keyId,
    key,
    node,
    pressedAt: now,
    startCorrect: Boolean(correctStart),
    wrongKey: Boolean(node && node.keyId !== keyId),
  };

  if (node) {
    node.state = "holding";
    node.element?.classList.add("is-holding");
  }
}

function handlePointerUp(event) {
  if (!activeHold || event.pointerId !== activeHold.pointerId) return;
  event.preventDefault();
  const hold = activeHold;
  activeHold = null;
  const now = performance.now();
  hold.key.classList.remove("is-active");
  playLv18HoldEndSound(keyDefinitions.get(hold.keyId)?.note ?? "C4");

  if (!hold.node) {
    registerFreeMistake(hold.key, hold.keyId);
    return;
  }

  const node = hold.node;
  if (node.judged) return;
  const releaseCorrect = Math.abs(now - node.targetEnd) <= RELEASE_TOLERANCE;
  const success = hold.startCorrect && !hold.wrongKey && releaseCorrect;
  judgeNode(node, success, hold.keyId, now - hold.pressedAt);
}

function nearestUnjudgedNode(now) {
  return nodes.filter((node) => !node.judged).sort((a, b) => Math.abs(a.targetStart - now) - Math.abs(b.targetStart - now))[0] ?? null;
}

function detectMisses(now) {
  nodes.forEach((node) => {
    if (node.judged) return;
    const beingHeld = activeHold?.node === node;
    if (!beingHeld && now > node.targetStart + MISS_GRACE) judgeNode(node, false, node.keyId, 0, "MISS");
  });
}

function judgeNode(node, success, pressedKeyId, heldDuration, reason = "") {
  if (node.judged) return;
  node.judged = true;
  node.state = "judged";
  node.element?.classList.remove("is-holding");
  node.element?.classList.add(success ? "is-success" : "is-fail");
  const key = keyElement(pressedKeyId || node.keyId);
  pulseClass(key, success ? "is-success" : "is-fail", 560);

  if (success) {
    successes += 1;
    playLv18SuccessSound(node.note, successes);
    showFeedback(true, "BEAUTIFUL", "정확한 길이와 타이밍입니다");
  } else {
    failures += 1;
    playLv18FailSound(keyDefinitions.get(pressedKeyId)?.note ?? node.note, failures);
    const expected = Math.round(node.holdDuration);
    const actual = Math.round(heldDuration);
    const detail = reason === "MISS" ? "건반을 누르지 않았습니다" : `목표 ${expected}ms · 입력 ${actual}ms`;
    showFeedback(false, "MISSED", detail);
  }
  schedule(() => removeNode(node), 620);
}

function registerFreeMistake(key, keyId) {
  failures += 1;
  pulseClass(key, "is-fail", 520);
  playLv18FailSound(keyDefinitions.get(keyId)?.note ?? "C4", failures);
  showFeedback(false, "WRONG KEY", "노드가 닿은 건반을 눌러주세요");
}

function finishSpawning(token) {
  if (!isActive(token)) return;
  window.clearTimeout(spawnTimer);
  setText("lv18PhaseText", "FINAL NOTES");
  const waitForNodes = () => {
    if (!isActive(token)) return;
    const pending = nodes.some((node) => !node.judged);
    if (pending || activeHold) return schedule(waitForNodes, 250);
    finishGame(token);
  };
  waitForNodes();
}

function finishGame(token) {
  if (!isActive(token)) return;
  running = false;
  window.cancelAnimationFrame(animationFrame);
  stopLv18Sounds();
  const success = failures === 0;
  playLv18FinishSound(success);
  setProgress(1);
  setText("lv18TimeText", "00:00");
  setText("lv18ResultKicker", success ? "PERFECT FLOW" : "FLOW COMPLETE");
  setText("lv18ResultTitle", success ? "완벽한 연주입니다" : "한 번 더 흐름을 이어보세요");
  setText("lv18ResultDescription", success
    ? `${totalNodes}개의 노드를 모두 정확한 길이로 연주했습니다.`
    : `${totalNodes}개 중 ${successes}개 성공 · ${failures}번의 실수가 있었습니다.`);
  toggleHidden("lv18NextButton", !success);
  toggleHidden("lv18RetryButton", success);
  show("lv18Result");
}

function showFeedback(success, title, detail) {
  const feedback = document.getElementById("lv18Feedback");
  if (!feedback) return;
  window.clearTimeout(feedbackTimer);
  feedback.className = `lv18-feedback is-visible ${success ? "is-good" : "is-bad"}`;
  feedback.querySelector("strong").textContent = title;
  feedback.querySelector("small").textContent = detail;
  feedbackTimer = window.setTimeout(() => feedback.classList.remove("is-visible"), 760);
}

function randomizeColors() {
  const palette = [...PALETTE[randomInt(0, PALETTE.length - 1)]];
  palette.sort(() => Math.random() - .5);
  colorMap = new Map();
  for (let index = -20; index <= 20; index += 1) colorMap.set(`w:${index}`, palette[positiveModulo(index, palette.length)]);
}

function colorFor(keyId) {
  if (!colorMap.size) randomizeColors();
  return colorMap.get(keyId) ?? PALETTE[0][positiveModulo(Number(keyId.split(":")[1]) || 0, 8)];
}

function keyElement(id) { return document.querySelector(`.lv18-key[data-key-id="${CSS.escape(id)}"]`); }
function positiveModulo(value, divisor) { return ((value % divisor) + divisor) % divisor; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function lerp(start, end, amount) { return start + (end - start) * amount; }
function formatTime(ms) { const seconds = Math.ceil(ms / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function setProgress(value) { const element = document.getElementById("lv18ProgressBar"); if (element) element.style.width = `${clamp(value, 0, 1) * 100}%`; }
function hide(id) { document.getElementById(id)?.setAttribute("hidden", ""); }
function show(id) { document.getElementById(id)?.removeAttribute("hidden"); }
function toggleHidden(id, hidden) { const element = document.getElementById(id); if (element) element.hidden = hidden; }
function pulseClass(element, className, duration) { if (!element) return; element.classList.remove(className); void element.offsetWidth; element.classList.add(className); window.setTimeout(() => element.classList.remove(className), duration); }
function clearKeyStates() { document.querySelectorAll(".lv18-key").forEach((key) => key.classList.remove("is-active", "is-success", "is-fail")); }
function clearNodeElements() { document.getElementById("lv18Nodes")?.replaceChildren(); }
function removeNode(node) { node.state = "removed"; node.element?.remove(); node.element = null; }
function isActive(token) { return running && token === gameToken && document.getElementById("lv18Page"); }
function schedule(callback, delay) { const timer = window.setTimeout(() => { timers.delete(timer); callback(); }, delay); timers.add(timer); return timer; }

function cancelGame() {
  running = false;
  gameToken += 1;
  window.cancelAnimationFrame(animationFrame);
  window.clearTimeout(spawnTimer);
  window.clearTimeout(endTimer);
  window.clearTimeout(feedbackTimer);
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  activeHold = null;
  stopLv18Sounds();
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
