import * as Tone from "tone";

let soundReady = false;
let soundStartPromise = null;
let soundUnlockBound = false;

const startSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sawtooth" },
  envelope: {
    attack: 0.01,
    decay: 0.15,
    sustain: 0.2,
    release: 0.4,
  },
}).toDestination();

const okSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine" },
  envelope: {
    attack: 0.005,
    decay: 0.08,
    sustain: 0.15,
    release: 0.2,
  },
}).toDestination();

const failSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "square" },
  envelope: {
    attack: 0.005,
    decay: 0.05,
    sustain: 0,
    release: 0.08,
  },
}).toDestination();

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

export function playStartSound() {
  if (!canPlaySound()) return;

  const now = Tone.now() + 0.03;

  startSynth.triggerAttackRelease("C3", 0.12, now);
  startSynth.triggerAttackRelease("G3", 0.16, now + 0.08);
  startSynth.triggerAttackRelease("C4", 0.25, now + 0.16);
}

export function playOkSound() {
  if (!canPlaySound()) return;

  const now = Tone.now() + 0.03;

  okSynth.triggerAttackRelease("E5", 0.08, now);
  okSynth.triggerAttackRelease("A5", 0.16, now + 0.06);
}

export function playFailSound() {
  if (!canPlaySound()) return;

  failSynth.triggerAttackRelease("C3", 0.12, Tone.now() + 0.03);
}