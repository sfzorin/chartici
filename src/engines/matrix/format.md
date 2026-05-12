# Matrix — .cci Format

**`meta.type`**: `"matrix"`  
**`ioFormat.edgeEncoding`**: `none` — рёбра запрещены

## Структура файла

```json
{
  "meta": { "type": "matrix", "version": "3.0.0" },
  "title": { "text": "Risk Matrix", "size": "M" },
  "data": {
    "groups": [
      {
        "id": "g_high_high",
        "label": "Critical",
        "color": "blue",
        "nodes": [
          { "id": "r_1", "label": "Security breach",   "size": "M" },
          { "id": "r_2", "label": "Data loss",         "size": "M" }
        ]
      },
      {
        "id": "g_high_low",
        "label": "Monitor",
        "color": "green",
        "nodes": [
          { "id": "r_3", "label": "Slow response",     "size": "M" }
        ]
      },
      {
        "id": "g_low_low",
        "label": "Acceptable",
        "color": "teal",
        "nodes": [
          { "id": "r_4", "label": "Minor UI glitch",   "size": "S" }
        ]
      }
    ]
  }
}
```

## Правила

- **Группы** = ячейки матрицы / зоны кластеризации.
- **Рёбра запрещены** — секции `data.edges`, `data.messages`, `data.relationships` не должно быть.
- Матричный overlay рисует сетку по bounding boxes групп.
- Нет ограничений на количество нод в группе.

## Разрешённые типы нод

| type | Описание |
|------|----------|
| `process` | Элемент матрицы |
| `text` | Аннотация |

## data.config (опционально)

| Поле | Тип | Описание |
|------|-----|----------|
| `aspect` | String | Соотношение сторон: `"16:9"`, `"4:3"`, `"1:1"` |
| `bgColor` | String | Фон холста: `"white"` или `"black"` |
| `showGrid` | Boolean | Показывать сетку листа в редакторе (по умолчанию `true`, omitted when true) |

> Легенда не поддерживается — информация отображается в overlay-подписях.
