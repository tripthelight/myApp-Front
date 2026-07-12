import lv6Style from "../../../assets/scss/game/lv6/common.scss?inline";
import lv6Template from "./lv6.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv6FailSound,
  playLv6TapSound,
  playStartSound,
  readySound,
  startLv6HoldSound,
  stopLv6HoldSound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/sound.js";

// lv6을 다른 레벨에서 재사용할 때 이 값만 1~10 사이로 변경하면 됩니다.
// 1: 가장 느린 이동 속도와 가장 긴 출현 간격
// 10: 가장 빠른 이동 속도와 가장 짧은 출현 간격
const LV6_DIFFICULTY = 1;

const BASE_CONFIG = Object.freeze({
  noteCount: 20,
  tapToleranceMs: 190,
  holdStartToleranceMs: 210,
  holdReleaseToleranceMs: 230,
  missGraceMs: 235,
  holdMinMs: 620,
  holdMaxMs: 1180,
  holdStepMs: 70,
  holdCountMin: 6,
  holdCountMax: 8,
  resultDelayMs: 650,
});

const DIFFICULTY_RANGE = Object.freeze({
  leadTimeMs: { easy: 3600, hard: 1050 },
  firstHitDelayMs: { easy: 4200, hard: 1450 },
  minGapAfterNoteMs: { easy: 1350, hard: 260 },
  maxGapAfterNoteMs: { easy: 1900, hard: 470 },
});

const CONFIG = Object.freeze({
  ...BASE_CONFIG,
  difficulty: clampDifficulty(LV6_DIFFICULTY),
  ...createDifficultyTiming(LV6_DIFFICULTY),
});

let activeGameId = 0;
let activeFrameId = 0;
let currentRound = null;

export function renderPage() {
  cancelActiveGame();
  const pageGameId = activeGameId;
  renderView(lv6Template, lv6Style);
  bindPage(pageGameId);
}

function bindPage(pageGameId) {
  const readyLayer = document.getElementById("lv6Ready");
  const resultLayer = document.getElementById("lv6Result");
  const startButton = document.getElementById("lv6StartButton");
  const retryButton = document.getElementById("lv6RetryButton");
  const nextButton = document.getElementById("lv6NextButton");
  const homeButton = document.getElementById("lv6HomeButton");
  const topButton = document.getElementById("lv6TopButton");
  const bottomButton = document.getElementById("lv6BottomButton");

  if (!readyLayer || !resultLayer || !startButton || !retryButton || !nextButton || !homeButton || !topButton || !bottomButton) {
    return;
  }

  unlockSoundOnNextGesture();
  bindKey(topButton, "up");
  bindKey(bottomButton, "down");

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
    cancelActiveGame();
    navigate("lv7", { replace: true });
  });

  homeButton.addEventListener("click", () => {
    cancelActiveGame();
    navigate("home", { replace: true });
  });

  activeGameId = pageGameId;
}

function beginGame() {
  cancelAnimationFrame(activeFrameId);
  stopLv6HoldSound();
  activeGameId += 1;
  resetStage();
  return activeGameId;
}

function cancelActiveGame() {
  activeGameId += 1;
  cancelAnimationFrame(activeFrameId);
  activeFrameId = 0;
  currentRound = null;
  stopLv6HoldSound();
}

function runGame(gameId) {
  const round = createRound();
  currentRound = round;
  renderNodes(round);
  setStatus("리듬을 따라 위·아래 버튼을 누르세요.");
  setJudge("GO");

  round.startedAt = performance.now();
  activeFrameId = requestAnimationFrame((now) => updateFrame(gameId, round, now));
}

function createRound() {
  const directions = createDirections();
  const holdIndexes = new Set(
    shuffle([...Array(CONFIG.noteCount).keys()])
      .slice(0, randomInteger(CONFIG.holdCountMin, CONFIG.holdCountMax)),
  );

  let hitAtMs = CONFIG.firstHitDelayMs;
  const notes = directions.map((direction, index) => {
    const isHold = holdIndexes.has(index);
    const holdMs = isHold
      ? randomSteppedValue(CONFIG.holdMinMs, CONFIG.holdMaxMs, CONFIG.holdStepMs)
      : 0;

    const note = {
      id: `lv6-note-${index}`,
      index,
      direction,
      type: isHold ? "hold" : "tap",
      hitAtMs,
      holdMs,
      state: "pending",
      pressedAtMs: null,
      pointerId: null,
      element: null,
    };

    hitAtMs += holdMs
      + randomInteger(CONFIG.minGapAfterNoteMs, CONFIG.maxGapAfterNoteMs);
    return note;
  });

  return {
    notes,
    startedAt: 0,
    judgedCount: 0,
    failed: false,
    finished: false,
    activePresses: new Map(),
  };
}

