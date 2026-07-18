import lv20Style from "../../../assets/scss/game/lv20/common.scss?inline";
import lv20Template from "./lv20.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv20FailSound,
  playLv20FinishSound,
  playLv20MemorySound,
  playLv20TouchSound,
  playLv20TransitionSound,
  playStartSound,
  readySound,
  stopLv20Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv20Sound.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const BEAT_MS = 1000;
const FLASH_MS = 620;
const PREPARE_MS = 720;
const INPUT_DELAY_MS = 650;
const ROUND_GAP_MS = 950;
const MORPH_MS = 1180;
const TOTAL_INPUTS = 18;
const GLYPH_MAX_WIDTH = 960;
const ROUND_CONFIGS = Object.freeze([
  { letter: "Z", count: 3, zones: 2 },
  { letter: "Y", count: 4, zones: 3 },
  { letter: "X", count: 5, zones: 4 },
  { letter: "W", count: 6, zones: 5 },
]);
const COLOR_BANKS = Object.freeze([
  ["#ff9fbd", "#86cfe3", "#a7db9d", "#f1c879", "#bea7eb", "#8ed9c2"],
  ["#f5a7c8", "#91bced", "#9ed9ba", "#eacb79", "#c4a6e5", "#8fd4d0"],
  ["#ffad9f", "#8ecae1", "#a9d59b", "#e9c981", "#c3acec", "#91d6c3"],
]);

let gameToken = 0;
let running = false;
let currentRound = 0;
let currentSequence = [];
let currentColors = [];
let inputIndex = 0;
let totalCorrect = 0;
let totalFailures = 0;
let acceptingInput = false;
let beatTimer = 0;
let feedbackTimer = 0;
let timers = new Set();
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let routeWatchTimer = 0;
let resizeFrame = 0;
let mountedPathname = "";
let stageSize = { width: 0, height: 0 };
let segmentState = [];

export function renderPage() {
  destroyPage();
  renderView(lv20Template, lv20Style);
  document.getElementById("lv20Feedback")?.remove();
  mountedPathname = window.location.pathname;
  bindLifecycle();
  bindViewport();
  bindControls();
  renderGlyph(0, false);
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv20Page")) destroyPage();
  }, 100);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv20Page");
    const stage = document.getElementById("lv20Stage");
    if (!page || !stage) return;
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    page.style.setProperty("--lv20-vh", `${height}px`);
    page.style.setProperty("--lv20-vw", `${width}px`);
    page.classList.toggle("is-portrait", height > width);
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      const rect = stage.getBoundingClientRect();
      stageSize = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
      renderGlyph(currentRound, false, true);
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
  document.getElementById("lv20StartButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv20RetryButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv20NextButton")?.addEventListener("click", () => { cancelGame(); navigate("lv21", { replace: true }); }, { signal });
  document.getElementById("lv20HomeButton")?.addEventListener("click", () => { cancelGame(); navigate("home", { replace: true }); }, { signal });
  document.getElementById("lv20Glyph")?.addEventListener("pointerdown", handleZonePress, { signal });
  document.getElementById("lv20Glyph")?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

async function startGame() {
  cancelGame();
  const token = ++gameToken;
  running = true;
  currentRound = 0;
  currentSequence = [];
  currentColors = [];
  inputIndex = 0;
  totalCorrect = 0;
  totalFailures = 0;
  acceptingInput = false;
  hide("lv20Ready");
  hide("lv20Result");
  setProgress(0);
  setText("lv20PhaseText", "GET READY");
  await readySound();
  if (!isActive(token)) return;
  playStartSound();
  renderGlyph(0, false);
  schedule(() => beginRound(token, 0), 620);
}

function beginRound(token, roundIndex) {
  if (!isActive(token)) return;
  currentRound = roundIndex;
  inputIndex = 0;
  acceptingInput = false;
  const config = ROUND_CONFIGS[roundIndex];
  currentColors = makeRoundColors(config.zones);
  currentSequence = makeSequence(config.count, config.zones);
  setText("lv20PhaseText", "MEMORIZE");
  setText("lv20RoundText", `${config.letter} · ${roundIndex + 1} / 4`);
  setRoundBadge(roundIndex);
  setProgress(completedInputCount(roundIndex) / TOTAL_INPUTS);
  applyZoneColors();
  document.getElementById("lv20Stage")?.classList.add("is-round-intro");
  schedule(() => document.getElementById("lv20Stage")?.classList.remove("is-round-intro"), 760);
  schedule(() => playMemorySequence(token, 0), PREPARE_MS);
}

