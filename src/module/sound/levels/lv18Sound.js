import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

/* LEVEL 18 · responsive piano hold rhythm */
const lv18Room = new Tone.Reverb({ decay: 2.25, wet: 0.2 }).connect(masterLimiter);
const lv18PianoDelay = new Tone.FeedbackDelay({ delayTime: "32n", feedback: 0.09, wet: 0.12 }).connect(lv18Room);
const lv18PianoSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.008, decay: 0.28, sustain: 0.28, release: 1.1 },
  volume: -15,
}).connect(lv18PianoDelay);
const lv18SuccessSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.004, decay: 0.22, sustain: 0.12, release: 0.9 },
  volume: -16,
}).connect(lv18Room);
const lv18FailFilter = new Tone.Filter({ frequency: 840, type: "lowpass", rolloff: -12 }).connect(masterLimiter);
const lv18FailSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.005, decay: 0.18, sustain: 0.03, release: 0.42 },
  volume: -17,
}).connect(lv18FailFilter);
const lv18FinishSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.006, decay: 0.26, sustain: 0.14, release: 1.2 },
  volume: -15,
}).connect(lv18Room);
let lv18HeldNote = null;

export function playLv18HoldStartSound(note = "C4") {
  if (!canPlaySound()) return;
  const startTime = getStrictStartTime("lv18-hold", 0.035);
  try {
    if (lv18HeldNote) lv18PianoSynth.triggerRelease(lv18HeldNote, startTime);
    lv18HeldNote = note;
    lv18PianoSynth.triggerAttack(note, startTime, 0.68);
  } catch {
    lv18HeldNote = null;
  }
}

export function playLv18HoldEndSound(note = "C4") {
  if (!canPlaySound()) return;
  const startTime = getStrictStartTime("lv18-release", 0.03);
  try {
    lv18PianoSynth.triggerRelease(lv18HeldNote ?? note, startTime);
  } finally {
    lv18HeldNote = null;
  }
}

export function playLv18SuccessSound(note = "C4", step = 0) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv18-success", 0.08);
  const fifth = Tone.Frequency(note).transpose(7).toNote();
  const octave = Tone.Frequency(note).transpose(12).toNote();
  lv18SuccessSynth.triggerAttackRelease([note, fifth], 0.2, time, 0.55);
  lv18SuccessSynth.triggerAttackRelease(octave, 0.28, time + 0.075, 0.42 + (step % 3) * 0.04);
  lastStartTimes.set("lv18-success", time + 0.075);
}

export function playLv18FailSound(note = "C4", step = 0) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv18-fail", 0.09);
  const lower = Tone.Frequency(note).transpose(-1 - (step % 2)).toNote();
  lv18FailSynth.triggerAttackRelease(note, 0.13, time, 0.4);
  lv18FailSynth.triggerAttackRelease(lower, 0.2, time + 0.065, 0.32);
  lastStartTimes.set("lv18-fail", time + 0.065);
}

export function playLv18FinishSound(success = true) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv18-finish", 0.14);
  const notes = success ? ["C5", "E5", "G5", "C6"] : ["A4", "C5", "E5"];
  notes.forEach((note, index) => {
    lv18FinishSynth.triggerAttackRelease(note, success ? 0.34 : 0.24, time + index * 0.075, 0.48);
  });
  lastStartTimes.set("lv18-finish", time + (notes.length - 1) * 0.075);
}

export function stopLv18Sounds() {
  try {
    lv18PianoSynth.releaseAll();
    lv18SuccessSynth.releaseAll();
    lv18FailSynth.releaseAll();
    lv18FinishSynth.releaseAll();
  } catch {
    // Tone 컨텍스트가 닫히는 라우트 전환에서는 조용히 정리합니다.
  }
  lv18HeldNote = null;
}

