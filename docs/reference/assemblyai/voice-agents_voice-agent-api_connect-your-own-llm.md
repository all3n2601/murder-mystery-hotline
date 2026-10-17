> ## Documentation Index
> Fetch the complete documentation index at: https://assemblyai.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Connect your own LLM

> Point a voice agent at your own OpenAI-compatible LLM endpoint instead of AssemblyAI's managed model.

By default, a voice agent uses AssemblyAI's **managed** conversational model — you don't configure anything. To run the agent on a different model, set the `llm` field on the agent to your own **OpenAI-compatible** chat-completions endpoint. AssemblyAI calls that endpoint at runtime to generate every reply.

<Note>
  **When to use this.** Reach for a custom LLM when you need a specific model, your own fine-tune, or your own provider account and billing. If you just want a different frontier model without managing an endpoint, point `llm` at the [LLM Gateway](#use-the-llm-gateway) instead.
</Note>

## Connect a model

Add an `llm` array to a [create](/docs/voice-agents/voice-agent-api/create-agent) or [update](/docs/voice-agents/voice-agent-api/manage-agents) request. Each entry needs a `base_url`, a `model`, and an `api_key`:

<CodeGroup>
  ```bash cURL expandable theme={null}
  curl -X POST https://agents.assemblyai.com/v1/agents \
    -H "Authorization: $ASSEMBLYAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Support Assistant",
      "system_prompt": "You are a friendly support agent. Keep replies under two sentences.",
      "voice": { "voice_id": "alba" },
      "llm": [
        {
          "base_url": "https://api.openai.com/v1",
          "model": "gpt-5-mini",
          "api_key": "sk-..."
        }
      ]
    }'
  ```

  ```python Python expandable theme={null}
  # pip install requests
  import os
  import requests

  resp = requests.post(
      "https://agents.assemblyai.com/v1/agents",
      headers={"Authorization": os.environ["ASSEMBLYAI_API_KEY"]},
      json={
          "name": "Support Assistant",
          "system_prompt": "You are a friendly support agent. Keep replies under two sentences.",
          "voice": {"voice_id": "alba"},
          "llm": [
              {
                  "base_url": "https://api.openai.com/v1",
                  "model": "gpt-5-mini",
                  "api_key": "sk-...",
              }
          ],
      },
  )
  resp.raise_for_status()
  print(resp.json())
  ```

  ```javascript Node.js expandable theme={null}
  // Node 18+ has fetch built in
  const res = await fetch("https://agents.assemblyai.com/v1/agents", {
    method: "POST",
    headers: {
      Authorization: process.env.ASSEMBLYAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Support Assistant",
      system_prompt: "You are a friendly support agent. Keep replies under two sentences.",
      voice: { voice_id: "alba" },
      llm: [
        {
          base_url: "https://api.openai.com/v1",
          model: "gpt-5-mini",
          api_key: "sk-...",
        },
      ],
    }),
  });
  const data = await res.json();
  console.log(data);
  ```
</CodeGroup>

| Field | Type | Required | Notes |
| - | - | - | - |
| `base_url` | string | Yes | HTTPS base URL of the OpenAI-compatible endpoint. Must be `https` and a public host. The agent calls `POST {base_url}/chat/completions`. |
| `model` | string | Yes | Model name sent in the chat-completions request body. |
| `api_key` | string | Yes | Key for your endpoint. **Write-only** — encrypted at rest and never returned in any response. |

## Update or rotate the model

Send a new `llm` array on `PUT /v1/agents/{id}`. Include `api_key` to rotate the key; the whole `llm` entry is replaced:

<CodeGroup>
  ```bash cURL theme={null}
  curl -X PUT https://agents.assemblyai.com/v1/agents/$AGENT_ID \
    -H "Authorization: $ASSEMBLYAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "llm": [
        { "base_url": "https://api.openai.com/v1", "model": "gpt-4.1", "api_key": "sk-new..." }
      ]
    }'
  ```

  ```python Python theme={null}
  # pip install requests
  import os
  import requests

  resp = requests.put(
      f"https://agents.assemblyai.com/v1/agents/{os.environ['AGENT_ID']}",
      headers={"Authorization": os.environ["ASSEMBLYAI_API_KEY"]},
      json={
          "llm": [
              {"base_url": "https://api.openai.com/v1", "model": "gpt-4.1", "api_key": "sk-new..."}
          ]
      },
  )
  resp.raise_for_status()
  print(resp.json())
  ```

  ```javascript Node.js theme={null}
  // Node 18+ has fetch built in
  const res = await fetch(`https://agents.assemblyai.com/v1/agents/${process.env.AGENT_ID}`, {
    method: "PUT",
    headers: {
      Authorization: process.env.ASSEMBLYAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      llm: [
        { base_url: "https://api.openai.com/v1", model: "gpt-4.1", api_key: "sk-new..." },
      ],
    }),
  });
  const data = await res.json();
  console.log(data);
  ```
</CodeGroup>

To switch the agent **back to the managed model**, send `"llm": []`.

## Use the LLM Gateway

You don't need your own provider account to use a frontier model. Point `base_url` at AssemblyAI's [LLM Gateway](/docs/llm-gateway/quickstart) and pass your AssemblyAI API key — you get Claude, GPT, Gemini, and more through one endpoint, billed on your AssemblyAI account:

<CodeGroup>
  ```bash cURL expandable theme={null}
  curl -X POST https://agents.assemblyai.com/v1/agents \
    -H "Authorization: $ASSEMBLYAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Gateway Assistant",
      "system_prompt": "You are a friendly support agent. Keep replies under two sentences.",
      "voice": { "voice_id": "alba" },
      "llm": [
        {
          "base_url": "https://llm-gateway.assemblyai.com/v1",
          "model": "claude-sonnet-4-6",
          "api_key": "'"$ASSEMBLYAI_API_KEY"'"
        }
      ]
    }'
  ```

  ```python Python expandable theme={null}
  # pip install requests
  import os
  import requests

  resp = requests.post(
      "https://agents.assemblyai.com/v1/agents",
      headers={"Authorization": os.environ["ASSEMBLYAI_API_KEY"]},
      json={
          "name": "Gateway Assistant",
          "system_prompt": "You are a friendly support agent. Keep replies under two sentences.",
          "voice": {"voice_id": "alba"},
          "llm": [
              {
                  "base_url": "https://llm-gateway.assemblyai.com/v1",
                  "model": "claude-sonnet-4-6",
                  "api_key": os.environ["ASSEMBLYAI_API_KEY"],
              }
          ],
      },
  )
  resp.raise_for_status()
  print(resp.json())
  ```

  ```javascript Node.js expandable theme={null}
  // Node 18+ has fetch built in
  const res = await fetch("https://agents.assemblyai.com/v1/agents", {
    method: "POST",
    headers: {
      Authorization: process.env.ASSEMBLYAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Gateway Assistant",
      system_prompt: "You are a friendly support agent. Keep replies under two sentences.",
      voice: { voice_id: "alba" },
      llm: [
        {
          base_url: "https://llm-gateway.assemblyai.com/v1",
          model: "claude-sonnet-4-6",
          api_key: process.env.ASSEMBLYAI_API_KEY,
        },
      ],
    }),
  });
  const data = await res.json();
  console.log(data);
  ```
</CodeGroup>

See [Available models](/docs/llm-gateway/available-models) for the full list. Use the EU host `https://llm-gateway.eu.assemblyai.com/v1` for EU workloads.

## Requirements & behavior

* **OpenAI-compatible.** The endpoint must accept `POST /chat/completions` in the OpenAI schema.
* **Streaming.** Realtime voice needs token streaming, so the model must support streamed chat completions.
* **One config.** `llm` is a list, but only a single entry is accepted today (fallbacks aren't supported yet).
* **HTTPS + public host.** Non-`https` URLs and private/loopback hosts are rejected.
* **Reads mask the key.** `GET`/list responses return only `base_url` and `model` — never `api_key`.

<Note>
  Latency and reliability now depend on your endpoint. A slow or rate-limited model shows up directly as reply latency in the conversation. See [Best practices](/docs/voice-agents/best-practices) for tuning.
</Note>
