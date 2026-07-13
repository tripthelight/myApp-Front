import lv9Style from "../../../assets/scss/game/lv9/common.scss?inline";
import lv9Template from "./lv9.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv9ApproachSound,
  playLv9FailSound,
  playLv9SuccessSound,
  playStartSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/sound.js";

const CONFIG = Object.freeze({
  eventCount: 10,
  travelMs: 2200,
  firstEventMs: 2500,
  minGapMs: 1450,
  maxGapMs: 2050,
  judgeLeadMs: 520,
  judgeLateMs: 460,
  resultDelayMs: 900,
  desktopThreshold: 0.24,
  mobileThreshold: 4.5,
  maxWorldTilt: 8,
  maxNodeTilt: 6.8,
  tiltSmoothing: 0.115,
  sensorTimeoutMs: 1800,
  sensorRangeDeg: 18,
});

const DIRECTIONS = Object.freeze({
  lt: { x: -1, y: -1, glyph: "┌", label: "LEFT TOP" },
  rt: { x: 1, y: -1, glyph: "┐", label: "RIGHT TOP" },
  lb: { x: -1, y: 1, glyph: "└", label: "LEFT BOTTOM" },
  rb: { x: 1, y: 1, glyph: "┘", label: "RIGHT BOTTOM" },
});

const COLORS = ["#9fdac8", "#efb9c6", "#aabfe5", "#ead594", "#c9b8e8"];

let activeGameId = 0;
let activeFrameId = 0;
let activeTimeouts = new Set();
let currentRound = null;
let inputMode = "pointer";
let pointerState = { x: 0, y: 0 };
let tiltState = { x: 0, y: 0 };
let targetTiltState = { x: 0, y: 0 };
let renderTiltState = { x: 0, y: 0 };
let tiltRenderFrameId = 0;
let lastHintDirection = "";
let sensorBaseline = null;
let sensorEventReceived = false;
let sensorCheckTimeoutId = 0;
let sensorListening = false;
let sensorPreflightShown = false;
let viewportController = null;

export function renderPage() {
  cancelActiveGame();
  stopSensor();
  renderView(lv9Template, lv9Style);
  bindViewportHeight();
  bindPage();
}


function bindViewportHeight() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;

  const syncViewportHeight = () => {
    const page = document.getElementById("lv9Page");
    if (!page) return;
    const height = window.visualViewport?.height ?? window.innerHeight;
    page.style.setProperty("--lv9-viewport-height", `${Math.round(height)}px`);
  };

  syncViewportHeight();
  window.addEventListener("resize", syncViewportHeight, { passive: true, signal });
  window.addEventListener("orientationchange", syncViewportHeight, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", syncViewportHeight, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", syncViewportHeight, { passive: true, signal });
}

function bindPage() {
  const start = document.getElementById("lv9StartButton");
  const retry = document.getElementById("lv9RetryButton");
  const next = document.getElementById("lv9NextButton");
  const home = document.getElementById("lv9HomeButton");
  const page = document.getElementById("lv9Page");
  if (!start || !retry || !next || !home || !page) return;

  unlockSoundOnNextGesture();
  detectPreferredInput();
  if (inputMode === "sensor" && typeof DeviceOrientationEvent.requestPermission !== "function") startSensor();
  page.addEventListener("pointermove", handlePointerMove, { passive: true });
  page.addEventListener("pointerleave", resetPointerTilt, { passive: true });
  startTiltRenderer();

  start.addEventListener("click", async () => {
    if (shouldShowSensorPreflight()) {
      showSensorPreflight();
      return;
    }

    await prepareInput();
    const gameId = beginGame();
    await readySound();
    if (!isActive(gameId)) return;
    document.getElementById("lv9Ready")?.setAttribute("hidden", "");
    playStartSound();
    runGame(gameId);
  });

  retry.addEventListener("click", async () => {
    const gameId = beginGame();
    await readySound();
    if (!isActive(gameId)) return;
    document.getElementById("lv9Result")?.setAttribute("hidden", "");
    playStartSound();
    runGame(gameId);
  });

  next.addEventListener("click", () => {
    cancelActiveGame();
    stopSensor();
    navigate("lv10", { replace: true });
  });

  home.addEventListener("click", () => {
    cancelActiveGame();
    stopSensor();
    navigate("home", { replace: true });
  });
}

