import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const lv9ApproachDelay = new Tone.FeedbackDelay({
  delayTime: "16n",
  feedback: 0.18,
  wet: 0.2,
}).connect(masterLimiter);

const lv9ApproachSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.06, release: 0.52 },
  volume: -17,
}).connect(lv9ApproachDelay);

const lv9SuccessSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.006, decay: 0.18, sustain: 0.12, release: 0.62 },
  volume: -12,
}).connect(masterLimiter);

const lv9FailFilter = new Tone.Filter({
  frequency: 780,
  type: "lowpass",
  rolloff: -12,
}).connect(masterLimiter);

const lv9FailSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.16, sustain: 0.02, release: 0.28 },
  volume: -14,
}).connect(lv9FailFilter);

export function playLv9ApproachSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [
    ["C4", "G4"],
    ["D4", "A4"],
    ["E4", "B4"],
    ["G4", "D5"],
  ];
  lv9ApproachSynth.triggerAttackRelease(
    chords[step % chords.length],
    0.24,
    getStrictStartTime("lv9-approach", 0.075),
    0.34,
  );
}

export function playLv9SuccessSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [
    ["E5", "A5", "C6"],
    ["F#5", "B5", "D6"],
    ["G5", "C6", "E6"],
    ["A5", "D6", "F#6"],
  ];
  lv9SuccessSynth.triggerAttackRelease(
    chords[step % chords.length],
    0.34,
    getStrictStartTime("lv9-success", 0.1),
    0.56,
  );
}

export function playLv9FailSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [
    ["G3", "Db4"],
    ["F#3", "C4"],
    ["F3", "B3"],
  ];
  lv9FailSynth.triggerAttackRelease(
    chords[step % chords.length],
    0.18,
    getStrictStartTime("lv9-fail", 0.08),
    0.42,
  );
}


