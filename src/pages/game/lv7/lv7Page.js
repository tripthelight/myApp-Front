import lv7Style from "../../../assets/scss/game/lv7/common.scss?inline";
import lv7Template from "./lv7.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv7FailSound,
  playLv7SuccessSound,
  playLv7TickSound,
  playStartSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv7Sound.js";

const CONFIG = Object.freeze({
  observeCount: 5,
  answerCount: 5,
  beatMs: 1000,
  firstObserveDelayMs: 650,
  blackoutMs: 1500,
  readyCountdown: 5,
  countdownExitMs: 820,
  resultDelayMs: 650,
  optionCount: 10,
});

const RULES = Object.freeze([
  { id: "hour-minute", increments: [61, 61, 61, 61, 61, 61, 61, 61, 61, 61] },
  { id: "prime", increments: [1, 3, 5, 7, 11, 13, 17, 19, 23, 29] },
  { id: "one-minute", increments: Array(10).fill(1) },
  { id: "alternating", increments: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0] },
  { id: "two-minute", increments: Array(10).fill(2) },
]);

let activeGameId = 0;
let activeTimers = new Set();
let currentRound = null;

export function renderPage() {
  cancelActiveGame();
  renderView(lv7Template, lv7Style);
  bindPage();
}

function bindPage() {
  const readyLayer = document.getElementById("lv7Ready");
  const resultLayer = document.getElementById("lv7Result");
  const startButton = document.getElementById("lv7StartButton");
  const retryButton = document.getElementById("lv7RetryButton");
  const nextButton = document.getElementById("lv7NextButton");
  const homeButton = document.getElementById("lv7HomeButton");

  if (!readyLayer || !resultLayer || !startButton || !retryButton || !nextButton || !homeButton) return;

  unlockSoundOnNextGesture();

  startButton.addEventListener("click", async () => {
    const gameId = beginGame();
    await readySound();
    if (!isActive(gameId)) return;
    playStartSound();
    readyLayer.hidden = true;
    await runGame(gameId);
  });

  retryButton.addEventListener("click", async () => {
    const gameId = beginGame();
    await readySound();
    if (!isActive(gameId)) return;
    resultLayer.hidden = true;
    playStartSound();
    await runGame(gameId);
  });

  nextButton.addEventListener("click", () => {
    cancelActiveGame();
    navigate("lv8", { replace: true });
  });

  homeButton.addEventListener("click", () => {
    cancelActiveGame();
    navigate("home", { replace: true });
  });
}

function beginGame() {
  cancelActiveGame();
  activeGameId += 1;
  resetView();
  return activeGameId;
}

function cancelActiveGame() {
  activeGameId += 1;
  activeTimers.forEach((timerId) => clearTimeout(timerId));
  activeTimers.clear();
  currentRound = null;
}

async function runGame(gameId) {
  const round = createRound();
  currentRound = round;
  setStatus("변하는 시간을 보고 규칙을 기억하세요.");
  setPhase("OBSERVE", `0 / ${CONFIG.observeCount}`);
  setClock(round.startMinute);

  await wait(CONFIG.firstObserveDelayMs, gameId);
  if (!isActive(gameId)) return;

  for (let index = 0; index < CONFIG.observeCount; index += 1) {
    round.currentMinute = addMinutes(round.currentMinute, round.rule.increments[index]);
    round.observed.push(round.currentMinute);
    setClock(round.currentMinute, true);
    activateBeat(index);
    playLv7TickSound(index);
    setPhase("OBSERVE", `${index + 1} / ${CONFIG.observeCount}`);
    await wait(CONFIG.beatMs, gameId);
    if (!isActive(gameId)) return;
  }

  await playBlackout(gameId);
  if (!isActive(gameId)) return;

  prepareAnswerPhase(round);
  await playReadyCountdown(gameId);
  if (!isActive(gameId)) return;

  await playAnswerPhase(gameId, round);
}

function createRound() {
  const startMinute = randomInteger(0, (12 * 60) - 1);
  const rule = RULES[randomInteger(0, RULES.length - 1)];
  let cursor = startMinute;
  const answers = [];

  for (let index = 0; index < CONFIG.observeCount + CONFIG.answerCount; index += 1) {
    cursor = addMinutes(cursor, rule.increments[index]);
    if (index >= CONFIG.observeCount) answers.push(cursor);
  }

  return {
    startMinute,
    currentMinute: startMinute,
    rule,
    observed: [],
    answers,
    options: [],
    answerIndex: 0,
    failed: false,
    touchedThisBeat: false,
    touchWasCorrect: false,
    finished: false,
  };
}