function shouldShowSensorPreflight() {
  return inputMode === "sensor"
    && typeof DeviceOrientationEvent.requestPermission === "function"
    && !sensorPreflightShown;
}

function showSensorPreflight() {
  sensorPreflightShown = true;
  const title = document.getElementById("lv9GuideTitle");
  const description = document.getElementById("lv9GuideDescription");
  const start = document.getElementById("lv9StartButton");
  const notice = document.getElementById("lv9SensorNotice");

  if (title) title.textContent = "기울임 센서를 사용합니다";
  if (description) {
    description.textContent = "다음 단계에서 iPhone이 ‘동작 및 방향’ 접근 권한을 묻습니다. 이 권한은 기울인 방향만 게임에 전달하며, 사진·연락처·위치 정보에는 접근하지 않습니다.";
  }
  if (notice) {
    notice.textContent = "Apple이 표시하는 시스템 팝업에서 ‘허용’을 눌러야 Gyroscope 모드로 플레이할 수 있습니다.";
    notice.hidden = false;
  }
  if (start) start.textContent = "센서 허용하고 시작";
}

function detectPreferredInput() {
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const orientationAvailable = "DeviceOrientationEvent" in window;
  inputMode = coarse && orientationAvailable ? "sensor" : "pointer";
  updateSensorNotice();
}

async function prepareInput() {
  if (inputMode !== "sensor") return;
  if (!window.isSecureContext) {
    inputMode = "pointer";
    updateSensorNotice("iPhone 센서는 HTTPS에서만 사용할 수 있습니다. 현재는 터치 위치 방식으로 전환되었습니다.");
    return;
  }
  const permission = DeviceOrientationEvent.requestPermission;
  if (typeof permission === "function") {
    try {
      const state = await permission.call(DeviceOrientationEvent);
      if (state !== "granted") {
        inputMode = "pointer";
        updateSensorNotice("기기 움직임 권한이 거부되어 터치 위치 방식으로 전환되었습니다.");
      }
    } catch {
      inputMode = "pointer";
      updateSensorNotice("기기 움직임 권한을 열 수 없어 터치 위치 방식으로 전환되었습니다.");
    }
  }
  if (inputMode === "sensor") {
    startSensor();
    sensorEventReceived = false;
    window.clearTimeout(sensorCheckTimeoutId);
    sensorCheckTimeoutId = window.setTimeout(() => {
      if (!sensorEventReceived && inputMode === "sensor") {
        inputMode = "pointer";
        stopSensor();
        updateSensorNotice("센서 값이 들어오지 않습니다. HTTPS 접속과 Safari의 동작 및 방향 접근 권한을 확인해 주세요. 터치 위치 방식으로 전환되었습니다.");
      }
    }, CONFIG.sensorTimeoutMs);
  }
  updateSensorNotice();
}

function updateSensorNotice(message = "") {
  const notice = document.getElementById("lv9SensorNotice");
  if (!notice) return;
  if (message) {
    notice.textContent = message;
    notice.hidden = false;
  } else if (inputMode === "sensor") {
    notice.textContent = window.isSecureContext ? "START를 누르면 기기 움직임 권한을 요청합니다." : "iPhone 자이로 센서는 HTTPS 접속이 필요합니다.";
    notice.hidden = false;
  } else if (window.matchMedia?.("(pointer: coarse)")?.matches) {
    notice.textContent = "자이로 센서를 사용할 수 없어 화면 위 포인터 위치로 판정합니다.";
    notice.hidden = false;
  } else {
    notice.hidden = true;
  }
}

function startSensor() {
  if (sensorListening) return;
  sensorBaseline = null;
  window.addEventListener("deviceorientation", handleOrientation, true);
  sensorListening = true;
}

function stopSensor() {
  if (sensorListening) window.removeEventListener("deviceorientation", handleOrientation, true);
  sensorListening = false;
  sensorBaseline = null;
  window.clearTimeout(sensorCheckTimeoutId);
  sensorCheckTimeoutId = 0;
}