function playMemorySequence(token, sequenceIndex) {
  if (!isActive(token)) return;
  if (sequenceIndex >= currentSequence.length) {
    clearZoneStates();
    setText("lv20PhaseText", "YOUR TURN");
    schedule(() => startInputPhase(token), INPUT_DELAY_MS);
    return;
  }
  const zoneIndex = currentSequence[sequenceIndex];
  flashZone(zoneIndex, "is-memory");
  playLv20MemorySound(sequenceIndex, currentRound);
  schedule(() => clearZoneClass(zoneIndex, "is-memory"), FLASH_MS);
  schedule(() => playMemorySequence(token, sequenceIndex + 1), BEAT_MS);
}

function startInputPhase(token) {
  if (!isActive(token)) return;
  inputIndex = 0;
  acceptingInput = true;
  setText("lv20PhaseText", "PLAY");
  startBeat(token);
}

function startBeat(token) {
  window.clearTimeout(beatTimer);
  if (!isActive(token) || !acceptingInput || inputIndex >= currentSequence.length) return;
  const beat = document.getElementById("lv20Beat");
  beat?.classList.remove("is-active");
  void beat?.offsetWidth;
  beat?.classList.add("is-active");
  beatTimer = window.setTimeout(() => registerMiss(token), BEAT_MS);
}

function handleZonePress(event) {
  const zone = event.target.closest(".lv20-zone");
  if (!zone || !running || !acceptingInput || inputIndex >= currentSequence.length) return;
  event.preventDefault();
  window.clearTimeout(beatTimer);
  document.getElementById("lv20Beat")?.classList.remove("is-active");
  const pressedIndex = Number(zone.dataset.zone);
  const expectedIndex = currentSequence[inputIndex];
  flashZone(pressedIndex, "is-touch");
  if (pressedIndex === expectedIndex) {
    totalCorrect += 1;
    zone.classList.add("is-correct");
    playLv20TouchSound(inputIndex, currentRound);
    showGlyphFeedback(true);
  } else {
    totalFailures += 1;
    zone.classList.add("is-wrong");
    document.querySelector(`.lv20-zone[data-zone="${expectedIndex}"]`)?.classList.add("is-answer");
    playLv20FailSound(inputIndex);
    showGlyphFeedback(false);
  }
  inputIndex += 1;
  schedule(() => {
    clearZoneStates();
    continueOrFinishRound(gameToken);
  }, 260);
}

function registerMiss(token) {
  if (!isActive(token) || !acceptingInput) return;
  const expectedIndex = currentSequence[inputIndex];
  totalFailures += 1;
  document.querySelector(`.lv20-zone[data-zone="${expectedIndex}"]`)?.classList.add("is-wrong", "is-answer");
  playLv20FailSound(inputIndex);
  showGlyphFeedback(false);
  inputIndex += 1;
  schedule(() => {
    clearZoneStates();
    continueOrFinishRound(token);
  }, 280);
}

function continueOrFinishRound(token) {
  if (!isActive(token)) return;
  if (inputIndex < currentSequence.length) {
    startBeat(token);
    return;
  }
  acceptingInput = false;
  document.getElementById("lv20Beat")?.classList.remove("is-active");
  setProgress((completedInputCount(currentRound) + currentSequence.length) / TOTAL_INPUTS);
  const nextRound = currentRound + 1;
  if (nextRound < ROUND_CONFIGS.length) {
    setText("lv20PhaseText", "LINE SHIFT");
    schedule(() => transitionRound(token, nextRound), ROUND_GAP_MS);
  } else {
    schedule(() => finishGame(token), ROUND_GAP_MS);
  }
}

function transitionRound(token, nextRound) {
  if (!isActive(token)) return;
  playLv20TransitionSound(currentRound);
  const stage = document.getElementById("lv20Stage");
  stage?.classList.add("is-morphing");
  morphGlyph(nextRound, MORPH_MS, token).then(() => {
    if (!isActive(token)) return;
    stage?.classList.remove("is-morphing");
    beginRound(token, nextRound);
  });
}

function finishGame(token) {
  if (!isActive(token)) return;
  running = false;
  acceptingInput = false;
  stopLv20Sounds();
  const success = totalFailures === 0;
  playLv20FinishSound(success);
  setProgress(1);
  setText("lv20PhaseText", "COMPLETE");
  setText("lv20ResultKicker", success ? "PERFECT LINE MEMORY" : "LINE MEMORY COMPLETE");
  setText("lv20ResultTitle", success ? "완벽한 라인 리듬입니다" : "라인의 흐름을 한 번 더 기억해보세요");
  setText("lv20ResultDescription", success
    ? "Z, Y, X, W의 18개 여백 신호를 모두 정확한 순서와 박자로 터치했습니다."
    : `총 18개의 입력 중 ${totalCorrect}개 성공 · ${totalFailures}번의 실수가 기록되었습니다.`);
  toggleHidden("lv20NextButton", !success);
  toggleHidden("lv20RetryButton", success);
  show("lv20Result");
}

