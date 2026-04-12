# Timeline — AI Prompt Format (Step 2)

Промежуточный Markdown-формат, который LLM возвращает на шаге 2 генерации.  
Парсер: `src/services/aiGenerate.js`

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
