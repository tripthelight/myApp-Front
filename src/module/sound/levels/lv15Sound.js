import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const lv15PianoReverb = new Tone.Reverb({ decay: 2.1, wet: 0.18 }).connect(masterLimiter);
const lv15PianoDelay = new Tone.FeedbackDelay({ delayTime: "32n", feedback: 0.08, wet: 0.1 }).connect(lv15PianoReverb);
const lv15PianoSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.006, decay: 0.34, sustain: 0.18, release: 1.15 },
  volume: -13,
}).connect(lv15PianoDelay);
const lv15SuccessSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.004, decay: 0.24, sustain: 0.12, release: 0.82 },
  volume: -16,
}).connect(lv15PianoReverb);
const lv15FailFilter = new Tone.Filter({ frequency: 920, type: "lowpass", rolloff: -12 }).connect(masterLimiter);
const lv15FailSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.006, decay: 0.2, sustain: 0.04, release: 0.48 },
  volume: -16,
}).connect(lv15FailFilter);

export function playLv15KeySound(note = "C4", step = 0, preview = false) {
  if (!canPlaySound()) return;
  const startTime = getStrictStartTime("lv15-key", 0.06);
  const velocity = preview ? 0.44 : 0.5;
  lv15PianoSynth.triggerAttackRelease(note, preview ? 0.52 : 0.44, startTime, velocity);
  if (preview && step % 3 === 2) {
    lv15PianoSynth.triggerAttackRelease(Tone.Frequency(note).transpose(12).toNote(), 0.22, startTime + 0.035, 0.14);
  }
}

export function playLv15SuccessSound(note = "C4", step = 0) {
  if (!canPlaySound()) return;
  const startTime = getStrictStartTime("lv15-success", 0.075);
  const third = Tone.Frequency(note).transpose(step % 2 === 0 ? 4 : 3).toNote();
  const fifth = Tone.Frequency(note).transpose(7).toNote();
  lv15PianoSynth.triggerAttackRelease(note, 0.5, startTime, 0.56);
  lv15SuccessSynth.triggerAttackRelease([third, fifth], 0.34, startTime + 0.035, 0.28);
}

export function playLv15FailSound(note = "C4", step = 0) {
  if (!canPlaySound()) return;
  const startTime = getStrictStartTime("lv15-fail", 0.08);
  const dissonance = Tone.Frequency(note).transpose(step % 2 === 0 ? 1 : -1).toNote();
  lv15PianoSynth.triggerAttackRelease(note, 0.34, startTime, 0.38);
  lv15FailSynth.triggerAttackRelease([dissonance, Tone.Frequency(note).transpose(-12).toNote()], 0.26, startTime + 0.03, 0.24);
}

export function stopLv15Sounds() {
  const now = Tone.now();
  lv15PianoSynth.releaseAll(now);
  lv15SuccessSynth.releaseAll(now);
  lv15FailSynth.releaseAll(now);
}



