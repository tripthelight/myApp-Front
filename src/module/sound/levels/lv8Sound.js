import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const lv8SoftDelay = new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.14, wet: 0.18 }).connect(masterLimiter);

const lv8SoftSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine4" },
  envelope: { attack: 0.008, decay: 0.16, sustain: 0.07, release: 0.42 },
  volume: -16,
}).connect(lv8SoftDelay);

const lv8AccentSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.006, decay: 0.18, sustain: 0.1, release: 0.5 },
  volume: -13,
}).connect(masterLimiter);

const lv8HitSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.004, decay: 0.12, sustain: 0.12, release: 0.42 },
  volume: -11,
}).connect(masterLimiter);

const lv8FailSynth = new Tone.MembraneSynth({
  pitchDecay: 0.08, octaves: 2.2, oscillator: { type: "sine" },
  envelope: { attack: 0.003, decay: 0.18, sustain: 0, release: 0.2 },
  volume: -14,
}).connect(masterLimiter);

export function playLv8SoftSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["C4", "G4"], ["D4", "A4"], ["E4", "B4"], ["F4", "C5"]];
  lv8SoftSynth.triggerAttackRelease(chords[step % chords.length], 0.2, getStrictStartTime("lv8-soft", 0.07), 0.38);
}

export function playLv8AccentSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["C4", "G4", "C5"], ["D4", "A4", "D5"], ["E4", "B4", "E5"]];
  lv8AccentSynth.triggerAttackRelease(chords[step % chords.length], 0.28, getStrictStartTime("lv8-accent", 0.085), 0.48);
}

export function playLv8HitSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["E5", "G5", "C6"], ["F5", "A5", "D6"], ["G5", "B5", "E6"]];
  lv8HitSynth.triggerAttackRelease(chords[step % chords.length], 0.3, getStrictStartTime("lv8-hit", 0.09), 0.58);
}

export function playLv8FailSound(step = 0) {
  if (!canPlaySound()) return;
  const notes = ["G2", "F#2", "F2"];
  lv8FailSynth.triggerAttackRelease(notes[step % notes.length], 0.15, getStrictStartTime("lv8-fail", 0.07), 0.48);
}


