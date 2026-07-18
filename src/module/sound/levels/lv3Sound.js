import { Tone, masterLimiter, canPlaySound, getStrictStartTime, lastStartTimes } from "../audioEngine.js";
export { readySound, unlockSoundOnNextGesture, playStartSound } from "../audioEngine.js";

const appearSynth = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.004, decay: 0.08, sustain: 0.08, release: 0.16 }, volume: -11 }).connect(masterLimiter);
const okSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.004, decay: 0.08, sustain: 0.12, release: 0.18 }, volume: -9 }).connect(masterLimiter);
const failSynth = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.004, decay: 0.06, sustain: 0, release: 0.12 }, volume: -8 }).connect(masterLimiter);
function playOkSound() { if (!canPlaySound()) return; const t=getStrictStartTime("ok",0.08); okSynth.triggerAttackRelease("E5",0.08,t); okSynth.triggerAttackRelease("A5",0.16,t+0.055); lastStartTimes.set("ok",t+0.055); }
function playFailSound() { if (!canPlaySound()) return; failSynth.triggerAttackRelease("C3",0.13,getStrictStartTime("fail",0.03)); }
export function playTouchDotAppearSound(step=0){ if(!canPlaySound())return; const notes=["D5","F5","A5","D6"]; appearSynth.triggerAttackRelease(notes[step%notes.length],0.13,getStrictStartTime("lv3-appear",0.03)); }
export { playOkSound, playFailSound };
