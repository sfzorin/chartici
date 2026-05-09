# AI Generation Format

Chartici uses a Markdown-first AI pipeline. The model is not asked to produce full `.cci` JSON. Instead, it returns simple Markdown tables that are parsed into the current `.cci` structure.

## Why Markdown Tables?

LLMs tend to make fewer useful mistakes with Markdown tables than with nested JSON:

- missing optional columns are easier to repair
- table rows map naturally to nodes and edges
- humans can inspect and edit the output
- the same format works well in prompts and tests

## Pipeline

```text
User prompt
  -> Phase 1: planning
  -> Phase 2: Markdown tables
  -> parser
  -> quality validation
  -> optional one-shot repair
  -> .cci document
  -> layout and SVG rendering
```

## Phase 1: Planning

Defined in `src/assets/systemPrompts.js`.

The model returns:

```xml
<title>Short diagram title</title>
<type>flowchart</type>
<prompt>Expanded, type-specific generation brief</prompt>
```

Supported type values:

- `flowchart`
- `timeline`
- `tree`
- `matrix`
- `sequence`
- `erd`
- `radial`
- `piechart`

## Phase 2: Markdown Tables

Defined by each engine in `src/engines/<type>/ai_prompt.js`.

The canonical pattern is:

```markdown
# Section

### Group: Group Name | Size: M
| ID | Label | ... |
|---|---|---|
| n_1 | First item | ... |
```

The parser is tolerant of some small variations, but new prompts and tests should follow the canonical format.

## Canonical Sections

| Diagram type | Node section | Edge section |
|---|---|---|
| Flowchart | `# Steps` | encoded in `Next Steps` column |
| Timeline | `# Timeline Spine`, `# Events` | encoded with `Spine ID` |
| Tree | `# Root`, `# Branches` | encoded with `Parent ID` on branch headings |
| Matrix | `# Elements` | none |
| Sequence | `# States` | `# Messages` |
| ERD | `# Entities` | `# Relationships` |
| Radial | `# Root`, `# Branches` | encoded with `Parent ID` on branch headings |
| Pie chart | `# Pie Slices` | none |

## Parser Tolerance

The parser accepts these common model deviations:

- fenced Markdown code blocks
- `<output>...</output>`, `<response>...</response>`, `<result>...</result>` wrappers
- omitted top-level node section when `###` group headings are present
- `### Relationships` / `### Messages` used as edge-section headings
- table headers used to infer the current section

The parser removes reasoning wrappers:

- `<thinking>...</thinking>`
- `<reasoning>...</reasoning>`
- `<analysis>...</analysis>`

Those wrappers are never used as diagram content.

## Quality Gate

After parsing, `src/services/aiGenerate.js` validates the generated `.cci`:

- there must be at least one group
- node IDs must be present and unique
- labels must be present and short enough for a book figure
- flowcharts must have `nextSteps`
- timelines must have spine phases and valid `spineId` references
- sequence and ERD diagrams must have explicit relationships/messages
- matrices must have at least two zones
- diagrams must stay compact, with type-specific limits

## Repair Pass

If parsing or validation fails, Chartici asks the model to repair its own answer once.

The repair prompt includes:

- the original expanded task
- the raw failed Markdown
- the concrete parser/validator errors

The model is instructed to return only corrected Markdown tables, without explanation, JSON, or XML wrappers.

This keeps the user from seeing avoidable failures while preventing unbounded API loops.

## Adding Or Changing A Prompt

When editing `src/engines/<type>/ai_prompt.js`:

1. Keep examples compact.
2. Use stable ID prefixes.
3. Keep labels short.
4. Prefer 5-11 real nodes for book figures.
5. Avoid optional prose outside the tables.
6. Update parser tests if the table shape changes.

Run:

```bash
npm run test:engine
npm run build
```

## Related Files

- `src/services/aiGenerate.js` — generation, parser, validation, repair pass
- `src/assets/systemPrompts.js` — Phase 1 and common Phase 2 rules
- `src/engines/<type>/ai_prompt.js` — type-specific Markdown contracts
- `src/tests/engine.aiParser.test.mjs` — parser and repair regression tests
