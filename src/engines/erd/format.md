# ERD — .cci Format

**`meta.type`**: `"erd"`  
**`ioFormat.edgeEncoding`**: `explicit` — явные рёбра в секции `data.relationships[]`

## Структура файла

```json
{
  "meta": { "type": "erd", "version": "3.0.0" },
  "title": { "text": "User Schema", "size": "M" },
  "data": {
    "groups": [
      {
        "id": "g_users",
        "label": "Users",
        "color": 1,
        "nodes": [
          { "id": "t_users",  "label": "Users",   "type": "process", "size": "M" },
          { "id": "c_id",     "label": "id",       "type": "text",    "size": "S" },
          { "id": "c_name",   "label": "name",     "type": "text",    "size": "S" },
          { "id": "c_email",  "label": "email",    "type": "text",    "size": "S" }
        ]
      },
      {
        "id": "g_orders",
        "label": "Orders",
        "color": 2,
        "nodes": [
          { "id": "t_orders", "label": "Orders",   "type": "process", "size": "M" },
          { "id": "o_id",     "label": "id",       "type": "text",    "size": "S" },
          { "id": "o_uid",    "label": "user_id",  "type": "text",    "size": "S" }
        ]
      }
    ],
    "relationships": [
      { "sourceId": "t_users", "targetId": "t_orders", "connectionType": "1:N" }
    ]
  }
}
```

## Правила

- **Группы** = схемы БД или пространства имён.
- Каждая группа содержит одну `process`-ноду (таблица) + `text`-ноды (атрибуты).
- **Связи** хранятся в `data.relationships[]` (не `data.edges`).
- `connectionType` — кардинальность ERD: `1:1`, `1:N`, `N:1`, `N:M`.
- `lineStyle` всегда `solid` или `dashed` (обязательная / опциональная связь).

## Разрешённые типы нод

| type | Описание |
|------|----------|
| `process` | Таблица / сущность |
| `text` | Атрибут / поле |

## Поля связи (`relationships[]`)

| Поле | Тип | Описание |
|------|-----|----------|
| `sourceId` | String | Обязательно |
| `targetId` | String | Обязательно |
| `label` | String | Название связи (опционально) |
| `connectionType` | `1:1` \| `1:N` \| `N:1` \| `N:M` | Кардинальность (обязательно) |
| `lineStyle` | `solid` \| `dashed` | `solid` — обязательная связь |
