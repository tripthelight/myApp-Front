import lv5Style from "../../../assets/scss/game/lv5/common.scss?inline";
import lv5Template from "./lv5.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playFailSound,
  playLv5BlinkSound,
  playOkSound,
  playStartSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/sound.js";

const LEVEL_CONFIG = Object.freeze({
  sequenceLength: 6,

  // true: 150~1000ms 사이에서 서로 다른 간격 6개를 자동 생성합니다.
  // false: manualTimingsMs에 작성한 값을 그대로 사용합니다.
  useRandomTimings: true,
  manualTimingsMs: [500, 800, 950, 200, 1000, 700],
  randomTimingMinMs: 150,
  randomTimingMaxMs: 1000,
  randomTimingStepMs: 10,

  blinkMs: 430,
  betweenPhaseMs: 760,
  feedbackMs: 360,
  touchTimingToleranceMs: 260,
  resultDelayMs: 500,
  positions: ["lt", "rt", "lb", "rb"],
});

let activeGameId = 0;

export function renderPage() {
  activeGameId += 1;
  const pageGameId = activeGameId;

  renderView(lv5Template, lv5Style);
  bindPage(pageGameId);
}

function bindPage(pageGameId) {
  const readyLayer = document.getElementById("lv5Ready");
  const resultLayer = document.getElementById("lv5Result");
  const startButton = document.getElementById("lv5StartButton");
  const retryButton = document.getElementById("lv5RetryButton");
  const nextButton = document.getElementById("lv5NextButton");
  const homeButton = document.getElementById("lv5HomeButton");

  if (!readyLayer || !resultLayer || !startButton || !retryButton || !nextButton || !homeButton) {
    return;
  }

  unlockSoundOnNextGesture();

  startButton.addEventListener("click", async () => {
    const gameId = beginGame();
    await readySound();
    if (!isActive(gameId)) return;

    playStartSound();
    readyLayer.hidden = true;
    runGame(gameId);
  });

  retryButton.addEventListener("click", async () => {
    const gameId = beginGame();
    await readySound();
    if (!isActive(gameId)) return;

    playStartSound();
    resultLayer.hidden = true;
    runGame(gameId);
  });

  nextButton.addEventListener("click", () => {
    activeGameId += 1;
    navigate("lv6", { replace: true });
  });

  homeButton.addEventListener("click", () => {
    activeGameId += 1;
    navigate("home", { replace: true });
  });

  activeGameId = pageGameId;
}

function beginGame() {
  activeGameId += 1;
  resetBoard();
  hideResult();
  return activeGameId;
}

async function runGame(gameId) {
  const round = createRound();
  buildProgress(round.timingsMs);

  setBoardEnabled(false);
  setStatus("빛나는 위치와 순서를 기억하세요. 0 / 6");

  await playMemoryPhase(gameId, round);
  if (!isActive(gameId)) return;

  setStatus("준비하세요.");
  await playPhaseMotion(gameId);
  if (!isActive(gameId)) return;

  setStatus("기억한 순서와 타이밍에 맞춰 터치하세요. 0 / 6");
  startProgress(round.timingsMs);
  const results = await playTouchPhase(gameId, round);
  if (!isActive(gameId)) return;

  await delay(LEVEL_CONFIG.resultDelayMs);
  if (!isActive(gameId)) return;

  showResult(results.every(Boolean));
}

function createRound() {
  return {
    sequence: createSequence(),
    timingsMs: createTimings(),
  };
}

function createSequence() {
  const guaranteedPositions = shuffle([...LEVEL_CONFIG.positions]);
  const remainingCount = LEVEL_CONFIG.sequenceLength - guaranteedPositions.length;
  const remainingPositions = Array.from({ length: remainingCount }, () => {
    return LEVEL_CONFIG.positions[randomInteger(0, LEVEL_CONFIG.positions.length - 1)];
  });

  return shuffle([...guaranteedPositions, ...remainingPositions]);
}

function createTimings() {
  if (!LEVEL_CONFIG.useRandomTimings) {
    validateManualTimings(LEVEL_CONFIG.manualTimingsMs);
    return [...LEVEL_CONFIG.manualTimingsMs];
  }

  const available = [];
  for (
    let value = LEVEL_CONFIG.randomTimingMinMs;
    value <= LEVEL_CONFIG.randomTimingMaxMs;
    value += LEVEL_CONFIG.randomTimingStepMs
  ) {
    available.push(value);
  }

  return shuffle(available).slice(0, LEVEL_CONFIG.sequenceLength);
}

