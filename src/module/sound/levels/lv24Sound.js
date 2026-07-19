import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const room = new Tone.Reverb({ decay: 1.2, wet: 0.12 }).connect(masterLimiter);
const motionSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine" },
  envelope: { attack: 0.004, decay: 0.08, sustain: 0.02, release: 0.18 },
  volume: -20,
}).connect(room);
const failSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "square4" },
  envelope: { attack: 0.002, decay: 0.08, sustain: 0.01, release: 0.16 },
  volume: -23,
}).connect(masterLimiter);
const finishSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.005, decay: 0.16, sustain: 0.06, release: 0.5 },
  volume: -15,
}).connect(room);

const ROOTS = ["C5", "D5", "E5", "G5", "A5"];

export function playLv24Lock(typeIndex = 0) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv24-lock", 0.08);
  const note = Tone.Frequency(ROOTS[typeIndex % ROOTS.length]).transpose(12).toNote();
  motionSynth.triggerAttackRelease(note, 0.12, time, 0.34);
}

export function playLv24Fail() {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv24-fail", 0.12);
  failSynth.triggerAttackRelease(["F#4", "C4"], 0.13, time, 0.28);
}

export function playLv24Finish(success) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv24-finish", 0.16);
  const notes = success ? ["C5", "E5", "G5", "B5", "D6"] : ["A4", "C5", "E5", "D5"];
  notes.forEach((note, index) => finishSynth.triggerAttackRelease(note, success ? 0.28 : 0.2, time + index * 0.075, 0.38));
  lastStartTimes.set("lv24-finish", time + (notes.length - 1) * 0.075);
}

export function stopLv24Sounds() {
  try {
    motionSynth.releaseAll();
    failSynth.releaseAll();
    finishSynth.releaseAll();
  } catch {
    // 페이지 전환 도중에도 안전하게 정리합니다.
  }
}
