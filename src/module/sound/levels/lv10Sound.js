import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const lv10WaveDelay = new Tone.FeedbackDelay({
  delayTime: "16n",
  feedback: 0.16,
  wet: 0.2,
}).connect(masterLimiter);

const lv10WaveSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.006, decay: 0.12, sustain: 0.05, release: 0.4 },
  volume: -15,
}).connect(lv10WaveDelay);

const lv10SwipeNoise = new Tone.NoiseSynth({
  noise: { type: "pink" },
  envelope: { attack: 0.003, decay: 0.16, sustain: 0, release: 0.12 },
  volume: -22,
}).connect(masterLimiter);

const lv10SwipeSynth = new Tone.Synth({
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.004, decay: 0.11, sustain: 0.02, release: 0.24 },
  volume: -15,
}).connect(masterLimiter);

const lv10CollisionFilter = new Tone.Filter({
  frequency: 720,
  type: "lowpass",
  rolloff: -12,
}).connect(masterLimiter);

const lv10CollisionSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.003, decay: 0.2, sustain: 0.03, release: 0.36 },
  volume: -13,
}).connect(lv10CollisionFilter);

export function playLv10WaveSound(order = 0, waveIndex = 0) {
  if (!canPlaySound()) return;
  const noteSets = [
    ["D5", "F5", "A5", "E5"],
    ["E5", "G5", "B5", "F#5"],
    ["F5", "A5", "C6", "G5"],
  ];
  const notes = noteSets[waveIndex % noteSets.length];
  const startTime = getStrictStartTime("lv10-wave", 0.045);
  const velocity = 0.44 + (order % 3) * 0.055;
  lv10WaveSynth.triggerAttackRelease(
    notes[order % notes.length],
    order % 3 === 1 ? 0.09 : 0.13,
    startTime,
    velocity,
  );
}

export function playLv10SwipeSound(power = 0.5) {
  if (!canPlaySound()) return;
  const normalized = Math.max(0, Math.min(power, 1));
  const startTime = getStrictStartTime("lv10-swipe", 0.055);
  const note = normalized > 0.62 ? "A5" : "E5";
  lv10SwipeSynth.triggerAttackRelease(note, 0.11 + normalized * 0.08, startTime, 0.34 + normalized * 0.28);
  lv10SwipeNoise.triggerAttackRelease(0.07 + normalized * 0.1, startTime + 0.012, 0.22 + normalized * 0.25);
}

export function playLv10CollisionSound(hitCount = 1) {
  if (!canPlaySound()) return;
  const startTime = getStrictStartTime("lv10-collision", 0.16);
  const root = hitCount % 2 === 0 ? "C3" : "D3";
  lv10CollisionSynth.triggerAttackRelease([root, "Ab3"], 0.24, startTime, 0.62);
  lv10CollisionSynth.triggerAttackRelease("Eb3", 0.16, startTime + 0.11, 0.38);
}


