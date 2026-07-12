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

