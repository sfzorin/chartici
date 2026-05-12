# Radial — .cci Format

**`meta.type`**: `"radial"`  
**`ioFormat.edgeEncoding`**: `parentId` — аналогично Tree

## Структура файла

```json
{
  "meta": { "type": "radial", "version": "3.0.0" },
  "title": { "text": "System Architecture", "size": "M" },
  "data": {
    "groups": [
      {
        "id": "g_hub",
        "label": "Hub",
        "color": "navy",
        "nodes": [
          { "id": "hub_1", "label": "Core Service", "size": "L" }
        ]
      },
      {
        "id": "g_auth",
        "label": "Auth",
        "parentId": "hub_1",
        "color": "teal",
        "nodes": [
          { "id": "auth_1", "label": "OAuth" },
          { "id": "auth_2", "label": "JWT" }
        ]
      },
      {
        "id": "g_db",
        "label": "Storage",
        "parentId": "hub_1",
        "color": "yellow",
        "nodes": [
          { "id": "db_1", "label": "PostgreSQL" },
          { "id": "db_2", "label": "Redis" }
        ]
      }
    ]
  }
}
```

## Правила

- Идентичен Tree по кодировке (`parentId` на группе).
- Если описание содержит группы/кластеры, эти группы должны быть отдельными видимыми узлами: `center → category → leaves`.
- Отличие только в рендере: рёбра рисуются как прямые radial-связи с направлением к дочерней ноде.
- Подходит для mind-map и hub-and-spoke архитектур.
- `connectionType: "target"` используется по умолчанию для implicit-связей.
- `suppressEdgeLabels: true` — метки рёбер не показываются.

## Разрешённые типы нод

| type | Описание |
|------|----------|
| `process` | Все узлы — прямоугольники |

## data.config (опционально)

| Поле | Тип | Описание |
|------|-----|----------|
| `aspect` | String | Соотношение сторон: `"16:9"`, `"4:3"`, `"1:1"` |
| `bgColor` | String | Фон холста: `"white"` или `"black"` |
| `showGrid` | Boolean | Показывать сетку листа в редакторе (по умолчанию `true`, omitted when true) |
| `showLegend` | Boolean | Показывать легенду групп (по умолчанию `false`, omitted when false) |
| `legendX` | Number | Залоченная X-координата легенды (omitted = авто-позиция) |
| `legendY` | Number | Залоченная Y-координата легенды (omitted = авто-позиция) |
