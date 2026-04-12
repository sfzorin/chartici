# Tree — AI Prompt Format (Step 2)

Промежуточный Markdown-формат, который LLM возвращает на шаге 2 генерации.  
Парсер: `src/services/aiGenerate.js`

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