async function playBlackout(gameId) {
  const page = document.getElementById("lv7Page");
  const blackout = document.getElementById("lv7Blackout");
  page?.classList.add("is-blackout");
  blackout?.classList.add("is-active");
  setStatus("흐름을 기억하세요.");
  setPhase("MEMORY", "• • •");

  playLv7TickSound(5);
  await wait(CONFIG.beatMs, gameId);
  if (!isActive(gameId)) return;
  playLv7TickSound(6);
  await wait(CONFIG.blackoutMs - CONFIG.beatMs, gameId);

  page?.classList.remove("is-blackout");
  blackout?.classList.remove("is-active");
}

function prepareAnswerPhase(round) {
  const watchPhase = document.getElementById("lv7WatchPhase");
  const answerPhase = document.getElementById("lv7AnswerPhase");
  watchPhase.hidden = true;
  answerPhase.hidden = false;
  round.options = createOptions(round.answers);
  renderOptions(round);
  setStatus("떠 있는 시간을 확인하세요.");
  setPhase("READY", `${CONFIG.readyCountdown}`);
}

async function playReadyCountdown(gameId) {
  const countdown = document.getElementById("lv7Countdown");
  const number = document.getElementById("lv7CountdownNumber");
  if (!countdown || !number) return;

  countdown.hidden = false;
  countdown.classList.add("is-active");

  for (let value = CONFIG.readyCountdown; value >= 1; value -= 1) {
    number.textContent = String(value);
    countdown.classList.remove("is-ticking");
    void countdown.offsetWidth;
    countdown.classList.add("is-ticking");
    setPhase("READY", String(value));
    playLv7TickSound(CONFIG.readyCountdown - value + 7);
    await wait(CONFIG.beatMs, gameId);
    if (!isActive(gameId)) return;
  }

  const field = document.getElementById("lv7TimeField");
  countdown.classList.remove("is-ticking");
  countdown.classList.add("is-leaving");
  field?.classList.add("is-settled");
  setStatus("시간들이 자리를 잡고 있습니다.");
  setPhase("READY", "GO");

  await wait(CONFIG.countdownExitMs, gameId);
  if (!isActive(gameId)) return;

  countdown.classList.remove("is-active", "is-leaving");
  countdown.hidden = true;
  setStatus("이어질 시간을 박자마다 하나씩 터치하세요.");
  setPhase("TOUCH", `0 / ${CONFIG.answerCount}`);
}

async function playAnswerPhase(gameId, round) {
  for (let index = 0; index < CONFIG.answerCount; index += 1) {
    round.answerIndex = index;
    round.touchedThisBeat = false;
    round.touchWasCorrect = false;
    pulseAnswerBeat(index);
    enableTouch(round);

    await wait(CONFIG.beatMs, gameId);
    if (!isActive(gameId)) return;

    disableTouch();
    if (!round.touchedThisBeat) {
      round.failed = true;
      playLv7TickSound(index + 7);
      markExpectedMiss(round.answers[index]);
    }

    setPhase("TOUCH", `${index + 1} / ${CONFIG.answerCount}`);
  }

  round.finished = true;
  await wait(CONFIG.resultDelayMs, gameId);
  if (isActive(gameId)) showResult(round);
}

