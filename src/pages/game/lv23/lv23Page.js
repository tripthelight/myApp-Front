import lv23Style from "../../../assets/scss/game/lv23/common.scss?inline";
import lv23Template from "./lv23.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv23Fail,
  playLv23Finish,
  playLv23Count,
  playLv23Step,
  playLv23Success,
  playLv23Type,
  playStartSound,
  readySound,
  stopLv23Sounds,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv23Sound.js";

const REVEAL_STEP = 24;
const SCRAMBLE_TICKS = 4;
const COUNT_BEAT = 620;
const ROUND_GAP = 1150;
const DEFAULT_STEP = Object.freeze({ cue: "ding", watchGap: 980, playWindow: 920, resolveGap: 660 });
const SCRAMBLE_CHARS = "01<>[]{}=+-*/IFELSETRUEFALSELOOPPRINTSUMHAPPY";

const ROUNDS = Object.freeze([
  {
    name: "VARIABLES",
    file: "round_01.flow",
    lines: [
      [{ id: "one", text: "ONE = 1" }],
      [{ id: "two", text: "TWO = 2" }],
      [{ id: "sum", text: "SUM = ONE + TWO" }],
      [{ id: "print", text: "print(ONE + TWO = sum)" }],
    ],
    flow: ["one", "two", "sum", "print"],
    rhythm: [
      { cue: "ding", watchGap: 1080, playWindow: 980, resolveGap: 760 },
      { cue: "dingHigh", watchGap: 1080, playWindow: 980, resolveGap: 760 },
      { cue: "long", watchGap: 1480, playWindow: 1180, resolveGap: 900 },
      { cue: "print", watchGap: 1220, playWindow: 1080, resolveGap: 820 },
    ],
    insightPause: 2450,
    outputs: { print: "1 + 2 = 3" },
  },
  {
    name: "CONDITION",
    file: "round_02.flow",
    lines: [
      [{ id: "happy", text: "HAPPY = True" }],
      [{ id: "if", text: "if (HAPPY = True)" }],
      [{ id: "true", text: "  print(True)" }],
      [{ id: "else", text: "else" }],
      [{ id: "false", text: "  print(False)" }],
    ],
    flow: ["happy", "if", "true"],
    rhythm: [
      { cue: "ding", watchGap: 1120, playWindow: 1020, resolveGap: 780 },
      { cue: "long", watchGap: 1520, playWindow: 1220, resolveGap: 920 },
      { cue: "print", watchGap: 1260, playWindow: 1100, resolveGap: 840 },
    ],
    insightPause: 2500,
    outputs: { true: "True" },
  },
  {
    name: "LOOP",
    file: "round_03.flow",
    lines: [
      [
        { id: "loop", text: "loop" }, { text: " (" }, { id: "init", text: "HAPPY = 0" },
        { text: ", " }, { id: "condition", text: "HAPPY < 2" }, { text: ", " },
        { id: "increment", text: "HAPPY + 1" }, { text: ")" },
      ],
      [{ id: "if", text: "  if (HAPPY = 0)" }],
      [{ id: "first", text: "    print(Happiness Begins)" }],
      [{ id: "else", text: "  else" }],
      [{ id: "second", text: "    print(The First Happiness)" }],
    ],
    flow: ["loop", "init", "condition", "if", "first", "increment", "init", "condition", "if", "else", "second"],
    rhythm: [
      { cue: "tick", watchGap: 900, playWindow: 860, resolveGap: 620 },
      { cue: "ding", watchGap: 1240, playWindow: 1080, resolveGap: 820 },
      { cue: "dingHigh", watchGap: 1240, playWindow: 1080, resolveGap: 820 },
      { cue: "long", watchGap: 1320, playWindow: 1140, resolveGap: 820 },
      { cue: "print", watchGap: 1580, playWindow: 1200, resolveGap: 980 },
      { cue: "dingRise", watchGap: 1260, playWindow: 1080, resolveGap: 840 },
      { cue: "tickHigh", watchGap: 1160, playWindow: 1020, resolveGap: 760 },
      { cue: "dingHigh", watchGap: 1240, playWindow: 1080, resolveGap: 820 },
      { cue: "longLow", watchGap: 1300, playWindow: 1120, resolveGap: 800 },
      { cue: "longHigh", watchGap: 1220, playWindow: 1080, resolveGap: 760 },
      { cue: "printHigh", watchGap: 1320, playWindow: 1160, resolveGap: 900 },
    ],
    insightPause: 3200,
    outputs: { first: "Happiness Begins", second: "The First Happiness" },
  },
]);

