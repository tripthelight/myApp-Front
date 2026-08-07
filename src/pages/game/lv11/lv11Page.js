import lv11Style from "../../../assets/scss/game/lv11/common.scss?inline";
import lv11Template from "./lv11.html?raw";
import { navigate } from "../../../app/router.js";
import { renderView } from "../../../shared/dom.js";
import {
  playLv11FailSound,
  playLv11MelodySound,
  playLv11SuccessSound,
  playStartSound,
  readySound,
  unlockSoundOnNextGesture,
} from "../../../module/sound/levels/lv11Sound.js";

const CONFIG = Object.freeze({
  stepCount: 4,
  judgeWindowMs: 175,
  firstNoteDelayMs: 720,
  playbackTailMs: 760,
  inputLeadMs: 620,
  stepGapMs: 1050,
});

const COLORS = ["#f2b8c6", "#f4d78e", "#a9ddcd", "#aec9ed", "#cbb9e8", "#f3c4a6"];
const SPLITS = [
  { angle: 0, listen: 50, direction: 1 },
  { angle: -19, listen: 66, direction: -1 },
  { angle: 24, listen: 69, direction: 1 },
  { angle: -32, listen: 64, direction: -1 },
];

let gameId = 0;
let timers = new Set();
let viewportController = null;
let running = false;
let currentStep = 0;
let currentPattern = null;
let expectedTimes = [];
let judged = [];
let inputStartTime = 0;
let inputIndex = 0;
let totalHits = 0;
let totalNotes = 0;
let hadFailure = false;

export function renderPage() {
  cancelGame();
  renderView(lv11Template, lv11Style);
  bindViewportHeight();
  bindPage();
}