function createDirections() {
  const majorityDirection = Math.random() < 0.5 ? "up" : "down";
  const majorityCount = randomInteger(10, 13);
  const minorityDirection = majorityDirection === "up" ? "down" : "up";

  return shuffle([
    ...Array(majorityCount).fill(majorityDirection),
    ...Array(CONFIG.noteCount - majorityCount).fill(minorityDirection),
  ]);
}

function renderNodes(round) {
  const container = document.getElementById("lv6Nodes");
  if (!container) return;

  const fragment = document.createDocumentFragment();
  round.notes.forEach((note) => {
    const element = document.createElement("span");
    element.id = note.id;
    element.className = `lv6-node is-${note.direction} is-${note.type}`;
    element.dataset.noteIndex = String(note.index);
    element.innerHTML = note.type === "hold"
      ? '<span class="lv6-node-cap"></span><span class="lv6-node-hold-mark">HOLD</span>'
      : '<span class="lv6-node-cap"></span>';
    note.element = element;
    fragment.appendChild(element);
  });
  container.replaceChildren(fragment);
}

function updateFrame(gameId, round, now) {
  if (!isActive(gameId) || round.finished) return;

  const elapsedMs = now - round.startedAt;
  const geometry = readGeometry();
  if (!geometry) return;

  round.notes.forEach((note) => {
    updateNodeVisual(note, elapsedMs, geometry);
    updateMissState(note, elapsedMs, round);
    updateHoldState(note, elapsedMs, round);
  });

  if (round.judgedCount >= CONFIG.noteCount) {
    finishRound(gameId, round);
    return;
  }

  activeFrameId = requestAnimationFrame((nextNow) => updateFrame(gameId, round, nextNow));
}

function readGeometry() {
  const stage = document.getElementById("lv6Stage");
  const topButton = document.getElementById("lv6TopButton");
  const bottomButton = document.getElementById("lv6BottomButton");
  if (!stage || !topButton || !bottomButton) return null;

  const stageRect = stage.getBoundingClientRect();
  const topRect = topButton.getBoundingClientRect();
  const bottomRect = bottomButton.getBoundingClientRect();

  return {
    topTargetY: topRect.bottom - stageRect.top,
    bottomTargetY: bottomRect.top - stageRect.top,
    centerY: stageRect.height / 2,
    travelDistance: Math.max(1, bottomRect.top - topRect.bottom),
  };
}

function updateNodeVisual(note, elapsedMs, geometry) {
  if (!note.element || note.state === "judged" || note.state === "missed") return;

  const progress = (elapsedMs - (note.hitAtMs - CONFIG.leadTimeMs)) / CONFIG.leadTimeMs;
  if (progress < 0) {
    note.element.style.opacity = "0";
    return;
  }

  const speedPxPerMs = geometry.travelDistance / CONFIG.leadTimeMs;
  const tapHeight = clamp(geometry.travelDistance * 0.035, 13, 25);
  const noteHeight = note.type === "hold"
    ? Math.max(tapHeight * 2.4, note.holdMs * speedPxPerMs)
    : tapHeight;
  const visibleAfterHitProgress = note.type === "hold"
    ? (note.holdMs + CONFIG.holdReleaseToleranceMs) / CONFIG.leadTimeMs
    : 0.14;
  const maxProgress = 1 + visibleAfterHitProgress;
  const clampedProgress = Math.min(maxProgress, progress);

  note.element.style.setProperty("--note-height", `${noteHeight}px`);
  note.element.style.opacity = progress <= maxProgress ? "1" : "0";

  if (note.direction === "down") {
    const leadingY = geometry.topTargetY + geometry.travelDistance * clampedProgress;
    note.element.style.transform = `translate3d(0, ${leadingY - noteHeight}px, 0)`;
  } else {
    const leadingY = geometry.bottomTargetY - geometry.travelDistance * clampedProgress;
    note.element.style.transform = `translate3d(0, ${leadingY}px, 0)`;
  }
}

