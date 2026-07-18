import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const lv11MelodyDelay = new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.16, wet: 0.2 }).connect(masterLimiter);
const lv11MelodySynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.004, decay: 0.12, sustain: 0.08, release: 0.38 },
  volume: -14,
}).connect(lv11MelodyDelay);
const lv11SuccessSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.004, decay: 0.14, sustain: 0.12, release: 0.48 },
  volume: -12,
}).connect(masterLimiter);
const lv11FailSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.12, sustain: 0.02, release: 0.28 },
  volume: -14,
}).connect(masterLimiter);

export function playLv11MelodySound(pitch = 0, order = 0, echo = false) {
  if (!canPlaySound()) return;
  const notes = ["C5", "D5", "E5", "G5", "A5", "C6"];
  const note = notes[pitch % notes.length];
  const startTime = getStrictStartTime(echo ? "lv11-echo" : "lv11-melody", 0.035);
  lv11MelodySynth.triggerAttackRelease(note, order % 3 === 1 ? 0.11 : 0.16, startTime, echo ? 0.46 : 0.56);
}

export function playLv11SuccessSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["E5","A5","C6"],["F#5","B5","D6"],["G5","C6","E6"]];
  const startTime = getStrictStartTime("lv11-success", 0.075);
  lv11SuccessSynth.triggerAttackRelease(chords[step % chords.length], 0.24, startTime, 0.56);
}

export function playLv11FailSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["G3","Db4"],["F#3","C4"],["F3","B3"]];
  const startTime = getStrictStartTime("lv11-fail", 0.065);
  lv11FailSynth.triggerAttackRelease(chords[step % chords.length], 0.16, startTime, 0.42);
}


