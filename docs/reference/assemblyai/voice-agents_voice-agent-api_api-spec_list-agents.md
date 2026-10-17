> ## Documentation Index
> Fetch the complete documentation index at: https://assemblyai.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# List agents

> List the agents for the authenticated account. Returns lightweight records (no tools or prompt), newest first.



## OpenAPI

````yaml api-reference/specs/agents.yaml GET /v1/agents
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
    get:
      summary: List agents
      description: >-
        List the agents for the authenticated account. Returns lightweight
        records (no tools or prompt), newest first.
      operationId: listAgents
      responses:
        '200':
          description: A list of agents.
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/AgentListItem'
        '401':
          $ref: '#/components/responses/Unauthorized'
      security:
        - apiKey: []
components:
  schemas:
    AgentListItem:
      type: object
      description: Lightweight agent record returned by the list endpoint.
      properties:
        id:
          type: string
        name:
          type: string
        deleted_at:
          type: string
          format: date-time
          nullable: true
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
    Error:
      type: object
      properties:
        detail:
          type: string
          description: Error message describing what went wrong.
          example: Unauthorized
  responses:
    Unauthorized:
      description: >-
        Unauthorized. Invalid or missing API key, or the key is not entitled for
        Voice Agents.
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