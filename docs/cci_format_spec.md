# Chartici .CCI Format Specification

Формат `.cci` (Chartici Concept Interchange) — JSON-документ для сохранения, загрузки и обмена диаграммами.  
Версия: **3.0.0** (актуальная). Версии 1.x принимаются без изменений — парсер обратно совместим.

---

## 1. Структура верхнего уровня

```json
{
  "meta": {
    "type": "flowchart",
    "version": "3.0.0"
  },
  "theme": "default",
  "title": {
    "text": "My Diagram",
    "size": "M",
    "x": 800,
    "y": 40
  },
  "data": {
    "config": {
      "aspect": "16:9",
      "bgColor": "dark"
    },
    "groups": [],
    "edges": []
  }
}
```

### `meta` (обязательно)

| Поле | Тип | Описание |
|------|-----|----------|
| `type` | String | Тип диаграммы. Значения: `flowchart`, `tree`, `radial`, `sequence`, `erd`, `matrix`, `timeline`, `piechart` |
| `version` | String | Версия формата. Актуальная: `"3.0.0"` |

### `theme` (опционально)

Строка — ключ палитры из `PALETTES` (`src/diagram/colors.js`).  
Примеры: `"default"`, `"muted-rainbow"`, `"ocean"`. Если отсутствует — используется тема по умолчанию.

### `title` (опционально)

Блок заголовка диаграммы. Рендерится как нода типа `title` с ID `__SYSTEM_TITLE__`.

| Поле | Тип | Описание |
|------|-----|----------|
| `text` | String | Текст заголовка |
| `size` | String | `S`, `M` (default), `L` |
| `x` | Number | Явная X-координата. Если отсутствует — позиция вычисляется авто-лэйаутом |
| `y` | Number | Явная Y-координата |

### `data.config` (опционально)

| Поле | Тип | Описание |
|------|-----|----------|
| `aspect` | String | Соотношение сторон холста: `"16:9"`, `"4:3"`, `"1:1"`, `"free"` |
| `bgColor` | String | Цвет фона: `"light"`, `"dark"` или CSS hex |

---

## 2. Группы (`data.groups`)

Все ноды живут внутри групп. Группа определяет контейнер и лэйаут для дочерних нод.

