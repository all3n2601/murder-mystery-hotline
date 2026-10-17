> ## Documentation Index
> Fetch the complete documentation index at: https://assemblyai.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Create an agent

> Create a reusable voice agent. Returns the full agent record, including a
generated `id` you use to connect over the WebSocket (`session.update` with
`agent_id`).




## OpenAPI

````yaml api-reference/specs/agents.yaml POST /v1/agents
openapi: 3.0.3
info:
  title: AssemblyAI Voice Agents API
  description: >
    REST API for creating and managing reusable voice agents. An agent stores
    its

    system prompt, greeting, voice, and tools server-side, so you can deploy the
    same

    agent across the WebSocket API, a browser, or Twilio by referencing its
    `id`. See

    [Create an agent](/voice-agents/voice-agent-api/create-agent)

    for a guided walkthrough.
  version: 1.0.0
  termsOfService: https://www.assemblyai.com/legal/terms-of-service
  contact:
    name: API Support
    email: support@assemblyai.com
    url: https://www.assemblyai.com/docs/
servers:
  - url: https://agents.assemblyai.com
    description: Production server
    x-fern-server-name: Default
security: []
paths:
  /v1/agents:
    post:
      summary: Create an agent
      description: >
        Create a reusable voice agent. Returns the full agent record, including
        a

        generated `id` you use to connect over the WebSocket (`session.update`
        with

        `agent_id`).
      operationId: createAgent
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AgentCreateRequest'
      responses:
        '201':
          description: Agent created.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Agent'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '422':
          $ref: '#/components/responses/UnprocessableEntity'
      security:
        - apiKey: []
