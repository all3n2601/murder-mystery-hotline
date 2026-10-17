import { afterEach, describe, expect, it, vi } from "vitest";
import { startFakeSttServer } from "./fake-stt-server.js";
import { createAssemblyStt } from "./stt.js";

let server: Awaited<ReturnType<typeof startFakeSttServer>> | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

function listen() {
  const partials: string[] = [];
  const finals: string[] = [];
  return {
    partials,
    finals,
    handlers: { onPartial: (t: string) => partials.push(t), onFinal: (t: string) => finals.push(t), onError: () => {} },
  };
}

describe("AssemblyAI STT adapter", () => {
  it("streams mic audio, forces the endpoint on release, and reports one final per turn", async () => {
    server = await startFakeSttServer();
    server.say("Where were you at one?");
    const stt = createAssemblyStt({ apiKey: "k3y", url: server.url, keyterms: ["Doyle", "Marlowe"] });
    const l = listen();
    const session = stt.open(l.handlers);
    session.sendAudio(new Uint8Array(3200)); // sent before the socket opens: must be queued, not lost
    await vi.waitFor(() => expect(l.partials).toEqual(["Where"]));
    session.endTurn();
    await vi.waitFor(() => expect(l.finals).toEqual(["where were you at one?"]));
    session.close();

    const s = server.sessions[0]!;
    expect(s.auth).toBe("k3y");
    expect(Object.fromEntries(s.params)).toMatchObject({ sample_rate: "16000", encoding: "pcm_s16le", speech_model: "universal-3-6-pro" });
    expect(JSON.parse(s.params.get("keyterms_prompt")!)).toEqual(["Doyle", "Marlowe"]);
    expect(s.audioBytes).toBe(3200);
    await vi.waitFor(() => expect(s.control).toEqual(["ForceEndpoint", "Terminate"]));
  });
});
