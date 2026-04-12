# Flowchart — .cci Format

**`meta.type`**: `"flowchart"`  
**`ioFormat.edgeEncoding`**: `nextSteps` — исходящие связи хранятся в поле `node.nextSteps`

## Структура файла

```json
{
  "meta": { "type": "flowchart", "version": "3.0.0" },
  "theme": "muted-rainbow",
  "title": { "text": "Auth Flow", "size": "M" },
  "data": {
    "config": { "aspect": "16:9", "bgColor": "white" },
    "groups": [
      {
        "id": "g_entry",
        "label": "Entry Point",
        "color": 1,
        "nodes": [
          { "id": "p_start", "label": "Request",       "type": "oval",    "size": "M" },
          { "id": "d_check", "label": "Valid token?",  "type": "rhombus", "nextSteps": "p_ok[Yes], p_err[No]" }
        ]
      },
      {
        "id": "g_result",
        "label": "Results",
        "color": 3,
        "nodes": [
          { "id": "p_ok",  "label": "200 OK",     "type": "oval", "size": "S" },
          { "id": "p_err", "label": "401 Denied", "type": "oval", "size": "S" }
        ]
      }
    ]
  }
}
```

## Правила

- **Группы** = логические подсистемы. Нода принадлежит ровно одной группе.
- **Связи** кодируются в `node.nextSteps` — список через запятую:
  - Без метки: `"p_2"`
  - С меткой: `"p_2[Yes]"`
  - Несколько: `"p_2[Yes], e_1[No]"`
- **Нет** секции `data.edges` — связи при импорте восстанавливаются через `resolveImplicitEdges`.
- `lineStyle` и `connectionType` задаются на самом ребре при экспорте — в `nextSteps` не хранятся.  
  По умолчанию: `solid`, `target`.

## Разрешённые типы нод

| type | Описание |
|------|----------|
| `process` | Стандартный прямоугольник |
| `circle` | Круг |
| `oval` | Овал / стартовое/конечное состояние |
| `rhombus` | Ромб / ветвление |
| `text` | Аннотация без рамки |

## Конфиг группы

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String | Уникальный ID |
| `label` | String | Заголовок подсистемы |
| `color` | Number | Индекс палитры 1–9 |
| `outlined` | Boolean | Контурный стиль |
