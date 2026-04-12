# Timeline — .cci Format

**`meta.type`**: `"timeline"`  
**`ioFormat.edgeEncoding`**: `spineId` — событие-нода хранит ID своего шеврона в `node.spineId`

## Структура файла

```json
{
  "meta": { "type": "timeline", "version": "3.0.0" },
  "title": { "text": "Q1–Q2 Roadmap", "size": "M" },
  "data": {
    "groups": [
      {
        "id": "g_spine",
        "label": "Spine",
        "type": "chevron",
        "nodes": [
          { "id": "ch_q1", "label": "Q1 2025", "type": "chevron", "color": 1, "size": "M" },
          { "id": "ch_q2", "label": "Q2 2025", "type": "chevron", "color": 2, "size": "M" }
        ]
      },
      {
        "id": "g_events",
        "label": "Milestones",
        "color": 3,
        "nodes": [
          { "id": "ev_1", "label": "Launch beta",   "spineId": "ch_q1", "size": "S" },
          { "id": "ev_2", "label": "First deploy",  "spineId": "ch_q1", "size": "S" },
          { "id": "ev_3", "label": "GA Release",    "spineId": "ch_q2", "size": "M" }
        ]
      }
    ]
  }
}
```

## Правила

- **Шеврон-группа**: одна группа с нодами типа `chevron` — визуальный «позвоночник» таймлайна.
- **Событие-ноды**: имеют `spineId` — ID шеврона, к которому событие привязано.
- **Нет** секции `data.edges` — связи восстанавливаются через `resolveImplicitEdges` из `spineId`.
- Шевроны связываются между собой автоматически движком в порядке следования.
- `lineStyle: "dashed"`, `arrowType: "none"` у event → spine рёбер (авто).

## Разрешённые типы нод

| type | Описание |
|------|----------|
| `chevron` | Фаза / период на спине таймлайна |
| `process` | Событие / задача, привязанная к шеврону |
| `text` | Аннотация |

## Поля ноды-события

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String | Уникальный ID |
| `label` | String | Текст события |
| `spineId` | String | ID шеврона — обязательно для событий |
| `size` | `S` \| `M` \| `L` | Размер |