function renderGlyph(roundIndex, animate = false, preserveStates = false) {
  const svg = document.getElementById("lv20Glyph");
  const stage = document.getElementById("lv20Stage");
  if (!svg || !stage) return;
  const rect = stage.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  stageSize = { width, height };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const geometry = makeGeometry(roundIndex, width, height);
  if (!svg.querySelector(".lv20-zone-layer")) {
    svg.innerHTML = `<g class="lv20-zone-layer"></g><g class="lv20-line-layer"></g>`;
  }
  renderZones(geometry.zones, preserveStates);
  renderSegments(geometry.segments, animate);
  applyZoneColors();
}

function renderZones(zones, preserveStates = false) {
  const layer = document.querySelector("#lv20Glyph .lv20-zone-layer");
  if (!layer) return;
  const previous = preserveStates
    ? [...layer.querySelectorAll(".lv20-zone")].map((zone) => zone.className.baseVal)
    : [];
  layer.innerHTML = "";
  zones.forEach((points, index) => {
    const polygon = document.createElementNS(SVG_NS, "polygon");
    polygon.setAttribute("points", points.map(([x, y]) => `${x},${y}`).join(" "));
    polygon.setAttribute("class", previous[index] || "lv20-zone");
    polygon.dataset.zone = String(index);
    polygon.setAttribute("aria-label", `여백 ${index + 1}`);
    layer.appendChild(polygon);
  });
}

function renderSegments(segments, animate = false) {
  const layer = document.querySelector("#lv20Glyph .lv20-line-layer");
  if (!layer) return;
  if (!layer.children.length) {
    segments.forEach((segment) => {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("class", "lv20-line");
      layer.appendChild(line);
    });
  }
  segmentState = segments.map((segment) => [...segment]);
  [...layer.children].forEach((line, index) => setLine(line, segments[index], animate));
}

function morphGlyph(nextRound, duration, token) {
  const svg = document.getElementById("lv20Glyph");
  const layer = svg?.querySelector(".lv20-line-layer");
  if (!svg || !layer) return Promise.resolve();
  const target = makeGeometry(nextRound, stageSize.width, stageSize.height);
  const start = segmentState.length ? segmentState.map((segment) => [...segment]) : target.segments.map((segment) => [...segment]);
  const startedAt = performance.now();
  document.querySelector("#lv20Glyph .lv20-zone-layer")?.classList.add("is-leaving");
  return new Promise((resolve) => {
    const frame = (now) => {
      if (!isActive(token)) { resolve(); return; }
      const raw = Math.min(1, (now - startedAt) / duration);
      const progress = raw < .5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      [...layer.children].forEach((line, index) => {
        const segment = start[index].map((value, valueIndex) => value + (target.segments[index][valueIndex] - value) * progress);
        setLine(line, segment, false);
      });
      if (raw < 1) {
        requestAnimationFrame(frame);
        return;
      }
      currentRound = nextRound;
      segmentState = target.segments.map((segment) => [...segment]);
      const zoneLayer = document.querySelector("#lv20Glyph .lv20-zone-layer");
      zoneLayer?.classList.remove("is-leaving", "is-entering");
      renderZones(target.zones, false);
      zoneLayer?.classList.add("is-entering");
      requestAnimationFrame(() => {
        zoneLayer?.classList.remove("is-entering");
      });
      resolve();
    };
    requestAnimationFrame(frame);
  });
}

function makeGeometry(roundIndex, width, height) {
  const top = Math.max(72, height * 0.09);
  const bottom = height - Math.max(12, height * 0.025);
  const glyphWidth = Math.min(width, GLYPH_MAX_WIDTH);
  const glyphLeft = (width - glyphWidth) / 2;
  const glyphRight = glyphLeft + glyphWidth;
  const inset = Math.max(8, Math.min(glyphWidth * 0.04, 38));
  const left = glyphLeft + inset;
  const right = glyphRight - inset;
  const center = width / 2;
  const middle = top + (bottom - top) * 0.46;
  const hidden = [center, middle, center, middle];

  if (roundIndex === 0) {
    return {
      segments: [[left, top, right, top], [right, top, left, bottom], [left, bottom, right, bottom], hidden],
      zones: [
        [[0, top], [right, top], [left, bottom], [0, bottom]],
        [[right, top], [width, top], [width, bottom], [left, bottom]],
      ],
    };
  }

  if (roundIndex === 1) {
    return {
      segments: [[left, top, center, middle], [right, top, center, middle], [center, middle, center, bottom], hidden],
      zones: [
        [[0, top], [left, top], [center, middle], [center, bottom], [0, bottom]],
        [[right, top], [width, top], [width, bottom], [center, bottom], [center, middle]],
        [[left, top], [right, top], [center, middle]],
      ],
    };
  }

  if (roundIndex === 2) {
    const crossY = (top + bottom) / 2;
    return {
      segments: [[left, top, right, bottom], [right, top, left, bottom], hidden, hidden],
      zones: [
        [[0, top], [left, top], [center, crossY], [left, bottom], [0, bottom]],
        [[left, top], [right, top], [center, crossY]],
        [[right, top], [width, top], [width, bottom], [right, bottom], [center, crossY]],
        [[center, crossY], [right, bottom], [left, bottom]],
      ],
    };
  }

  const x0 = left;
  const x1 = left + (right - left) * 0.25;
  const x2 = center;
  const x3 = left + (right - left) * 0.75;
  const x4 = right;

  return {
    segments: [
      [x0, top, x1, bottom],
      [x1, bottom, x2, top],
      [x2, top, x3, bottom],
      [x3, bottom, x4, top],
    ],
    zones: [
      [[0, top], [x0, top], [x1, bottom], [0, bottom]],
      [[x0, top], [x2, top], [x1, bottom]],
      [[x2, top], [x3, bottom], [x1, bottom]],
      [[x2, top], [x4, top], [x3, bottom]],
      [[x4, top], [width, top], [width, bottom], [x3, bottom]],
    ],
  };
}