function handleOrientation(event) {
  if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
  sensorEventReceived = true;
  if (!sensorBaseline) sensorBaseline = { beta: event.beta, gamma: event.gamma };
  const dx = clamp((event.gamma - sensorBaseline.gamma) / CONFIG.sensorRangeDeg, -1, 1);
  const dy = clamp((event.beta - sensorBaseline.beta) / CONFIG.sensorRangeDeg, -1, 1);
  targetTiltState = normalizeOrientationTilt(dx, dy);
}

function handlePointerMove(event) {
  if (inputMode === "sensor") return;
  const page = document.getElementById("lv9Page");
  if (!page) return;
  const rect = page.getBoundingClientRect();
  pointerState = {
    x: clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
    y: clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1),
  };
  targetTiltState = pointerState;
}

function resetPointerTilt() {
  if (inputMode === "sensor") return;
  pointerState = { x: 0, y: 0 };
  targetTiltState = pointerState;
}

function startTiltRenderer() {
  cancelAnimationFrame(tiltRenderFrameId);
  const render = () => {
    const smoothing = CONFIG.tiltSmoothing;
    renderTiltState.x += (targetTiltState.x - renderTiltState.x) * smoothing;
    renderTiltState.y += (targetTiltState.y - renderTiltState.y) * smoothing;
    tiltState = { ...renderTiltState };
    applyWorldTilt();
    if (document.getElementById("lv9Page")) tiltRenderFrameId = requestAnimationFrame(render);
  };
  tiltRenderFrameId = requestAnimationFrame(render);
}

function normalizeOrientationTilt(x, y) {
  const angle = screen.orientation?.angle ?? window.orientation ?? 0;
  if (angle === 90) return { x: -y, y: x };
  if (angle === -90 || angle === 270) return { x: y, y: -x };
  if (Math.abs(angle) === 180) return { x: -x, y: -y };
  return { x, y };
}

function applyWorldTilt() {
  const world = document.getElementById("lv9World");
  if (!world) return;
  const x = clamp(tiltState.x, -1, 1);
  const y = clamp(tiltState.y, -1, 1);
  world.style.setProperty("--tilt-x", `${(-y * CONFIG.maxWorldTilt).toFixed(3)}deg`);
  world.style.setProperty("--tilt-y", `${(x * CONFIG.maxWorldTilt).toFixed(3)}deg`);
  world.style.setProperty("--node-tilt-x", `${(-y * CONFIG.maxNodeTilt).toFixed(3)}deg`);
  world.style.setProperty("--node-tilt-y", `${(x * CONFIG.maxNodeTilt).toFixed(3)}deg`);
  world.style.setProperty("--parallax-x", x.toFixed(4));
  world.style.setProperty("--parallax-y", y.toFixed(4));
  world.style.setProperty("--light-x", `${(50 + x * 30).toFixed(2)}%`);
  world.style.setProperty("--light-y", `${(50 + y * 30).toFixed(2)}%`);
  updateDirectionHint();
}

function updateDirectionHint() {
  const hint = document.getElementById("lv9DirectionHint");
  if (!hint) return;
  const direction = inputDirection();
  const nextDirection = direction || "center";
  if (nextDirection === lastHintDirection) return;
  lastHintDirection = nextDirection;
  hint.dataset.direction = nextDirection;
  hint.querySelector("span").textContent = direction ? DIRECTIONS[direction].glyph : "·";
}

function beginGame() {
  cancelActiveGame();
  activeGameId += 1;
  resetView();
  return activeGameId;
}

function cancelActiveGame() {
  activeGameId += 1;
  cancelAnimationFrame(activeFrameId);
  activeFrameId = 0;
  activeTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
  activeTimeouts.clear();
  currentRound = null;
}

function runGame(gameId) {
  const round = createRound();
  currentRound = round;
  renderNodes(round);
  setStatus(inputMode === "sensor" ? "노드가 닿는 모서리로 기기를 기울이세요." : "노드가 닿는 모서리로 마우스를 이동하세요.");
  setJudge("GO");
  round.startedAt = performance.now();
  activeFrameId = requestAnimationFrame((now) => updateFrame(gameId, round, now));
}

