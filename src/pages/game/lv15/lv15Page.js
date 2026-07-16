import lv15Style from "../../../assets/scss/game/lv15/common.scss?inline";
import lv15Template from "./lv15.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv15FailSound,
  playLv15KeySound,
  playLv15SuccessSound,
  playStartSound,
  readySound,
  stopLv15Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/sound.js";

const WHITE_KEY_WIDTH = 70;
const WHITE_KEY_HEIGHT = 285;
const BLACK_KEY_WIDTH = 43;
const BLACK_KEY_HEIGHT = 182;
const CENTER_WHITE_START = 0; // C4
const CENTER_WHITE_END = 7;   // C5
const WHITE_NOTE_NAMES = Object.freeze(["C", "D", "E", "F", "G", "A", "B"]);
const WHITE_SOLFEGE = Object.freeze(["도", "레", "미", "파", "솔", "라", "시"]);
const SHARP_AFTER = new Set(["C", "D", "F", "G", "A"]);

const STEP_LENGTHS = Object.freeze([2, 3, 4, 5, 6]);
const FIRST_INPUT_DELAY = 720;
const TIMING_TOLERANCE = 270;
const MISS_GRACE = 430;

let gameId = 0;
let running = false;
let acceptingInput = false;
let timers = new Set();
let viewportController = null;
let inputController = null;
let sequence = [];
let expectedIndex = 0;
let playerStartedAt = 0;
let successes = 0;
let failures = 0;
let currentStep = 0;
let renderedKeys = [];
let activeKeys = [];
let keyDefinitions = new Map();
let feedbackTimer = 0;
let lifecycleController = null;
let resizeFrame = 0;
let routeWatchTimer = 0;
let mountedPathname = "";

export function renderPage() {
  destroyPage();
  renderView(lv15Template, lv15Style);
  mountedPathname = window.location.pathname;
  bindRouteLifecycle();
  bindViewportHeight();
  configureKeyboard();
  bindPage();
}

function bindRouteLifecycle() {
  lifecycleController?.abort();
  lifecycleController = new AbortController();
  const { signal } = lifecycleController;

  const leavePage = () => destroyPage();
  window.addEventListener("popstate", leavePage, { signal });
  window.addEventListener("pagehide", leavePage, { signal });
  window.addEventListener("beforeunload", leavePage, { signal });

  window.clearInterval(routeWatchTimer);
  routeWatchTimer = window.setInterval(() => {
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv15Page")) {
      destroyPage();
    }
  }, 80);
}

function bindViewportHeight() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv15Page");
    if (!page) return;
    const height = window.visualViewport?.height ?? window.innerHeight;
    page.style.setProperty("--lv15-viewport-height", `${Math.round(height)}px`);

    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      if (!document.getElementById("lv15Page")) return;
      configureKeyboard();
    });
  };
  sync();
  window.addEventListener("resize", sync, { passive: true, signal });
  window.addEventListener("orientationchange", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true, signal });
}

function configureKeyboard() {
  const keyboard = document.getElementById("lv15Keyboard");
  if (!keyboard) return;

  const viewportWidth = Math.max(1, Math.round(keyboard.getBoundingClientRect().width || window.innerWidth));
  const extraWhiteKeys = 3;
  const minIndex = Math.floor((-viewportWidth / 2) / WHITE_KEY_WIDTH + 3.5) - extraWhiteKeys;
  const maxIndex = Math.ceil((viewportWidth / 2) / WHITE_KEY_WIDTH + 3.5) + extraWhiteKeys;

  renderedKeys = [];
  keyDefinitions = new Map();

  for (let index = minIndex; index <= maxIndex; index += 1) {
    const whiteKey = createWhiteKey(index);
    renderedKeys.push(whiteKey);
    keyDefinitions.set(whiteKey.id, whiteKey);

    if (SHARP_AFTER.has(whiteKey.label)) {
      const blackKey = createBlackKey(index, whiteKey);
      renderedKeys.push(blackKey);
      keyDefinitions.set(blackKey.id, blackKey);
    }
  }

  renderKeyboard(viewportWidth);
  selectPlayableKeys(viewportWidth);
}

function createWhiteKey(index) {
  const cycle = positiveModulo(index, 7);
  const octave = 4 + Math.floor(index / 7);
  const label = WHITE_NOTE_NAMES[cycle];
  return {
    id: `w:${index}`,
    type: "white",
    whiteIndex: index,
    label,
    solfege: WHITE_SOLFEGE[cycle],
    note: `${label}${octave}`,
  };
}

