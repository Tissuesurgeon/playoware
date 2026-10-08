let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext;
  if (!AudioCtx) return null;
  context ??= new AudioCtx();
  if (context.state === "suspended") void context.resume();
  return context;
}

function tone(frequency: number, duration: number, gainValue: number, type: OscillatorType = "sine") {
  const ctx = audio();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.value = gainValue;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  oscillator.stop(ctx.currentTime + duration);
}

export const sounds = {
  pickup() {
    tone(180, 0.06, 0.025, "triangle");
  },
  sow() {
    tone(520, 0.04, 0.03, "triangle");
  },
  turn() {
    tone(440, 0.05, 0.02);
  },
  capture() {
    tone(240, 0.12, 0.05, "sine");
  },
  start() {
    tone(392, 0.08, 0.04);
    window.setTimeout(() => tone(523, 0.1, 0.04), 90);
  },
  end() {
    tone(330, 0.16, 0.05);
    window.setTimeout(() => tone(262, 0.22, 0.05), 140);
  },
};