function createRound() {
  let arrivalAtMs = CONFIG.firstEventMs;
  const keys = Object.keys(DIRECTIONS);
  const events = Array.from({ length: CONFIG.eventCount }, (_, index) => {
    const direction = keys[randomInteger(0, keys.length - 1)];
    const event = {
      index,
      direction,
      arrivalAtMs,
      state: "pending",
      soundPlayed: false,
      matchedDirection: false,
      element: null,
    };
    arrivalAtMs += randomInteger(CONFIG.minGapMs, CONFIG.maxGapMs);
    return event;
  });
  return { events, startedAt: 0, judgedCount: 0, failed: false, finished: false };
}

function renderNodes(round) {
  const layer = document.getElementById("lv9NodeLayer");
  if (!layer) return;
  const fragment = document.createDocumentFragment();
  round.events.forEach((event) => {
    const node = document.createElement("span");
    node.className = "lv9-node";
    node.textContent = DIRECTIONS[event.direction].glyph;
    node.dataset.direction = event.direction;
    node.style.setProperty("--node-color", COLORS[event.index % COLORS.length]);
    event.element = node;
    fragment.appendChild(node);
  });
  layer.replaceChildren(fragment);
}

function updateFrame(gameId, round, now) {
  if (!isActive(gameId) || round.finished) return;
  const elapsed = now - round.startedAt;
  const geometry = readGeometry();
  if (!geometry) return;

  round.events.forEach((event) => updateEvent(event, elapsed, geometry, round));
  setProgress(`${round.judgedCount} / ${CONFIG.eventCount}`);

  if (round.judgedCount >= CONFIG.eventCount) {
    finishRound(gameId, round);
    return;
  }
  activeFrameId = requestAnimationFrame((time) => updateFrame(gameId, round, time));
}

function updateEvent(event, elapsed, geometry, round) {
  if (event.state !== "pending") return;
  const relative = elapsed - event.arrivalAtMs;
  const progress = clamp((relative + CONFIG.travelMs) / CONFIG.travelMs, 0, 1);
  if (event.index === 0 && progress > 0) document.getElementById("lv9Stage")?.classList.add("is-playing");
  positionNode(event, progress, relative, geometry);

  if (!event.soundPlayed && progress >= 0.7) {
    event.soundPlayed = true;
    playLv9ApproachSound(event.index);
  }

  if (relative >= -CONFIG.judgeLeadMs && relative <= CONFIG.judgeLateMs) {
    event.element?.classList.add("is-arriving");
    if (inputDirection() === event.direction) event.matchedDirection = true;
  }

  if (relative > CONFIG.judgeLateMs) judgeEvent(event, round);
}

