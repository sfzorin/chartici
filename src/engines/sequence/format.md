# Sequence — .cci Format

**`meta.type`**: `"sequence"`  
**`ioFormat.edgeEncoding`**: `explicit` — явные рёбра в секции `data.messages[]`

## Структура файла

```json
{
  "meta": { "type": "sequence", "version": "3.0.0" },
  "title": { "text": "Login Flow", "size": "M" },
  "data": {
    "groups": [
      {
        "id": "g_client",
        "label": "Client",
        "color": 1,
        "nodes": [
          { "id": "c_1", "label": "Send Login" },
          { "id": "c_2", "label": "Show Result" }
        ]
      },
      {
        "id": "g_server",
        "label": "API Server",
        "color": 2,
        "nodes": [
          { "id": "s_1", "label": "Validate Auth" },
          { "id": "s_2", "label": "Query DB" }
        ]
      }
    ],
    "messages": [
      { "sourceId": "c_1", "targetId": "s_1", "label": "POST /login",  "lineStyle": "solid",  "connectionType": "target" },
      { "sourceId": "s_1", "targetId": "s_2", "label": "Read User",    "lineStyle": "solid",  "connectionType": "target" },
      { "sourceId": "s_2", "targetId": "c_2", "label": "200 OK",       "lineStyle": "dashed", "connectionType": "reverse" }
    ]
  }
}
```

## Правила

- **Группы** = актёры (Lifelines). Ноды = шаги/состояния актёра.
- **Связи** хранятся в `data.messages[]` (не `data.edges`).
- `lineStyle: "solid"` — синхронный вызов; `"dashed"` — асинхронный ответ.
- `connectionType` — направление стрелки: `target` / `reverse` / `both` / `none`.
- Матричный overlay рисует вертикальные lifeline-полосы по группам.

## Разрешённые типы нод

| type | Описание |
|------|----------|
| `process` | Шаг взаимодействия |
| `circle` | Старт/стоп актёра |
| `text` | Аннотация |

## Поля сообщения (`messages[]`)

| Поле | Тип | Описание |
|------|-----|----------|
| `sourceId` | String | Обязательно |
| `targetId` | String | Обязательно |
| `label` | String | Текст сообщения |
| `lineStyle` | `solid` \| `dashed` \| `none` | Стиль линии |
| `connectionType` | `target` \| `reverse` \| `both` \| `none` | Направление стрелки |
