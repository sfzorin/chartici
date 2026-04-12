# Pie Chart — .cci Format

**`meta.type`**: `"piechart"`  
**`ioFormat.edgeEncoding`**: `none`, `flatNodes: true` — плоский `data.nodes[]`, без групп и рёбер

## Структура файла

```json
{
  "meta": { "type": "piechart", "version": "3.0.0" },
  "title": { "text": "Market Share", "size": "M" },
  "data": {
    "nodes": [
      { "id": "s_1", "label": "Android",  "value": 63.3, "color": 1, "size": "M" },
      { "id": "s_2", "label": "iOS",      "value": 28.7, "color": 2, "size": "M" },
      { "id": "s_3", "label": "Other",    "value": 8.0,  "color": 3, "size": "S" }
    ]
  }
}
```

## Правила

- **Плоский `data.nodes[]`** — без `data.groups`, без `data.edges`.
- `value` — числовое (может быть дробным); нормализуется в проценты автоматически.
- Максимум **9 секторов** (`enforceMaxNodes: 9`).
- `color` автоинкрементируется если не задан явно (1, 2, 3…).
- `type` ноды — всегда `"pie_slice"` (задаётся автоматически при отсутствии).
- `size: "L"` — сектор визуально **выдвинут наружу** (explode ~28px по mid-angle); `"M"` — стандарт. Только два значения.
- Рёбра и группы **строго запрещены**.

## Поля ноды (`nodes[]`)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String | Уникальный ID |
| `label` | String | Метка сектора |
| `value` | Number | Значение (нормализуется автоматически) |
| `color` | Number | Индекс палитры 1–9 |
| `size` | `M` \| `L` | `M` — нормальный, `L` — выдвинутый наружу |

## data.config (опционально)

| Поле | Тип | Описание |
|------|-----|----------|
| `aspect` | String | Соотношение сторон: `"16:9"`, `"4:3"`, `"1:1"`, `"A4"` |
| `bgColor` | String | Фон холста: `"white"`, `"black"`, `"transparent"` и т.д. |
| `showLegend` | Boolean | Показывать легенду групп (по умолчанию `false`, omitted when false) |
| `legendX` | Number | Залоченная X-координата легенды (omitted = авто-позиция) |
| `legendY` | Number | Залоченная Y-координата легенды (omitted = авто-позиция) |
