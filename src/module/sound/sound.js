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
  if (soundReady && isAudioRunning()) return true;

  if (isAudioRunning()) {
    soundReady = true;
    return true;
  }

  if (!isUserGestureActive()) return false;
  if (soundStartPromise) return soundStartPromise;

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
  if (soundReady || soundUnlockBound) return;

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

function safeNow(offset = 0.02) {
  return Tone.now() + offset;
}

export function playStartSound() {
  if (!canPlaySound()) return;

  const now = safeNow();

  startSynth.triggerAttackRelease("C4", 0.1, now);
  startSynth.triggerAttackRelease("G4", 0.14, now + 0.07);
  startSynth.triggerAttackRelease("C5", 0.18, now + 0.14);
}

export function playCircleAppearSound(step = 0) {
  if (!canPlaySound()) return;

  const notes = ["E5", "G5", "A5", "C6"];
  const note = notes[step % notes.length];

  appearSynth.triggerAttackRelease(note, 0.11, safeNow());
}

export function playOkSound() {
  if (!canPlaySound()) return;

  const now = safeNow();

  okSynth.triggerAttackRelease("E5", 0.08, now);
  okSynth.triggerAttackRelease("A5", 0.16, now + 0.055);
}

export function playFailSound() {
  if (!canPlaySound()) return;

  failSynth.triggerAttackRelease("C3", 0.13, safeNow());
}