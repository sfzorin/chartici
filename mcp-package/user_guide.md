# AI Agent Implementation Guide

> **Author:** [Sergey Zorin](https://www.linkedin.com/in/sfzorin/)

**CHARTICI** is a **Declarative Diagramming Engine** driven by algorithms. The user (or AI) provides unstructured or semi-structured data (Nodes and Connections), and Chartici's engine automatically computes their optimal grid coordinates, aligning them into beautiful, deterministic, non-intersecting layouts.

### Core Philosophy
- **Deterministic Math**: There is no manual dragging of connection lines. Every route between nodes is calculated using a specialized Orthogonal A* Pathfinding algorithm to guarantee perfect 20px grid alignment, shared trunks, and rounded corners.
- **Auto-Formatting**: The engine supports various structural aspect ratios (e.g., `16:9 Landscape`, `9:16 Vertical`). Flow direction adjusts automatically based on the chosen format or cluster complexity.
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
- **`diagramType`**: **CRITICAL PARAMETER.** Defines the logical behavior and heuristic rules of the auto-layouter. Must be one of the following exact strings:
   - `"flowchart"`: Maps step-by-step processes or algorithms. Uses Diamonds (decisions) and Rectangles (tasks). Arrows show paths based on outcomes. The engine uses Happy Path optimization to align the primary process flow into a straight axis.
   - `"tree"`: General core type for ALL hierarchical layouts, including Org Charts, Decision Trees, Concept Maps, and File Systems. The layout engine will mathematically branch them out from the root efficiently without process-flow logic. **Dense fan-outs** (>4 leaf children) are automatically stacked vertically with a shared bus trunk for compact layouts.
   - `"sequence"`: Forces strict vertical alignment. Shows interactions over time (vertical lifelines).
   - `"erd"`: **Entity-Relationship Diagram (ERD)**. Used heavily in software engineering to map out static data architecture explicitly without any implied chronological flow. Maps structured relationships (e.g., "1 User has N Orders").
   - `"radial"`: **Radial / Mind Map.** A central hub node with spokes radiating outward. The engine uses straight diagonal lines (not orthogonal routing) with arrowheads. It automatically identifies the most-connected node as the root and arranges all neighbors in concentric rings. Ideal for brainstorming, concept exploration, stakeholder maps, and single-level mind maps. Supports 2+ levels of nesting (inner ring → outer ring). Edge labels are always oriented for readability (never upside-down).
   - `"timeline"`: **Timeline / Roadmap.** Nodes are arranged along a linear axis in topological order (based on edge connections). Even/odd nodes alternate above and below the baseline for readability. Best for project roadmaps, historical timelines, release planning, and any sequential-but-not-branching data. Flow direction adapts to aspect ratio (horizontal for 16:9, vertical for 9:16).
   - `"matrix"`: **Matrix / Grid.** Nodes are organized into a spatial grid based on their groups. Each group occupies one cell of the grid (2 groups → 2×1, 4 groups → 2×2, 9 groups → 3×3). Perfect for SWOT analysis, priority matrices (urgent/important), product positioning maps, and any 2D categorical classification. If no groups exist, all nodes are laid out in a flat grid.

### Groups Array (Contains Nodes)

Chartici is fundamentally built around grouping. Instead of a flat list of nodes, nodes are nested inside Groups. A Group represents a boundary, system, or cluster.

```json
{
  "id": "Backend Services",
  "color": 3,
  "type": "rect",
  "size": "L",
  "nodes": [
    {
      "id": "api_gw",
      "text": "API Gateway"
    },
    {
      "id": "db_main",
      "text": "PostgreSQL"
    }
  ]
}
```

- **`id`**: Unique string identifier for the group. 
- **`type`**: The graphical shape of the item. Valid options: `"rect"` (default rectangle), `"circle"`, `"rhombus"`, `"oval"` (pill shape).
- **`color`**: Styling for the group itself. These styles **cascade** down and bind the `nodes` inside it. A node inside a group cannot have a uniquely different color or type than the group!
- **`outlined`**: (Optional, boolean) When `true`, nodes in this group render as outlined (border only, transparent fill) instead of solid fill. Useful for secondary/supporting elements.
- **`size`**: Defines the physical geometric scale of nodes (based on strict grid heights). Valid options: `"S"` (Base Height: 40px), `"M"` (Base Height: 80px), `"L"` (Base Height: 120px), `"XL"` (Base Height: 160px). True widths are dynamic based on the node `type` (e.g. Circles are symmetrical, Text nodes auto-wrap).
- **`nodes`**: Array of individual entities inside this group.
  - **`id`**: (Required) Unique identifier across the entire diagram.
  - **`text`**: (Optional) The display label inside the node. (Alias: `label`).

**Note on Positioning:** The Heuristic Layout Engine completely calculates `x` and `y` coordinates to ensure pixel-perfect grids. Do not attempt to calculate coordinates mathematically yourself.

### Edges Array

Edges define the connections (arrows) between nodes. 

```json
{
  "id": "e1",
  "sourceId": "api_gw",
  "targetId": "db_main",
  "label": "Fetch User Data",
  "lineStyle": "solid",
  "arrowType": "target"
}
```

- **`id`**: Unique string for the edge. 
- **`sourceId`**: The `id` of the originating Node. (Alias: `from`).
- **`targetId`**: The `id` of the destination Node. (Alias: `to`).
- **`label`**: (Optional) Text that floats along the path. **CRITICAL:** Keep labels EXTREMELY short (1-3 words max). Long edge labels will cause layout bugs, overlap issues, and will be aggressively truncated. Use short verbs like "Fetches", "Syncs", "Validates".
- **`lineStyle`**: `"solid"` (default), `"dashed"`, `"dotted"`, `"bold"`, `"bold-dashed"`.
- **`connectionType`**: `"target"` (default, →), `"both"` (↔), `"none"` (—), or ERD crow's foot: `"1:1"`, `"1:N"`, `"N:1"`, `"N:M"`.

---

## Agentic Operations & Rules

When an AI Agent is tasked with creating or modifying a Chartici diagram, it **MUST** follow these critical rules:

1. **Prioritize Structural Grouping**: Do not attempt to calculate coordinates mathematically yourself. Instead, use nested `nodes` arrays inside `groups`! If you want a row of icons underneath the CEO, place them all inside a single group `{ "id": "ExecTeam", "nodes": [...] }`. When rendered, the engine will permanently lock them into a stunning grid array.
   
2. **Assign Logical Semantic Colors by Index**: In enterprise architecture, color is information. Use color index `1-9` for distinct core systems. **Do not use words like "blue" or "red". ONLY use integers (1-9). Do not use index 10.**

3. **Aspect Ratios Dictate Flow**: 
   - If an agent generates a long list of sequentially connected nodes, tell the user to use the `"9:16"` aspect ratio (Top-Down Flow). 
   - If the architecture is broad (one API gateway pointing to 15 microservices), suggest `"16:9"` (Left-to-Right Flow).

4. **JSON Purity**: ALWAYS ensure the output `.cci` file is mathematically valid JSON. Removing a trailing comma or using unescaped quotes in the `label` parameter will crash the drawing engine. Ensure `source` and `target` in the Edges always match an existing Node `id`.

5. **ERD Cardinality**: Always use `connectionType` with crow's foot notation (`"1:N"`, `"N:M"`, etc.) for ERD diagrams instead of arrows. This communicates relationship semantics precisely.

6. **Tree Dense Fan-Outs**: The engine automatically stacks >4 leaf children vertically (max 6 per column). This means you can safely connect 10+ children to a single parent — the layout will remain compact.

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