function bindViewportHeight() {
  viewportController?.abort();
  viewportController = new AbortController();
  const { signal } = viewportController;
  const sync = () => {
    const page = document.getElementById("lv11Page");
    if (!page) return;
    const height = window.visualViewport?.height ?? window.innerHeight;
    page.style.setProperty("--lv11-viewport-height", `${Math.round(height)}px`);
  };
  sync();
  window.addEventListener("resize", sync, { passive: true, signal });
  window.addEventListener("orientationchange", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", sync, { passive: true, signal });
  window.visualViewport?.addEventListener("scroll", sync, { passive: true, signal });
}

function bindPage() {
  const start = document.getElementById("lv11StartButton");
  const retry = document.getElementById("lv11RetryButton");
  const next = document.getElementById("lv11NextButton");
  const home = document.getElementById("lv11HomeButton");
  const touchZone = document.getElementById("lv11TouchZone");
  if (!start || !retry || !next || !home || !touchZone) return;

  unlockSoundOnNextGesture();
  start.addEventListener("click", startGame);
  retry.addEventListener("click", startGame);
  next.addEventListener("click", () => {
    cancelGame();
    navigate("lv12", { replace: true });
  });
  home.addEventListener("click", () => {
    cancelGame();
    navigate("home", { replace: true });
  });
  touchZone.addEventListener("pointerdown", handleTouch);
}

async function startGame() {
  cancelGame();
  const id = ++gameId;
  running = true;
  currentStep = 0;
  totalHits = 0;
  totalNotes = 0;
  hadFailure = false;
  document.getElementById("lv11Ready")?.setAttribute("hidden", "");
  document.getElementById("lv11Result")?.setAttribute("hidden", "");
  document.getElementById("lv11Stage")?.classList.add("is-running");
  await readySound();
  if (!isActive(id)) return;
  playStartSound();
  schedule(() => runStep(id, 0), 520);
}

function runStep(id, stepIndex) {
  if (!isActive(id)) return;
  currentStep = stepIndex;
  currentPattern = createPattern(stepIndex);
  totalNotes += currentPattern.notes.length;
  inputIndex = 0;
  judged = Array(currentPattern.notes.length).fill(false);
  expectedTimes = currentPattern.notes.map((note) => note.at);

  const split = SPLITS[stepIndex % SPLITS.length];
  const stage = document.getElementById("lv11Stage");
  const touchZone = document.getElementById("lv11TouchZone");
  const track = document.getElementById("lv11NoteTrack");
  if (!stage || !touchZone || !track) return;

  stage.style.setProperty("--split-angle", `${split.angle}deg`);
  stage.style.setProperty("--listen-size", `${stepIndex === 0 ? 50 : split.listen}%`);
  stage.style.setProperty("--touch-shift", "0%");
  stage.classList.remove("is-input", "is-step-success", "is-step-fail", "is-horizontal");
  stage.classList.toggle("is-horizontal", stepIndex === 0);
  stage.classList.add("is-listening");
  touchZone.disabled = true;
  touchZone.style.removeProperty("--touch-color");
  track.replaceChildren();
  setText("lv11StepText", `STEP ${stepIndex + 1} / ${CONFIG.stepCount}`);
  setText("lv11ScoreText", `${totalHits} / ${totalNotes}`);
  setText("lv11StatusText", "색 조각과 멜로디의 간격을 기억하세요.");
  setText("lv11TouchLabel", "기억하는 중");

  currentPattern.notes.forEach((note, index) => {
    schedule(() => spawnNote(id, note, index, split.direction), CONFIG.firstNoteDelayMs + note.at);
  });

  const patternEnd = currentPattern.notes.at(-1).at + currentPattern.notes.at(-1).duration;
  schedule(() => beginInput(id, split), CONFIG.firstNoteDelayMs + patternEnd + CONFIG.playbackTailMs);
}

function createPattern(stepIndex) {
  const noteCount = 5 + stepIndex;
  const gapChoices = stepIndex < 2
    ? [260, 330, 420, 540, 690]
    : [220, 290, 360, 470, 610, 760];
  const notes = [];
  let at = 0;

  for (let index = 0; index < noteCount; index += 1) {
    if (index > 0) at += gapChoices[Math.floor(Math.random() * gapChoices.length)];
    const nextGap = gapChoices[Math.floor(Math.random() * gapChoices.length)];
    const duration = Math.max(180, Math.min(nextGap + 200, 620));
    notes.push({
      at,
      duration,
      color: COLORS[(index + stepIndex * 2) % COLORS.length],
      pitch: (index + stepIndex) % 6,
    });
  }
  return { notes };
}

function spawnNote(id, note, index, direction) {
  if (!isActive(id)) return;
  const track = document.getElementById("lv11NoteTrack");
  if (!track) return;
  const element = document.createElement("i");
  element.className = direction > 0 ? "is-forward" : "is-reverse";
  element.style.setProperty("--note-color", note.color);
  element.style.setProperty("--note-duration", `${note.duration + 980}ms`);
  element.style.setProperty("--note-width", `${Math.max(9, note.duration / 11)}%`);
  track.appendChild(element);
  requestAnimationFrame(() => element.classList.add("is-moving"));
  playLv11MelodySound(note.pitch, index, false);
  schedule(() => element.remove(), note.duration + 1200);
}

function beginInput(id, split) {
  if (!isActive(id)) return;
  const stage = document.getElementById("lv11Stage");
  const touchZone = document.getElementById("lv11TouchZone");
  if (!stage || !touchZone) return;

  stage.classList.remove("is-listening");
  stage.classList.add("is-input");
  stage.style.setProperty("--listen-size", `${currentStep === 0 ? 50 : 34 + (currentStep % 2) * 3}%`);
  stage.style.setProperty("--touch-shift", `${split.angle > 0 ? -2 : 2}%`);
  touchZone.disabled = false;
  setText("lv11StatusText", "같은 멜로디가 들립니다. 정확한 순간에 터치하세요.");
  setText("lv11TouchLabel", "멜로디를 따라 터치");

  inputStartTime = performance.now() + CONFIG.inputLeadMs;
  currentPattern.notes.forEach((note, index) => {
    schedule(() => {
      if (!isActive(id)) return;
      touchZone.style.setProperty("--touch-color", note.color);
      touchZone.classList.remove("is-color-beat");
      void touchZone.offsetWidth;
      touchZone.classList.add("is-color-beat");
      playLv11MelodySound(note.pitch, index, true);
      schedule(() => judgeMissedNotes(id, index), CONFIG.judgeWindowMs + 12);
    }, CONFIG.inputLeadMs + note.at);
  });

  const finalAt = currentPattern.notes.at(-1).at;
  schedule(() => finishStep(id), CONFIG.inputLeadMs + finalAt + CONFIG.judgeWindowMs + 520);
}

function handleTouch(event) {
  if (!running || event.currentTarget.disabled || !currentPattern) return;
  event.preventDefault();
  const now = performance.now() - inputStartTime;
  let bestIndex = -1;
  let bestDelta = Infinity;

  expectedTimes.forEach((time, index) => {
    if (judged[index]) return;
    const delta = Math.abs(now - time);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIndex = index;
    }
  });

  if (bestIndex >= 0 && bestDelta <= CONFIG.judgeWindowMs) {
    judged[bestIndex] = true;
    inputIndex += 1;
    totalHits += 1;
    playLv11SuccessSound(bestIndex);
    showTouchFeedback(true, bestDelta);
    resizeTouchArea(true);
  } else {
    hadFailure = true;
    playLv11FailSound(inputIndex);
    showTouchFeedback(false, bestDelta);
    resizeTouchArea(false);
  }
  setText("lv11ScoreText", `${totalHits} / ${totalNotes}`);
}

