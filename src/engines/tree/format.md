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
        "color": 1,
        "nodes": [
          { "id": "ceo_1", "label": "CEO", "size": "L" }
        ]
      },
      {
        "id": "g_eng",
        "label": "Engineering",
        "parentId": "ceo_1",
        "color": 2,
        "nodes": [
          { "id": "vp_1", "label": "VP Engineering" },
          { "id": "cto_1", "label": "CTO" }
        ]
      },
      {
        "id": "g_design",
        "label": "Design",
        "parentId": "ceo_1",
        "color": 3,
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
| `color` | Number | Индекс палитры 1–9 |
