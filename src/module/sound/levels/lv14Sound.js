import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const lv14StepDelay = new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.12, wet: 0.16 }).connect(masterLimiter);
const lv14StepSynth = new Tone.Synth({
  oscillator: { type: "sine8" },
  envelope: { attack: 0.004, decay: 0.1, sustain: 0.03, release: 0.3 },
  volume: -17,
}).connect(lv14StepDelay);
const lv14HitSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.004, decay: 0.16, sustain: 0.12, release: 0.58 },
  volume: -12,
}).connect(masterLimiter);
const lv14HitBell = new Tone.Synth({
  oscillator: { type: "sine" },
  envelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.46 },
  volume: -16,
}).connect(lv14StepDelay);
const lv14FailFilter = new Tone.Filter({ frequency: 720, type: "lowpass", rolloff: -12 }).connect(masterLimiter);
const lv14FailSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.15, sustain: 0.01, release: 0.28 },
  volume: -14,
}).connect(lv14FailFilter);

export function playLv14StepSound(step = 0, level = 1) {
  if (!canPlaySound()) return;
  const notes = ["C5", "D5", "E5", "G5", "A5", "B5"];
  const startTime = getStrictStartTime("lv14-step", 0.045);
  lv14StepSynth.triggerAttackRelease(notes[(step + level - 1) % notes.length], 0.1, startTime, 0.28 + level * 0.035);
}

export function playLv14HitSound(step = 0, direction = "left", level = 1) {
  if (!canPlaySound()) return;
  const roots = { left: 0, down: 1, up: 2, right: 3 };
  const chords = [
    ["E5", "A5", "C6"],
    ["F#5", "B5", "D6"],
    ["G5", "C6", "E6"],
    ["A5", "D6", "F#6"],
  ];
  const index = (roots[direction] + step + level) % chords.length;
  const startTime = getStrictStartTime("lv14-hit", 0.085);
  lv14HitSynth.triggerAttackRelease(chords[index], 0.28, startTime, 0.55 + level * 0.025);
  lv14HitBell.triggerAttackRelease(["A6", "B6", "C7", "D7"][index], 0.13, startTime + 0.045, 0.3);
}

export function playLv14FailSound(step = 0, direction = "left") {
  if (!canPlaySound()) return;
  const offsets = { left: 0, down: 1, up: 2, right: 3 };
  const chords = [["G3", "Db4"], ["F#3", "C4"], ["F3", "B3"], ["E3", "Bb3"]];
  const startTime = getStrictStartTime("lv14-fail", 0.075);
  lv14FailSynth.triggerAttackRelease(chords[(step + offsets[direction]) % chords.length], 0.2, startTime, 0.44);
}

