import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const shimmer = new Tone.Reverb({ decay: 1.8, wet: 0.18 }).connect(masterLimiter);
const noteSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.004, decay: 0.12, sustain: 0.08, release: 0.34 },
  volume: -13,
}).connect(shimmer);
const successSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.004, decay: 0.16, sustain: 0.08, release: 0.52 },
  volume: -12,
}).connect(shimmer);
const failFilter = new Tone.Filter({ type: "bandpass", frequency: 840, Q: 2.4 }).connect(masterLimiter);
const failSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sawtooth" },
  envelope: { attack: 0.002, decay: 0.12, sustain: 0.01, release: 0.24 },
  volume: -19,
}).connect(failFilter);
const finishSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine4" },
  envelope: { attack: 0.008, decay: 0.22, sustain: 0.12, release: 0.9 },
  volume: -14,
}).connect(shimmer);

export const LV22_NOTES = Object.freeze(["C5", "D5", "E5", "G5", "A5"]);

export function playLv22Note(slot, durationMs = 500, velocity = 0.44) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv22-note", 0.018);
  const duration = Math.max(0.08, Math.min(0.42, durationMs / 1000 * 0.48));
  noteSynth.triggerAttackRelease(LV22_NOTES[slot % LV22_NOTES.length], duration, time, velocity);
}

export function playLv22Success(slot, mutedTarget = false) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv22-success", 0.05);
  const root = LV22_NOTES[slot % LV22_NOTES.length];
  const notes = mutedTarget ? [root, Tone.Frequency(root).transpose(12).toNote()] : [Tone.Frequency(root).transpose(12).toNote()];
  successSynth.triggerAttackRelease(notes, 0.26, time, 0.5);
}

export function playLv22Fail() {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv22-fail", 0.08);
  failSynth.triggerAttackRelease(["F#4", "C4"], 0.14, time, 0.38);
  failSynth.triggerAttackRelease(["F4", "B3"], 0.18, time + 0.09, 0.3);
  lastStartTimes.set("lv22-fail", time + 0.09);
}

export function playLv22Finish(success = true) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv22-finish", 0.15);
  const notes = success ? ["C5", "E5", "G5", "B5", "D6"] : ["A4", "C5", "E5", "D5"];
  notes.forEach((note, index) => finishSynth.triggerAttackRelease(note, success ? 0.34 : 0.24, time + index * 0.07, 0.42));
  lastStartTimes.set("lv22-finish", time + (notes.length - 1) * 0.07);
}

export function stopLv22Sounds() {
  try {
    noteSynth.releaseAll();
    successSynth.releaseAll();
    failSynth.releaseAll();
    finishSynth.releaseAll();
  } catch {
    // 페이지 전환 중에도 안전하게 정리합니다.
  }
}
