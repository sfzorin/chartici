# ERD — AI Prompt Format (Step 2)

Промежуточный Markdown-формат, который LLM возвращает на шаге 2 генерации.  
Парсер: `src/services/aiGenerate.js`

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