function updateMissState(note, elapsedMs, round) {
  if (note.state !== "pending") return;

  if (elapsedMs > note.hitAtMs + CONFIG.missGraceMs) {
    judgeNote(note, false, round, "MISS");
  }
}

function updateHoldState(note, elapsedMs, round) {
  if (note.state !== "holding") return;

  const expectedReleaseMs = note.hitAtMs + note.holdMs;
  if (elapsedMs > expectedReleaseMs + CONFIG.holdReleaseToleranceMs) {
    const key = getKey(note.direction);
    key?.classList.remove("is-success");
    key?.classList.add("is-fail");
    stopLv6HoldSound();
    round.activePresses.delete(note.pointerId);
    judgeNote(note, false, round, "TOO LONG");
  }
}

function bindKey(key, direction) {
  key.addEventListener("contextmenu", (event) => event.preventDefault());

  key.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (!currentRound || currentRound.finished) return;

    key.setPointerCapture?.(event.pointerId);
    handlePress(direction, event.pointerId, key);
  });

  const release = (event) => {
    if (!currentRound) return;
    handleRelease(direction, event.pointerId, key);
  };

  key.addEventListener("pointerup", release);
  key.addEventListener("pointercancel", release);
  key.addEventListener("lostpointercapture", (event) => {
    if (currentRound?.activePresses.has(event.pointerId)) {
      handleRelease(direction, event.pointerId, key);
    }
  });
}

function handlePress(direction, pointerId, key) {
  const round = currentRound;
  if (!round || round.finished || round.activePresses.has(pointerId)) return;

  const elapsedMs = performance.now() - round.startedAt;
  const note = findPressCandidate(round, direction, elapsedMs);

  key.classList.remove("is-success", "is-fail");

  if (!note) {
    markStrayPress(round, pointerId, direction, key);
    return;
  }

  const tolerance = note.type === "hold"
    ? CONFIG.holdStartToleranceMs
    : CONFIG.tapToleranceMs;
  const isOnTime = Math.abs(elapsedMs - note.hitAtMs) <= tolerance;

  if (!isOnTime) {
    markStrayPress(round, pointerId, direction, key, note);
    return;
  }

  note.pressedAtMs = elapsedMs;
  note.pointerId = pointerId;
  round.activePresses.set(pointerId, { note, key, direction, success: true });
  key.classList.add("is-success");

  if (note.type === "tap") {
    playLv6TapSound(note.index);
    judgeNote(note, true, round, "SUCCESS");
  } else {
    note.state = "holding";
    note.element?.classList.add("is-holding");
    startLv6HoldSound(note.index);
    setJudge("HOLD");
  }
}

function handleRelease(direction, pointerId, key) {
  const round = currentRound;
  const press = round?.activePresses.get(pointerId);

  key.classList.remove("is-success", "is-fail");
  if (!round || !press || press.direction !== direction) return;

  round.activePresses.delete(pointerId);
  const { note } = press;

  if (!press.success || note.type === "tap" || note.state === "judged" || note.state === "missed") {
    return;
  }

  stopLv6HoldSound();
  const elapsedMs = performance.now() - round.startedAt;
  const expectedReleaseMs = note.hitAtMs + note.holdMs;
  const releaseErrorMs = elapsedMs - expectedReleaseMs;
  const success = Math.abs(releaseErrorMs) <= CONFIG.holdReleaseToleranceMs;

  if (success) {
    playLv6TapSound(note.index + 2);
    judgeNote(note, true, round, "SUCCESS");
  } else {
    judgeNote(note, false, round, releaseErrorMs < 0 ? "TOO EARLY" : "TOO LATE");
  }
}

function findPressCandidate(round, direction, elapsedMs) {
  return round.notes
    .filter((note) => note.direction === direction && note.state === "pending")
    .sort((a, b) => Math.abs(a.hitAtMs - elapsedMs) - Math.abs(b.hitAtMs - elapsedMs))[0] ?? null;
}

function markStrayPress(round, pointerId, direction, key, note = null) {
  key.classList.add("is-fail");
  playLv6FailSound();
  setJudge("FAIL");
  round.failed = true;
  round.activePresses.set(pointerId, { note, key, direction, success: false });

  if (note && note.state === "pending") {
    judgeNote(note, false, round, "FAIL", false);
  }
}

