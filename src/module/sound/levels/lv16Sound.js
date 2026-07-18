import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const lv16RiseFilter = new Tone.Filter({ frequency: 1400, type: "lowpass", rolloff: -12 }).connect(masterLimiter);
const lv16PreviewSynth = new Tone.MonoSynth({
  oscillator: { type: "sine4" },
  envelope: { attack: 0.04, decay: 0.18, sustain: 0.36, release: 0.42 },
  filterEnvelope: { attack: 0.08, decay: 0.2, sustain: 0.4, release: 0.35, baseFrequency: 260, octaves: 3.1 },
  volume: -18,
}).connect(lv16RiseFilter);
const lv16HoldSynth = new Tone.MonoSynth({
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.03, decay: 0.14, sustain: 0.4, release: 0.34 },
  filterEnvelope: { attack: 0.05, decay: 0.16, sustain: 0.5, release: 0.3, baseFrequency: 190, octaves: 3.5 },
  volume: -19,
}).connect(lv16RiseFilter);
const lv16SuccessReverb = new Tone.Reverb({ decay: 1.8, wet: 0.22 }).connect(masterLimiter);
const lv16SuccessSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.004, decay: 0.2, sustain: 0.12, release: 0.72 },
  volume: -14,
}).connect(lv16SuccessReverb);
const lv16FailSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.16, sustain: 0.02, release: 0.34 },
  volume: -16,
}).connect(lv16RiseFilter);
let lv16HoldActive = false;

export function playLv16PreviewSound(order = 0, duration = 1200) {
  if (!canPlaySound()) return;
  const notes = ["C4", "D4", "F4", "A4"];
  const startTime = getStrictStartTime("lv16-preview", 0.08);
  lv16PreviewSynth.triggerAttack(notes[order % notes.length], startTime, 0.38);
  lv16PreviewSynth.frequency.exponentialRampToValueAtTime(Tone.Frequency(notes[order % notes.length]).transpose(7).toFrequency(), startTime + Math.max(0.25, duration / 1000));
  lv16PreviewSynth.triggerRelease(startTime + Math.max(0.3, duration / 1000));
}

export function startLv16HoldSound(order = 0) {
  if (!canPlaySound()) return;
  const notes = ["G3", "A3", "C4", "D4"];
  const startTime = getStrictStartTime("lv16-hold", 0.08);
  lv16HoldSynth.triggerRelease(startTime);
  lv16HoldSynth.triggerAttack(notes[order % notes.length], startTime + 0.015, 0.34);
  lv16HoldSynth.frequency.exponentialRampToValueAtTime(Tone.Frequency(notes[order % notes.length]).transpose(9).toFrequency(), startTime + 1.7);
  lv16HoldActive = true;
}

export function stopLv16HoldSound() {
  if (!lv16HoldActive || !canPlaySound()) return;
  lv16HoldSynth.triggerRelease(getStrictStartTime("lv16-hold-release", 0.04));
  lv16HoldActive = false;
}

export function playLv16SuccessSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["E5", "A5", "C6"], ["F#5", "B5", "D6"], ["G5", "C6", "E6"], ["A5", "D6", "F#6"]];
  const startTime = getStrictStartTime("lv16-success", 0.09);
  lv16SuccessSynth.triggerAttackRelease(chords[step % chords.length], 0.42, startTime, 0.52);
  lv16SuccessSynth.triggerAttackRelease(chords[step % chords.length][2], 0.28, startTime + 0.16, 0.24);
}

export function playLv16FailSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["G3", "Db4"], ["F#3", "C4"], ["F3", "B3"], ["E3", "Bb3"]];
  const startTime = getStrictStartTime("lv16-fail", 0.085);
  lv16FailSynth.triggerAttackRelease(chords[step % chords.length], 0.24, startTime, 0.36);
}

export function stopLv16Sounds() {
  const now = Tone.now();
  lv16PreviewSynth.triggerRelease(now);
  lv16HoldSynth.triggerRelease(now);
  lv16SuccessSynth.releaseAll(now);
  lv16FailSynth.releaseAll(now);
  lv16HoldActive = false;
}


