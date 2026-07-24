import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const room = new Tone.Reverb({ decay: 1.1, wet: 0.12 }).connect(masterLimiter);
const tickSynth = new Tone.MembraneSynth({
  pitchDecay: 0.025,
  octaves: 3,
  oscillator: { type: "sine" },
  envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.08 },
  volume: -22,
}).connect(room);
const hitSynth = new Tone.Synth({
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.003, decay: 0.09, sustain: 0.02, release: 0.16 },
  volume: -18,
}).connect(room);
const missSynth = new Tone.Synth({
  oscillator: { type: "square8" },
  envelope: { attack: 0.002, decay: 0.07, sustain: 0, release: 0.1 },
  volume: -29,
}).connect(masterLimiter);

export function playLv29Tick() {
  if (!canPlaySound()) return;
  tickSynth.triggerAttackRelease("C3", "32n", getStrictStartTime("lv29-tick", 0.05), 0.16);
}

const HIT_NOTES_BY_RING = ["C5", "E5", "G5", "C6"];

export function playLv29Judge(success, ringIndex = 0) {
  if (!canPlaySound()) return;

  if (success) {
    const safeRingIndex = Math.min(HIT_NOTES_BY_RING.length - 1, Math.max(0, ringIndex));
    const time = getStrictStartTime("lv29-hit", 0.065);
    hitSynth.triggerAttackRelease(HIT_NOTES_BY_RING[safeRingIndex], 0.11, time, 0.22);
    return;
  }

  const time = getStrictStartTime("lv29-miss", 0.12);
  missSynth.triggerAttackRelease("D#3", 0.075, time, 0.14);
  missSynth.triggerAttackRelease("A2", 0.11, time + 0.065, 0.12);
  lastStartTimes.set("lv29-miss", time + 0.065);
}

export function playLv29Finish(success) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv29-finish", 0.18);
  const notes = success ? ["C5", "E5", "G5", "C6"] : ["A4", "C5", "E5", "D5"];
  notes.forEach((note, index) => hitSynth.triggerAttackRelease(note, 0.16, time + index * 0.085, 0.2));
  lastStartTimes.set("lv29-finish", time + (notes.length - 1) * 0.085);
}

export function stopLv29Sounds() {
  try {
    tickSynth.triggerRelease();
    hitSynth.triggerRelease();
    missSynth.triggerRelease();
  } catch {
    // 페이지 전환 중에도 안전하게 정리합니다.
  }
}