function createBlackKey(index, whiteKey) {
  return {
    id: `b:${index}`,
    type: "black",
    whiteIndex: index,
    label: `${whiteKey.label}#`,
    solfege: `${whiteKey.solfege}#`,
    note: `${whiteKey.label}#${whiteKey.note.slice(-1)}`,
  };
}

function renderKeyboard(viewportWidth) {
  const keyboard = document.getElementById("lv15Keyboard");
  if (!keyboard) return;

  keyboard.style.setProperty("--keyboard-width", `${viewportWidth}px`);
  keyboard.innerHTML = `<div class="lv15-keyboard-track">
    ${renderedKeys.filter((key) => key.type === "white").map((key) => {
      const left = (key.whiteIndex - 3.5) * WHITE_KEY_WIDTH;
      return `<button class="lv15-key lv15-white-key" type="button" data-key-id="${key.id}"
        style="--key-left:${left}px" aria-label="${key.solfege} ${key.label} ${key.note} 건반"><i></i></button>`;
    }).join("")}
    ${renderedKeys.filter((key) => key.type === "black").map((key) => {
      const left = (key.whiteIndex - 3.5 + 1) * WHITE_KEY_WIDTH;
      return `<button class="lv15-key lv15-black-key" type="button" data-key-id="${key.id}"
        style="--key-left:${left}px" aria-label="${key.solfege} ${key.note} 검은 건반"><i></i></button>`;
    }).join("")}
  </div>`;
}

