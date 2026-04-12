# Chartici AI Intermediate Format

Этот документ описывает **промежуточный Markdown-формат**, который LLM возвращает при генерации диаграммы через AI.  
Формат не является финальным JSON — он обрабатывается парсером (`src/services/aiGenerate.js`) и конвертируется во внутренний `.cci` формат.

> **Важно:** LLM не знает про JSON. Он возвращает Markdown-таблицы. Парсер — в `aiGenerate.js`.

---

## Общие правила

- Ответ начинается с `<thinking>...</thinking>` блока (цепочка рассуждений, не парсится).
- Далее идут секции с `#` заголовками и `###` подсекциями.
- Каждая подсекция содержит Markdown-таблицу нод.
- В заголовке подсекции кодируются метаданные группы (имя, размер, цвет, родитель).
- **Язык меток:** LLM обязан сохранять язык запроса (русский → русские метки).

---

## Размеры (Size)

Каждый тип диаграммы имеет **семантическую шкалу** размеров, определённую в `engine.js → ai_prompt.semanticScale`:

| Ключ | Semantic (flowchart) | Semantic (tree) | Semantic (piechart) |
|------|---------------------|-----------------|---------------------|
| `L`  | system | parent | (highlighted slice) |
| `M`  | process | branch | (standard slice) |
| `S`  | step | leaf | (minor slice) |

В промпте LLM видит слово (например, "process"), а в таблице пишет его. Парсер маппит обратно в `S/M/L`.

---

## Flowchart

```markdown
# Steps

### Subsystem: Core Auth | Size: process
| ID | Label | Type | Next Steps |
|---|---|---|---|
| p_1 | Start | terminal | d_1 |
| d_1 | Validate Token | decision | p_2[Yes], e_1[No] |
| e_1 | Return 401 | event | |
| p_2 | Process Request | process | p_3 |
| p_3 | End | terminal | |
```

**Поля:**
- `ID` — уникальный ID (напр. `p_1`, `server_a`)
- `Label` — текст ноды
- `Type` — `terminal` | `decision` | `process` | `event`
- `Next Steps` — список ID через запятую; опционально метка: `target_id[Label]`
- Заголовок подсекции: `### Subsystem: <Имя> | Size: <size>`

---

## Tree

```markdown
# Root
| ID | Label | Size |
|---|---|---|
| root_1 | CEO | parent |

# Branches

### Branch: Engineering | Parent ID: root_1 | Size: process
| ID | Label |
|---|---|
| vp_1 | VP Engineering |
| cto_1 | CTO |
```

**Поля:**
- Секция `# Root` — одна строка с корневой нодой
- `### Branch: <Имя> | Parent ID: <ID> | Size: <size>` — каждая ветка автоматически подключается к указанному родителю
- Нода в ветке — только `ID` и `Label` (связи задаются заголовком)

---

## Radial

Аналогичен Tree (те же секции `# Root` / `# Branches`), но рёбра отображаются как безье-дуги без стрелок.

---

## Sequence

```markdown
# States

### Actor: Client | Size: action
| ID | Label |
|---|---|
| c_1 | Init Request |
| c_2 | Display Results |

### Actor: API Server | Size: action
| ID | Label |
|---|---|
| s_1 | Validate Auth |
| s_2 | Query DB |

# Messages
| Source ID | Target ID | Label | ConnectionType |
|---|---|---|---|
| c_1 | s_1 | POST /data | solid |
| s_1 | s_2 | Read DB | solid |
| s_2 | c_2 | 200 OK | dashed |
```

**Поля:**
- `### Actor: <Имя> | Size: <size>` — группа акторов (lifelines)
- Секция `# Messages` — явные рёбра; `ConnectionType`: `solid` (синхронный вызов) или `dashed` (асинхронный возврат)

---

## ERD

```markdown
# Entities

### Schema: Core Auth | Size: table
| ID | Label | Type |
|---|---|---|
| t_users | Users Table | table |
| c_id | ID | attribute |
| c_name | Profile Name | attribute |

# Relationships
| Source ID | Target ID | Label | ConnectionType |
|---|---|---|---|
| t_users | c_id | Primary Key | 1:1 |
| t_users | c_name | - | 1:1 |
```

**Поля:**
- `Type` ноды — `table` | `attribute`
- `### Schema: <Имя> | Size: <size>` — группировка по схеме
- `ConnectionType` в Relationships — кардинальность: `1:1`, `1:N`, `N:1`, `N:M`

---

## Matrix

```markdown
# Elements

### Zone: High Priority | Size: cell
| ID | Label |
|---|---|
| t_1 | Fix Database |
| t_2 | Patch Auth |

### Zone: Low Priority | Size: cell
| ID | Label |
|---|---|
| t_3 | Update CSS |
```

**Поля:**
- `### Zone: <Имя> | Size: <size>` — ячейка матрицы (кластер)
- Рёбра запрещены; нет секции Connections

---

## Timeline

```markdown
# Timeline Spine
| ID | Phase/Era Label | Color (0-11) |
|---|---|---|
| e1 | Q1 Phase | 0 |
| e2 | Q2 Phase | 2 |

# Events

### Phase: Engineering Tasks | Size: sub-event
| Spine ID | Label |
|---|---|
| e1 | Bootstrapping |
| e1 | First Deploy |
```

**Поля:**
- `# Timeline Spine` — плоский список шеврон-фаз; `Color` — индекс палитры (0–9)
- `### Phase: <Имя> | Size: <size>` — подсекция событий фазы
- `Spine ID` — ID шеврона к которому привязано событие

---

## Pie Chart

```markdown
# Pie Slices
| Title (Label) | Size | Value |
|---|---|---|
| Revenue | system | 45.5 |
| Costs | process | 30 |
| Other | step | 24.5 |
```

**Поля:**
- Единственная секция `# Pie Slices`
- `Value` — числовое (может быть дробным); парсер нормализует в проценты
- `Size` — семантика: `system` (выделенный) / `process` (стандарт) / `step` (приглушённый)
- Максимум 9 секторов (`enforceMaxNodes: 9`)

---

## Сводная таблица секций по типам

| Тип | Главные секции | Подсекции |
|-----|---------------|-----------|
| `flowchart` | `# Steps` | `### Subsystem: <N> \| Size: <S>` |
| `tree` | `# Root`, `# Branches` | `### Branch: <N> \| Parent ID: <ID> \| Size: <S>` |
| `radial` | `# Root`, `# Branches` | `### Branch: <N> \| Parent ID: <ID> \| Size: <S>` |
| `sequence` | `# States`, `# Messages` | `### Actor: <N> \| Size: <S>` |
| `erd` | `# Entities`, `# Relationships` | `### Schema: <N> \| Size: <S>` |
| `matrix` | `# Elements` | `### Zone: <N> \| Size: <S>` |
| `timeline` | `# Timeline Spine`, `# Events` | `### Phase: <N> \| Size: <S>` |
| `piechart` | `# Pie Slices` | *(нет)* |

---

*Промпты: `src/engines/<тип>/ai_prompt.js → getPrompt(schema, sMap)`*  
*Парсер: `src/services/aiGenerate.js`*  
*Актуально: апрель 2026.*