function validateManualTimings(timings) {
  if (!Array.isArray(timings) || timings.length !== LEVEL_CONFIG.sequenceLength) {
    throw new Error(`manualTimingsMs must contain exactly ${LEVEL_CONFIG.sequenceLength} values.`);
  }

  const invalidValue = timings.find((value) => {
    return !Number.isFinite(value) || value < 0 || value > LEVEL_CONFIG.randomTimingMaxMs;
  });

  if (invalidValue !== undefined) {
    throw new Error("Each manual timing must be a number between 0 and 1000ms.");
  }
}

async function playMemoryPhase(gameId, round) {
  for (let index = 0; index < round.sequence.length; index += 1) {
    await delay(round.timingsMs[index]);
    if (!isActive(gameId)) return;

    const position = round.sequence[index];
    const quadrant = getQuadrant(position);
    if (!quadrant) return;

    setStatus(`빛나는 위치와 순서를 기억하세요. ${index + 1} / 6`);
    playLv5BlinkSound(index);
    restartClass(quadrant, "is-memory-blink");

    await delay(LEVEL_CONFIG.blinkMs);
    if (!isActive(gameId)) return;
    quadrant.classList.remove("is-memory-blink");
  }
}

async function playPhaseMotion(gameId) {
  const page = document.getElementById("lv5Page");
  const motion = document.getElementById("lv5PhaseMotion");
  if (!page || !motion) return;

  page.classList.add("is-phase-changing");
  restartClass(motion, "is-active");

  await delay(LEVEL_CONFIG.betweenPhaseMs);
  if (!isActive(gameId)) return;

  motion.classList.remove("is-active");
  page.classList.remove("is-phase-changing");
}

function playTouchPhase(gameId, round) {
  return new Promise((resolve) => {
    const board = document.getElementById("lv5Board");
    if (!board) {
      resolve(Array(LEVEL_CONFIG.sequenceLength).fill(false));
      return;
    }

    const targetTimesMs = [];
    let accumulatedMs = 0;

    round.timingsMs.forEach((timingMs) => {
      accumulatedMs += timingMs;
      targetTimesMs.push(accumulatedMs);
    });

    const results = [];
    const feedbackTimers = new Map();
    const phaseStartedAt = performance.now();
    const phaseDurationMs = accumulatedMs + LEVEL_CONFIG.touchTimingToleranceMs;
    let touchIndex = 0;
    let finished = false;

    setBoardEnabled(true);

    const clearFeedback = () => {
      feedbackTimers.forEach((timerId, quadrant) => {
        window.clearTimeout(timerId);
        quadrant.classList.remove("is-success", "is-fail");
      });
      feedbackTimers.clear();
    };

    const finishPhase = () => {
      if (finished) return;
      finished = true;

      while (results.length < LEVEL_CONFIG.sequenceLength) {
        results.push(false);
      }

      setBoardEnabled(false);
      board.removeEventListener("pointerdown", handlePointerDown);
      clearFeedback();
      setStatus("여섯 번의 타이밍이 모두 끝났습니다.");
      resolve(results);
    };

    const handlePointerDown = (event) => {
      const quadrant = event.target.closest(".lv5-quadrant");
      if (
        !quadrant ||
        !board.contains(quadrant) ||
        !isActive(gameId) ||
        finished ||
        touchIndex >= LEVEL_CONFIG.sequenceLength
      ) {
        return;
      }

      event.preventDefault();

      const expectedIndex = touchIndex;
      const elapsedMs = performance.now() - phaseStartedAt;
      const timingDifferenceMs = Math.abs(elapsedMs - targetTimesMs[expectedIndex]);
      const touchedPosition = quadrant.dataset.position;
      const positionMatches = touchedPosition === round.sequence[expectedIndex];
      const timingMatches = timingDifferenceMs <= LEVEL_CONFIG.touchTimingToleranceMs;
      const isCorrect = positionMatches && timingMatches;

      results.push(isCorrect);
      touchIndex += 1;

      setStatus(`순서와 타이밍에 맞춰 터치하세요. ${touchIndex} / 6`);
      showTouchFeedback(quadrant, isCorrect);

      const previousTimer = feedbackTimers.get(quadrant);
      if (previousTimer) window.clearTimeout(previousTimer);

      const feedbackTimer = window.setTimeout(() => {
        quadrant.classList.remove("is-success", "is-fail");
        feedbackTimers.delete(quadrant);
      }, LEVEL_CONFIG.feedbackMs);
      feedbackTimers.set(quadrant, feedbackTimer);

      if (isCorrect) playOkSound();
      else playFailSound();
    };

    board.addEventListener("pointerdown", handlePointerDown);

    window.setTimeout(() => {
      if (!isActive(gameId)) {
        finished = true;
        board.removeEventListener("pointerdown", handlePointerDown);
        clearFeedback();
        resolve(results);
        return;
      }

      finishPhase();
    }, phaseDurationMs);
  });
}
function showTouchFeedback(quadrant, isCorrect) {
  quadrant.classList.remove("is-success", "is-fail");
  void quadrant.offsetWidth;
  quadrant.classList.add(isCorrect ? "is-success" : "is-fail");
}

