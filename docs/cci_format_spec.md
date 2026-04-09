# Chartici .CCI Format Specification

The `.cci` (Chartici Concept Interchange) file format is a strict JSON blueprint used for generating, validating, and layout-rendering dynamic diagrams.

## 1. Top-Level Structure
```json
{
  "data": {
    "nodes": [],
    "edges": [],
    "groups": [],
    "config": {}
  },
  "meta": {
    "type": "flowchart",
    "version": "1.0.0"
  }
}
```

## 2. General Node Properties
Nodes define graphical entities. All sizes and coordinates use a virtual canvas pixel system.
- **`id`** (String): Unique identifier. System title use `__SYSTEM_TITLE__` internally.
- **`type`** (String): Visual shape. Must be one of: `process, circle, oval, rhombus, text, chevron, pie_slice`.
- **`label`** (String): Content of the node. Newlines `\n` are supported.
- **`x`**, **`y`** (Number): Logical coordinates.
- **`color`** (Number | String): Either an integer `1-9` matching the predefined color palettes, OR a valid Hex string like `#1E293B`.
- **`size`** (String): Typography and boundary scaling. Allowed: `AUTO, XS, S, M, L, XL`. (Pie slices strictly enforce `M`).
- **`lockPos`** (Boolean): If `true`, the Auto-Layout (Heuristic) engine will NOT touch or move this node from its `x,y` position.
- **`value`** (Number): Quantitative value, heavily used in specific types (e.g., Pie Chart slices).
- **`groupId`** (String): Optional reference to a group ID.

## 3. General Edge Properties
- **`id`** (String): Unique edge ID.
- **`from`**, **`to`** (String): Must match existing node `id`s.
- **`label`** (String): Optional textual badge centered on the edge.
- **`lineStyle`** (String): `solid, dashed, dotted, bold, bold-dashed, none`. (`none` acts as a topological invsible spine link).
- **`connectionType`** (String): Arrow mapping: `target, both, reverse, none` or ERD specifics like `1:1, 1:N, N:M`.

## 4. Diagram Type Matrix
Chartici supports specialized validation and rendering logic depending on the active diagram type.

### Flowchart (`type: "flowchart"`)
**Purpose**: logical step-by-step processes or algorithms.
- **Allowed Nodes**: `process, circle, oval, rhombus, text`
- **Allowed Edges**: `solid, dashed, bold, none`

### Sequence (`type: "sequence"`)
**Purpose**: chronological interactions between systems or actors.
- **Allowed Nodes**: `process, circle, text`
- **Allowed Edges**: `solid, dashed, bold, none`

### Entity-Relationship (`type: "erd"`)
**Purpose**: database schemas, entities, and relationships.
- **Allowed Nodes**: `process, text`
- **Allowed Edges**: `solid, dashed, bold, none`

### Radial (`type: "radial"`)
**Purpose**: mind-maps, concentric layers, or hub-and-spoke architectures.
- **Allowed Nodes**: `process, circle, text`
- **Allowed Edges**: `solid, dashed, bold, none`

### Array (`type: "array"`)
**Purpose**: memory buffers, queues, or sequential data structures.
- **Allowed Nodes**: `process, text`
- **Allowed Edges**: `solid, dashed, bold, none`

### Matrix (`type: "matrix"`)
**Purpose**: grid-like comparisons, or categorization into distinct cluster zones/cells.
- **Allowed Nodes**: `process, text`
- **Allowed Edges**: `none, solid`
- **Strict Connection Rules**:
   - process -> process : Allowed across different groups/cells using 'solid'.

### Timeline (`type: "timeline"`)
**Purpose**: events plotted on a generic chronological spine.
- **Allowed Nodes**: `chevron, process, circle, text`
- **Allowed Edges**: `solid, dashed, none`
- **Strict Connection Rules**:
   - chevron -> chevron : MUST use 'lineStyle': 'none' (invisible topological spine)
   - circle/process -> chevron : Use 'solid' or 'dashed' (visible event links)
   - text -> any : Use 'none' (invisible text binding)

### Tree (`type: "tree"`)
**Purpose**: strict hierarchical org-charts or breakdowns.
- **Allowed Nodes**: `process, circle, text`
- **Allowed Edges**: `solid, dashed, bold, none`

### Pie Chart (`type: "piechart"`)
**Purpose**: breakdown of items into proportional circular slices.
- **Allowed Nodes**: `pie_slice`
- **Allowed Edges**: `none`
- **Feature Flags**: Data Values Required | No Connections Allowed | No Grouping Allowed
- **Strict Connection Rules**:
   - Edges MUST NOT be used in piecharts.

