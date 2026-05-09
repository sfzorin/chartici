# Chartici User Guide

Chartici is an editor for concise technical diagrams. It can generate a first draft with AI, but every generated diagram is a normal editable Chartici document.

## Basic Workflow

1. Open the app.
2. Choose an example or describe the diagram you want.
3. Review the AI plan.
4. Build the diagram.
5. Edit labels, groups, colors, nodes, and connections.
6. Export SVG or save a `.cci` project file.

## AI Generation

The welcome modal has two steps:

- **Plan Diagram:** the model selects the diagram type and expands your request.
- **Build Diagram:** the model returns Markdown tables, Chartici parses them, validates the structure, and lays out the diagram.

If the model returns malformed Markdown, Chartici sends one repair request back to the model with the validation errors. If the repair also fails, the app keeps you in the welcome modal and shows the error. The editor should always keep a valid sheet visible, even for a blank project.

## Diagram Types

Use fewer types well. These are the supported diagram types:

| Type | Use it for |
|---|---|
| Flowchart | Decisions, procedures, pipelines, cause/effect flows |
| Timeline | Phases, milestones, chronology, evolution over time |
| Tree | Hierarchies, taxonomies, org structures, nested concepts |
| Matrix | 2x2 or grouped comparisons without edges |
| Sequence | Ordered interactions across actors or systems |
| ERD | Entity relationships with cardinality |
| Radial | Hub-and-spoke maps, concept maps, system maps |
| Pie chart | Simple proportional breakdowns |

## Editing

### Nodes

Select a node to edit:

- shape
- size
- color
- label
- group
- lock position
- delete
- start a connection

Node types are constrained by the current diagram type. For example, ERD entities use block nodes; pie charts use pie-slice nodes.

### Edges

Select an edge to edit:

- line style
- arrow direction
- ERD cardinality
- label
- delete

Some diagrams derive edges from node or group fields:

- Flowchart: `nextSteps`
- Tree/radial: group `parentId`
- Timeline: event `spineId`

Sequence and ERD use explicit edge arrays.

### Groups

Groups provide semantic structure and color. Depending on diagram type, groups mean:

- subsystem in a flowchart
- branch in a tree
- actor lane in a sequence diagram
- zone in a matrix
- schema/domain in an ERD
- event category in a timeline

## Themes And Palettes

Current palette keys:

- `basic`
- `ink`
- `library`
- `copper`
- `atlas`

Use `basic` as the default unless the diagram belongs to a section of the book that needs a distinct tone.

## Exporting

### SVG

SVG export is intended for publishing workflows:

- no watermark
- editor-only selection handles are removed
- CSS custom properties are baked into concrete colors
- the exported viewBox is cropped to the diagram sheet

### CCI

Use `.cci` to save an editable Chartici project. `.cci` files are JSON and can be reviewed or generated manually.

## Writing Good Prompts

Good prompts mention:

- the topic
- the target diagram type if you know it
- the audience
- desired scope
- important entities or phases

Examples:

```text
Timeline for how a technical book chapter evolves from idea to edited manuscript.
```

```text
Flowchart showing how an author decides whether a concept needs a figure, a table, or prose.
```

```text
Matrix comparing chapter ideas by reader value and research effort.
```

## Troubleshooting

### AI returned a low-quality diagram

The validator rejected the output. Try a narrower prompt with fewer concepts, or specify the diagram type explicitly.

### AI returned unexpected format

The model returned text that could not be repaired into Markdown tables. Try again; the repair pass catches many but not all malformed answers.

### The sheet is empty

A blank project is valid. Add a node with the plus button, open an example, or generate a new diagram.

### Exported SVG looks wrong

Please open an issue with:

- the `.cci` file
- the exported SVG
- the browser and OS
- whether the issue appears in the browser or only in another SVG viewer

## Format References

- [AI prompt format](ai_prompt_format.md)
- [Engine architecture](engine_architecture.md)
- `src/engines/<type>/format.md`
