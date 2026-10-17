import { afterEach, describe, expect, it, vi } from "vitest";
import { startFakeTtsServer } from "./fake-tts-server.js";
import { createAssemblyTts } from "./tts.js";

let server: Awaited<ReturnType<typeof startFakeTtsServer>> | null = null;
afterEach(async () => {
  await server?.close();
  server = null;
});

async function* sentences(...items: string[]) {
  for (const s of items) yield s;
}

describe("AssemblyAI TTS adapter", () => {
  it("speaks sentences in the requested voice, authenticated, and terminates the session", async () => {
    server = await startFakeTtsServer();
    const tts = createAssemblyTts({ apiKey: "k3y", url: server.url });
    const audio: string[] = [];
    await tts.speak({
      voice: "george",
      sentences: sentences("I was at the desk.", "All night."),
      signal: new AbortController().signal,
      onAudio: (pcm) => audio.push(Buffer.from(pcm).toString()),
    });
    expect(audio.join("").trim()).toBe("I was at the desk. All night.");
    expect(server.log[0]).toMatchObject({ voice: "george", auth: "k3y" });
    await vi.waitFor(() => expect(server!.log[0]!.received.at(-1)).toBe("Terminate"));
  });

  it("never opens more than the account's 3 sessions; extra replies queue and still speak", async () => {
    server = await startFakeTtsServer({ maxConcurrent: 3, flushDelayMs: 40 });
    const tts = createAssemblyTts({ apiKey: "k", url: server.url, maxConcurrent: 3 });
    const queued: number[] = [];
    const heard: string[] = [];
    await Promise.all(
      [1, 2, 3, 4].map((n) =>
        tts.speak({
          voice: "eve",
          sentences: sentences(`Reply ${n}.`),
          signal: new AbortController().signal,
          onAudio: (pcm) => heard.push(Buffer.from(pcm).toString().trim()),
          onQueued: () => queued.push(n),
        }),
      ),
    );
    expect(server.peakOpen()).toBeLessThanOrEqual(3);
    expect(queued).toEqual([4]);
    expect(heard.sort()).toEqual(["Reply 1.", "Reply 2.", "Reply 3.", "Reply 4."]);
  });

  it("cancels on abort: no more audio, prompt return, and the slot is freed", async () => {
    server = await startFakeTtsServer({ maxConcurrent: 1, flushDelayMs: 200 });
    const tts = createAssemblyTts({ apiKey: "k", url: server.url, maxConcurrent: 1 });
    const abort = new AbortController();
    const audio: string[] = [];
    const started = Date.now();
    const speaking = tts.speak({
      voice: "eve",
      sentences: sentences("This gets cut off."),
      signal: abort.signal,
      onAudio: (pcm) => audio.push(Buffer.from(pcm).toString()),
    });
    setTimeout(() => abort.abort(), 30);
    await speaking;
    expect(Date.now() - started).toBeLessThan(150);
    expect(audio).toEqual([]);
    await vi.waitFor(() => expect(server!.log[0]!.received).toContain("Cancel"));

    // With one slot, a second reply only works if the first one gave its slot back.
    const second: string[] = [];
    await tts.speak({
      voice: "eve",
      sentences: sentences("Next."),
      signal: new AbortController().signal,
      onAudio: (pcm) => second.push(Buffer.from(pcm).toString().trim()),
    });
    expect(second).toEqual(["Next."]);
  });

  it("still terminates the server session when aborted while the socket is connecting", async () => {
    server = await startFakeTtsServer();
    const tts = createAssemblyTts({ apiKey: "k", url: server.url });
    const abort = new AbortController();
    const speaking = tts.speak({ voice: "eve", sentences: sentences("Never said."), signal: abort.signal, onAudio: () => {} });
    await new Promise((r) => setImmediate(r)); // the socket exists but hasn't opened yet
    abort.abort();
    await speaking;
    await vi.waitFor(() => expect(server!.log[0]?.received).toContain("Terminate"));
    await vi.waitFor(() => expect(server!.openNow()).toBe(0));
  });

  it("rejects on a server error frame and still frees the slot", async () => {
    server = await startFakeTtsServer({ maxConcurrent: 1, failWith: "Unsupported preset voice 'zz'" });
    const tts = createAssemblyTts({ apiKey: "k", url: server.url, maxConcurrent: 1 });
    const attempt = () =>
      tts.speak({ voice: "zz", sentences: sentences("Hi."), signal: new AbortController().signal, onAudio: () => {} });
    await expect(attempt()).rejects.toThrow(/Unsupported preset voice/);
    await expect(attempt()).rejects.toThrow(/Unsupported preset voice/); // would hang if the slot leaked
  });

  it("gives up if the server goes silent mid-reply", async () => {
    server = await startFakeTtsServer({ flushDelayMs: 10_000 });
    const tts = createAssemblyTts({ apiKey: "k", url: server.url, idleTimeoutMs: 100 });
    const attempt = tts.speak({ voice: "eve", sentences: sentences("Hello?"), signal: new AbortController().signal, onAudio: () => {} });
    await expect(attempt).rejects.toThrow(/silent/);
  });
});