components:
  schemas:
    AgentCreateRequest:
      type: object
      required:
        - name
        - system_prompt
        - voice
      properties:
        name:
          type: string
          description: Display name for the agent.
          example: Support Assistant
        system_prompt:
          type: string
          description: The agent's instructions. Write voice-first.
          example: >-
            You are a friendly support agent. Keep responses under two
            sentences.
        voice:
          $ref: '#/components/schemas/VoiceConfig'
        greeting:
          type: string
          nullable: true
          description: Spoken on connect; sent straight to TTS. Omit to listen first.
          example: Hi, how can I help?
        input:
          $ref: '#/components/schemas/AudioInput'
        output:
          $ref: '#/components/schemas/AudioOutput'
        tools:
          type: array
          description: Tools the agent can call.
          items:
            $ref: '#/components/schemas/ToolDefinition'
        llm:
          type: array
          maxItems: 1
          description: |
            Connect your own OpenAI-compatible LLM instead of AssemblyAI's
            managed model. Provide at most one config; omit to use the managed
            LLM. Multiple configs (fallbacks) are not yet supported.
          items:
            $ref: '#/components/schemas/LlmConfig'
        pre_connect_requests:
          type: array
          maxItems: 2
          description: >
            HTTPS lookups the platform runs, in order, before answering an
            inbound

            phone call. Each can send the call's facts (such as the caller's

            number) and values an earlier entry captured, and captures values
            from

            its JSON response for the greeting and the conversation. Telephony

            only; ignored on WebSocket sessions. See

            [Pre-connect
            requests](/voice-agents/voice-agent-api/pre-connect-requests).
          items:
            $ref: '#/components/schemas/PreConnectRequest'
    Agent:
      type: object
      description: A stored voice agent.
      properties:
        id:
          type: string
          example: 7ad24396-b822-4dca-871a-be9cc4781cf9
        name:
          type: string
          example: Support Assistant
        system_prompt:
          type: string
        greeting:
          type: string
          nullable: true
        voice:
          $ref: '#/components/schemas/VoiceConfig'
        input:
          $ref: '#/components/schemas/AudioInput'
        output:
          $ref: '#/components/schemas/AudioOutput'
        tools:
          type: array
          items:
            $ref: '#/components/schemas/ToolResponse'
        llm:
          type: array
          description: Connected LLM, if any. The api_key is write-only and never returned.
          items:
            $ref: '#/components/schemas/LlmConfigResponse'
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        pre_connect_requests:
          type: array
          description: The declared pre-connect requests. Header values are never returned.
          items:
            $ref: '#/components/schemas/PreConnectRequestResponse'
    VoiceConfig:
      type: object
      required:
        - voice_id
      properties:
        voice_id:
          type: string
          description: >-
            A voice from the voice catalog. An invalid id returns 400 with the
            list of valid voices.
          example: alba
    AudioInput:
      type: object
      description: Audio input configuration. Defaults to PCM at 24 kHz if omitted.
      properties:
        type:
          type: string
          default: audio
        format:
          $ref: '#/components/schemas/AudioFormat'
        turn_detection:
          type: object
          nullable: true
          description: VAD tuning, or null for adaptive defaults.
        keyterms:
          type: array
          nullable: true
          description: Up to 100 transcription-bias strings, or null.
          items:
            type: string
    AudioOutput:
      type: object
      description: >-
        Audio output configuration. Defaults to PCM at 24 kHz with the agent's
        voice.
      properties:
        type:
          type: string
          default: audio
        voice:
          type: string
          example: alba
        format:
          $ref: '#/components/schemas/AudioFormat'
        volume:
          type: number
          nullable: true
          description: Playback volume 0–100, or null for native level.
    ToolDefinition:
      type: object
      required:
        - name
        - description
      properties:
        name:
          type: string
          description: Tool name the model calls.
          example: get_weather
        description:
          type: string
          description: When to call the tool. The model's main signal.
          example: >-
            Get current weather for a location. Use whenever the user asks about
            weather.
        parameters:
          $ref: '#/components/schemas/ToolParameters'
        http:
          $ref: '#/components/schemas/HttpToolConfig'
        timeout_seconds:
          type: integer
          minimum: 1
          maximum: 300
          default: 120
        execution_mode:
          type: string
          enum:
            - interactive
            - hold
          default: interactive
          description: How the agent behaves while the tool runs.
    LlmConfig:
      type: object
      required:
        - base_url
        - model
        - api_key
      description: |
        An OpenAI-compatible chat-completions endpoint used as the agent's
        conversational LLM in place of AssemblyAI's managed model.
      properties:
        base_url:
          type: string
          description: >-
            HTTPS base URL of the OpenAI-compatible endpoint. Must be https and
            resolve to a public host.
          example: https://api.openai.com/v1
        model:
          type: string
          description: Model name sent in the chat-completions request body.
          example: gpt-4o-mini
        api_key:
          type: string
          description: >-
            API key for the endpoint. Write-only — encrypted at rest and never
            returned in any response.
    PreConnectRequest:
      type: object
      required:
        - http
      properties:
        http:
          $ref: '#/components/schemas/HttpToolConfig'
          description: >-
            The HTTPS endpoint to call. The hostname must resolve in public DNS
            at create or update time.
        sends:
          type: array
          description: >
            Names to send to this endpoint, in the JSON body for POST, PUT and

            PATCH or as query parameters for GET and DELETE. Any entry may name

            the platform's call facts `caller_number`, `dialed_number`,

            `direction`, `agent_id` and `session_id`; later entries may also
            name

            values an earlier entry captured. Opt-in per entry: nothing is sent

            unless named. A fact the platform does not have (for example a

            withheld caller number) is omitted rather than sent blank.
          items:
            type: string
          example:
            - caller_number
        returns:
          type: array
          description: Values to capture from the JSON response.
          items:
            $ref: '#/components/schemas/PreConnectReturn'
        timeout_ms:
          type: integer
          minimum: 1
          maximum: 800
          nullable: true
          description: |
            Lowers this entry's timeout. Every entry has its own 800 ms ceiling;
            this can only shorten it. Omit for the full ceiling.
          example: 600
        allow_overrides:
          type: array
          description: >-
            Agent fields the response may replace. Closed vocabulary; today only
            `greeting`.
          items:
            type: string
            enum:
              - greeting
          example:
            - greeting
    ToolResponse:
      type: object
      description: A tool as returned in an agent record. Header values are masked.
      properties:
        id:
          type: string
        name:
          type: string
        description:
          type: string
        http:
          $ref: '#/components/schemas/HttpToolConfigResponse'
        parameters:
          $ref: '#/components/schemas/ToolParameters'
        timeout_seconds:
          type: integer
        execution_mode:
          type: string
          enum:
            - interactive
            - hold
    LlmConfigResponse:
      type: object
      description: >-
        A connected LLM as returned in an agent record. The api_key is never
        included.
      properties:
        base_url:
          type: string
          example: https://api.openai.com/v1
        model:
          type: string
          example: gpt-4o-mini
    PreConnectRequestResponse:
      type: object
      properties:
        http:
          $ref: '#/components/schemas/HttpToolConfigResponse'
        sends:
          type: array
          items:
            type: string
        returns:
          type: array
          items:
            $ref: '#/components/schemas/PreConnectReturn'
        timeout_ms:
          type: integer
          nullable: true
          description: Null means the full 800 ms ceiling applies.
        allow_overrides:
          type: array
          items:
            type: string
    Error:
      type: object
      properties:
        detail:
          type: string
          description: Error message describing what went wrong.
          example: Unauthorized
    AudioFormat:
      type: object
      properties:
        encoding:
          type: string
          enum:
            - audio/pcm
            - audio/pcmu
            - audio/pcma
          default: audio/pcm
        sample_rate:
          type: integer
          example: 24000
    ToolParameters:
      type: object
      description: >
        A JSON Schema describing the tool's arguments. The same form for HTTP
        and

        client-side tools. Each property accepts standard JSON-Schema keywords;
        beyond

        `type` and `description`, use `enum`, `examples`, `pattern`, and
        `format` to

        sharpen tool-calling and turn-detection accuracy.
      properties:
        type:
          type: string
          enum:
            - object
          default: object
        properties:
          type: object
          description: Map of argument name to its JSON-Schema definition.
          additionalProperties: true
        required:
          type: array
          description: Names of the required arguments.
          items:
            type: string
      example:
        type: object
        properties:
          order_id:
            type: string
            description: The customer's order ID.
            examples:
              - AB-12345
            pattern: '[A-Z]{2}-\d{5}'
        required:
          - order_id
    HttpToolConfig:
      type: object
      required:
        - url
      description: >-
        Makes the tool a server-side HTTP tool. AssemblyAI calls this endpoint
        when the model invokes the tool.
      properties:
        url:
          type: string
          description: Must be https and resolve to a public host. Max 2048 chars.
          example: https://api.example.com/weather
        http_method:
          type: string
          enum:
            - GET
            - POST
            - PUT
            - PATCH
            - DELETE
          default: POST
          description: >-
            GET/DELETE send arguments as query params; POST/PUT/PATCH send them
            as a JSON body.
        headers:
          type: object
          nullable: true
          description: >-
            Sent on every call. Values are encrypted at rest and write-only
            (masked as "***" in responses).
          additionalProperties:
            type: string
    PreConnectReturn:
      type: object
      required:
        - name
        - path
      properties:
        name:
          type: string
          description: |
            Name the value is captured under. Available to later entries'
            `sends`, to `{{name}}` placeholders in the agent's greeting, and to
            the model as `aai_pre_connect_context`. Unique across all entries.
          example: patient_name
        path:
          type: string
          description: |
            Dotted path into the JSON response, e.g. `patient.first_name` or
            `results.0.id`. Segments match `[A-Za-z0-9_-]+`, at most 10 deep and
            256 characters. Shape is validated at write time; whether the path
            exists is only knowable at call time.
          example: patient.first_name
        default:
          type: string
          nullable: true
          description: |
            Used when the path does not resolve. Without one, an unresolved
            path leaves the value unset. For greeting placeholders use a
            non-empty default: a placeholder that resolves to nothing makes the
            platform speak the agent's greeting as declared.
          example: there
    HttpToolConfigResponse:
      type: object
      properties:
        url:
          type: string
        http_method:
          type: string
          enum:
            - GET
            - POST
            - PUT
            - PATCH
            - DELETE
        headers:
          type: object
          description: Header names with values masked as "***".
          additionalProperties:
            type: string
          example:
            Authorization: '***'
  responses:
    BadRequest:
      description: >-
        Bad request. A field failed validation (e.g. invalid voice, non-https
        tool URL, timeout out of range).
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    Unauthorized:
      description: >-
        Unauthorized. Invalid or missing API key, or the key is not entitled for
        Voice Agents.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    UnprocessableEntity:
      description: Unprocessable entity. Malformed JSON or a field of the wrong type.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
  securitySchemes:
    apiKey:
      type: apiKey
      in: header
      name: Authorization
      description: >-
        Your AssemblyAI API key in the `Authorization` header. The raw key works
        directly; a `Bearer ` prefix is also accepted.

````