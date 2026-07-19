import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const room = new Tone.Reverb({ decay: 1.35, wet: 0.14 }).connect(masterLimiter);
const typeSynth = new Tone.Synth({
  oscillator: { type: "sine" },
  envelope: { attack: 0.002, decay: 0.025, sustain: 0, release: 0.035 },
  volume: -26,
}).connect(room);
const cueSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.008, decay: 0.16, sustain: 0.08, release: 0.5 },
  volume: -16,
}).connect(room);
const accentSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.004, decay: 0.09, sustain: 0.04, release: 0.28 },
  volume: -15,
}).connect(room);
const failSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "square4" },
  envelope: { attack: 0.002, decay: 0.09, sustain: 0.01, release: 0.16 },
  volume: -21,
}).connect(masterLimiter);
const finishSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.006, decay: 0.18, sustain: 0.08, release: 0.65 },
  volume: -14,
}).connect(room);

const CUES = Object.freeze({
  tick: { notes: ["G5"], duration: 0.09, velocity: 0.34 },
  tickHigh: { notes: ["C6"], duration: 0.1, velocity: 0.36 },
  ding: { notes: ["C5", "G5"], duration: 0.22, velocity: 0.34 },
  dingHigh: { notes: ["E5", "B5"], duration: 0.24, velocity: 0.36 },
  dingRise: { notes: ["D5", "A5"], duration: 0.28, velocity: 0.38 },
  long: { notes: ["C5", "E5", "G5"], duration: 0.62, velocity: 0.34 },
  longLow: { notes: ["A4", "C5", "E5"], duration: 0.58, velocity: 0.33 },
  longHigh: { notes: ["D5", "F5", "A5"], duration: 0.58, velocity: 0.35 },
  print: { notes: ["G5", "C6"], duration: 0.11, velocity: 0.43, second: "E6" },
  printHigh: { notes: ["A5", "D6"], duration: 0.11, velocity: 0.44, second: "F#6" },
});

export function playLv23Type() {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv23-type", 0.022);
  typeSynth.triggerAttackRelease(Math.random() > 0.5 ? "C7" : "G6", 0.018, time, 0.12);
}

export function playLv23Step(cueName = "ding", phase = "watch") {
  if (!canPlaySound()) return;
  const cue = CUES[cueName] ?? CUES.ding;
  const time = getStrictStartTime("lv23-step", 0.08);
  const velocity = Math.min(0.5, cue.velocity + (phase === "play" ? 0.05 : 0));
  cueSynth.triggerAttackRelease(cue.notes, cue.duration, time, velocity);
  if (cue.second) {
    accentSynth.triggerAttackRelease(cue.second, 0.08, time + 0.13, velocity);
    lastStartTimes.set("lv23-step", time + 0.13);
  }
}

export function playLv23Count(value) {
  if (!canPlaySound()) return;
  const index = value === "GO" ? 3 : 3 - Number(value);
  const notes = ["C5", "E5", "G5", "C6"];
  const time = getStrictStartTime("lv23-count", 0.08);
  accentSynth.triggerAttackRelease(notes[index] ?? "C6", value === "GO" ? 0.2 : 0.12, time, value === "GO" ? 0.42 : 0.3);
}

export function playLv23Flow(step, velocity = 0.38) {
  playLv23Step(["ding", "dingHigh", "long", "print"][step % 4], velocity > 0.4 ? "play" : "watch");
}

export function playLv23Success(step) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv23-success", 0.065);
  const roots = ["C5", "D5", "E5", "G5", "A5", "B5"];
  const root = roots[step % roots.length];
  accentSynth.triggerAttackRelease(Tone.Frequency(root).transpose(12).toNote(), 0.12, time, 0.24);
}

export function playLv23Fail() {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv23-fail", 0.1);
  failSynth.triggerAttackRelease(["F#4", "C4"], 0.12, time, 0.28);
}

export function playLv23Finish(success) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv23-finish", 0.16);
  const notes = success ? ["C5", "E5", "G5", "B5", "D6"] : ["A4", "C5", "E5", "D5"];
  notes.forEach((note, index) => finishSynth.triggerAttackRelease(note, success ? 0.3 : 0.22, time + index * 0.075, 0.4));
  lastStartTimes.set("lv23-finish", time + (notes.length - 1) * 0.075);
}

export function stopLv23Sounds() {
  try {
    cueSynth.releaseAll();
    accentSynth.releaseAll();
    failSynth.releaseAll();
    finishSynth.releaseAll();
  } catch {
    // 페이지 전환 중에도 안전하게 정리합니다.
  }
}
