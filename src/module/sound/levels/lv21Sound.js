import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const castanetRoom = new Tone.Reverb({ decay: 1.15, wet: 0.11 }).connect(masterLimiter);
const castanetTone = new Tone.Filter({ type: "bandpass", frequency: 2250, Q: 0.9 }).connect(castanetRoom);
const castanetBody = new Tone.Filter({ type: "bandpass", frequency: 880, Q: 1.25 }).connect(masterLimiter);

const shellClick = new Tone.NoiseSynth({
  noise: { type: "pink" },
  envelope: { attack: 0.0008, decay: 0.028, sustain: 0, release: 0.018 },
  volume: -13,
}).connect(castanetTone);

const woodBody = new Tone.MembraneSynth({
  pitchDecay: 0.012,
  octaves: 1.15,
  oscillator: { type: "sine" },
  envelope: { attack: 0.0008, decay: 0.052, sustain: 0, release: 0.025 },
  volume: -19,
}).connect(castanetBody);

const rimAccent = new Tone.Synth({
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.0007, decay: 0.024, sustain: 0, release: 0.015 },
  volume: -24,
}).connect(castanetRoom);

const dealRoom = new Tone.Reverb({ decay: 1.7, wet: 0.16 }).connect(masterLimiter);
const dealSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.006, decay: 0.11, sustain: 0.02, release: 0.28 },
  volume: -18,
}).connect(dealRoom);
const failSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.18, sustain: 0.01, release: 0.34 },
  volume: -17,
}).connect(masterLimiter);
const finishSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.008, decay: 0.26, sustain: 0.12, release: 1.05 },
  volume: -15,
}).connect(dealRoom);

const dealNotes = ["C5", "E5", "G5", "B5"];
const laneBodyPitches = [214, 228, 242, 258];
const laneRimNotes = ["D6", "E6", "F#6", "A6"];

export function playLv21CastanetSound(tapIndex = 0, laneIndex = 0) {
  if (!canPlaySound()) return;

  const safeLane = Math.abs(laneIndex) % 4;
  const accentStep = Math.abs(tapIndex) % 4;
  const time = getStrictStartTime("lv21-castanet", 0.038);
  const velocity = accentStep === 0 ? 0.72 : 0.58;

  castanetTone.frequency.setValueAtTime(2050 + safeLane * 145 + accentStep * 55, time);
  castanetBody.frequency.setValueAtTime(760 + safeLane * 75, time);

  shellClick.triggerAttackRelease(0.032, time, velocity);
  woodBody.triggerAttackRelease(laneBodyPitches[safeLane] + accentStep * 3, "64n", time + 0.0025, 0.38);
  rimAccent.triggerAttackRelease(laneRimNotes[safeLane], "128n", time + 0.006, accentStep === 0 ? 0.24 : 0.16);

  lastStartTimes.set("lv21-castanet", time + 0.006);
}

export function playLv21DealSound(laneIndex = 0) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv21-deal", 0.08);
  dealSynth.triggerAttackRelease([dealNotes[laneIndex % 4], "C6"], 0.12, time, 0.34);
}

export function playLv21FailSound() {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv21-fail", 0.12);
  failSynth.triggerAttackRelease(["Db4", "Ab3"], 0.22, time, 0.32);
}

export function playLv21FinishSound(success = true) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv21-finish", 0.16);
  const notes = success ? ["C5", "E5", "G5", "B5", "D6", "G6"] : ["A4", "C5", "E5", "B4"];
  notes.forEach((note, index) => finishSynth.triggerAttackRelease(note, success ? 0.36 : 0.26, time + index * 0.075, 0.44));
  lastStartTimes.set("lv21-finish", time + (notes.length - 1) * 0.075);
}

export function stopLv21Sounds() {
  try {
    dealSynth.releaseAll();
    failSynth.releaseAll();
    finishSynth.releaseAll();
    rimAccent.triggerRelease();
  } catch {
    // 페이지 전환 중에도 안전하게 정리합니다.
  }
}