let token = 0;
let running = false;
let acceptingInput = false;
let currentRound = 0;
let currentStep = 0;
let roundMistake = false;
let totalMistakes = 0;
let totalSuccesses = 0;
let stepResolved = false;
let stepStartedAt = 0;
let timers = new Set();
let lifecycleController = null;
let inputController = null;
let viewportController = null;
let mountedPathname = "";
let routeWatchTimer = 0;
let resizeFrame = 0;

export function renderPage() {
  destroyPage();
  renderView(lv23Template, lv23Style);
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
    if (window.location.pathname !== mountedPathname || !document.getElementById("lv23Page")) destroyPage();
  }, 100);
}

function bindViewport() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv23Page");
    if (!page) return;
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const height = Math.round(viewport?.height ?? window.innerHeight);
    page.style.setProperty("--lv23-vw", `${width}px`);
    page.style.setProperty("--lv23-vh", `${height}px`);
    page.classList.toggle("is-portrait", height > width);
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      page.style.setProperty("--lv23-scale", String(Math.min(1, Math.max(0.72, Math.min(width / 980, height / 720)))));
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
  document.getElementById("lv23StartButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv23RetryButton")?.addEventListener("click", startGame, { signal });
  document.getElementById("lv23NextButton")?.addEventListener("click", () => { cancelGame(); navigate("lv24", { replace: true }); }, { signal });
  document.getElementById("lv23HomeButton")?.addEventListener("click", () => { cancelGame(); navigate("home", { replace: true }); }, { signal });
  document.getElementById("lv23Code")?.addEventListener("pointerdown", handleCodePress, { signal });
  document.getElementById("lv23Code")?.addEventListener("contextmenu", (event) => event.preventDefault(), { signal });
}

function prepareReadyState() {
  currentRound = 0;
  totalMistakes = 0;
  totalSuccesses = 0;
  setText("lv23PhaseText", "READY");
  setText("lv23RoundText", "ROUND 1 / 3");
  setText("lv23Cue", "WATCH THE FLOW");
  setProgress(0);
  renderCode(ROUNDS[0], false);
  resetOutput();
  createStepDots(ROUNDS[0].flow.length);
}

async function startGame() {
  cancelGame();
  const gameToken = ++token;
  running = true;
  currentRound = 0;
  totalMistakes = 0;
  totalSuccesses = 0;
  hide("lv23Ready");
  hide("lv23Result");
  await readySound();
  if (!isActive(gameToken)) return;
  playStartSound();
  schedule(() => beginRound(gameToken, 0), 420);
}

async function beginRound(gameToken, roundIndex) {
  if (!isActive(gameToken)) return;
  currentRound = roundIndex;
  currentStep = 0;
  roundMistake = false;
  acceptingInput = false;
  stepResolved = false;
  const round = ROUNDS[roundIndex];
  setText("lv23RoundText", `ROUND ${roundIndex + 1} / 3`);
  setText("lv23PhaseText", "DECODING");
  setText("lv23Cue", "CODE IS FORMING");
  setText("lv23FileName", round.file);
  setProgress(roundIndex / ROUNDS.length);
  createStepDots(round.flow.length);
  renderCode(round, true);
  resetOutput();
  await revealCode(gameToken, round);
  if (!isActive(gameToken)) return;
  schedule(() => watchFlow(gameToken, 0), 500);
}

function renderCode(round, hiddenCharacters) {
  const code = document.getElementById("lv23Code");
  if (!code) return;
  code.innerHTML = "";
  round.lines.forEach((segments, lineIndex) => {
    const line = document.createElement("div");
    line.className = "lv23-code-line";
    line.dataset.line = String(lineIndex + 1);
    const number = document.createElement("span");
    number.className = "lv23-line-number";
    number.textContent = String(lineIndex + 1).padStart(2, "0");
    line.append(number);
    const content = document.createElement("span");
    content.className = "lv23-line-content";
    segments.forEach((segment) => {
      const element = document.createElement(segment.id ? "button" : "span");
      element.className = segment.id ? "lv23-code-hit" : "lv23-code-text";
      if (segment.id) {
        element.type = "button";
        element.dataset.codeId = segment.id;
        element.disabled = true;
      }
      [...segment.text].forEach((character) => {
        const char = document.createElement("span");
        char.className = "lv23-char";
        char.dataset.final = character;
        char.textContent = hiddenCharacters && character !== " " ? "·" : character;
        char.classList.toggle("is-space", character === " ");
        content.appendChild(element);
        element.appendChild(char);
      });
    });
    line.append(content);
    code.append(line);
  });
}

