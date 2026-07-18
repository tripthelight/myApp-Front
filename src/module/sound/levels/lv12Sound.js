import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const lv12ApproachDelay = new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.14, wet: 0.18 }).connect(masterLimiter);
const lv12ApproachSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.006, decay: 0.12, sustain: 0.05, release: 0.4 },
  volume: -16,
}).connect(lv12ApproachDelay);
const lv12SlashNoise = new Tone.NoiseSynth({
  noise: { type: "pink" },
  envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.1 },
  volume: -23,
}).connect(masterLimiter);
const lv12SuccessSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.004, decay: 0.13, sustain: 0.1, release: 0.48 },
  volume: -12,
}).connect(masterLimiter);
const lv12FailFilter = new Tone.Filter({ frequency: 760, type: "lowpass", rolloff: -12 }).connect(masterLimiter);
const lv12FailSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.14, sustain: 0.02, release: 0.3 },
  volume: -14,
}).connect(lv12FailFilter);

export function playLv12ApproachSound(step = 0, pair = false) {
  if (!canPlaySound()) return;
  const notes = ["C5", "D5", "E5", "G5", "A5", "B5"];
  const startTime = getStrictStartTime("lv12-approach", 0.05);
  lv12ApproachSynth.triggerAttackRelease(notes[step % notes.length], pair ? 0.15 : 0.11, startTime, pair ? 0.5 : 0.42);
  if (pair) lv12ApproachSynth.triggerAttackRelease(notes[(step + 2) % notes.length], 0.11, startTime + 0.075, 0.34);
}

export function playLv12SuccessSound(step = 0, pair = false) {
  if (!canPlaySound()) return;
  const chords = [["E5", "A5", "C6"], ["F#5", "B5", "D6"], ["G5", "C6", "E6"], ["A5", "D6", "F#6"]];
  const startTime = getStrictStartTime("lv12-success", 0.085);
  lv12SlashNoise.triggerAttackRelease(pair ? 0.14 : 0.1, startTime, pair ? 0.32 : 0.25);
  lv12SuccessSynth.triggerAttackRelease(chords[step % chords.length], pair ? 0.3 : 0.24, startTime + 0.018, pair ? 0.62 : 0.54);
}

export function playLv12FailSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["G3", "Db4"], ["F#3", "C4"], ["F3", "B3"]];
  const startTime = getStrictStartTime("lv12-fail", 0.075);
  lv12FailSynth.triggerAttackRelease(chords[step % chords.length], 0.2, startTime, 0.44);
}


