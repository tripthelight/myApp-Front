import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const lv13NodeDelay = new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.16, wet: 0.2 }).connect(masterLimiter);
const lv13NodeSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.008, decay: 0.15, sustain: 0.06, release: 0.46 },
  volume: -16,
}).connect(lv13NodeDelay);
const lv13SpinNoise = new Tone.NoiseSynth({
  noise: { type: "pink" },
  envelope: { attack: 0.003, decay: 0.1, sustain: 0, release: 0.12 },
  volume: -27,
}).connect(masterLimiter);
const lv13SpinSynth = new Tone.Synth({
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.004, decay: 0.11, sustain: 0.03, release: 0.25 },
  volume: -16,
}).connect(masterLimiter);
const lv13SuccessSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.005, decay: 0.14, sustain: 0.11, release: 0.52 },
  volume: -12,
}).connect(masterLimiter);
const lv13FailFilter = new Tone.Filter({ frequency: 820, type: "lowpass", rolloff: -12 }).connect(masterLimiter);
const lv13FailSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.15, sustain: 0.02, release: 0.3 },
  volume: -14,
}).connect(lv13FailFilter);

export function playLv13NodeSound(step = 0, snake = false) {
  if (!canPlaySound()) return;
  const notes = ["C5", "D5", "E5", "G5", "A5", "B5"];
  const startTime = getStrictStartTime("lv13-node", 0.055);
  lv13NodeSynth.triggerAttackRelease(notes[step % notes.length], snake ? 0.18 : 0.12, startTime, snake ? 0.48 : 0.4);
  if (snake) lv13NodeSynth.triggerAttackRelease(notes[(step + 3) % notes.length], 0.12, startTime + 0.09, 0.3);
}

export function playLv13SpinSound(direction = "right", power = 0.5) {
  if (!canPlaySound()) return;
  const startTime = getStrictStartTime("lv13-spin", 0.05);
  const note = direction === "left" ? "D5" : "A5";
  lv13SpinNoise.triggerAttackRelease(0.09, startTime, 0.14 + power * 0.12);
  lv13SpinSynth.triggerAttackRelease(note, 0.11, startTime + 0.012, 0.28 + power * 0.18);
}

export function playLv13SuccessSound(step = 0, snake = false) {
  if (!canPlaySound()) return;
  const chords = [["E5", "A5", "C6"], ["F#5", "B5", "D6"], ["G5", "C6", "E6"], ["A5", "D6", "F#6"]];
  const startTime = getStrictStartTime("lv13-success", 0.085);
  lv13SuccessSynth.triggerAttackRelease(chords[step % chords.length], snake ? 0.31 : 0.25, startTime, snake ? 0.62 : 0.54);
}

export function playLv13FailSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["G3", "Db4"], ["F#3", "C4"], ["F3", "B3"]];
  const startTime = getStrictStartTime("lv13-fail", 0.075);
  lv13FailSynth.triggerAttackRelease(chords[step % chords.length], 0.2, startTime, 0.43);
}