function judgeNote(note, success, round, label, playSound = true) {
  if (note.state === "judged" || note.state === "missed") return;

  note.state = success ? "judged" : "missed";
  note.element?.classList.remove("is-holding");
  note.element?.classList.add(success ? "is-cleared" : "is-missed");
  round.judgedCount += 1;
  round.failed ||= !success;

  if (!success && playSound) {
    playLv6FailSound();
  }

  setProgress(round.judgedCount);
  setJudge(label);
}

async function finishRound(gameId, round) {
  if (round.finished) return;
  round.finished = true;
  stopLv6HoldSound();
  setStatus("모든 노드의 판정이 끝났습니다.");

  await delay(CONFIG.resultDelayMs);
  if (!isActive(gameId)) return;

  showResult(!round.failed);
}

function showResult(success) {
  const resultLayer = document.getElementById("lv6Result");
  const title = document.getElementById("lv6ResultTitle");
  const message = document.getElementById("lv6ResultMessage");
  const nextButton = document.getElementById("lv6NextButton");
  const retryButton = document.getElementById("lv6RetryButton");
  if (!resultLayer || !title || !message || !nextButton || !retryButton) return;

  title.textContent = success ? "PERFECT RHYTHM" : "TRY AGAIN";
  message.textContent = success
    ? "20개의 노드를 모두 정확하게 연주했습니다."
    : "끝까지 잘 따라왔습니다. 놓친 리듬을 다시 맞춰보세요.";
  nextButton.hidden = !success;
  retryButton.hidden = success;
  resultLayer.hidden = false;
}

function resetStage() {
  currentRound = null;
  document.getElementById("lv6Nodes")?.replaceChildren();
  document.querySelectorAll(".lv6-key").forEach((key) => {
    key.classList.remove("is-success", "is-fail");
  });
  document.getElementById("lv6Result")?.setAttribute("hidden", "");
  setProgress(0);
  setJudge("READY");
  setStatus("준비하세요.");
}

function setStatus(message) {
  const element = document.getElementById("lv6Status");
  if (element) element.textContent = message;
}

function setProgress(count) {
  const element = document.getElementById("lv6ProgressText");
  if (element) element.textContent = `${count} / ${CONFIG.noteCount}`;
}

function setJudge(message) {
  const element = document.getElementById("lv6JudgeText");
  if (element) element.textContent = message;
}

function getKey(direction) {
  return document.getElementById(direction === "up" ? "lv6TopButton" : "lv6BottomButton");
}

function isActive(gameId) {
  return gameId === activeGameId && document.getElementById("lv6Page");
}

function createDifficultyTiming(difficulty) {
  const normalized = (clampDifficulty(difficulty) - 1) / 9;

  return {
    leadTimeMs: interpolateRounded(
      DIFFICULTY_RANGE.leadTimeMs.easy,
      DIFFICULTY_RANGE.leadTimeMs.hard,
      normalized,
    ),
    firstHitDelayMs: interpolateRounded(
      DIFFICULTY_RANGE.firstHitDelayMs.easy,
      DIFFICULTY_RANGE.firstHitDelayMs.hard,
      normalized,
    ),
    minGapAfterNoteMs: interpolateRounded(
      DIFFICULTY_RANGE.minGapAfterNoteMs.easy,
      DIFFICULTY_RANGE.minGapAfterNoteMs.hard,
      normalized,
    ),
    maxGapAfterNoteMs: interpolateRounded(
      DIFFICULTY_RANGE.maxGapAfterNoteMs.easy,
      DIFFICULTY_RANGE.maxGapAfterNoteMs.hard,
      normalized,
    ),
  };
}

function clampDifficulty(value) {
  const difficulty = Number(value);
  if (!Number.isFinite(difficulty)) return 1;
  return Math.min(10, Math.max(1, Math.round(difficulty)));
}

function interpolateRounded(easyValue, hardValue, normalizedDifficulty) {
  return Math.round(easyValue + (hardValue - easyValue) * normalizedDifficulty);
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomSteppedValue(min, max, step) {
  const steps = Math.floor((max - min) / step);
  return min + randomInteger(0, steps) * step;
}

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
