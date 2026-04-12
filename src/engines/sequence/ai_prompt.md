# Sequence — AI Prompt Format (Step 2)

Промежуточный Markdown-формат, который LLM возвращает на шаге 2 генерации.  
Парсер: `src/services/aiGenerate.js`

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
