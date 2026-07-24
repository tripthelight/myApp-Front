import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const room = new Tone.Reverb({ decay: 1.25, wet: 0.14 }).connect(masterLimiter);
const noteSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.008, decay: 0.12, sustain: 0.12, release: 0.28 },
  volume: -15,
}).connect(room);
const catchSynth = new Tone.Synth({
  oscillator: { type: "sine" },
  envelope: { attack: 0.004, decay: 0.09, sustain: 0.02, release: 0.14 },
  volume: -18,
}).connect(room);
const failSynth = new Tone.Synth({
  oscillator: { type: "square8" },
  envelope: { attack: 0.003, decay: 0.08, sustain: 0, release: 0.12 },
  volume: -27,
}).connect(masterLimiter);

export function playLv28Note(note, durationMs, channel = "listen") {
  if (!canPlaySound()) return;
  const time = getStrictStartTime(`lv28-${channel}`, 0.045);
  noteSynth.triggerAttackRelease(note, Math.max(0.1, durationMs / 1000), time, 0.42);
}

export function playLv28Catch(success) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime(success ? "lv28-catch" : "lv28-fail", 0.07);
  if (success) catchSynth.triggerAttackRelease("C6", 0.09, time, 0.2);
  else failSynth.triggerAttackRelease("F#3", 0.1, time, 0.14);
}

export function playLv28Finish(success) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv28-finish", 0.16);
  const notes = success ? ["C5", "E5", "G5", "C6"] : ["A4", "C5", "E5", "D5"];
  notes.forEach((note, index) => noteSynth.triggerAttackRelease(note, 0.18, time + index * 0.08, 0.28));
  lastStartTimes.set("lv28-finish", time + (notes.length - 1) * 0.08);
}

export function stopLv28Sounds() {
  try {
    noteSynth.releaseAll();
    catchSynth.triggerRelease();
    failSynth.triggerRelease();
  } catch {
    // 페이지 전환 중에도 안전하게 정리합니다.
  }
}
