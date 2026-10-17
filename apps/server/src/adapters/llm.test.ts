import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createGatewayLlm } from "./llm.js";

let server: Server | null = null;
afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

/** A fake OpenAI-compatible endpoint that streams the given deltas as SSE. */
async function fakeGateway(deltas: string[], status = 200) {
  const seen: { auth?: string; body?: any } = {};
  server = createServer(async (req, res) => {
    let raw = "";
    for await (const c of req) raw += c;
    seen.auth = req.headers.authorization;
    seen.body = JSON.parse(raw);
    if (status !== 200) return res.writeHead(status).end('{"error":"nope"}');
    res.writeHead(200, { "content-type": "text/event-stream" });
    for (const d of deltas) {
      // Split each event across two writes, as real networks do.
      const line = `data: ${JSON.stringify({ choices: [{ delta: { content: d } }] })}\n\n`;
      res.write(line.slice(0, 10));
      res.write(line.slice(10));
    }
    res.end("data: [DONE]\n\n");
  });
  await new Promise<void>((r) => server!.listen(0, r));
  return { url: `http://127.0.0.1:${(server!.address() as AddressInfo).port}/v1`, seen };
}

async function collect(it: AsyncIterable<string>) {
  const out: string[] = [];
  for await (const x of it) out.push(x);
  return out;
}

describe("LLM Gateway adapter", () => {
  it("streams reply text from an OpenAI-compatible endpoint", async () => {
    const gw = await fakeGateway(["I was ", "at the desk."]);
    const llm = createGatewayLlm({ apiKey: "k3y", baseUrl: gw.url, model: "claude-haiku-5-5" });
    const chunks = await collect(
      llm.stream({ system: "You are Doyle.", messages: [{ role: "user", content: "Where?" }], signal: new AbortController().signal }),
    );
    expect(chunks.join("")).toBe("I was at the desk.");
    expect(gw.seen.auth).toBe("k3y");
    expect(gw.seen.body).toMatchObject({
      model: "claude-haiku-5-5",
      stream: true,
      messages: [
        { role: "system", content: "You are Doyle." },
        { role: "user", content: "Where?" },
      ],
    });
  });

  it("throws on a non-200 response so the session can cover it", async () => {
    const gw = await fakeGateway([], 500);
    const llm = createGatewayLlm({ apiKey: "k", baseUrl: gw.url, model: "m" });
    await expect(collect(llm.stream({ system: "", messages: [], signal: new AbortController().signal }))).rejects.toThrow(/500/);
  });
});
