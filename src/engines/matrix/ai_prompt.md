# Matrix — AI Prompt Format (Step 2)

Промежуточный Markdown-формат, который LLM возвращает на шаге 2 генерации.  
Парсер: `src/services/aiGenerate.js`

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
