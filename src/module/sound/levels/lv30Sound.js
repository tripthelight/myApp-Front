import {
  Tone,
  canPlaySound,
  getStrictStartTime,
  lastStartTimes,
  masterLimiter,
  readySound,
} from "../audioEngine.js";

export { readySound };

const reverb = new Tone.Reverb({ decay: 2.8, preDelay: 0.025, wet: 0.28 }).connect(masterLimiter);
const delay = new Tone.FeedbackDelay({ delayTime: "16n", feedback: 0.15, wet: 0.14 }).connect(reverb);
const chime = new Tone.PolySynth(Tone.Synth, {
  maxPolyphony: 24,
  oscillator: { type: "sine8" },
  envelope: { attack: 0.006, decay: 0.34, sustain: 0.08, release: 1.1 },
  volume: -17,
}).connect(delay);

const NOTES = [
  "C4", "D4", "E4", "G4", "A4",
  "B4", "C5", "D5",
  "E5", "G5", "A5",
  "B5", "C6", "D6", "E6", "G6", "A6", "C7",
];

export async function playLv30Letter(index, source = "touch") {
  const ready = await readySound();
  if (!ready || !canPlaySound()) return false;

  const safeIndex = Math.min(NOTES.length - 1, Math.max(0, Number(index) || 0));
  const gap = source === "bloom" ? 0.035 : 0.06;
  const channel = source === "bloom" ? "lv30-bloom" : `lv30-touch-${safeIndex}`;
  const time = getStrictStartTime(channel, gap);
  const velocity = source === "bloom" ? 0.16 : 0.3;
  const duration = source === "bloom" ? 0.24 : 0.42;
  chime.triggerAttackRelease(NOTES[safeIndex], duration, time, velocity);
  return true;
}

export function playLv30Home() {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv30-home", 0.08);
  ["C5", "G5", "C6"].forEach((note, index) => {
    chime.triggerAttackRelease(note, 0.24, time + index * 0.055, 0.18);
  });
  lastStartTimes.set("lv30-home", time + 0.11);
}

export function stopLv30Sounds() {
  try {
    chime.releaseAll();
  } catch {
    // 페이지 전환 중에도 안전하게 정리합니다.
  }
}
