# ERD — .cci Format

**`meta.type`**: `"erd"`  
**`ioFormat.edgeEncoding`**: `explicit` — явные рёбра в секции `data.relationships[]`

## Структура файла

```json
{
  "meta": { "type": "erd", "version": "3.0.0" },
  "theme": "basic",
  "title": { "text": "User Schema", "size": "M" },
  "data": {
    "groups": [
      {
        "id": "g_users",
        "label": "Users",
        "color": "navy",
        "nodes": [
          { "id": "t_users",  "label": "Users",   "type": "process", "size": "M" },
          { "id": "t_sessions", "label": "Sessions", "type": "process", "size": "M" }
        ]
      },
      {
        "id": "g_orders",
        "label": "Orders",
        "color": "teal",
        "nodes": [
          { "id": "t_orders", "label": "Orders",   "type": "process", "size": "M" },
          { "id": "t_payments", "label": "Payments", "type": "process", "size": "M" }
        ]
      }
    ],
    "relationships": [
      { "sourceId": "t_users", "targetId": "t_orders", "label": "places", "connectionType": "1:N" },
      { "sourceId": "t_orders", "targetId": "t_payments", "label": "paid by", "connectionType": "1:1" }
    ]
  }
}
```

## Правила

- **Группы** = домены, схемы БД или пространства имён.
- Ноды ERD — только `process`: сущности/таблицы. Атрибуты как отдельные круглые или текстовые ноды не используются.
- **Связи** хранятся в `data.relationships[]` (не `data.edges`).
- `connectionType` — кардинальность ERD: `1:1`, `1:N`, `N:1`, `N:M`.
- `lineStyle` всегда `solid` или `dashed` (обязательная / опциональная связь).

## Разрешённые типы нод

| type | Описание |
|------|----------|
| `process` | Таблица / сущность |

## Поля связи (`relationships[]`)

| Поле | Тип | Описание |
|------|-----|----------|
| `sourceId` | String | Обязательно |
| `targetId` | String | Обязательно |
| `label` | String | Название связи (опционально) |
| `connectionType` | `1:1` \| `1:N` \| `N:1` \| `N:M` | Кардинальность (обязательно) |
| `lineStyle` | `solid` \| `dashed` | `solid` — обязательная связь |

## data.config (опционально)

| Поле | Тип | Описание |
|------|-----|----------|
| `aspect` | String | Соотношение сторон: `"16:9"`, `"4:3"`, `"1:1"` |
| `bgColor` | String | Фон холста: `"white"` или `"black"` |
| `showGrid` | Boolean | Показывать сетку листа в редакторе (по умолчанию `true`, omitted when true) |
| `showLegend` | Boolean | Показывать легенду групп (по умолчанию `false`, omitted when false) |
| `legendX` | Number | Залоченная X-координата легенды (omitted = авто-позиция) |
| `legendY` | Number | Залоченная Y-координата легенды (omitted = авто-позиция) |