function setLine(line, [x1, y1, x2, y2], animate) {
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.classList.toggle("is-hidden", Math.hypot(x2 - x1, y2 - y1) < 2);
  if (animate) line.classList.add("is-animated");
}

function applyZoneColors() {
  document.querySelectorAll(".lv20-zone").forEach((zone, index) => {
    zone.style.setProperty("--zone-color", currentColors[index] || "#b8c7e8");
  });
}

function makeRoundColors(count) {
  const palette = shuffled([...COLOR_BANKS[randomInt(0, COLOR_BANKS.length - 1)]]);
  return palette.slice(0, count);
}

function makeSequence(length, zoneCount) {
  const values = [];
  for (let index = 0; index < length; index += 1) {
    let next = randomInt(0, zoneCount - 1);
    if (zoneCount > 1 && next === values[index - 1]) next = (next + 1 + randomInt(0, zoneCount - 2)) % zoneCount;
    values.push(next);
  }
  return values;
}

function flashZone(index, className) {
  const zone = document.querySelector(`.lv20-zone[data-zone="${index}"]`);
  if (!zone) return;
  zone.classList.remove(className);
  void zone.getBoundingClientRect();
  zone.classList.add(className);
}

function clearZoneClass(index, className) {
  document.querySelector(`.lv20-zone[data-zone="${index}"]`)?.classList.remove(className);
}

function clearZoneStates() {
  document.querySelectorAll(".lv20-zone").forEach((zone) => zone.classList.remove("is-memory", "is-touch", "is-correct", "is-wrong", "is-answer"));
}

function setRoundBadge(roundIndex) {
  const badge = document.getElementById("lv20RoundBadge");
  if (!badge) return;
  badge.querySelector("small").textContent = `ROUND ${roundIndex + 1}`;
  badge.querySelector("strong").textContent = ROUND_CONFIGS[roundIndex].letter;
  badge.classList.remove("is-visible");
  void badge.offsetWidth;
  badge.classList.add("is-visible");
  schedule(() => badge.classList.remove("is-visible"), 950);
}

function showGlyphFeedback(success) {
  const stage = document.getElementById("lv20Stage");
  if (!stage) return;
  window.clearTimeout(feedbackTimer);
  stage.classList.remove("is-feedback-good", "is-feedback-bad");
  void stage.offsetWidth;
  stage.classList.add(success ? "is-feedback-good" : "is-feedback-bad");
  feedbackTimer = window.setTimeout(() => {
    stage.classList.remove("is-feedback-good", "is-feedback-bad");
  }, 680);
}

function completedInputCount(roundIndex) {
  return ROUND_CONFIGS.slice(0, roundIndex).reduce((sum, config) => sum + config.count, 0);
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
function setProgress(value) { const element = document.getElementById("lv20ProgressBar"); if (element) element.style.width = `${Math.min(1, Math.max(0, value)) * 100}%`; }
function hide(id) { document.getElementById(id)?.setAttribute("hidden", ""); }
function show(id) { document.getElementById(id)?.removeAttribute("hidden"); }
function toggleHidden(id, hidden) { const element = document.getElementById(id); if (element) element.hidden = hidden; }
function isActive(token) { return running && token === gameToken && Boolean(document.getElementById("lv20Page")); }
function schedule(callback, delay) { const timer = window.setTimeout(() => { timers.delete(timer); callback(); }, delay); timers.add(timer); return timer; }

function cancelGame() {
  running = false;
  acceptingInput = false;
  gameToken += 1;
  window.clearTimeout(beatTimer);
  window.clearTimeout(feedbackTimer);
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  document.getElementById("lv20Beat")?.classList.remove("is-active");
  stopLv20Sounds();
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