async function revealCode(gameToken, round) {
  const characters = [...document.querySelectorAll(".lv23-char:not(.is-space)")];
  for (let index = 0; index < characters.length; index += 1) {
    if (!isActive(gameToken)) return;
    const character = characters[index];
    for (let tick = 0; tick < SCRAMBLE_TICKS; tick += 1) {
      character.textContent = randomScramble();
      character.classList.add("is-scrambling");
      await delay(REVEAL_STEP);
      if (!isActive(gameToken)) return;
    }
    character.textContent = character.dataset.final;
    character.classList.remove("is-scrambling");
    character.classList.add("is-revealed");
    if (index % 2 === 0) playLv23Type();
  }
  document.getElementById("lv23Code")?.classList.add("is-complete");
  setText("lv23Cue", `${round.name} READY`);
}

function watchFlow(gameToken, stepIndex) {
  if (!isActive(gameToken)) return;
  const round = ROUNDS[currentRound];
  if (stepIndex >= round.flow.length) {
    clearCodeStates();
    schedule(() => runCountdown(gameToken), 520);
    return;
  }
  syncLoopValueForWatch(stepIndex);
  setText("lv23PhaseText", "WATCH");
  setText("lv23Cue", `FLOW ${stepIndex + 1} / ${round.flow.length}`);
  activateDot(stepIndex, "watch");
  const target = findCodeTarget(round.flow[stepIndex]);
  const rhythm = getStepRhythm(round, stepIndex);
  flashTarget(target, "is-watching", Math.min(760, rhythm.watchGap * 0.68));
  playLv23Step(rhythm.cue, "watch");
  schedule(() => watchFlow(gameToken, stepIndex + 1), rhythm.watchGap);
}

async function runCountdown(gameToken) {
  if (!isActive(gameToken)) return;
  setText("lv23PhaseText", "COUNT");
  setText("lv23Cue", "GET READY");
  const countdown = document.getElementById("lv23Countdown");
  if (countdown) countdown.hidden = false;

  for (const value of ["3", "2", "1", "GO"]) {
    if (!isActive(gameToken)) return;
    setText("lv23CountdownValue", value);
    countdown?.classList.remove("is-popping");
    void countdown?.offsetWidth;
    countdown?.classList.add("is-popping");
    pulseCodeForCountdown();
    playLv23Count(value);
    await delay(value === "GO" ? 430 : COUNT_BEAT);
  }

  if (!isActive(gameToken)) return;
  if (countdown) {
    countdown.hidden = true;
    countdown.classList.remove("is-popping");
  }
  beginPlay(gameToken);
}

function beginPlay(gameToken) {
  if (!isActive(gameToken)) return;
  setLoopInitValue(0);
  currentStep = 0;
  acceptingInput = true;
  document.querySelectorAll(".lv23-code-hit").forEach((element) => { element.disabled = false; });
  resetDots();
  setText("lv23PhaseText", "PLAY");
  setText("lv23Cue", "FOLLOW THE RHYTHM");
  schedule(() => openStep(gameToken), 480);
}

function openStep(gameToken) {
  if (!isActive(gameToken) || !acceptingInput) return;
  const round = ROUNDS[currentRound];
  if (currentStep >= round.flow.length) {
    finishRound(gameToken);
    return;
  }
  stepResolved = false;
  stepStartedAt = performance.now();
  const rhythm = getStepRhythm(round, currentStep);
  activateDot(currentStep, "play");
  document.getElementById("lv23Code")?.classList.add("is-beating");
  schedule(() => document.getElementById("lv23Code")?.classList.remove("is-beating"), 180);
  schedule(() => {
    if (!isActive(gameToken) || stepResolved) return;
    resolveStep(false, null, "MISS");
  }, rhythm.playWindow);
}

