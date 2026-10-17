// Who may open a game socket: a global cap on open sessions (each one can hold STT, TTS
// and LLM spend) and a per-IP hourly cap so one visitor can't drain the account.

const HOUR_MS = 60 * 60 * 1000;

export type Admission = { ok: true; release(): void } | { ok: false; reason: "full" | "rate_limited" };

export function createAdmission(opts: { maxOpen: number; perIpPerHour: number; now?: () => number }) {
  const now = opts.now ?? Date.now;
  const recent = new Map<string, number[]>(); // ip -> admission times within the last hour
  let open = 0;

  return {
    admit(ip: string): Admission {
      const cutoff = now() - HOUR_MS;
      const times = (recent.get(ip) ?? []).filter((t) => t > cutoff);
      if (times.length >= opts.perIpPerHour) {
        recent.set(ip, times);
        return { ok: false, reason: "rate_limited" };
      }
      if (open >= opts.maxOpen) return { ok: false, reason: "full" };
      times.push(now());
      recent.set(ip, times);
      open++;
      let released = false;
      return {
        ok: true,
        release() {
          if (released) return;
          released = true;
          open--;
        },
      };
    },
  };
}
