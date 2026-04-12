# Pie Chart — .cci Format

**`meta.type`**: `"piechart"`  
**`ioFormat.edgeEncoding`**: `none` — стандартные `data.groups[]`, без рёбер

## Структура файла

```json
{
  "meta": { "type": "piechart", "version": "3.0.0" },
  "title": { "text": "Market Share", "size": "M" },
  "data": {
    "groups": [
      { "id": "s_1", "type": "pie_slice", "color": 1, "nodes": [{ "id": "s_1", "label": "Android", "value": 63.3 }] },
      { "id": "s_2", "type": "pie_slice", "color": 2, "nodes": [{ "id": "s_2", "label": "iOS", "value": 28.7, "size": "L" }] },
      { "id": "s_3", "type": "pie_slice", "color": 3, "nodes": [{ "id": "s_3", "label": "Other", "value": 8.0 }] }
    ]
  }
}
```

## Правила

- **`data.groups[]`** — стандартный формат: каждый сектор = отдельная группа с 1 нодой.
- Если в группе несколько нод — рисуются отдельными секторами, но с одним цветом/размером.
- `value` — числовое (может быть дробным); нормализуется в проценты автоматически.
- Максимум **9 секторов** (`enforceMaxNodes: 9`).
- `color` автоинкрементируется если не задан явно (1, 2, 3…).
- `type` группы/ноды — всегда `"pie_slice"`.
- `size: "L"` — сектор визуально **выдвинут наружу** (explode ~36px по mid-angle); `"M"` — стандарт. Только два значения.
- Рёбра **строго запрещены** (`edgeEncoding: none`).

## Поля группы (`groups[]`)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String | Уникальный ID группы |
| `type` | `"pie_slice"` | Тип ноды |
| `color` | Number | Индекс палитры 1–9 |
| `nodes` | Array | Массив нод (обычно 1 нода) |

## Поля ноды (`nodes[]` внутри группы)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String | Уникальный ID |
| `label` | String | Метка сектора |
| `value` | Number | Значение (нормализуется автоматически) |
| `size` | `M` \| `L` | `M` — нормальный, `L` — выдвинутый наружу |

## data.config (опционально)

| Поле | Тип | Описание |
|------|-----|----------|
| `aspect` | String | Соотношение сторон: `"16:9"`, `"4:3"`, `"1:1"`, `"A4"` |
| `bgColor` | String | Фон холста: `"white"`, `"black"`, `"transparent"` и т.д. |
| `showLegend` | Boolean | Показывать легенду (по умолчанию `false`, omitted when false) |
| `legendX` | Number | Залоченная X-координата легенды (omitted = авто-позиция) |
| `legendY` | Number | Залоченная Y-координата легенды (omitted = авто-позиция) |
| `legendSize` | `S` \| `M` \| `L` | Размер легенды (omitted = `M`) |
