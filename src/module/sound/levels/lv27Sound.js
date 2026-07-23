import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const space = new Tone.Reverb({ decay: 1.45, wet: 0.16 }).connect(masterLimiter);
const beatSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.006, decay: 0.14, sustain: 0.04, release: 0.26 },
  volume: -16,
}).connect(space);
const touchSynth = new Tone.Synth({
  oscillator: { type: "sine" },
  envelope: { attack: 0.004, decay: 0.09, sustain: 0.02, release: 0.15 },
  volume: -18,
}).connect(space);
const failSynth = new Tone.Synth({
  oscillator: { type: "square8" },
  envelope: { attack: 0.003, decay: 0.08, sustain: 0, release: 0.12 },
  volume: -27,
}).connect(masterLimiter);

const BEAT_NOTES = ["C5", "E5", "G5", "C6"];

export function playLv27Beat(index, accent = false) {
  if (!canPlaySound()) return;
  const safeIndex = Math.max(0, Math.min(3, Number(index) || 0));
  const time = getStrictStartTime(`lv27-beat-${safeIndex}`, 0.08);
  beatSynth.triggerAttackRelease(BEAT_NOTES[safeIndex], accent ? 0.25 : 0.16, time, accent ? 0.62 : 0.45);
}

export function playLv27Touch(success) {
  if (!canPlaySound()) return;
  const channel = success ? "lv27-touch-ok" : "lv27-touch-fail";
  const time = getStrictStartTime(channel, 0.08);
  if (success) touchSynth.triggerAttackRelease("C6", 0.09, time, 0.18);
  else failSynth.triggerAttackRelease("F#3", 0.1, time, 0.15);
}

export function playLv27Finish(success) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv27-finish", 0.16);
  const notes = success ? ["C5", "E5", "G5", "C6"] : ["A4", "C5", "E5", "D5"];
  notes.forEach((note, index) => beatSynth.triggerAttackRelease(note, 0.2, time + index * 0.08, 0.28));
  lastStartTimes.set("lv27-finish", time + (notes.length - 1) * 0.08);
}

export function stopLv27Sounds() {
  try {
    beatSynth.releaseAll();
    touchSynth.triggerRelease();
    failSynth.triggerRelease();
  } catch {
    // 페이지 전환 중에도 안전하게 정리합니다.
  }
}
