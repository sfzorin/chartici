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
        "color": 9,
        "nodes": [
          { "id": "r_1", "label": "Security breach",   "size": "M" },
          { "id": "r_2", "label": "Data loss",         "size": "M" }
        ]
      },
      {
        "id": "g_high_low",
        "label": "Monitor",
        "color": 4,
        "nodes": [
          { "id": "r_3", "label": "Slow response",     "size": "M" }
        ]
      },
      {
        "id": "g_low_low",
        "label": "Acceptable",
        "color": 2,
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