function renderOptions(round) {
  const field = document.getElementById("lv7TimeField");
  if (!field) return;

  const fragment = document.createDocumentFragment();
  const slotOrder = shuffle(Array.from({ length: round.options.length }, (_, index) => index));
  round.options.forEach((minute, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lv7-time-option lv7-slot-${slotOrder[index]}`;
    button.dataset.minute = String(minute);
    button.style.setProperty("--drift-x", `${randomInteger(-7, 7)}px`);
    button.style.setProperty("--drift-y", `${randomInteger(-5, 5)}px`);
    button.style.setProperty("--delay", `${(index % 5) * -0.48}s`);
    button.textContent = formatTime(minute);
    button.disabled = true;
    button.addEventListener("pointerdown", (event) => handleOptionTouch(event, round, button));
    fragment.appendChild(button);
  });
  field.classList.remove("is-settled");
  field.replaceChildren(fragment);
}

function handleOptionTouch(event, round, button) {
  event.preventDefault();
  if (round.finished || round.touchedThisBeat || button.disabled) return;

  round.touchedThisBeat = true;
  const selectedMinute = Number(button.dataset.minute);
  const expectedMinute = round.answers[round.answerIndex];
  const isCorrect = selectedMinute === expectedMinute;
  round.touchWasCorrect = isCorrect;

  document.querySelectorAll(".lv7-time-option").forEach((option) => { option.disabled = true; });

  if (isCorrect) {
    button.classList.add("is-success");
    playLv7SuccessSound(round.answerIndex);
  } else {
    round.failed = true;
    button.classList.add("is-fail");
    playLv7FailSound(round.answerIndex);
  }

  schedule(() => button.classList.remove("is-success", "is-fail"), 520);
}

function enableTouch(round) {
  document.querySelectorAll(".lv7-time-option").forEach((button) => {
    button.disabled = false;
  });

  const expected = document.querySelector(`.lv7-time-option[data-minute="${round.answers[round.answerIndex]}"]`);
  if (expected) expected.classList.add("is-current-target");
}

function disableTouch() {
  document.querySelectorAll(".lv7-time-option").forEach((button) => {
    button.disabled = true;
    button.classList.remove("is-current-target");
  });

}

function markExpectedMiss(minute) {
  const option = document.querySelector(`.lv7-time-option[data-minute="${minute}"]`);
  option?.classList.add("is-missed");
  schedule(() => option?.classList.remove("is-missed"), 480);
}

function createOptions(answers) {
  const used = new Set(answers);
  while (used.size < CONFIG.optionCount) {
    const anchor = answers[randomInteger(0, answers.length - 1)];
    const offset = randomInteger(-95, 95);
    used.add(addMinutes(anchor, offset === 0 ? 31 : offset));
  }
  return shuffle([...used]);
}

function setClock(minute, animate = false) {
  const clock = document.getElementById("lv7MainClock");
  if (!clock) return;
  clock.textContent = formatTime(minute);
  if (!animate) return;
  clock.classList.remove("is-changing");
  void clock.offsetWidth;
  clock.classList.add("is-changing");
}

function activateBeat(index) {
  const beats = [...document.querySelectorAll("#lv7BeatRail span")];
  beats[index]?.classList.add("is-active");
}

function pulseAnswerBeat(index) {
  const pulse = document.getElementById("lv7BeatPulse");
  if (!pulse) return;
  pulse.classList.remove("is-pulse");
  pulse.dataset.step = String(index + 1);
  void pulse.offsetWidth;
  pulse.classList.add("is-pulse");
}

function showResult(round) {
  const resultLayer = document.getElementById("lv7Result");
  const title = document.getElementById("lv7ResultTitle");
  const message = document.getElementById("lv7ResultMessage");
  const nextButton = document.getElementById("lv7NextButton");
  const retryButton = document.getElementById("lv7RetryButton");
  if (!resultLayer || !title || !message || !nextButton || !retryButton) return;

  const success = !round.failed;
  title.textContent = success ? "SEQUENCE COMPLETE" : "SEQUENCE LOST";
  message.textContent = success
    ? "시간의 규칙과 박자를 모두 정확히 이어냈습니다."
    : "끝까지 잘 따라왔습니다. 흐름을 다시 보고 한 번 더 도전해보세요.";
  nextButton.hidden = !success;
  retryButton.hidden = success;
  resultLayer.hidden = false;
  document.getElementById("lv7Page")?.classList.toggle("is-success-result", success);
}

function resetView() {
  document.getElementById("lv7WatchPhase")?.removeAttribute("hidden");
  const answerPhase = document.getElementById("lv7AnswerPhase");
  if (answerPhase) answerPhase.hidden = true;
  document.getElementById("lv7TimeField")?.replaceChildren();
  const countdown = document.getElementById("lv7Countdown");
  if (countdown) {
    countdown.hidden = true;
    countdown.classList.remove("is-active", "is-ticking", "is-leaving");
  }
  document.getElementById("lv7TimeField")?.classList.remove("is-settled");
  document.getElementById("lv7Page")?.classList.remove("is-blackout", "is-success-result");
  document.getElementById("lv7Blackout")?.classList.remove("is-active");
  document.querySelectorAll("#lv7BeatRail span").forEach((beat) => beat.classList.remove("is-active"));
  setPhase("READY", `0 / ${CONFIG.observeCount}`);
}

function setStatus(text) {
  const status = document.getElementById("lv7Status");
  if (status) status.textContent = text;
}

function setPhase(phase, progress) {
  const phaseText = document.getElementById("lv7PhaseText");
  const progressText = document.getElementById("lv7ProgressText");
  if (phaseText) phaseText.textContent = phase;
  if (progressText) progressText.textContent = progress;
}

function formatTime(totalMinutes) {
  const normalized = ((totalMinutes % 720) + 720) % 720;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")} : ${String(minute).padStart(2, "0")}`;
}

function addMinutes(base, amount) {
  return ((base + amount) % 720 + 720) % 720;
}

function wait(ms, gameId) {
  return new Promise((resolve) => {
    const timerId = setTimeout(() => {
      activeTimers.delete(timerId);
      resolve(isActive(gameId));
    }, ms);
    activeTimers.add(timerId);
  });
}

function schedule(callback, ms) {
  const timerId = setTimeout(() => {
    activeTimers.delete(timerId);
    callback();
  }, ms);
  activeTimers.add(timerId);
}

function isActive(gameId) {
  return gameId === activeGameId && document.getElementById("lv7Page");
}

function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
