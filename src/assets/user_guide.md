# AI Agent Implementation Guide

> **Author:** [Sergey Zorin](https://www.linkedin.com/in/sfzorin/)

**CHARTICI** is a **Declarative Diagramming Engine** driven by algorithms. The user (or AI) provides unstructured or semi-structured data (Nodes and Connections), and Chartici's engine automatically computes their optimal grid coordinates, aligning them into beautiful, deterministic, non-intersecting layouts.

### Core Philosophy
- **Deterministic Math**: There is no manual dragging of connection lines. Every route between nodes is calculated using a specialized Orthogonal A* Pathfinding algorithm to guarantee perfect grid alignment, shared trunks, and rounded corners.
- **Design Tokens**: Node colors, borders, and styles are controlled by centralized numerical color palettes. You simply assign an integer `color` token (`1` through `9` for solid fill colors) and the engine gracefully translates them into accessible, curated CSS palettes like `vibrant-rainbow` or `blue-teal-slate`.

---

## File Format (`.cci` v3.0.0)

The system operates exclusively on the `.cci` `v3.0.0` file format. This is a strict **JSON** schema containing all data necessary for rendering, designed to drastically minimize boilerplate through implicit structural routing.

### Global Structure

```json
{
  "meta": {
    "type": "flowchart",
    "version": "3.0.0"
  },
  "title": { "text": "My System", "size": "L" },
  "theme": "blue-teal-slate",
  "data": {
    "groups": [ ... ],
    "relationships": [ ... ] 
  },
  "texts": [ ... ]
}
```

- **`title`**: The main title of the diagram containing `text` and `size` parameters.
- **`theme`**: Defines the overall visual color palette. Valid options: `"muted-rainbow"`, `"vibrant-rainbow"`, `"grey"`, `"red"`, `"green"`, `"blue"`, `"brown"`, `"purple"`, `"blue-orange"`, `"green-purple"`, `"slate-rose"`, `"blue-teal-slate"`, `"indigo-green-red"`, `"brown-amber-grey"`.
- **`meta.type`**: **CRITICAL PARAMETER.** Defines the structural layout. Valid options:
   - `"flowchart"`: For step-by-step processes or algorithms.
   - `"tree"`: For hierarchical data, including Org Charts, Decision Trees, Concept Maps, and File Systems.
   - `"sequence"`: For interactions over time (vertical lifelines).
   - `"erd"`: For static data architecture and structured relationships.
   - `"radial"`: For Mind Maps, stakeholder maps radiating from a central hub.
   - `"timeline"`: For project roadmaps, historical timelines, release planning.
   - `"matrix"`: For SWOT analysis, priority matrices, product positioning maps.
   - `"piechart"`: For proportional breakdown of elements in a pie graph.

### The v3.0.0 Implicit Graph System

Unlike legacy systems that require a massive flat array of `edges` to draw connections, Chartici v3.0.0 uses **implicit structural references** directly embedded inside nodes or groups. 
The global `data.edges` array has been completely removed for most diagram types.

1. **`nextSteps`** (Flowchart, Tree, Radial): Assign a comma-separated string to any node to dynamically generate outbound lines. Supported label syntax: `targetId[Label string]`.
   - Example Node: `{ "id": "n1", "label": "Has Account?", "nextSteps": "n2[Yes], n3[No]" }`
2. **`parentId`** (Tree, Radial): Assign to a `group` to inherently link its nodes to a parent. 
   - Example Group: `{ "label": "Layer 2", "parentId": "center_node", "nodes": [...] }`
3. **`spineId`** (Timeline): Assign to any event node to link it directly to a chronological spine chevron.

**Exceptions**: ERD uses explicit `relationships: [...]` arrays, and Sequence uses explicit `messages: [...]` arrays, since their models are highly rigid.

### Groups & Nodes Array

Chartici is built around grouping. Nodes are securely nested inside Groups. A Group represents a boundary or layer, and universally cascades its visual properties.

```json
{
  "label": "Backend Services",
  "color": 3,
  "type": "rect",
  "size": "L",
  "nodes": [
    { "id": "api_gw", "label": "API Gateway", "nextSteps": "psql_db" },
    { "id": "psql_db", "label": "PostgreSQL" }
  ]
}
```

- **Group Level Settings**:
  - **`color`**: Styling for the group itself. These styles **cascade** down and bind the `nodes` inside it.
  - **`type`**: The graphical shape of the child nodes. Valid options: `"rect"` (default), `"circle"`, `"rhombus"`, `"oval"`, `"chevron"`.
  - **`size`**: Physical scale of nodes (`"S"`, `"M"`, `"L"`).
  - **`parentId`**: Inherently routes a connection from the designated string ID to this group.
- **Node Level Settings**:
  - **`id`**: Unique identifier.
  - **`label`**: The display string inside the node.
  - **`nextSteps`**: Commas separated identifiers (with optional `[labels]`) for outbound arrows.
  - **`value`**: Numeric value, specifically used in Piechart.

### Explicit Edges (ERD & Sequence Only)

Only used in explicit arrays (`relationships` or `messages`).
```json
{
  "sourceId": "api_gw",
  "targetId": "psql_db",
  "label": "Fetch Data",
  "lineStyle": "dashed",
  "connectionType": "1:N"
}
```

- **`connectionType`**: Used in ERD. Must strictly be one of `"1:1"`, `"1:N"`, `"N:1"`, `"N:M"`.
- **`lineStyle`**: `"solid"` (default), `"dashed"`, `"dotted"`, `"none"`.

### Floating Annotations (`texts` array)

For loose, free-floating text labels outside of node structures, populate the root `texts` array.

```json
"texts": [
  { "id": "txt_1", "text": "Draft Diagram", "size": "S", "color": 0 }
]
```

---

## Operations & Rules

1. **Hoist Visual Rules to Groups**: Do not assign `size` and `type` directly to standard nodes. They must be defined on the wrapper Group. The only exception is Piecharts, which are fully flat and define values locally.
2. **Assign Logical Semantic Colors by Index**: Use color indexes `1-9` for distinct core systems. Do not use integer 10.
3. **JSON Purity**: ALWAYS ensure `.cci` files are mathematically valid. 
4. **Timeline Spines**: Use `chevron` type nodes for central time periods. Then, link standard events (`circle` or `process` nodes) to those chevrons using `node.spineId`.

---

## MCP Integration

Chartici includes a **Model Context Protocol (MCP)** server that allows AI assistants to render diagrams directly.

### Available Tools
- **`render_diagram`** — Takes `.cci` JSON, runs the full layout engine, and returns a complete SVG image.
- **`save_diagram`** — Saves a `.cci` file to disk.
- **`list_samples`** / **`read_sample`** — Browse and read example diagrams for reference.
