> ## Documentation Index
> Fetch the complete documentation index at: https://assemblyai.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Client-side tools

> Function tools your own code runs. Declare them inline, handle the tool.call, and return a tool.result without breaking turn-taking.

Declare tools inline in `session.tools` when the logic must run in your own code: local state, in-memory lookups, or anything you don't want to expose as an HTTP endpoint. The agent emits a [`tool.call`](/docs/voice-agents/voice-agent-api/events-reference#tool-call); you run the tool and reply with a [`tool.result`](/docs/voice-agents/voice-agent-api/events-reference#tool-result) when [`reply.done`](/docs/voice-agents/voice-agent-api/events-reference#reply-done) is the latest event you've received.

<Note>
  If your tool just calls an HTTP API, prefer a server-side [HTTP tool](/docs/voice-agents/voice-agent-api/tools/http-tools): AssemblyAI makes the request for you and your client never handles the round trip.
</Note>

## Quick start

```python theme={null}
import asyncio, json, websockets

URL = "wss://agents.assemblyai.com/v1/ws"
TOOLS = [{
    "type": "function",
    "name": "get_weather",
    "description": "Get current weather for any city. Use this whenever the user asks about weather, temperature, or conditions. Prefer calling this over guessing.",
    "parameters": {
        "type": "object",
        "properties": {"city": {"type": "string", "description": "City name (e.g. London)"}},
        "required": ["city"],
    },
}]

async def main():
    async with websockets.connect(URL, extra_headers={"Authorization": "Bearer YOUR_KEY"}) as ws:
        await ws.send(json.dumps({
            "type": "session.update",
            "session": {
                "system_prompt": "You are a weather assistant. Call get_weather for weather questions. When in doubt, call the tool.",
                "greeting": "Hi! Ask me about the weather.",
                "tools": TOOLS,
                "output": {"type": "audio", "voice": "alba"},
            },
        }))

        last_event, pending = None, []

        async def flush_if_idle():
            if last_event != "reply.done" or not pending:
                return
            for t in pending:
                await ws.send(json.dumps({"type": "tool.result", "call_id": t["call_id"],
                                          "result": json.dumps(t["result"])}))
            pending.clear()

        async for raw in ws:
            event = json.loads(raw); t = event.get("type")
            if t == "tool.call" and event["name"] == "get_weather":
                pending.append({"call_id": event["call_id"], "result": {"temp_c": 22, "description": "Sunny"}})
                await flush_if_idle()
            elif t in ("reply.started", "input.speech.started"):
                last_event = t
            elif t == "reply.done":
                last_event = t
                if event.get("status") == "interrupted":
                    pending.clear()
                else:
                    await flush_if_idle()

asyncio.run(main())
```

## Defining function tools

Function tools use a JSON Schema for `parameters` and carry `"type": "function"`. [HTTP tools](/docs/voice-agents/voice-agent-api/tools/http-tools) use the same JSON-Schema `parameters`; `description`, `execution_mode`, and `timeout_seconds` work the same way for both.

```json expandable theme={null}
{
  "type": "session.update",
  "session": {
    "tools": [
      {
        "type": "function",
        "name": "get_weather",
        "description": "Get current weather for any city. Use this whenever the user asks about weather.",
        "parameters": {
          "type": "object",
          "properties": {"location": {"type": "string", "description": "City name, e.g. London"}},
          "required": ["location"]
        },
        "execution_mode": "interactive",
        "timeout_seconds": 120
      }
    ]
  }
}
```

