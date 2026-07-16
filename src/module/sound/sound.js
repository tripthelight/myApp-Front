import * as Tone from "tone";

let soundReady = false;
let soundStartPromise = null;
let soundUnlockBound = false;

const masterLimiter = new Tone.Limiter(-8).toDestination();

const startSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: {
    attack: 0.01,
    decay: 0.14,
    sustain: 0.18,
    release: 0.28,
  },
  volume: -10,
}).connect(masterLimiter);

const appearSynth = new Tone.Synth({
  oscillator: { type: "sine" },
  envelope: {
    attack: 0.004,
    decay: 0.08,
    sustain: 0.08,
    release: 0.16,
  },
  volume: -11,
}).connect(masterLimiter);


const lv5BlinkSynth = new Tone.Synth({
  oscillator: { type: "sine" },
  envelope: {
    attack: 0.006,
    decay: 0.1,
    sustain: 0.08,
    release: 0.2,
  },
  volume: -11,
}).connect(masterLimiter);

const overlapSynth = new Tone.Synth({
  oscillator: { type: "sine" },
  envelope: {
    attack: 0.008,
    decay: 0.12,
    sustain: 0.06,
    release: 0.22,
  },
  volume: -12,
}).connect(masterLimiter);

const okSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine" },
  envelope: {
    attack: 0.004,
    decay: 0.08,
    sustain: 0.12,
    release: 0.18,
  },
  volume: -9,
}).connect(masterLimiter);

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

const lv12ApproachDelay = new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.14, wet: 0.18 }).connect(masterLimiter);
const lv12ApproachSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.006, decay: 0.12, sustain: 0.05, release: 0.4 },
  volume: -16,
}).connect(lv12ApproachDelay);
const lv12SlashNoise = new Tone.NoiseSynth({
  noise: { type: "pink" },
  envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.1 },
  volume: -23,
}).connect(masterLimiter);
const lv12SuccessSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.004, decay: 0.13, sustain: 0.1, release: 0.48 },
  volume: -12,
}).connect(masterLimiter);
const lv12FailFilter = new Tone.Filter({ frequency: 760, type: "lowpass", rolloff: -12 }).connect(masterLimiter);
const lv12FailSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.14, sustain: 0.02, release: 0.3 },
  volume: -14,
}).connect(lv12FailFilter);


const lv13NodeDelay = new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.16, wet: 0.2 }).connect(masterLimiter);
const lv13NodeSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.008, decay: 0.15, sustain: 0.06, release: 0.46 },
  volume: -16,
}).connect(lv13NodeDelay);
const lv13SpinNoise = new Tone.NoiseSynth({
  noise: { type: "pink" },
  envelope: { attack: 0.003, decay: 0.1, sustain: 0, release: 0.12 },
  volume: -27,
}).connect(masterLimiter);
const lv13SpinSynth = new Tone.Synth({
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.004, decay: 0.11, sustain: 0.03, release: 0.25 },
  volume: -16,
}).connect(masterLimiter);
const lv13SuccessSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.005, decay: 0.14, sustain: 0.11, release: 0.52 },
  volume: -12,
}).connect(masterLimiter);
const lv13FailFilter = new Tone.Filter({ frequency: 820, type: "lowpass", rolloff: -12 }).connect(masterLimiter);
const lv13FailSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.15, sustain: 0.02, release: 0.3 },
  volume: -14,
}).connect(lv13FailFilter);

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

let lv6HoldActive = false;

const failSynth = new Tone.Synth({
  oscillator: { type: "triangle" },
  envelope: {
    attack: 0.004,
    decay: 0.06,
    sustain: 0,
    release: 0.12,
  },
  volume: -8,
}).connect(masterLimiter);

function isUserGestureActive() {
  return navigator.userActivation?.isActive === true;
}

function isAudioRunning() {
  return Tone.context.state === "running";
}

