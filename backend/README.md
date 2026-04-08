# Chartici API Backend

Прокси-сервер, который пробрасывает запросы фронтенда к [Moonshot API](https://platform.moonshot.cn) (Kimi AI).

## Принцип работы

Бэкенд — **тупой прокси**. Фронтенд формирует готовый массив `messages` (включая system prompt и спецификацию .cci), бэкенд пробрасывает его в Moonshot API и возвращает сырой ответ. Вся бизнес-логика — на фронтенде.

```
Frontend  →  POST /api/generate  →  Backend  →  Moonshot API  →  Kimi AI
             { messages, model,      проксирует     тот же payload
               temperature }          как есть       + API key
```

## API

### `POST /api/generate`

**Request:**
```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "Нарисуй оргструктуру" }
  ],
  "model": "moonshot-v1-128k",
  "temperature": 0.3
}
```

| Поле | Обязательно | Default |
|------|:-----------:|---------|
| `messages` | ✅ | — |
| `model` | нет | `moonshot-v1-128k` |
| `temperature` | нет | `0.3` |

**Response (success):**
```json
{ "success": true, "content": "...строка от Kimi..." }
```

**Response (error):**
```json
{ "success": false, "error": "Rate limit exceeded. Try again in 60 seconds." }
```

### `GET /api/health`

```json
{ "status": "ok", "timestamp": "2026-04-08T12:00:00.000Z" }
```

### Коды ошибок

| Ситуация | HTTP | error |
|----------|:----:|-------|
| Невалидный request | 400 | `messages is required...` |
| Rate limit (10 req/min) | 429 | `Rate limit exceeded...` |
| Moonshot 401/403 | 502 | `AI service auth error` |
| Moonshot timeout | 504 | `AI response timeout` |
| Moonshot другая ошибка | 502 | `AI service error` |
| Внутренняя ошибка | 500 | `Internal server error` |

## Защита

- **Rate limiting:** 10 запросов в минуту с одного IP
- **Таймаут:** 120 секунд на ответ от Moonshot
- **Логирование:** в stdout без содержимого messages (приватность)

## Локальная разработка

```bash
cd backend
cp .env.example .env
# Вписать реальный MOONSHOT_API_KEY в .env
npm install
npm run dev
```

Сервер запустится на `http://localhost:3001`.

## Деплой

Бэкенд деплоится автоматически через GitHub Actions вместе с фронтендом. На VPS (`/opt/chartici`) нужно один раз создать `.env`:

```bash
echo "MOONSHOT_API_KEY=sk-ваш-ключ" > /opt/chartici/.env
```

Получить ключ: [platform.moonshot.cn](https://platform.moonshot.cn) → API Keys.