function selectPlayableKeys(viewportWidth) {
  const centralWhiteWidth = (CENTER_WHITE_END - CENTER_WHITE_START + 1) * WHITE_KEY_WIDTH;
  const centralIds = new Set();

  for (let index = CENTER_WHITE_START; index <= CENTER_WHITE_END; index += 1) {
    centralIds.add(`w:${index}`);
    const whiteKey = keyDefinitions.get(`w:${index}`);
    if (whiteKey && SHARP_AFTER.has(whiteKey.label) && index < CENTER_WHITE_END) {
      centralIds.add(`b:${index}`);
    }
  }

  if (viewportWidth >= centralWhiteWidth) {
    activeKeys = renderedKeys.filter((key) => centralIds.has(key.id));
    return;
  }

  const keyboard = document.getElementById("lv15Keyboard");
  const keyboardRect = keyboard?.getBoundingClientRect();
  if (!keyboardRect) {
    activeKeys = renderedKeys.filter((key) => key.type === "white");
    return;
  }

  activeKeys = renderedKeys.filter((key) => {
    const element = keyElement(key.id);
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.left >= keyboardRect.left - 0.5 && rect.right <= keyboardRect.right + 0.5;
  });

  if (!activeKeys.length) {
    activeKeys = renderedKeys.filter((key) => key.type === "white").slice(0, 1);
  }
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function bindPage() {
  inputController?.abort();
  inputController = new AbortController();
  const { signal } = inputController;
  const keyboard = document.getElementById("lv15Keyboard");
  const start = document.getElementById("lv15StartButton");
  const retry = document.getElementById("lv15RetryButton");
  const next = document.getElementById("lv15NextButton");
  const home = document.getElementById("lv15HomeButton");
  if (!keyboard || !start || !retry || !next || !home) return;

  unlockSoundOnNextGesture();
  start.addEventListener("click", startGame, { signal });
  retry.addEventListener("click", startGame, { signal });
  next.addEventListener("click", () => {
    cancelGame();
    navigate("lv16", { replace: true });
  }, { signal });
  home.addEventListener("click", () => {
    cancelGame();
    navigate("home", { replace: true });
  }, { signal });
  keyboard.addEventListener("pointerdown", handleKeyInput, { signal });
}

async function startGame() {
  cancelGame();
  configureKeyboard();
  const id = ++gameId;
  running = true;
  currentStep = 0;
  successes = 0;
  failures = 0;

  resetKeys();
  clearFloatingNotes();
  document.getElementById("lv15Ready")?.setAttribute("hidden", "");
  document.getElementById("lv15Result")?.setAttribute("hidden", "");
  document.getElementById("lv15Page")?.classList.remove("is-player-turn", "is-success-finale", "is-fail-finale");
  setText("lv15PhaseText", "GET READY");
  setText("lv15TurnLabel", "LISTEN");
  setText("lv15PromptText", "5단계 연주를 준비하세요");
  setText("lv15StatusText", "STEP이 올라갈수록 기억해야 할 음이 하나씩 늘어납니다.");
  updateProgress(0);

  await readySound();
  if (!isActive(id)) return;
  playStartSound();
  schedule(() => beginStep(id), 650);
}

function beginStep(id) {
  if (!isActive(id)) return;
  configureKeyboard();
  acceptingInput = false;
  expectedIndex = 0;
  sequence = createSequence(STEP_LENGTHS[currentStep]);
  resetKeys();
  setText("lv15PhaseText", `STEP ${currentStep + 1}`);
  setText("lv15TurnLabel", "LISTEN");
  setText("lv15PromptText", `${sequence.length}개의 음을 기억하세요`);
  setText("lv15StatusText", `STEP ${currentStep + 1} / ${STEP_LENGTHS.length} · 건반의 순서와 리듬을 기억해 주세요.`);
  updateProgress(0);
  schedule(() => playMemorySequence(id), 520);
}

function createSequence(length) {
  const result = [];
  let offset = 0;
  let previousId = "";
  for (let index = 0; index < length; index += 1) {
    let key = activeKeys[randomInt(0, activeKeys.length - 1)];
    if (key.id === previousId && activeKeys.length > 1) {
      key = activeKeys[(activeKeys.indexOf(key) + randomInt(1, activeKeys.length - 1)) % activeKeys.length];
    }
    const gap = index === 0 ? 0 : randomGap(currentStep);
    offset += gap;
    result.push({ index, keyId: key.id, offset, gap });
    previousId = key.id;
  }
  return result;
}

function randomGap(step) {
  const rhythmicGaps = [440, 520, 620, 760, 900, 1060];
  return Math.max(400, rhythmicGaps[randomInt(0, rhythmicGaps.length - 1)] - step * 28);
}

function playMemorySequence(id) {
  if (!isActive(id)) return;
  sequence.forEach((item) => schedule(() => demonstrateKey(id, item), item.offset));
  schedule(() => beginPlayerCountdown(id), sequence.at(-1).offset + 760);
}

function demonstrateKey(id, item) {
  if (!isActive(id)) return;
  const definition = getKey(item.keyId);
  animateKey(keyElement(item.keyId), "is-demo", 320);
  pulseTimingRail();
  launchNoteParticle(definition, true, item.index);
  playLv15KeySound(definition.note, item.index, true);
  setText("lv15ScoreText", `${item.index + 1} / ${sequence.length}`);
  updateProgress((item.index + 1) / sequence.length);
}

function beginPlayerCountdown(id) {
  if (!isActive(id)) return;
  setText("lv15PhaseText", `STEP ${currentStep + 1}`);
  setText("lv15StatusText", "잠시 후 같은 순서와 리듬으로 연주하세요.");
  setText("lv15PromptText", "연주를 준비하세요");

  const countdown = document.getElementById("lv15Countdown");
  const countdownNumber = countdown?.querySelector("strong");
  let count = 3;

  if (countdown) countdown.hidden = false;

  const tick = () => {
    if (!isActive(id)) return;
    if (count === 0) {
      if (countdown) countdown.hidden = true;
      return beginPlayerTurn(id);
    }

    if (countdownNumber) {
      countdownNumber.textContent = String(count);
      countdownNumber.classList.remove("is-pulsing");
      void countdownNumber.offsetWidth;
      countdownNumber.classList.add("is-pulsing");
    }

    count -= 1;
    schedule(tick, 560);
  };

  tick();
}

function beginPlayerTurn(id) {
  if (!isActive(id)) return;
  acceptingInput = true;
  expectedIndex = 0;
  playerStartedAt = performance.now();
  document.getElementById("lv15Page")?.classList.add("is-player-turn");
  const countdown = document.getElementById("lv15Countdown");
  if (countdown) countdown.hidden = true;
  setText("lv15TurnLabel", "PLAY");
  setText("lv15PromptText", `${sequence.length}개의 음을 연주하세요`);
  setText("lv15StatusText", `STEP ${currentStep + 1} / ${STEP_LENGTHS.length} · 순서와 시간 간격을 모두 맞춰 주세요.`);
  updateProgress(0);
  scheduleMissCheck(id, 0);
}

function handleKeyInput(event) {
  const key = event.target.closest(".lv15-key");
  if (!key || !acceptingInput || !running) return;
  event.preventDefault();
  evaluateInput(key.dataset.keyId, performance.now());
}

function evaluateInput(keyId, inputTime) {
  if (!acceptingInput || expectedIndex >= sequence.length) return;
  const item = sequence[expectedIndex];
  const expectedTime = playerStartedAt + FIRST_INPUT_DELAY + item.offset;
  const timingError = inputTime - expectedTime;
  const correctKey = keyId === item.keyId;
  const correctTiming = Math.abs(timingError) <= TIMING_TOLERANCE;
  const success = correctKey && correctTiming;
  const pressedDefinition = getKey(keyId);

  animateKey(keyElement(keyId), success ? "is-success" : "is-fail", 520);
  pulseTimingRail(success ? "is-good" : "is-bad");
  launchNoteParticle(pressedDefinition, success, expectedIndex);

  if (success) {
    successes += 1;
    playLv15SuccessSound(pressedDefinition.note, expectedIndex);
    showFeedback(true, timingLabel(timingError), `${pressedDefinition.label} · BEAUTIFUL`);
  } else {
    failures += 1;
    playLv15FailSound(pressedDefinition.note, expectedIndex);
    const expected = getKey(item.keyId);
    showFeedback(false, failureLabel(correctKey, timingError), correctKey ? "리듬이 조금 어긋났습니다" : `기억한 건반은 ${expected.label}입니다`);
  }

  expectedIndex += 1;
  updatePlayerProgress();
  if (expectedIndex >= sequence.length) finishStep(gameId);
  else scheduleMissCheck(gameId, expectedIndex);
}

function scheduleMissCheck(id, index) {
  const item = sequence[index];
  if (!item) return;
  const dueAt = playerStartedAt + FIRST_INPUT_DELAY + item.offset + MISS_GRACE;
  schedule(() => {
    if (!isActive(id) || !acceptingInput || expectedIndex !== index) return;
    registerMissedInput(id, item);
  }, Math.max(0, dueAt - performance.now()));
}

function registerMissedInput(id, item) {
  if (!isActive(id) || !acceptingInput) return;
  const definition = getKey(item.keyId);
  failures += 1;
  animateKey(keyElement(item.keyId), "is-fail", 520);
  pulseTimingRail("is-bad");
  launchNoteParticle(definition, false, expectedIndex);
  playLv15FailSound(definition.note, expectedIndex);
  showFeedback(false, "MISS", `${definition.label} 건반의 타이밍을 놓쳤습니다`);
  expectedIndex += 1;
  updatePlayerProgress();
  if (expectedIndex >= sequence.length) finishStep(id);
  else scheduleMissCheck(id, expectedIndex);
}

function finishStep(id) {
  acceptingInput = false;
  document.getElementById("lv15Page")?.classList.remove("is-player-turn");
  if (currentStep >= STEP_LENGTHS.length - 1) {
    schedule(() => finishGame(id), 760);
    return;
  }
  currentStep += 1;
  setText("lv15TurnLabel", "STEP CLEAR");
  setText("lv15PromptText", `다음은 ${STEP_LENGTHS[currentStep]}개의 음입니다`);
  setText("lv15StatusText", `STEP ${currentStep} 완료 · 난이도가 한 단계 올라갑니다.`);
  schedule(() => beginStep(id), 1250);
}

function updatePlayerProgress() {
  setText("lv15ScoreText", `${expectedIndex} / ${sequence.length}`);
  updateProgress(expectedIndex / sequence.length);
}

function finishGame(id) {
  if (!isActive(id)) return;
  running = false;
  acceptingInput = false;
  const totalNotes = STEP_LENGTHS.reduce((sum, length) => sum + length, 0);
  const perfect = failures === 0 && successes === totalNotes;
  const page = document.getElementById("lv15Page");
  page?.classList.add(perfect ? "is-success-finale" : "is-fail-finale");

  setText("lv15ResultKicker", perfect ? "PERFECT SONATA" : "SONATA COMPLETE");
  setText("lv15ResultTitle", perfect ? "5단계 연주가 완벽합니다" : "한 번 더 아름답게 연주해 볼까요?");
  setText("lv15ResultDescription", perfect
    ? `${totalNotes}개의 음을 5 STEP 동안 순서와 타이밍까지 모두 정확하게 연주했습니다.`
    : `${successes} / ${totalNotes} 성공 · 한 번이라도 실수하면 RETRY입니다.`);

  const next = document.getElementById("lv15NextButton");
  const retry = document.getElementById("lv15RetryButton");
  if (next) next.hidden = !perfect;
  if (retry) retry.hidden = perfect;
  schedule(() => document.getElementById("lv15Result")?.removeAttribute("hidden"), 420);
}

function getKey(id) {
  return keyDefinitions.get(id);
}

function animateKey(key, className, duration) {
  if (!key) return;
  key.classList.remove("is-demo", "is-success", "is-fail");
  void key.offsetWidth;
  key.classList.add(className, "is-pressed");
  schedule(() => key.classList.remove(className, "is-pressed"), duration);
}

function launchNoteParticle(definition, success, order) {
  const target = order % 2 === 0 ? document.getElementById("lv15TopNotes") : document.getElementById("lv15BottomNotes");
  if (!target) return;
  const particle = document.createElement("i");
  particle.className = success ? "is-good" : "is-bad";
  particle.textContent = order % 3 === 0 ? "♪" : order % 3 === 1 ? "♩" : "♫";
  const keyIndex = activeKeys.findIndex((key) => key.note === definition.note);
  particle.style.setProperty("--note-x", `${8 + (Math.max(0, keyIndex) / Math.max(1, activeKeys.length - 1)) * 84}%`);
  particle.style.setProperty("--note-delay", `${(order % 4) * 35}ms`);
  target.appendChild(particle);
  schedule(() => particle.remove(), 1600);
}

function showFeedback(success, title, detail) {
  const feedback = document.getElementById("lv15Feedback");
  if (!feedback) return;
  window.clearTimeout(feedbackTimer);
  feedback.classList.remove("is-good", "is-bad", "is-showing");
  void feedback.offsetWidth;
  feedback.querySelector("strong").textContent = title;
  feedback.querySelector("small").textContent = detail;
  feedback.classList.add(success ? "is-good" : "is-bad", "is-showing");
  feedbackTimer = window.setTimeout(() => feedback.classList.remove("is-showing"), 680);
}

function timingLabel(error) {
  if (Math.abs(error) <= 90) return "PERFECT";
  return error < 0 ? "GREAT · EARLY" : "GREAT · LATE";
}

function failureLabel(correctKey, error) {
  if (!correctKey) return "WRONG NOTE";
  return error < 0 ? "TOO EARLY" : "TOO LATE";
}

function pulseTimingRail(state = "") {
  const pulse = document.getElementById("lv15TimingPulse");
  if (!pulse) return;
  pulse.classList.remove("is-pulsing", "is-good", "is-bad");
  void pulse.offsetWidth;
  if (state) pulse.classList.add(state);
  pulse.classList.add("is-pulsing");
  schedule(() => pulse.classList.remove("is-pulsing", "is-good", "is-bad"), 480);
}

function updateProgress(ratio) {
  const bar = document.getElementById("lv15ProgressBar");
  if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
}

function resetKeys() {
  document.querySelectorAll(".lv15-key").forEach((key) => key.classList.remove("is-demo", "is-success", "is-fail", "is-pressed"));
}

function clearFloatingNotes() {
  document.getElementById("lv15TopNotes")?.replaceChildren();
  document.getElementById("lv15BottomNotes")?.replaceChildren();
}

function cancelGame() {
  running = false;
  acceptingInput = false;
  gameId += 1;
  timers.forEach((timer) => window.clearTimeout(timer));
  timers.clear();
  window.clearTimeout(feedbackTimer);
  stopLv15Sounds();
}

function destroyPage() {
  cancelGame();
  viewportController?.abort();
  viewportController = null;
  inputController?.abort();
  inputController = null;
  lifecycleController?.abort();
  lifecycleController = null;
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = 0;
  window.clearInterval(routeWatchTimer);
  routeWatchTimer = 0;
  mountedPathname = "";
}

function schedule(callback, delay) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
  return timer;
}

function keyElement(id) {
  return document.querySelector(`.lv15-key[data-key-id="${id}"]`);
}

function isActive(id) {
  return running && id === gameId;
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = text;

  if (id === "lv15TurnLabel" || id === "lv15PromptText") {
    element.style.animation = "none";
    void element.offsetWidth;
    element.style.animation = "";
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
