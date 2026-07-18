import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const lv17Room = new Tone.Reverb({ decay: 1.5, wet: 0.16 }).connect(masterLimiter);
const lv17AppearSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.006, decay: 0.16, sustain: 0.06, release: 0.55 },
  volume: -16,
}).connect(lv17Room);
const lv17WallSynth = new Tone.MembraneSynth({
  pitchDecay: 0.025, octaves: 2.2, oscillator: { type: "sine" },
  envelope: { attack: 0.002, decay: 0.09, sustain: 0, release: 0.12 }, volume: -20,
}).connect(masterLimiter);
const lv17FloorSynth = new Tone.MembraneSynth({
  pitchDecay: 0.045, octaves: 3.2, oscillator: { type: "sine" },
  envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.24 }, volume: -14,
}).connect(lv17Room);
const lv17SuccessSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.004, decay: 0.16, sustain: 0.1, release: 0.62 }, volume: -14,
}).connect(lv17Room);
const lv17FailFilter = new Tone.Filter({ frequency: 760, type: "lowpass", rolloff: -12 }).connect(masterLimiter);
const lv17FailSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.13, sustain: 0.01, release: 0.3 }, volume: -15,
}).connect(lv17FailFilter);

export function playLv17AppearSound(index = 0) {
  if (!canPlaySound()) return;
  const chords = [["C5","E5"],["D5","F5"],["E5","G5"],["G5","B5"],["A5","C6"]];
  const t = getStrictStartTime("lv17-appear", 0.08);
  lv17AppearSynth.triggerAttackRelease(chords[index % chords.length], 0.28, t, 0.34);
}

export function playLv17WallSound(index = 0, wall = "left") {
  if (!canPlaySound()) return;
  const notes = wall === "top" ? ["G3","A3","B3"] : ["C3","D3","E3"];
  lv17WallSynth.triggerAttackRelease(notes[index % notes.length], 0.08, getStrictStartTime("lv17-wall", 0.028), 0.22);
}

export function playLv17FloorSound(index = 0) {
  if (!canPlaySound()) return;
  lv17FloorSynth.triggerAttackRelease(["C2","D2","E2","G2","A2"][index % 5], 0.16, getStrictStartTime("lv17-floor", 0.045), 0.48);
}

export function playLv17SuccessSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["E5","A5","C6"],["F#5","B5","D6"],["G5","C6","E6"],["A5","D6","F#6"]];
  const t = getStrictStartTime("lv17-success", 0.075);
  lv17SuccessSynth.triggerAttackRelease(chords[step % chords.length], 0.32, t, 0.5);
  lv17SuccessSynth.triggerAttackRelease(chords[step % chords.length][2], 0.18, t + 0.13, 0.2);
}

export function playLv17FailSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["G3","Db4"],["F#3","C4"],["F3","B3"]];
  lv17FailSynth.triggerAttackRelease(chords[step % chords.length], 0.2, getStrictStartTime("lv17-fail", 0.065), 0.34);
}

export function playLv17FinishSound(success = true) {
  if (!canPlaySound()) return;
  const t = getStrictStartTime("lv17-finish", 0.1);
  const chord = success ? ["C5","E5","G5","B5"] : ["D4","F4","Ab4"];
  lv17SuccessSynth.triggerAttackRelease(chord, success ? 0.7 : 0.42, t, success ? 0.5 : 0.3);
}

export function stopLv17Sounds() {
  const now = Tone.now();
  lv17AppearSynth.releaseAll(now);
  lv17SuccessSynth.releaseAll(now);
  lv17FailSynth.releaseAll(now);
}

