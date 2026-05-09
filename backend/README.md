# Chartici Backend

Small Express proxy for AI generation requests.

The browser app must not contain the DeepSeek API key. This backend accepts sanitized generation requests from the frontend, forwards them to DeepSeek, and returns the assistant message content.

## Runtime

- Node.js 18+
- Express
- DeepSeek API key in `DEEPSEEK_API_KEY`

## Local Development

```bash
cd backend
npm install
DEEPSEEK_API_KEY=sk-... npm run dev
```

Server URL:

```text
http://localhost:3001
```

## API

### `GET /api/health`

Returns:

```json
{
  "status": "ok",
  "timestamp": "2026-05-09T12:00:00.000Z"
}
```

### `POST /api/generate`

Request:

```json
{
  "task": "build",
  "diagramType": "flowchart",
  "extendedPrompt": "- Teaching idea: ..."
}
```

Supported tasks:

- `plan`: `{ "task": "plan", "userPrompt": "..." }`
- `build`: `{ "task": "build", "diagramType": "flowchart", "extendedPrompt": "..." }`
- `repair`: `{ "task": "repair", "diagramType": "flowchart", "extendedPrompt": "...", "rawContent": "...", "errors": ["..."] }`

Response:

```json
{
  "success": true,
  "content": "...assistant message..."
}
```

Error response:

```json
{
  "success": false,
  "error": "Unsupported generation task"
}
```

## Validation

The proxy intentionally does not accept arbitrary DeepSeek messages or parameters.
System prompts are assembled on the backend from the shared prompt builders in `src/assets/systemPrompts.js`.

Allowed:

- `task`: `plan`, `build`, or `repair`
- task-specific text fields listed above

Rejected:

- raw `messages`
- raw `model`
- raw `temperature`
- raw `response_format`
- malformed task payloads
- missing API key

## Protection

- Request body limit: `1mb`
- Rate limit: 10 requests per minute per client IP on `/api/generate`
- DeepSeek timeout: 120 seconds
- Prompt-injection surface is reduced: the browser can submit only task payloads, not system prompts or arbitrary chat messages
- Logs contain request metadata, not prompt contents

## Deployment Notes

Set:

```bash
DEEPSEEK_API_KEY=sk-...
PORT=3001
```

The frontend should proxy `/api/generate` and `/api/health` to this service.

The backend Docker image must be built from the repository root, not from `backend/`,
because the proxy imports shared prompt builders from `src/assets/systemPrompts.js`:

```bash
docker build -f backend/Dockerfile -t chartici-api .
```

## Related Frontend Files

- `src/services/aiGenerate.js`
- `src/assets/systemPrompts.js`
- `src/engines/<type>/ai_prompt.js`