export async function readySound() {
  if (soundReady && isAudioRunning()) {
    return true;
  }

  if (isAudioRunning()) {
    soundReady = true;
    return true;
  }

  if (!isUserGestureActive()) {
    return false;
  }

  if (soundStartPromise) {
    return soundStartPromise;
  }

  soundStartPromise = Tone.start()
    .then(() => {
      soundReady = isAudioRunning();
      return soundReady;
    })
    .catch(() => false)
    .finally(() => {
      soundStartPromise = null;
    });

  return soundStartPromise;
}

export function unlockSoundOnNextGesture() {
  if (soundReady || soundUnlockBound) {
    return;
  }

  const unlock = async () => {
    const ok = await readySound();

    if (ok) {
      window.removeEventListener("pointerdown", unlock);
      soundUnlockBound = false;
    }
  };

  soundUnlockBound = true;
  window.addEventListener("pointerdown", unlock);
}

function canPlaySound() {
  return soundReady && isAudioRunning();
}

/*
 * Tone.Synth는 같은 시각이나 이전 시각으로 연속 재생을 예약하면
 * "Start time must be strictly greater than previous start time" 오류가 발생한다.
 *
 * 각 사운드 채널의 마지막 예약 시각을 저장하고,
 * 다음 사운드는 반드시 그 시각보다 뒤에 예약한다.
 */
const lastStartTimes = new Map();

function safeNow(offset = 0.02) {
  return Tone.now() + offset;
}

function getStrictStartTime(channel, gapSeconds = 0.025) {
  const currentTime = safeNow();
  const previousTime = lastStartTimes.get(channel) ?? -Infinity;

  const startTime = Math.max(
    currentTime,
    previousTime + gapSeconds,
  );

  lastStartTimes.set(channel, startTime);

  return startTime;
}

export function playStartSound() {
  if (!canPlaySound()) {
    return;
  }

  const startTime = getStrictStartTime("start", 0.16);

  startSynth.triggerAttackRelease(
    "C4",
    0.1,
    startTime,
  );

  startSynth.triggerAttackRelease(
    "G4",
    0.14,
    startTime + 0.07,
  );

  startSynth.triggerAttackRelease(
    "C5",
    0.18,
    startTime + 0.14,
  );

  lastStartTimes.set(
    "start",
    startTime + 0.14,
  );
}

export function playCircleAppearSound(step = 0) {
  if (!canPlaySound()) {
    return;
  }

  const notes = [
    "E5",
    "G5",
    "A5",
    "C6",
  ];

  const note = notes[step % notes.length];
  const startTime = getStrictStartTime("appear", 0.03);

  appearSynth.triggerAttackRelease(
    note,
    0.11,
    startTime,
  );
}

export function playTouchDotAppearSound(step = 0) {
  if (!canPlaySound()) {
    return;
  }

  const notes = [
    "D5",
    "F5",
    "A5",
    "D6",
  ];

  const note = notes[step % notes.length];
  const startTime = getStrictStartTime("appear", 0.03);

  appearSynth.triggerAttackRelease(
    note,
    0.13,
    startTime,
  );
}

export function playOverlapAppearSound(step = 0) {
  if (!canPlaySound()) {
    return;
  }

  const notes = ["C5", "E5", "G5", "B5", "D6", "A5"];
  const startTime = getStrictStartTime("overlap", 0.055);

  overlapSynth.triggerAttackRelease(
    notes[step % notes.length],
    0.16,
    startTime,
  );
}

export function playOkSound() {
  if (!canPlaySound()) {
    return;
  }

  const startTime = getStrictStartTime("ok", 0.08);

  okSynth.triggerAttackRelease(
    "E5",
    0.08,
    startTime,
  );

  okSynth.triggerAttackRelease(
    "A5",
    0.16,
    startTime + 0.055,
  );

  lastStartTimes.set(
    "ok",
    startTime + 0.055,
  );
}

export function playFailSound() {
  if (!canPlaySound()) {
    return;
  }

  const startTime = getStrictStartTime("fail", 0.03);

  failSynth.triggerAttackRelease(
    "C3",
    0.13,
    startTime,
  );
}

