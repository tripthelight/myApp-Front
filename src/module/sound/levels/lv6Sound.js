import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const lv6TapDelay = new Tone.FeedbackDelay({
  delayTime: "16n",
  feedback: 0.12,
  wet: 0.16,
}).connect(masterLimiter);

const lv6TapSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: {
    attack: 0.008,
    decay: 0.12,
    sustain: 0.16,
    release: 0.34,
  },
  volume: -13,
}).connect(lv6TapDelay);

const lv6HoldFilter = new Tone.Filter({
  frequency: 1300,
  type: "lowpass",
  rolloff: -12,
}).connect(masterLimiter);

const lv6HoldSynth = new Tone.MonoSynth({
  oscillator: { type: "sine4" },
  filterEnvelope: {
    attack: 0.08,
    decay: 0.18,
    sustain: 0.45,
    release: 0.4,
    baseFrequency: 240,
    octaves: 2.4,
  },
  envelope: {
    attack: 0.045,
    decay: 0.18,
    sustain: 0.42,
    release: 0.38,
  },
  volume: -16,
}).connect(lv6HoldFilter);

const lv6FailSynth = new Tone.MembraneSynth({
  pitchDecay: 0.05,
  octaves: 2,
  oscillator: { type: "sine" },
  envelope: {
    attack: 0.002,
    decay: 0.12,
    sustain: 0,
    release: 0.15,
  },
  volume: -13,
}).connect(masterLimiter);

let lv6HoldActive = false;

export function playLv6TapSound(step = 0) {
  if (!canPlaySound()) {
    return;
  }

  const chords = [
    ["C4", "G4", "D5"],
    ["D4", "A4", "E5"],
    ["E4", "B4", "F#5"],
    ["G4", "D5", "A5"],
  ];
  const startTime = getStrictStartTime("lv6-tap", 0.075);

  lv6TapSynth.triggerAttackRelease(
    chords[step % chords.length],
    0.18,
    startTime,
    0.62,
  );
}

export function startLv6HoldSound(step = 0) {
  if (!canPlaySound()) {
    return;
  }

  if (lv6HoldActive) {
    lv6HoldSynth.triggerRelease(safeNow(0.005));
  }

  const notes = ["C3", "D3", "E3", "G3", "A3"];
  const startTime = getStrictStartTime("lv6-hold", 0.06);
  lv6HoldSynth.triggerAttack(notes[step % notes.length], startTime, 0.48);
  lv6HoldActive = true;
}

export function stopLv6HoldSound() {
  if (!lv6HoldActive || !canPlaySound()) {
    lv6HoldActive = false;
    return;
  }

  lv6HoldSynth.triggerRelease(safeNow(0.04));
  lv6HoldActive = false;
}

export function playLv6FailSound() {
  if (!canPlaySound()) {
    return;
  }

  const startTime = getStrictStartTime("lv6-fail", 0.055);
  lv6FailSynth.triggerAttackRelease("G2", 0.12, startTime, 0.52);
}


