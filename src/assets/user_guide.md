# AI Agent Implementation Guide

> **Author:** [Sergey Zorin](https://www.linkedin.com/in/sfzorin/)

**CHARTICI** is a **Declarative Diagramming Engine** driven by algorithms. The user (or AI) provides unstructured or semi-structured data (Nodes and Connections), and Chartici's engine automatically computes their optimal grid coordinates, aligning them into beautiful, deterministic, non-intersecting layouts.

### Core Philosophy
- **Deterministic Math**: There is no manual dragging of connection lines. Every route between nodes is calculated using a specialized Orthogonal A* Pathfinding algorithm to guarantee perfect grid alignment, shared trunks, and rounded corners.
- **Design Tokens**: Node colors, borders, and styles are controlled by centralized numerical color palettes. You simply assign an integer `color` token (`1` through `9` for solid fill colors) and the engine gracefully translates them into accessible, curated CSS palettes like `vibrant-rainbow` or `blue-teal-slate`.

---

## File Format (`.cci`)

The system operates exclusively on the `.cci` file format. This is a strict **JSON** schema containing all data necessary for rendering. 

### Global Structure

```json
{
  "type": "cci_project",
  "title": "My Architecture Diagram",
  "aspect": "16:9",
  "diagramType": "flowchart",
  "theme": "blue-teal-slate",
  "data": {
    "groups": [ ... ],
    "edges": [ ... ]
  }
}
```

- **`title`**: The main title of the diagram that will be automatically centered at the top.
- **`aspect`**: Defines the bounding box of the graphic. Valid options: `"16:9"`, `"4:3"`, `"1:1"`, `"3:4"`, `"9:16"`.
- **`theme`**: Defines the overall visual color palette. Valid options: `"muted-rainbow"`, `"vibrant-rainbow"`, `"grey"`, `"red"`, `"green"`, `"blue"`, `"brown"`, `"purple"`, `"blue-orange"`, `"green-purple"`, `"slate-rose"`, `"blue-teal-slate"`, `"indigo-green-red"`, `"brown-amber-grey"`.
- **`diagramType`**: **CRITICAL PARAMETER.** Defines the structural layout. Valid options:
   - `"flowchart"`: For step-by-step processes or algorithms.
   - `"tree"`: For hierarchical data, including Org Charts, Decision Trees, Concept Maps, and File Systems.
   - `"sequence"`: For interactions over time (vertical lifelines).
   - `"erd"`: For static data architecture and structured relationships (e.g., "1 User has N Orders").
   - `"radial"`: For Mind Maps, brainstorming, concept exploration, and stakeholder maps radiating from a central hub.
   - `"timeline"`: For project roadmaps, historical timelines, release planning, and linear sequential phases.
   - `"matrix"`: For SWOT analysis, priority matrices (urgent/important), product positioning maps, and 2D classifications.

### Groups Array (Contains Nodes)

Chartici is fundamentally built around grouping. Instead of a flat list of nodes, nodes are nested inside Groups. A Group represents a boundary, system, or cluster.

```json
{
  "label": "Backend Services",
  "color": 3,
  "type": "rect",
  "size": "L",
  "nodes": [
    {
      "id": "api_gw",
      "label": "API Gateway"
    },
    {
      "id": "psql_db",
      "label": "PostgreSQL"
    }
  ]
}
```

- **`label`**: (Optional) The string name displayed at the top of the group visually.
- **`type`**: The graphical shape of the item. Valid options: `"rect"` (default rectangle), `"circle"`, `"rhombus"`, `"oval"` (pill shape).
- **`color`**: Styling for the group itself. These styles **cascade** down and bind the `nodes` inside it. A node inside a group cannot have a uniquely different color or type than the group!
- **`outlined`**: (Optional, boolean) When `true`, nodes in this group render as outlined (border only, transparent fill) instead of solid fill. Useful for secondary/supporting elements.
- **`size`**: Defines the physical geometric scale of nodes (based on strict grid heights). Valid options: `"XS"`, `"S"`, `"M"`, `"L"`, `"XL"`. True widths scale dynamically based on the node `type` and textual contents.
- **`nodes`**: Array of individual entities inside this group.
  - **`id`**: (Required) Unique identifier to be referenced as `sourceId` or `targetId` in Edges.
  - **`label`**: (Optional) The display string inside the node. If omitted, the node will be rendered blank but still act as a structural target for edges.

**Note on Positioning:** The Heuristic Layout Engine completely calculates `x` and `y` coordinates to ensure pixel-perfect grids. Do not attempt to calculate coordinates mathematically yourself.

### Edges Array

Edges define the connections (arrows) between nodes. 

```json
{
  "sourceId": "api_gw",
  "targetId": "psql_db",
  "label": "Fetch User Data",
  "lineStyle": "solid",
  "connectionType": "target"
}
```

- **`sourceId`**: Exact match of the `id` of the originating Node or Group.
- **`targetId`**: Exact match of the `id` of the destination Node or Group.
- **`label`**: (Optional) Text that floats along the path. **CRITICAL:** Keep edge labels EXTREMELY short (1-3 words max). Use short verbs like "Fetches", "Syncs", "Validates".
- **`lineStyle`**: `"solid"` (default), `"dashed"`, `"dotted"`, `"bold"`, `"bold-dashed"`, `"hidden"`.
- **`connectionType`**: `"target"` (default, →), `"both"` (↔), `"none"` (—), or ERD crow's foot: `"1:1"`, `"1:N"`, `"N:1"`, `"N:M"`.

---

## Operations & Rules

When you are creating or modifying a Chartici diagram, you **MUST** follow these critical rules:

1. **Prioritize Structural Grouping**: Do not attempt to calculate coordinates mathematically yourself. Instead, use nested `nodes` arrays inside `groups`! If you want a row of icons underneath the CEO, place them all inside a single group `{ "id": "ExecTeam", "nodes": [...] }`. When rendered, the engine will permanently lock them into a stunning grid array.
   
2. **Assign Logical Semantic Colors by Index**: In enterprise architecture, color is information. Use color index `1-9` for distinct core systems. **Do not use words like "blue" or "red". ONLY use integers (1-9). Do not use index 10.**

3. **JSON Purity**: ALWAYS ensure the output `.cci` file is mathematically valid JSON. Removing a trailing comma or using unescaped quotes will crash the drawing engine. Ensure `sourceId` and `targetId` in the Edges always match an existing Node or Group `id`.

4. **ERD Cardinality**: Always use `connectionType` with crow's foot notation (`"1:1"`, `"1:N"`, `"N:M"`, etc.) for ERD diagrams instead of arrows. This communicates relationship semantics precisely.

5. **Tree Dense Fan-Outs**: The engine automatically stacks >=3 leaf children vertically (max 6 per column). This means you can safely connect 10+ children to a single parent — the layout will remain compact.

---

## MCP Integration

Chartici includes a **Model Context Protocol (MCP)** server that allows AI assistants (Claude, etc.) to render diagrams directly.

### Available Tools
- **`render_diagram`** — Takes `.cci` JSON, runs the full layout + routing engine, and returns a complete SVG image.
- **`save_diagram`** — Saves a `.cci` file to disk.
- **`list_samples`** / **`read_sample`** — Browse and read example diagrams for reference.

### Setup (Claude Desktop)
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "chartici": {
      "command": "npx",
      "args": ["tsx", "/path/to/chartici/mcp-server.mjs"]
    }
  }
}
```
