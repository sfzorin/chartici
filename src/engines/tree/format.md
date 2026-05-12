# Tree — .cci Format

**`meta.type`**: `"tree"`  
**`ioFormat.edgeEncoding`**: `parentId` — группа хранит ID родительской ноды в поле `group.parentId`

## Структура файла

```json
{
  "meta": { "type": "tree", "version": "3.0.0" },
  "title": { "text": "Org Chart", "size": "L" },
  "data": {
    "groups": [
      {
        "id": "g_root",
        "label": "Root",
        "color": "navy",
        "nodes": [
          { "id": "ceo_1", "label": "CEO", "size": "L" }
        ]
      },
      {
        "id": "g_eng",
        "label": "Engineering",
        "parentId": "ceo_1",
        "color": "teal",
        "nodes": [
          { "id": "vp_1", "label": "VP Engineering" },
          { "id": "cto_1", "label": "CTO" }
        ]
      },
      {
        "id": "g_design",
        "label": "Design",
        "parentId": "ceo_1",
        "color": "yellow",
        "nodes": [
          { "id": "head_1", "label": "Head of Design" }
        ]
      }
    ]
  }
}
```

## Правила

- **Корневая группа** — группа без `parentId` (ровно одна).
- **`group.parentId`** = ID ноды-родителя (не ID группы), к которому подключаются все ноды этой группы.
- Если исходное описание содержит именованные ветки/категории, эти ветки должны быть отдельными видимыми нодами: `root → category → leaves`.
- **Нет** секции `data.edges` — связи восстанавливаются через `resolveImplicitEdges` из `parentId`.
- Все рёбра — `solid`, без стрелок (`arrowType: 'none'`).
- Нода может дополнительно задавать `nextSteps` для нестандартных поперечных связей.

## Разрешённые типы нод

| type | Описание |
|------|----------|
| `process` | Иерархический узел |
| `text` | Аннотация |

## Конфиг группы

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String | Уникальный ID |
| `parentId` | String | ID родительской ноды |
| `label` | String | Заголовок ветки |
| `color` | String | Semantic color name: `blue`, `green`, `yellow`, `red`, `gray`, `purple`, `brown`, `navy`, `teal`, `orange` |

## data.config (опционально)

| Поле | Тип | Описание |
|------|-----|----------|
| `aspect` | String | Соотношение сторон: `"16:9"`, `"4:3"`, `"1:1"` |
| `bgColor` | String | Фон холста: `"white"` или `"black"` |
| `showGrid` | Boolean | Показывать сетку листа в редакторе (по умолчанию `true`, omitted when true) |
| `showLegend` | Boolean | Показывать легенду групп (по умолчанию `false`, omitted when false) |
| `legendX` | Number | Залоченная X-координата легенды (omitted = авто-позиция) |
| `legendY` | Number | Залоченная Y-координата легенды (omitted = авто-позиция) |