function handleCodePress(event) {
  const target = event.target.closest(".lv23-code-hit");
  if (!target || !running || !acceptingInput || stepResolved) return;
  event.preventDefault();
  const expected = ROUNDS[currentRound].flow[currentStep];
  const elapsed = performance.now() - stepStartedAt;
  const rhythm = getStepRhythm(ROUNDS[currentRound], currentStep);
  const timingValid = elapsed >= 0 && elapsed <= rhythm.playWindow;
  resolveStep(target.dataset.codeId === expected && timingValid, target, target.dataset.codeId === expected ? "TIMING" : "ORDER");
}

function resolveStep(success, pressedTarget, reason) {
  if (stepResolved || !acceptingInput) return;
  stepResolved = true;
  const expectedId = ROUNDS[currentRound].flow[currentStep];
  if (currentRound === 2 && expectedId === "increment") setLoopInitValue(1);
  const expectedTarget = findCodeTarget(expectedId);
  if (success) {
    totalSuccesses += 1;
    pressedTarget?.classList.add("is-success");
    activateDot(currentStep, "success");
    playLv23Step(getStepRhythm(ROUNDS[currentRound], currentStep).cue, "play");
    playLv23Success(currentStep);
    emitRoundOutput(expectedId);
    setText("lv23Cue", "PERFECT FLOW");
  } else {
    totalMistakes += 1;
    roundMistake = true;
    pressedTarget?.classList.add("is-fail");
    expectedTarget?.classList.add("is-answer");
    activateDot(currentStep, "fail");
    playLv23Fail();
    setText("lv23Cue", reason === "ORDER" ? "WRONG CODE" : "MISSED BEAT");
  }
  const rhythm = getStepRhythm(ROUNDS[currentRound], currentStep);
  schedule(() => {
    pressedTarget?.classList.remove("is-success", "is-fail");
    expectedTarget?.classList.remove("is-answer");
    currentStep += 1;
    openStep(token);
  }, rhythm.resolveGap);
}

function finishRound(gameToken) {
  if (!isActive(gameToken)) return;
  acceptingInput = false;
  document.querySelectorAll(".lv23-code-hit").forEach((element) => { element.disabled = true; });
  setProgress((currentRound + 1) / ROUNDS.length);
  setText("lv23PhaseText", "ROUND CLEAR");
  setText("lv23Cue", roundMistake ? "FLOW RECORDED" : "CLEAN EXECUTION");
  const comprehensionPause = ROUNDS[currentRound].insightPause ?? 2200;
  if (currentRound >= ROUNDS.length - 1) {
    setText("lv23Cue", roundMistake ? "FLOW RECORDED" : "READ THE OUTPUT");
    schedule(() => finishGame(gameToken), comprehensionPause);
    return;
  }
  const nextRound = currentRound + 1;
  const card = document.getElementById("lv23RoundCard");
  setText("lv23RoundCardTitle", `ROUND ${nextRound + 1}`);
  setText("lv23RoundCardSub", ROUNDS[nextRound].name);

  schedule(() => {
    if (!isActive(gameToken)) return;
    if (card) {
      card.hidden = false;
      card.classList.remove("is-showing");
      void card.offsetWidth;
      card.classList.add("is-showing");
    }

    schedule(() => {
      if (!isActive(gameToken)) return;
      if (card) {
        card.classList.remove("is-showing");
        card.hidden = true;
      }
      beginRound(gameToken, nextRound);
    }, ROUND_GAP);
  }, comprehensionPause);
}

function finishGame(gameToken) {
  if (!isActive(gameToken)) return;
  running = false;
  acceptingInput = false;
  stopLv23Sounds();
  const success = totalMistakes === 0;
  playLv23Finish(success);
  setText("lv23PhaseText", "COMPLETE");
  setText("lv23Cue", "EXECUTION COMPLETE");
  setText("lv23ResultKicker", success ? "PERFECT CODE FLOW" : "CODE FLOW COMPLETE");
  setText("lv23ResultTitle", success ? "완벽한 실행 순서입니다" : "코드 흐름을 한 번 더 따라가세요");
  setText("lv23ResultDescription", success
    ? "3 ROUND의 모든 실행 코드를 정확한 순서와 박자에 맞춰 터치했습니다."
    : `전체 흐름에서 ${totalSuccesses}번 성공했고, ${totalMistakes}번의 실수가 기록되었습니다.`);
  toggleHidden("lv23NextButton", !success);
  toggleHidden("lv23RetryButton", success);
  show("lv23Result");
}

