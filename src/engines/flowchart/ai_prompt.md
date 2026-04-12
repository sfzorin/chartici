# Flowchart — AI Prompt Format (Step 2)

Промежуточный Markdown-формат, который LLM возвращает на шаге 2 генерации.  
Парсер: `src/services/aiGenerate.js`

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
