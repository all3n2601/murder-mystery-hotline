import type { LlmPort } from "../ports.js";

// AssemblyAI LLM Gateway: OpenAI-compatible chat completions, streamed as server-sent events.

export const GATEWAY_URL = "https://llm-gateway.assemblyai.com/v1";

export function createGatewayLlm(opts: { apiKey: string; model: string; baseUrl?: string; maxTokens?: number }): LlmPort {
  const url = `${(opts.baseUrl ?? GATEWAY_URL).replace(/\/+$/, "")}/chat/completions`;

  return {
    async *stream({ system, messages, signal }) {
      const res = await fetch(url, {
        method: "POST",
        signal,
        headers: { Authorization: opts.apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          model: opts.model,
          stream: true,
          max_tokens: opts.maxTokens ?? 200,
          messages: [{ role: "system", content: system }, ...messages],
        }),
      });
      if (!res.ok || !res.body) throw new Error(`LLM Gateway ${res.status}: ${await res.text().catch(() => "")}`);

      const decoder = new TextDecoder();
      let buffer = "";
      for await (const part of res.body) {
        buffer += decoder.decode(part as Uint8Array, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          const delta = (JSON.parse(data) as { choices?: { delta?: { content?: string } }[] }).choices?.[0]?.delta?.content;
          if (delta) yield delta;
        }
      }
    },
  };
}
