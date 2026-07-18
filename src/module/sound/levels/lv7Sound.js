import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const lv7TickDelay = new Tone.FeedbackDelay({
  delayTime: "32n",
  feedback: 0.08,
  wet: 0.12,
}).connect(masterLimiter);

const lv7TickSynth = new Tone.Synth({
  oscillator: { type: "sine4" },
  envelope: { attack: 0.004, decay: 0.07, sustain: 0.02, release: 0.13 },
  volume: -15,
}).connect(lv7TickDelay);

const lv7SuccessSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.006, decay: 0.1, sustain: 0.08, release: 0.24 },
  volume: -13,
}).connect(masterLimiter);

const lv7FailSynth = new Tone.Synth({
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.1, sustain: 0, release: 0.16 },
  volume: -12,
}).connect(masterLimiter);

export function playLv7TickSound(step = 0) {
  if (!canPlaySound()) return;
  const notes = ["C6", "D6", "C6", "E6"];
  const startTime = getStrictStartTime("lv7-tick", 0.055);
  lv7TickSynth.triggerAttackRelease(notes[step % notes.length], 0.075, startTime, 0.42);
}

export function playLv7SuccessSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [
    ["E5", "A5"],
    ["F#5", "B5"],
    ["G5", "C6"],
    ["A5", "D6"],
    ["B5", "E6"],
  ];
  const startTime = getStrictStartTime("lv7-success", 0.08);
  lv7SuccessSynth.triggerAttackRelease(chords[step % chords.length], 0.16, startTime, 0.56);
}

export function playLv7FailSound(step = 0) {
  if (!canPlaySound()) return;
  const notes = ["D3", "C#3", "C3"];
  const startTime = getStrictStartTime("lv7-fail", 0.06);
  lv7FailSynth.triggerAttackRelease(notes[step % notes.length], 0.13, startTime, 0.5);
}


