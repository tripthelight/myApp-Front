import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const room = new Tone.Reverb({ decay: 1.1, wet: 0.11 }).connect(masterLimiter);

const laneSynths = [
  new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.008, decay: 0.16, sustain: 0.08, release: 0.3 },
    volume: -13,
  }).connect(room),
  new Tone.Synth({
    oscillator: { type: "triangle8" },
    envelope: { attack: 0.006, decay: 0.14, sustain: 0.06, release: 0.27 },
    volume: -15,
  }).connect(room),
  new Tone.Synth({
    oscillator: { type: "square4" },
    envelope: { attack: 0.004, decay: 0.11, sustain: 0.035, release: 0.22 },
    volume: -21,
  }).connect(room),
];

const judgeSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.1, sustain: 0.02, release: 0.2 },
  volume: -19,
}).connect(room);

const failSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "square8" },
  envelope: { attack: 0.003, decay: 0.075, sustain: 0.01, release: 0.12 },
  volume: -27,
}).connect(masterLimiter);

const LANE_NOTES = ["C4", "E4", "G4"];

export function playLv26Lane(lane, emphasis = false) {
  if (!canPlaySound()) return;
  const safeLane = Math.max(0, Math.min(2, Number(lane) || 0));
  const time = getStrictStartTime(`lv26-lane-${safeLane}`, 0.09);
  laneSynths[safeLane].triggerAttackRelease(
    LANE_NOTES[safeLane],
    emphasis ? 0.34 : 0.24,
    time,
    emphasis ? 0.72 : 0.56,
  );
}

export function playLv26Success() {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv26-success", 0.1);
  judgeSynth.triggerAttackRelease(["C6", "E6"], 0.1, time, 0.18);
}

export function playLv26Fail() {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv26-fail", 0.12);
  failSynth.triggerAttackRelease(["F#3", "C4"], 0.11, time, 0.18);
}

export function playLv26Finish(success) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv26-finish", 0.15);
  const notes = success ? ["C5", "E5", "G5", "C6"] : ["A4", "C5", "E5", "D5"];
  notes.forEach((note, index) => judgeSynth.triggerAttackRelease(note, 0.2, time + index * 0.075, 0.28));
  lastStartTimes.set("lv26-finish", time + (notes.length - 1) * 0.075);
}

export function stopLv26Sounds() {
  try {
    laneSynths.forEach((synth) => synth.triggerRelease());
    judgeSynth.releaseAll();
    failSynth.releaseAll();
  } catch {
    // 페이지 전환 중에도 안전하게 정리합니다.
  }
}
