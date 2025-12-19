let audioCtx: AudioContext | null = null;
let unlocked = false;

function getCtx(): AudioContext | null {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

export async function unlockAudio(): Promise<boolean> {
  const ctx = getCtx();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // “ping” silenzioso per sbloccare
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.frequency.value = 440;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.02);

    unlocked = true;
    return true;
  } catch {
    return false;
  }
}

export async function playNotificationBeep(): Promise<boolean> {
  const ctx = getCtx();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") {
      // se è suspended e non sbloccato da gesto utente, spesso fallisce: ritorniamo false
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }

    // se non è mai stato sbloccato da un click, su iOS può comunque non suonare: proviamo lo stesso
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);

    return true;
  } catch {
    return false;
  }
}
