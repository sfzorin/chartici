# Chartici Guide

Chartici creates editable SVG diagrams from examples, manual editing, or AI-generated Markdown tables.

## Supported Diagrams

- Flowchart
- Timeline
- Tree / hierarchy
- Matrix
- Sequence
- Entity-Relationship
- Radial map
- Pie chart

## AI Workflow

1. Describe the diagram.
2. Review the AI plan.
3. Build the diagram.
4. Edit the result manually.
5. Export SVG or save `.cci`.

If the model returns malformed Markdown, Chartici sends one repair request with the concrete parser errors. If repair fails, the welcome modal stays open and shows the error.

## `.cci` Format

Chartici project files are JSON with a `.cci` extension.

```json
{
  "meta": { "type": "flowchart", "version": "3.0.0" },
  "theme": "basic",
  "title": { "text": "Example", "size": "M" },
  "data": {
    "config": { "aspect": "16:9", "bgColor": "white", "showGrid": false },
    "groups": []
  }
}
```

Current palette keys:

- `basic`
- `ink`
- `library`
- `copper`
- `atlas`

## Groups

Groups provide structure and shared styling. Depending on the diagram type, a group can represent a subsystem, lane, branch, matrix zone, schema, or event category.

Common group fields:

| Field | Description |
|---|---|
| `id` | Unique group ID |
| `label` | Group label |
| `color` | Palette index `1..9` |
| `type` | Default node type for the group |
| `size` | Default node size |
| `parentId` | Parent node ID for tree/radial diagrams |

## Nodes

Common node fields:

| Field | Description |
|---|---|
| `id` | Unique node ID |
| `label` | Visible label |
| `type` | Shape type |
| `size` | `S`, `M`, or `L` |
| `color` | Palette index or custom hex |
| `nextSteps` | Flowchart links |
| `spineId` | Timeline event attachment |
| `value` | Pie chart value |

Common node types:

- `process`
- `circle`
- `oval`
- `rhombus`
- `chevron`
- `pie_slice`
- `text`

Each diagram type allows only the node types that make sense for that topology.

## Edges

Edge storage depends on the diagram type:

| Type | Edge storage |
|---|---|
| Flowchart | `node.nextSteps` |
| Tree | `group.parentId` |
| Radial | `group.parentId` |
| Timeline | `node.spineId` |
| Sequence | `data.messages[]` |
| ERD | `data.relationships[]` |
| Matrix | no edges |
| Pie chart | no edges |

Explicit edges use:

```json
{
  "sourceId": "a",
  "targetId": "b",
  "label": "Optional label",
  "lineStyle": "solid",
  "connectionType": "target"
}
```

ERD `connectionType` values:

- `1:1`
- `1:N`
- `N:1`
- `N:M`

## Export

SVG export removes editor-only UI, removes watermarks, bakes CSS variables into colors, and crops the SVG to the paper sheet.

Use `.cci` when you need to preserve editability.

## References

See the repository docs for deeper details:

- `docs/user_guide.md`
- `docs/ai_prompt_format.md`
- `docs/engine_architecture.md`
- `src/engines/<type>/format.md`