function pulseCodeForCountdown() {
  const terminal = document.getElementById("lv23Terminal");
  if (!terminal) return;
  terminal.classList.remove("is-count-pulsing");
  void terminal.offsetWidth;
  terminal.classList.add("is-count-pulsing");
  schedule(() => terminal.classList.remove("is-count-pulsing"), 430);
}

function resetOutput() {
  const output = document.getElementById("lv23OutputContent");
  if (!output) return;
  output.innerHTML = '<span class="lv23-output-placeholder">Waiting for print...</span>';
  document.getElementById("lv23Output")?.classList.remove("has-output", "is-printing");
}

function emitRoundOutput(codeId) {
  const value = ROUNDS[currentRound]?.outputs?.[codeId];
  if (!value) return;
  const output = document.getElementById("lv23OutputContent");
  const panel = document.getElementById("lv23Output");
  if (!output || !panel) return;
  output.querySelector(".lv23-output-placeholder")?.remove();
  const line = document.createElement("div");
  line.className = "lv23-output-line";
  line.innerHTML = `<i>&gt;</i><span>${escapeHtml(value)}</span>`;
  output.append(line);
  panel.classList.add("has-output");
  panel.classList.remove("is-printing");
  void panel.offsetWidth;
  panel.classList.add("is-printing");
  schedule(() => panel.classList.remove("is-printing"), 520);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function syncLoopValueForWatch(stepIndex) {
  if (currentRound !== 2) return;
  const secondInitStep = ROUNDS[2].flow.findLastIndex((id) => id === "init");
  setLoopInitValue(stepIndex >= secondInitStep ? 1 : 0);
}

function setLoopInitValue(value) {
  if (currentRound !== 2) return;
  const target = findCodeTarget("init");
  if (!target) return;
  target.textContent = `HAPPY = ${value}`;
  target.setAttribute("aria-label", `HAPPY = ${value}`);
}

function getStepRhythm(round, stepIndex) {
  return { ...DEFAULT_STEP, ...(round?.rhythm?.[stepIndex] ?? {}) };
}

function findCodeTarget(id) {
  return document.querySelector(`.lv23-code-hit[data-code-id="${id}"]`);
}

function flashTarget(target, className, duration) {
  if (!target) return;
  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);
  schedule(() => target.classList.remove(className), duration);
}

function clearCodeStates() {
  document.querySelectorAll(".lv23-code-hit").forEach((element) => element.classList.remove("is-watching", "is-success", "is-fail", "is-answer"));
}

function createStepDots(count) {
  const dots = document.getElementById("lv23StepDots");
  if (!dots) return;
  dots.innerHTML = Array.from({ length: count }, (_, index) => `<i data-step="${index}"></i>`).join("");
}

function activateDot(index, state) {
  const dot = document.querySelector(`.lv23-step-dots i[data-step="${index}"]`);
  if (!dot) return;
  dot.className = `is-${state}`;
}

function resetDots() {
  document.querySelectorAll(".lv23-step-dots i").forEach((dot) => { dot.className = ""; });
}

function randomScramble() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

function setProgress(value) {
  const bar = document.getElementById("lv23ProgressBar");
  if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
}
function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
function show(id) { const element = document.getElementById(id); if (element) element.hidden = false; }
function hide(id) { const element = document.getElementById(id); if (element) element.hidden = true; }
function toggleHidden(id, hidden) { const element = document.getElementById(id); if (element) element.hidden = hidden; }
function schedule(callback, delayMs) { const id = window.setTimeout(() => { timers.delete(id); callback(); }, delayMs); timers.add(id); return id; }
function delay(delayMs) { return new Promise((resolve) => schedule(resolve, delayMs)); }
function clearTimers() { timers.forEach((id) => window.clearTimeout(id)); timers.clear(); }
function isActive(gameToken) { return running && gameToken === token && Boolean(document.getElementById("lv23Page")); }
function cancelGame() {
  running = false;
  acceptingInput = false;
  stepResolved = true;
  token += 1;
  clearTimers();
  const countdown = document.getElementById("lv23Countdown");
  if (countdown) countdown.hidden = true;
  stopLv23Sounds();
}
function destroyPage() {
  cancelGame();
  lifecycleController?.abort(); lifecycleController = null;
  inputController?.abort(); inputController = null;
  viewportController?.abort(); viewportController = null;
  window.clearInterval(routeWatchTimer); routeWatchTimer = 0;
  window.cancelAnimationFrame(resizeFrame); resizeFrame = 0;
}
