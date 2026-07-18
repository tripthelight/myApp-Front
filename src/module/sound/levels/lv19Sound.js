import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

/* LEVEL 19 · color sequence memory rhythm */
const lv19Room = new Tone.Reverb({ decay: 1.9, wet: 0.18 }).connect(masterLimiter);
const lv19Delay = new Tone.FeedbackDelay({ delayTime: "32n", feedback: 0.1, wet: 0.13 }).connect(lv19Room);
const lv19SignalSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle8" },
  envelope: { attack: 0.006, decay: 0.2, sustain: 0.08, release: 0.55 },
  volume: -15,
}).connect(lv19Delay);
const lv19BeatSynth = new Tone.Synth({
  oscillator: { type: "sine4" },
  envelope: { attack: 0.003, decay: 0.08, sustain: 0.02, release: 0.16 },
  volume: -17,
}).connect(lv19Room);
const lv19SuccessSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.004, decay: 0.16, sustain: 0.1, release: 0.7 },
  volume: -14,
}).connect(lv19Room);
const lv19FailFilter = new Tone.Filter({ frequency: 760, type: "lowpass", rolloff: -12 }).connect(masterLimiter);
const lv19FailSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "triangle" },
  envelope: { attack: 0.004, decay: 0.15, sustain: 0.02, release: 0.34 },
  volume: -16,
}).connect(lv19FailFilter);
const lv19FinishSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "sine8" },
  envelope: { attack: 0.006, decay: 0.24, sustain: 0.13, release: 1.05 },
  volume: -14,
}).connect(lv19Room);

export function playLv19SelectSound(step = 0) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv19-select", 0.1);
  const chords = [["C4", "G4"], ["D4", "A4"], ["E4", "B4"], ["F4", "C5"]];
  lv19SignalSynth.triggerAttackRelease(chords[step % chords.length], 0.32, time, 0.5);
}

export function playLv19BeatSound(index = 0, step = 0) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv19-beat", 0.045);
  const notes = ["C5", "D5", "E5", "G5", "A5"];
  lv19BeatSynth.triggerAttackRelease(notes[(index + step) % notes.length], 0.09, time, 0.32);
}

export function playLv19SuccessSound(index = 0, step = 0) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv19-success", 0.085);
  const roots = ["C5", "D5", "E5", "G5", "A5"];
  const root = roots[index % roots.length];
  const upper = Tone.Frequency(root).transpose(7 + (step % 2) * 5).toNote();
  lv19SuccessSynth.triggerAttackRelease([root, upper], 0.24, time, 0.52);
}

export function playLv19FailSound(index = 0, step = 0) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv19-fail", 0.085);
  const notes = ["Eb4", "D4", "Db4", "C4"];
  lv19FailSynth.triggerAttackRelease([notes[step % notes.length], "Ab3"], 0.22, time, 0.34 + (index % 2) * 0.04);
}

export function playLv19FinishSound(success = true) {
  if (!canPlaySound()) return;
  const time = getStrictStartTime("lv19-finish", 0.13);
  const notes = success ? ["C5", "E5", "G5", "B5", "D6"] : ["A4", "C5", "E5"];
  notes.forEach((note, index) => {
    lv19FinishSynth.triggerAttackRelease(note, success ? 0.34 : 0.24, time + index * 0.075, 0.48);
  });
  lastStartTimes.set("lv19-finish", time + (notes.length - 1) * 0.075);
}

export function stopLv19Sounds() {
  try {
    lv19SignalSynth.releaseAll();
    lv19SuccessSynth.releaseAll();
    lv19FailSynth.releaseAll();
    lv19FinishSynth.releaseAll();
  } catch {
    // 라우트 전환 중 Tone 컨텍스트가 닫혀도 조용히 정리합니다.
  }
}
