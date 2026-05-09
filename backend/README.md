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
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "model": "deepseek-chat",
  "temperature": 0.1
}
```

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
  "error": "Unsupported model"
}
```

## Validation

The proxy intentionally does not accept arbitrary DeepSeek parameters.

Allowed:

- `messages`: non-empty array of `{ role, content }`
- `model`: `deepseek-chat`
- `temperature`: finite number, clamped to `0..2`
- `response_format`: omitted or `{ "type": "json_object" }`

Rejected:

- unsupported models
- malformed messages
- unsupported response formats
- missing API key

## Protection

- Request body limit: `1mb`
- Rate limit: 10 requests per minute per client IP on `/api/generate`
- DeepSeek timeout: 120 seconds
- Logs contain request metadata, not prompt contents

## Deployment Notes

Set:

```bash
DEEPSEEK_API_KEY=sk-...
PORT=3001
```

The frontend should proxy `/api/generate` and `/api/health` to this service.

## Related Frontend Files

- `src/services/aiGenerate.js`
- `src/assets/systemPrompts.js`
- `src/engines/<type>/ai_prompt.js`