export function playLv5BlinkSound(step = 0) {
  if (!canPlaySound()) {
    return;
  }

  const notes = ["C5", "E5", "G5", "B5", "D6", "A5"];
  const startTime = getStrictStartTime("lv5-blink", 0.04);

  lv5BlinkSynth.triggerAttackRelease(
    notes[step % notes.length],
    0.14,
    startTime,
  );
}

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


export function playLv12ApproachSound(step = 0, pair = false) {
  if (!canPlaySound()) return;
  const notes = ["C5", "D5", "E5", "G5", "A5", "B5"];
  const startTime = getStrictStartTime("lv12-approach", 0.05);
  lv12ApproachSynth.triggerAttackRelease(notes[step % notes.length], pair ? 0.15 : 0.11, startTime, pair ? 0.5 : 0.42);
  if (pair) lv12ApproachSynth.triggerAttackRelease(notes[(step + 2) % notes.length], 0.11, startTime + 0.075, 0.34);
}

export function playLv12SuccessSound(step = 0, pair = false) {
  if (!canPlaySound()) return;
  const chords = [["E5", "A5", "C6"], ["F#5", "B5", "D6"], ["G5", "C6", "E6"], ["A5", "D6", "F#6"]];
  const startTime = getStrictStartTime("lv12-success", 0.085);
  lv12SlashNoise.triggerAttackRelease(pair ? 0.14 : 0.1, startTime, pair ? 0.32 : 0.25);
  lv12SuccessSynth.triggerAttackRelease(chords[step % chords.length], pair ? 0.3 : 0.24, startTime + 0.018, pair ? 0.62 : 0.54);
}

export function playLv12FailSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["G3", "Db4"], ["F#3", "C4"], ["F3", "B3"]];
  const startTime = getStrictStartTime("lv12-fail", 0.075);
  lv12FailSynth.triggerAttackRelease(chords[step % chords.length], 0.2, startTime, 0.44);
}


export function playLv13NodeSound(step = 0, snake = false) {
  if (!canPlaySound()) return;
  const notes = ["C5", "D5", "E5", "G5", "A5", "B5"];
  const startTime = getStrictStartTime("lv13-node", 0.055);
  lv13NodeSynth.triggerAttackRelease(notes[step % notes.length], snake ? 0.18 : 0.12, startTime, snake ? 0.48 : 0.4);
  if (snake) lv13NodeSynth.triggerAttackRelease(notes[(step + 3) % notes.length], 0.12, startTime + 0.09, 0.3);
}

export function playLv13SpinSound(direction = "right", power = 0.5) {
  if (!canPlaySound()) return;
  const startTime = getStrictStartTime("lv13-spin", 0.05);
  const note = direction === "left" ? "D5" : "A5";
  lv13SpinNoise.triggerAttackRelease(0.09, startTime, 0.14 + power * 0.12);
  lv13SpinSynth.triggerAttackRelease(note, 0.11, startTime + 0.012, 0.28 + power * 0.18);
}

export function playLv13SuccessSound(step = 0, snake = false) {
  if (!canPlaySound()) return;
  const chords = [["E5", "A5", "C6"], ["F#5", "B5", "D6"], ["G5", "C6", "E6"], ["A5", "D6", "F#6"]];
  const startTime = getStrictStartTime("lv13-success", 0.085);
  lv13SuccessSynth.triggerAttackRelease(chords[step % chords.length], snake ? 0.31 : 0.25, startTime, snake ? 0.62 : 0.54);
}

export function playLv13FailSound(step = 0) {
  if (!canPlaySound()) return;
  const chords = [["G3", "Db4"], ["F#3", "C4"], ["F3", "B3"]];
  const startTime = getStrictStartTime("lv13-fail", 0.075);
  lv13FailSynth.triggerAttackRelease(chords[step % chords.length], 0.2, startTime, 0.43);
}


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
