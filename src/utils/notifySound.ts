// src/utils/notifySound.ts

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  const AnyAudioContext = (window.AudioContext || (window as any).webkitAudioContext) as
    | typeof AudioContext
    | undefined;

  if (!AnyAudioContext) {
    throw new Error("Web Audio not supported");
  }

  if (!audioCtx) audioCtx = new AnyAudioContext();
  return audioCtx;
}

export async function unlockAudio(): Promise<boolean> {
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

export async function playNotificationBeep(): Promise<boolean> {
  try {
    const ctx = getAudioContext();

    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    if (ctx.state !== "running") return false;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.10, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);

    return true;
  } catch {
    return false;
  }
}