function positionNode(event, progress, relative, geometry) {
  if (!event.element) return;
  const vector = DIRECTIONS[event.direction];
  const eased = easeInOutCubic(progress);
  const x = vector.x * geometry.x * eased;
  const y = vector.y * geometry.y * eased;
  const scale = 0.54 + eased * 1.34;
  const visible = progress > 0 && relative <= CONFIG.judgeLateMs + 500;
  event.element.style.opacity = visible ? String(Math.min(1, progress * 4)) : "0";
  event.element.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), ${eased * 104}px) scale(${scale}) rotateX(var(--node-tilt-x)) rotateY(var(--node-tilt-y))`;
}

function judgeEvent(event, round) {
  if (event.state !== "pending") return;
  event.state = "judged";
  round.judgedCount += 1;
  const actual = inputDirection();
  const success = event.matchedDirection || actual === event.direction;
  if (!success) round.failed = true;

  event.element?.classList.remove("is-arriving");
  event.element?.classList.add(success ? "is-success" : "is-fail");
  if (success) {
    playLv9SuccessSound(event.index);
    showFeedback(true, "PERFECT TILT", DIRECTIONS[event.direction].label, event.direction);
  } else {
    playLv9FailSound(event.index);
    showFeedback(false, "MISSED ANGLE", `목표 ${DIRECTIONS[event.direction].label}`, event.direction);
  }

  schedule(() => {
    if (event.element) event.element.style.opacity = "0";
  }, 620);
}

function inputDirection() {
  const source = inputMode === "sensor" ? tiltState : pointerState;
  const threshold = inputMode === "sensor" ? CONFIG.mobileThreshold / CONFIG.sensorRangeDeg : CONFIG.desktopThreshold;
  if (Math.abs(source.x) < threshold || Math.abs(source.y) < threshold) return null;
  if (source.x < 0 && source.y < 0) return "lt";
  if (source.x > 0 && source.y < 0) return "rt";
  if (source.x < 0 && source.y > 0) return "lb";
  return "rb";
}

function showFeedback(success, title, message, direction) {
  const stage = document.getElementById("lv9Stage");
  const box = document.getElementById("lv9Feedback");
  if (!stage || !box) return;
  stage.classList.remove("is-success", "is-fail");
  box.classList.remove("is-success", "is-fail");
  void box.offsetWidth;
  stage.dataset.impact = direction;
  stage.classList.add(success ? "is-success" : "is-fail");
  box.classList.add(success ? "is-success" : "is-fail");
  box.querySelector("strong").textContent = title;
  box.querySelector("span").textContent = message;
  setJudge(success ? "PERFECT" : "MISS");
  schedule(() => stage.classList.remove("is-success", "is-fail"), 720);
}

function finishRound(gameId, round) {
  if (round.finished) return;
  round.finished = true;
  document.getElementById("lv9Stage")?.classList.remove("is-playing");
  setStatus(round.failed ? "모든 노드의 이동이 끝났습니다." : "모든 방향을 정확히 맞췄습니다.");
  schedule(() => {
    if (isActive(gameId)) showResult(round);
  }, CONFIG.resultDelayMs);
}

function showResult(round) {
  const result = document.getElementById("lv9Result");
  const title = document.getElementById("lv9ResultTitle");
  const message = document.getElementById("lv9ResultMessage");
  const next = document.getElementById("lv9NextButton");
  const retry = document.getElementById("lv9RetryButton");
  if (!result || !title || !message || !next || !retry) return;

  title.textContent = round.failed ? "TRY AGAIN" : "TILT COMPLETE";
  message.textContent = round.failed
    ? "한 번 이상의 방향 또는 타이밍이 어긋났습니다. 노드가 모서리에 닿는 박자를 다시 느껴보세요."
    : "모든 노드의 도착 방향과 타이밍을 정확히 맞췄습니다.";
  next.hidden = round.failed;
  retry.hidden = !round.failed;
  result.hidden = false;
}

function resetView() {
  document.getElementById("lv9NodeLayer")?.replaceChildren();
  document.getElementById("lv9Result")?.setAttribute("hidden", "");
  document.getElementById("lv9NextButton")?.setAttribute("hidden", "");
  document.getElementById("lv9RetryButton")?.setAttribute("hidden", "");
  const stage = document.getElementById("lv9Stage");
  stage?.classList.remove("is-success", "is-fail", "is-playing");
  setProgress(`0 / ${CONFIG.eventCount}`);
  setJudge("READY");
}

function readGeometry() {
  const stage = document.getElementById("lv9Stage");
  if (!stage) return null;
  const rect = stage.getBoundingClientRect();
  return { x: rect.width * 0.43, y: rect.height * 0.43 };
}

function schedule(callback, delay) {
  const timeoutId = window.setTimeout(() => {
    activeTimeouts.delete(timeoutId);
    callback();
  }, delay);
  activeTimeouts.add(timeoutId);
}

function setStatus(text) { const el = document.getElementById("lv9Status"); if (el) el.textContent = text; }
function setProgress(text) { const el = document.getElementById("lv9Progress"); if (el) el.textContent = text; }
function setJudge(text) { const el = document.getElementById("lv9Judge"); if (el) el.textContent = text; }
function isActive(gameId) { return gameId === activeGameId && Boolean(document.getElementById("lv9Page")); }
function randomInteger(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function easeInOutCubic(value) { return value < 0.5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2; }