function judgeMissedNotes(id, throughIndex) {
  if (!isActive(id)) return;
  for (let index = 0; index <= throughIndex; index += 1) {
    if (judged[index]) continue;
    judged[index] = true;
    hadFailure = true;
    playLv11FailSound(index);
    showTouchFeedback(false, Infinity, true);
    resizeTouchArea(false);
  }
}

function showTouchFeedback(success, delta, missed = false) {
  const feedback = document.getElementById("lv11Feedback");
  const touchZone = document.getElementById("lv11TouchZone");
  if (!feedback || !touchZone) return;
  const title = feedback.querySelector("strong");
  const detail = feedback.querySelector("span");
  feedback.className = `lv11-feedback is-visible ${success ? "is-success" : "is-fail"}`;
  if (title) title.textContent = success ? (delta < 70 ? "PERFECT" : "LOVELY") : "OOPS";
  if (detail) detail.textContent = success ? "BEAUTIFUL TIMING" : (missed ? "MISSED BEAT" : "TRY THE NEXT BEAT");
  touchZone.classList.remove("is-hit", "is-miss");
  void touchZone.offsetWidth;
  touchZone.classList.add(success ? "is-hit" : "is-miss");
  createParticles(success);
  schedule(() => feedback.classList.remove("is-visible"), 650);
}

function resizeTouchArea(success) {
  const stage = document.getElementById("lv11Stage");
  if (!stage) return;
  stage.classList.remove("is-step-success", "is-step-fail");
  void stage.offsetWidth;
  stage.classList.add(success ? "is-step-success" : "is-step-fail");
}

function createParticles(success) {
  const layer = document.getElementById("lv11Particles");
  if (!layer) return;
  const burst = document.createElement("div");
  burst.className = success ? "is-success" : "is-fail";
  burst.innerHTML = Array.from({ length: success ? 12 : 8 }, (_, index) => `<i style="--i:${index}"></i>`).join("");
  layer.appendChild(burst);
  schedule(() => burst.remove(), 900);
}

function finishStep(id) {
  if (!isActive(id)) return;
  const touchZone = document.getElementById("lv11TouchZone");
  const stage = document.getElementById("lv11Stage");
  if (touchZone) touchZone.disabled = true;
  stage?.classList.remove("is-input", "is-listening");

  if (currentStep + 1 < CONFIG.stepCount) {
    setText("lv11StatusText", "좋아요. 다음 멜로디로 이어집니다.");
    schedule(() => runStep(id, currentStep + 1), CONFIG.stepGapMs);
    return;
  }
  schedule(() => showResult(id), 700);
}

function showResult(id) {
  if (!isActive(id)) return;
  running = false;
  const success = !hadFailure && totalHits === totalNotes;
  setText("lv11ResultKicker", success ? "ALL PERFECT" : "MELODY COMPLETE");
  setText("lv11ResultTitle", success ? "완벽한 멜로디예요" : "조금만 더 다듬어 볼까요?");
  setText("lv11ResultDescription", success
    ? `${totalNotes}개의 박자를 모두 정확히 되돌려 주셨습니다.`
    : `${totalNotes}개의 박자 중 ${totalHits}개를 정확히 터치했습니다.`);
  document.getElementById("lv11NextButton")?.toggleAttribute("hidden", !success);
  document.getElementById("lv11RetryButton")?.toggleAttribute("hidden", success);
  document.getElementById("lv11Result")?.removeAttribute("hidden");
}

function schedule(callback, delay) {
  const timer = window.setTimeout(() => {
    timers.delete(timer);
    callback();
  }, delay);
  timers.add(timer);
  return timer;
}

function cancelGame() {
  running = false;
  gameId += 1;
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  document.getElementById("lv11TouchZone")?.setAttribute("disabled", "");
}

function isActive(id) {
  return running && id === gameId;
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}
