import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const room = new Tone.Reverb({ decay: 2.4, wet: 0.2 }).connect(masterLimiter);
const delay = new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.12, wet: 0.12 }).connect(room);
const memorySynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.008, decay: 0.22, sustain: 0.08, release: 0.58 },
  volume: -15,
}).connect(delay);
const touchSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.004, decay: 0.14, sustain: 0.08, release: 0.48 },
  volume: -14,
}).connect(room);
const failFilter = new Tone.Filter({ type: "lowpass", frequency: 720, rolloff: -12 }).connect(masterLimiter);
const failSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.18, sustain: 0.02, release: 0.42 },
  volume: -16,
}).connect(failFilter);
const transitionSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine4" },
  envelope: { attack: 0.02, decay: 0.28, sustain: 0.12, release: 0.9 },
  volume: -17,
}).connect(room);
const finishSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.008, decay: 0.28, sustain: 0.16, release: 1.25 },
  volume: -14,
}).connect(room);

const memoryNotes = ["C5", "D5", "E5", "G5", "A5", "C6"];

export function playLv20MemorySound(index = 0, round = 0) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv20-memory", 0.06);
  const root = memoryNotes[(index + round) % memoryNotes.length];
  const upper = Tone.Frequency(root).transpose(7).toNote();
  memorySynth.triggerAttackRelease([root, upper], 0.25, time, 0.42);
}

export function playLv20TouchSound(index = 0, round = 0) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv20-touch", 0.06);
  const root = memoryNotes[(index + round + 1) % memoryNotes.length];
  touchSynth.triggerAttackRelease([root, Tone.Frequency(root).transpose(12).toNote()], 0.22, time, 0.5);
}

export function playLv20FailSound(index = 0) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv20-fail", 0.09);
  const notes = ["Eb4", "D4", "Db4", "C4"];
  failSynth.triggerAttackRelease([notes[index % notes.length], "Ab3"], 0.24, time, 0.36);
}

export function playLv20TransitionSound(round = 0) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv20-transition", 0.15);
  const chords = [["C4", "G4", "D5"], ["D4", "A4", "E5"], ["E4", "B4", "F#5"]];
  transitionSynth.triggerAttackRelease(chords[round % chords.length], 0.48, time, 0.38);
}

export function playLv20FinishSound(success = true) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv20-finish", 0.16);
  const notes = success ? ["C5", "E5", "G5", "B5", "D6", "G6"] : ["A4", "C5", "E5", "B4"];
  notes.forEach((note, index) => finishSynth.triggerAttackRelease(note, success ? 0.38 : 0.28, time + index * 0.075, 0.46));
  lastStartTimes.set("lv20-finish", time + (notes.length - 1) * 0.075);
}

export function stopLv20Sounds() {
  try {
    memorySynth.releaseAll();
    touchSynth.releaseAll();
    failSynth.releaseAll();
    transitionSynth.releaseAll();
    finishSynth.releaseAll();
  } catch {
    // 페이지 전환 중 오디오 컨텍스트가 닫혀도 안전하게 정리합니다.
  }
}
