> ## Documentation Index
> Fetch the complete documentation index at: https://assemblyai.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Voices

> Pick a voice that matches your agent's personality and language.

Pick any voice ID from the tables below and set it as `voice` when you create the agent:

<CodeGroup>
  ```bash cURL theme={null}
  curl -X POST https://agents.assemblyai.com/v1/agents \
    -H "Authorization: $ASSEMBLYAI_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Support Assistant",
      "system_prompt": "You are a friendly support agent. Keep replies under two sentences.",
      "voice": { "voice_id": "anna" }
    }'
  ```

  ```python Python theme={null}
  # pip install requests
  import os
  import requests

  resp = requests.post(
      "https://agents.assemblyai.com/v1/agents",
      headers={"Authorization": os.environ["ASSEMBLYAI_API_KEY"]},
      json={
          "name": "Support Assistant",
          "system_prompt": "You are a friendly support agent. Keep replies under two sentences.",
          "voice": {"voice_id": "anna"},
      },
  )
  resp.raise_for_status()
  print(resp.json())
  ```

  ```javascript Node.js theme={null}
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
      voice: { voice_id: "anna" },
    }),
  });
  const data = await res.json();
  console.log(data);
  ```
</CodeGroup>

Configuring inline over the WebSocket instead of on a stored agent? Set it on `session.output.voice` in a [`session.update`](/docs/voice-agents/voice-agent-api/events-reference#session-update) before `session.ready`:

```json theme={null}
{
  "type": "session.update",
  "session": {
    "output": { "voice": "anna" }
  }
}
```

The voice is **immutable once the session is established**, so it can't be changed mid-conversation. Pick it before the agent connects.

## Language support

The agent recognizes far more input languages than it speaks. For the authoritative, up-to-date matrix, see [Supported languages](/docs/voice-agents/voice-agent-api/supported-languages).

In short:

* **Input (recognized):** 18 languages, with native code-switching. Because the agent recognizes more languages than it speaks, this enables translation use cases where a caller speaks one language and the agent responds in another.
* **Output (spoken):** 6 officially supported languages: 🇺🇸🇬🇧 English, 🇮🇹 Italian, 🇪🇸 Spanish, 🇩🇪 German, 🇵🇹 Portuguese, and 🇫🇷 French. Each is backed by at least one voice below with a matching accent. More output languages are [on the roadmap](/docs/voice-agents/voice-agent-api/supported-languages#coming-soon).

## Choose a voice by accent

Each voice has a primary accent:

* For **English** (the right pick for an English agent), choose from [English voices](#english-voices). Most have a 🇺🇸 American accent; `anna`, `charles`, `paul`, and `vera` have a 🇬🇧 British accent.
* For a **native accent** in Italian, Spanish, German, Portuguese, or French, choose the matching [language-specific voice](#language-specific-voices).

## English voices

These voices have an English accent and are the recommended pick for English agents.

| Voice | Accent |
| - | - |
| `alba` | 🇺🇸 |
| `eve` | 🇺🇸 |
| `george` | 🇺🇸 |
| `jane` | 🇺🇸 |
| `jean` | 🇺🇸 |
| `mary` | 🇺🇸 |
| `michael` | 🇺🇸 |
| `anna` | 🇬🇧 |
| `charles` | 🇬🇧 |
| `paul` | 🇬🇧 |
| `vera` | 🇬🇧 |

## Language-specific voices

These voices have a native accent in a specific non-English language and code-switch naturally between that language and English.

| Voice | Native accent |
| - | - |
| `giovanni` | 🇮🇹 Italian |
| `lola` | 🇪🇸 Spanish |
| `juergen` | 🇩🇪 German |
| `rafael` | 🇵🇹 Portuguese |
| `estelle` | 🇫🇷 French |
