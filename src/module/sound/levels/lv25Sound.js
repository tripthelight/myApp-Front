import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const room = new Tone.Reverb({ decay: 1.35, wet: 0.13 }).connect(masterLimiter);
const moveSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine" },
  envelope: { attack: 0.004, decay: 0.09, sustain: 0.015, release: 0.16 },
  volume: -21,
}).connect(room);
const judgeSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.004, decay: 0.13, sustain: 0.025, release: 0.28 },
  volume: -17,
}).connect(room);
const failSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "square4" },
  envelope: { attack: 0.003, decay: 0.08, sustain: 0.01, release: 0.15 },
  volume: -24,
}).connect(masterLimiter);

const MOVE_NOTES = ["C5", "D5", "E5", "G5", "A5"];

export function playLv25Move(index = 0, isTarget = false) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv25-move", 0.075);
  const note = MOVE_NOTES[index % MOVE_NOTES.length];
  moveSynth.triggerAttackRelease(note, isTarget ? 0.16 : 0.1, time, isTarget ? 0.38 : 0.22);
}

export function playLv25Success() {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv25-success", 0.14);
  ["E5", "A5", "C6"].forEach((note, index) => judgeSynth.triggerAttackRelease(note, 0.2, time + index * 0.055, 0.34));
  lastStartTimes.set("lv25-success", time + 0.11);
}

export function playLv25Fail() {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv25-fail", 0.14);
  failSynth.triggerAttackRelease(["F#4", "C4"], 0.13, time, 0.26);
}

export function playLv25Finish(success) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv25-finish", 0.16);
  const notes = success ? ["C5", "E5", "G5", "B5", "D6"] : ["A4", "C5", "E5", "D5"];
  notes.forEach((note, index) => judgeSynth.triggerAttackRelease(note, success ? 0.28 : 0.2, time + index * 0.075, 0.36));
  lastStartTimes.set("lv25-finish", time + (notes.length - 1) * 0.075);
}

export function stopLv25Sounds() {
  try {
    moveSynth.releaseAll();
    judgeSynth.releaseAll();
    failSynth.releaseAll();
  } catch {
    // 페이지 전환 중에도 안전하게 정리합니다.
  }
}