function setBoardEnabled(enabled) {
  const board = document.getElementById("lv5Board");
  if (!board) return;

  board.classList.toggle("is-touch-enabled", enabled);
  board.querySelectorAll(".lv5-quadrant").forEach((quadrant) => {
    quadrant.disabled = !enabled;
  });
}

function resetBoard() {
  document.getElementById("lv5Page")?.classList.remove("is-phase-changing");
  document.getElementById("lv5PhaseMotion")?.classList.remove("is-active");

  document.querySelectorAll(".lv5-quadrant").forEach((quadrant) => {
    quadrant.classList.remove("is-memory-blink", "is-success", "is-fail");
  });

  setBoardEnabled(false);
  resetProgress();
  setStatus("게임을 준비하고 있습니다.");
}

function buildProgress(timingsMs) {
  const progress = document.getElementById("lv5Progress");
  if (!progress) return;

  const total = timingsMs.reduce((sum, value) => sum + value, 0);
  progress.replaceChildren();
  progress.classList.add("is-visible");

  timingsMs.forEach((timingMs, index) => {
    const segment = document.createElement("span");
    segment.className = "lv5-progress__segment";
    segment.style.flexBasis = `${(timingMs / total) * 100}%`;
    segment.dataset.index = String(index);

    const fill = document.createElement("i");
    fill.className = "lv5-progress__fill";
    segment.appendChild(fill);
    progress.appendChild(segment);
  });
}

function startProgress(timingsMs) {
  const progress = document.getElementById("lv5Progress");
  if (!progress) return;

  let delayMs = 0;
  [...progress.querySelectorAll(".lv5-progress__fill")].forEach((fill, index) => {
    const duration = timingsMs[index];
    fill.getAnimations().forEach((animation) => animation.cancel());
    fill.animate(
      [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
      { duration, delay: delayMs, easing: "linear", fill: "forwards" }
    );
    delayMs += duration;
  });
}

function resetProgress() {
  const progress = document.getElementById("lv5Progress");
  if (!progress) return;
  progress.querySelectorAll(".lv5-progress__fill").forEach((fill) => {
    fill.getAnimations().forEach((animation) => animation.cancel());
    fill.style.transform = "scaleX(0)";
  });
  progress.classList.remove("is-visible");
  progress.replaceChildren();
}

function hideResult() {
  const resultLayer = document.getElementById("lv5Result");
  const nextButton = document.getElementById("lv5NextButton");
  const retryButton = document.getElementById("lv5RetryButton");

  if (resultLayer) resultLayer.hidden = true;
  if (nextButton) nextButton.hidden = true;
  if (retryButton) retryButton.hidden = true;
}

function showResult(success) {
  const resultLayer = document.getElementById("lv5Result");
  const title = document.getElementById("lv5ResultTitle");
  const message = document.getElementById("lv5ResultMessage");
  const nextButton = document.getElementById("lv5NextButton");
  const retryButton = document.getElementById("lv5RetryButton");

  if (!resultLayer || !title || !message || !nextButton || !retryButton) return;

  title.textContent = success ? "PERFECT" : "TRY AGAIN";
  message.textContent = success
    ? "여섯 번의 순서와 타이밍을 모두 정확하게 기억했습니다."
    : "여섯 번의 타이밍은 끝났습니다. 순서와 리듬을 다시 기억해 보세요.";
  nextButton.hidden = !success;
  retryButton.hidden = success;
  resultLayer.hidden = false;
}

function setStatus(message) {
  const status = document.getElementById("lv5Status");
  if (status) status.textContent = message;
}

function getQuadrant(position) {
  return document.querySelector(`.lv5-quadrant[data-position="${position}"]`);
}

function restartClass(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function isActive(gameId) {
  return gameId === activeGameId && document.getElementById("lv5Page") !== null;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(values) {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = randomInteger(0, index);
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }

  return result;
}