| Field | Type | Default | Notes |
| - | - | - | - |
| `type` | string | (required) | Always `"function"`. |
| `name` | string | (required) | snake\_case, verb-noun. Referenced by `tool.call`. |
| `description` | string | `""` | The model's main signal for when to call. See [Getting the agent to call your tools](/docs/voice-agents/voice-agent-api/tools/overview#getting-the-agent-to-call-your-tools). |
| `parameters` | object | `{}` | JSON Schema. See below. |
| `execution_mode` | string | `"interactive"` | `"interactive"` or `"hold"`. See [Execution modes](/docs/voice-agents/voice-agent-api/tools/overview#execution-modes). |
| `timeout_seconds` | number | `120` | 1–300. On timeout the agent apologises; the session continues. |

`session.tools` updates **replace** the previous array (not merge). See [Progressive tool reveal](/docs/voice-agents/voice-agent-api/tools/overview#progressive-tool-reveal).

### Parameters

```json theme={null}
{
  "type": "object",
  "properties": {
    "phone_number": {
      "type": "string",
      "description": "E.164 format (e.g. +14155551234). Strip spaces, parentheses, dashes."
    },
    "department": {
      "type": "string",
      "enum": ["billing", "sales", "support"],
      "description": "Pick the closest match (e.g. 'tech help' → support)."
    }
  },
  "required": ["phone_number", "department"]
}
```

* Lead with format ("E.164", "ISO-8601 date", "lowercase").
* Always include an example.
* Use `enum` for fixed sets.
* `required` only for fields the tool truly can't function without; otherwise the model interrogates the user.

The same [accuracy hints](/docs/voice-agents/voice-agent-api/tools/overview#parameter-hints-improve-accuracy) (`enum`, `examples`, `pattern`, `format`) can go on each property here.

<Warning>
  `parameters` is **not** validated at `session.update` time. Malformed schemas (missing `type: "object"`, broken `enum`) are accepted silently and break tool calling at runtime. Validate locally.
</Warning>

## Returning tool results

**Send `tool.result` when `reply.done` is the latest event you've received.** Not earlier (agent is still mid-transition-phrase), not later (a new turn has started).

```python theme={null}
last_event: str | None = None
pending_tools: list[dict] = []

async def flush_if_idle():
    if last_event != "reply.done" or not pending_tools:
        return
    for tool in pending_tools:
        await ws.send(json.dumps({
            "type": "tool.result",
            "call_id": tool["call_id"],
            "result": json.dumps(tool["result"]),   # JSON string
        }))
    pending_tools.clear()

# In your event loop:
if t == "tool.call":
    result = run_tool(event["name"], event["arguments"])
    pending_tools.append({"call_id": event["call_id"], "result": result})
    await flush_if_idle()                # may already be idle if reply.done fired first

elif t in ("reply.started", "input.speech.started"):
    last_event = t                        # turn in flight, hold results

elif t == "reply.done":
    last_event = t
    if event.get("status") == "interrupted":
        pending_tools.clear()             # agent moved on, drop stale results
    else:
        await flush_if_idle()
```

Two non-obvious bits:

* Call `flush_if_idle()` from the `tool.call` handler. Your tool may return *after* `reply.done` already fired.
* Update `last_event` on `reply.started` / `input.speech.started` so results that become available mid-turn are held until that turn ends.

### Errors that help the agent recover

The `error` field is read verbatim by the model. Weak errors cause guessing loops; specific errors get clean recoveries.

Weak (agent re-asks for everything):

```json theme={null}
{ "error": "Lookup failed." }
```

Strong (agent re-asks only for the field that failed):

```json theme={null}
{ "error": "Could not resolve DROPOFF 'Central train station'. Pickup resolved ('SW1A 1AA'). Ask the user for a UK postcode for the dropoff." }
```

Patterns: name the failing field, say what *did* work so the agent doesn't re-ask for it, tell the agent what to ask for next.

## Going further

The shared mechanics live on the [Tools overview](/docs/voice-agents/voice-agent-api/tools/overview): [execution modes](/docs/voice-agents/voice-agent-api/tools/overview#execution-modes) (`interactive` vs `hold`), [progressive tool reveal](/docs/voice-agents/voice-agent-api/tools/overview#progressive-tool-reveal), [per-agent patterns](/docs/voice-agents/voice-agent-api/tools/overview#patterns-by-agent-type), and [debugging](/docs/voice-agents/voice-agent-api/tools/overview#debugging).