```json
{
  "id": "g_abc123",
  "label": "Authentication",
  "type": "rect",
  "size": "M",
  "color": 3,
  "outlined": false,
  "nodeType": "process",
  "nodes": [ ... ]
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String | Уникальный ID группы. Если отсутствует — генерируется при загрузке |
| `label` | String | Заголовок группы (опционально) |
| `type` | String | Форма контейнера: `rect`, `ellipse`, `none`, `piechart`. По умолчанию `rect` |
| `size` | String | Размер группы: `S`, `M`, `L`. Наследуется нодами если `node.size` не задан |
| `color` | Number | Индекс палитры 1–9 (0 = чёрный, 10 = прозрачный) |
| `outlined` | Boolean | Если `true` — контур вместо заливки у всей группы |
| `nodeType` | String | Подсказка для авто-лэйаута какой тип нод в группе (опционально) |
| `nodes` | Array | Список нод (см. раздел 3) |

---

## 3. Ноды (`group.nodes[]`)

```json
{
  "id": "auth_1",
  "label": "Validate Token",
  "type": "rhombus",
  "size": "M",
  "color": 2,
  "x": 400,
  "y": 200,
  "lockPos": true
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | String | **Обязательно.** Уникальный ID среди всех нод диаграммы |
| `label` | String | Текст ноды. Переносы через `\n` |
| `type` | String | Тип ноды — см. таблицу ниже |
| `size` | String | `S`, `M`, `L`. При отсутствии наследуется от группы |
| `color` | Number/String | Индекс палитры 0–10, или CSS hex-строка (`"#ff5533"`) |
| `value` | Number | Численное значение (обязательно для `pie_slice`) |
| `x`, `y` | Number | Явные логические координаты (опционально) |
| `lockPos` | Boolean | Если `true` — авто-лэйаут не двигает ноду |
| `fontStyle` | String | `"bold"`, `"italic"` |
| `borderStyle` | String | `"dashed"` — пунктирная обводка |

### Типы нод (`type`)

| Значение | Форма | Примечания |
|----------|-------|------------|
| `process` | Прямоугольник | Основная универсальная нода |
| `circle` | Круг | |
| `oval` | Овал / Pill | |
| `rhombus` | Ромб | |
| `text` | Только текст | Без рамки, без заливки; динамический размер |
| `title` | Заголовок | Крупный текст; цвет/группа не меняются в UI |
| `chevron` | Шеврон-стрелка | Только для `timeline` |
| `pie_slice` | Сектор пирога | Только для `piechart`; требует `value` |

---

## 4. Рёбра (`data.edges[]`)

```json
{
  "sourceId": "auth_1",
  "targetId": "auth_2",
  "label": "Yes",
  "lineStyle": "solid",
  "connectionType": "target"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `sourceId` | String | **Обязательно.** ID исходной ноды |
| `targetId` | String | **Обязательно.** ID целевой ноды |
| `label` | String | Текст на ребре (опционально) |
| `lineStyle` | String | Стиль линии — см. таблицу ниже |
| `connectionType` | String | Направление стрелки (`target`/`reverse`/`both`/`none`) или кардинальность ERD (`1:1`, `1:N`…) |

### `lineStyle` (из `LINE_STYLE_REGISTRY`)

| Значение | Вид | Экспортируется в SVG |
|----------|-----|---------------------|
| `solid` | Сплошная 2px | ✓ |
| `dashed` | Пунктир `5,5` 2px | ✓ |
| `hidden` | Пунктир 40% прозрачности | ✗ (только визуально, не в SVG) |
| `none` | Пунктир 40% прозрачности | ✗ (только визуально, не в SVG) |

> `hidden` / `none` — технические рёбра (топологические связи). Для timeline: spine-to-spine рёбра должны иметь `lineStyle: "none"`.

### `connectionType` — направление стрелок и кардинальность ERD

**Направление стрелок:**

| Значение | Стрелка |
|----------|---------|
| `target` | → |
| `reverse` | ← |
| `both` | ↔ |
| `none` | — (без стрелок) |

**Кардинальность ERD** (только `meta.type: "erd"`):

| Значение | Маркеры |
|----------|---------|
| `1:1` | one — one |
| `1:N` | one — many |
| `N:1` | many — one |
| `N:M` | many — many |

---

## 5. Особенности по типам диаграмм

### Flowchart

## 5. Матрица форматов по типам

Каждый тип диаграммы имеет тип-специфичную кодировку связей, описанную в `engine.schema.ioFormat`.  
Подробный JSON-пример и правила — в `format.md` каждого плагина.

| Тип | Кодировка связей | Ключ в `data` | Документация |
|-----|------------------|---------------|--------------|
| `flowchart` | `nextSteps` на ноде | `data.groups` | [`src/engines/flowchart/format.md`](../src/engines/flowchart/format.md) |
| `tree` | `parentId` на группе | `data.groups` | [`src/engines/tree/format.md`](../src/engines/tree/format.md) |
| `radial` | `parentId` на группе | `data.groups` | [`src/engines/radial/format.md`](../src/engines/radial/format.md) |
| `sequence` | явные рёбра | `data.messages[]` | [`src/engines/sequence/format.md`](../src/engines/sequence/format.md) |
| `erd` | явные рёбра | `data.relationships[]` | [`src/engines/erd/format.md`](../src/engines/erd/format.md) |
| `matrix` | нет рёбер | `data.groups` | [`src/engines/matrix/format.md`](../src/engines/matrix/format.md) |
| `timeline` | `spineId` на ноде | `data.groups` | [`src/engines/timeline/format.md`](../src/engines/timeline/format.md) |
| `piechart` | нет рёбер | `data.nodes[]` плоский | [`src/engines/piechart/format.md`](../src/engines/piechart/format.md) |

### `ioFormat` в схеме плагина

```js
// Пример: flowchart
ioFormat: { edgeEncoding: 'nextSteps', connectionField: 'nextSteps', level: 'node' }

// Пример: sequence
ioFormat: { edgeEncoding: 'explicit', edgeKey: 'messages' }

// Пример: piechart
ioFormat: { edgeEncoding: 'none', flatNodes: true }
```

### Круговорот данных

```
.cci файл
  ↓ parseCharticiFile()
    → resolveImplicitEdges(flatNodes, groups)   ← engine.parser
    → explicit edges (data.messages / data.relationships)
  → внутренний граф {nodes, edges, groups}
  → DiagramRenderer
  ↑ downloadCharticiFile()
    → engine.parser.exportEdges(gMap, edges, explicitEdges)
    → тип-специфичный payload
.cci файл
```

---

## 6. Пример по типам

### Flowchart — `nextSteps` в ноде

```json
{
  "meta": { "type": "flowchart", "version": "3.0.0" },
  "title": { "text": "Auth Flow", "size": "M" },
  "data": {
    "groups": [
      {
        "id": "g_1", "label": "Entry", "color": 1,
        "nodes": [
          { "id": "n_start", "label": "Request",       "type": "oval",    "nextSteps": "n_check" },
          { "id": "n_check", "label": "Valid token?",  "type": "rhombus", "nextSteps": "n_ok[Yes], n_err[No]" }
        ]
      },
      {
        "id": "g_2", "label": "Results", "color": 3,
        "nodes": [
          { "id": "n_ok",  "label": "200 OK",     "type": "oval", "size": "S" },
          { "id": "n_err", "label": "401 Denied", "type": "oval", "size": "S" }
        ]
      }
    ]
  }
}
```

### Tree — `parentId` на группе

```json
{
  "meta": { "type": "tree", "version": "3.0.0" },
  "data": {
    "groups": [
      {
        "id": "g_root", "label": "Root", "color": 1,
        "nodes": [ { "id": "ceo", "label": "CEO", "size": "L" } ]
      },
      {
        "id": "g_eng", "label": "Engineering", "parentId": "ceo", "color": 2,
        "nodes": [
          { "id": "vp_eng", "label": "VP Engineering" },
          { "id": "cto_1",  "label": "CTO" }
        ]
      }
    ]
  }
}
```

---

*Реестры: `src/diagram/nodes.jsx` (NODE_REGISTRY), `src/diagram/edges.js` (LINE_STYLE_REGISTRY)*  
*Движки: `src/engines/<type>/engine.js` — schema.ioFormat*  
*Экспорт/импорт: `src/utils/charticiFormat.js`*  
*Актуально: апрель 2026.*
