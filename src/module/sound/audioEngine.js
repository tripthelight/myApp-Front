import * as Tone from "tone";

let soundReady = false;
let soundStartPromise = null;
let soundUnlockBound = false;

export { Tone };
export const masterLimiter = new Tone.Limiter(-8).toDestination();

const startSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.01, decay: 0.14, sustain: 0.18, release: 0.28 },
  volume: -10,
}).connect(masterLimiter);

function isUserGestureActive() { return navigator.userActivation?.isActive === true; }
function isAudioRunning() { return Tone.context.state === "running"; }

export async function readySound() {
  if (soundReady && isAudioRunning()) return true;
  if (isAudioRunning()) { soundReady = true; return true; }
  if (!isUserGestureActive()) return false;
  if (soundStartPromise) return soundStartPromise;
  soundStartPromise = Tone.start().then(() => {
    soundReady = isAudioRunning();
    return soundReady;
  }).catch(() => false).finally(() => { soundStartPromise = null; });
  return soundStartPromise;
}

export function unlockSoundOnNextGesture() {
  if (soundReady || soundUnlockBound) return;
  const unlock = async () => {
    const ok = await readySound();
    if (ok) { window.removeEventListener("pointerdown", unlock); soundUnlockBound = false; }
  };
  soundUnlockBound = true;
  window.addEventListener("pointerdown", unlock);
}

export function canPlaySound() { return soundReady && isAudioRunning(); }
export const lastStartTimes = new Map();
export function getStrictStartTime(channel, gapSeconds = 0.025) {
  const currentTime = Tone.now() + 0.02;
  const previousTime = lastStartTimes.get(channel) ?? -Infinity;
  const startTime = Math.max(currentTime, previousTime + gapSeconds);
  lastStartTimes.set(channel, startTime);
  return startTime;
}

export function playStartSound() {
  if (!canPlaySound()) return;
  const startTime = getStrictStartTime("start", 0.16);
  startSynth.triggerAttackRelease("C4", 0.1, startTime);
  startSynth.triggerAttackRelease("G4", 0.14, startTime + 0.07);
  startSynth.triggerAttackRelease("C5", 0.18, startTime + 0.14);
  lastStartTimes.set("start", startTime + 0.14);
}
