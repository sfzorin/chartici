# Pie Chart — AI Prompt Format (Step 2)

Промежуточный Markdown-формат, который LLM возвращает на шаге 2 генерации.  
Парсер: `src/services/aiGenerate.js`

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
