import { describe, expect, it } from "vitest";
import { createAdmission } from "./admission.js";

describe("admission", () => {
  it("caps sessions per IP per hour and frees the window an hour later", () => {
    let now = 0;
    const gate = createAdmission({ maxOpen: 100, perIpPerHour: 2, now: () => now });
    expect(gate.admit("1.1.1.1").ok).toBe(true);
    expect(gate.admit("1.1.1.1").ok).toBe(true);
    expect(gate.admit("1.1.1.1")).toEqual({ ok: false, reason: "rate_limited" });
    expect(gate.admit("2.2.2.2").ok).toBe(true); // other players are unaffected
    now += 60 * 60 * 1000 + 1;
    expect(gate.admit("1.1.1.1").ok).toBe(true);
  });

  it("caps sessions open at once, and a closed session frees its place", () => {
    const gate = createAdmission({ maxOpen: 1, perIpPerHour: 100, now: () => 0 });
    const first = gate.admit("1.1.1.1");
    expect(gate.admit("2.2.2.2")).toEqual({ ok: false, reason: "full" });
    if (first.ok) first.release();
    expect(gate.admit("2.2.2.2").ok).toBe(true);
  });
});
