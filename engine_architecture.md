# Diagram Engine Architecture

This document describes the complete lifecycle of generating a diagram — from the logical placement of node rectangles to the final vector rendering of orthogonal routing with intersecting line jumps.

---

## Unified Pipeline (Architectural Invariant)

All diagram types undergo an **identical** processing pipeline. The process is divided into 4 sequential stages. **Only the first stage** varies, as it is unique to each topology.

`[Stage 1: Macro-Layout] → [Stage 2: Port Assignment] → [Stage 3: A* Routing] → [Stage 4: SVG Vector]`

1. **Macro-Layout:** Depends on `diagramType`. Uses Dagre for flowcharts, RT-algorithm for trees, and Kahn top-sort for timelines. After coordinate calculation, nodes are rigidly snapped to a `20px` grid.
2. **Port Assignment:** Every edge (prior to routing) receives explicit exit and entry ports (Top/Bottom/Left/Right) based on a geometric penalty matrix.
3. **A* Routing:** A unified algorithm lays down orthogonal polylines along the free cells of the grid, avoiding obstacles. Only variables like port gravity and busing are toggled. Exception: radial uses direct math vectors without A*.
4. **SVG Post-processing:** Insertion of engineering gaps (jumps), corner fillets, and specific markers.

---

## STAGE 1. Macro-Layout and Topologies (Node Placement)

The objective is to calculate `(x, y)` for all nodes to minimize intersections.

### 1.1. Core Rules
- **Unified Flow Direction:** Dynamic orientation based on canvas size was removed for predictability. General direction is now strictly hardcoded to the semantic `diagramType`:
  - **Vertical Flow (Top-Down, TB):** Trees (`tree`) and Radial Maps (`radial`).
  - **Horizontal Flow (Left-Right, LR):** Flowcharts (`flowchart`), ER Diagrams (`erd`), Timelines, and Matrices.
- **Coordinate Freezing:** If a node has `lockPos === true`, it is excluded from auto-algorithms and maintains its manual coordinates.
- **Text Spacing Constraints:** Edges with long text are translated into invisible "spacer nodes", forcing Dagre to spread out accommodating the width *before* lines are drawn.
- **Swiss Snapping (20px Grid):** Final coordinates are always multiples of 20. This guarantees ports align perfectly across axes.

### 1.2. Topology Specifications

#### 1. Flowchart
- **Layout:** Dagre (Sugiyama DAG) with an active **Happy Path (`weight=100`)**. The engine finds the longest logical DFS path and forces it into a perfect straight axis. Secondary cycle handlers are pushed to the side.
- **Cycle-safe:** Back-edges are detected via `color 0/1/2` depth searches and hidden from Dagre to prevent breaking layout layers.
- **Swimlane Heuristic:** With small grouped node counts, the engine automatically clusters them horizontally, mimicking classic swimlanes.
- **Gaps:** `MIN_GAP = 40`. Edge bundling/busing is banned (every link is individual).

#### 2. Tree / Hierarchy (Org Charts)
- **Layout:** Custom Bottom-Up Engine (Reingold-Tilford). Inverted axis logic relative to Flowcharts.
- **Layer Logic:**
  - **Multi-roots & Orphans:** The engine builds a Forest of independent trees. "Orphans" are stacked in a matrix grid on the side.
  - **Children (Depth 1):** Always arrayed in a wide horizontal row (up to 10 in a row). If exceeded, staggers into a checkerboard up to 19.
  - **Grandchildren (Depth 2+):** Packed into vertical cascading columns (up to 5 blocks high, max 3 columns) to prevent an infinitely wide canopy. Forces `_stackEntry = 'Left'`.
- **Edges:** **Absolute Busing Dominance (`allowBusPremium = true`)**. Branches merge into a single trunk (T-fork). Gaps: `MIN_GAP = 80`.

#### 3. Sequence Diagram
- **Logic:** Extended horizontal gaps `MIN_GAP_X = 120` for lifelines. `MIN_GAP_Y = 80` defines the chronological (vertical) message step.
- **Edges:** Orthogonal Z-shapes. Busing banned.

#### 4. Entity-Relationship (ERD & Architecture)
- **Layout:** Dagre without Happy Path. Nodes distribute into "islands" with `MIN_GAP = 80` to keep links readable.
- **Edges:** A* routes lines "like streets", navigating around rectangles. Free port choice from all faces.

#### 5. Radial / Mind Map
- **Logic:** The node with maximum `degree` becomes the center. Others radiate outward in concentric circles.
- **Layout:**
  - Angular sector of children is proportional to the depth of their subtree (children = x0.4 weight, grandchildren = x0.1).
  - Cone spreads dynamically (±45° for children, ±28° for grandchildren).
  - Uses a physics engine (20 iterations of relaxation) pushing overlapping nodes apart along radii and tangents.
- **Edges (Direct-Line Routing):** Direct vectors cutting through bounding box or oval intersections (no grid).

#### 6. Timeline
- **Layout:** Topological sorting (Kahn). Elements snake back and forth, alternating `+` and `-` `crossOffset` from the baseline axis. Busing banned. Expanded gaps: 120/80.

#### 7. Matrix / Grid
- **Layout:** Sorted by `groupId`. Modules are clustered into `ceil(√N) × ceil(√M)` cells. Groups receive SVG bounding frames.

---

## STAGE 2. Port Assignment (Port Assigner)

Orchestrated by `portAssigner.js` before router initialization. It creates a dynamic penalty matrix.

### Base Penalties (L-Rays Matrix)
Checks all 4 faces (ports) of the node.
- **Ideal Port (Line of Sight, `0 penalty`):** An L-Ray to the target does not collide with obstacles.
- **Lateral Port (`1 × D penalty`):** Requires wrapping around another object (where D is width/height).
- **Rear Port (`2 × D penalty`):** Requires wrapping around its *own* node.

### Specific Modifiers
- **Bifurcation penalty:** For nodes with sufficient dimensions (`w >= 50px` or `h >= 50px`), 2 lateral backup ports are added on the respective edges (offset ±20px from the center). Initially heavily penalized `+2 × D` so they are only used when the central port is saturated.
- **Circle Diagonal Ports:** Circles (`circle`) receive diagonal 45° escape routes placed 20px outside boundaries. Penalty = diameter.
- **Port Saturation Rule:** Two edges with distinct visual styles (e.g. solid vs dashed) cannot share the same port to prevent visual merging. If `edgeType` mismatches, the occupied port receives a blocking `+10 × D` penalty, forcing A* to divert the dashed line into a bifurcation port.
- **Tree _stackEntry Override:** For vertically collapsed list nodes (Tree depth 2+), `_stackEntry = 'Left'` is intercepted, obligating the line to enter from the side instead of penetrating the block from the top.

---

## STAGE 3. Routing Core (A* Routing & Penalties)

The heart of the system is `astar.js`. Every polyline minimizes the function: `fScore = gScore (real distance) + hScore (Distance to safeTarget)`. 
All nodes are enveloped in a **padBox** (+20px margin), through which lines cannot travel (except to their own ports via `allowObsId`).

The Routing Queue (Edge Prioritization) sorts from shortest edges to longest so local clusters route first without blocking transit highways.

### 3.1 Tier Degradation
If an ideal path is blocked, constraints relax sequentially:
- **Tiers 1-2 (20px Grid):** Ideal. Strict ban on line overlapping.
- **Tier 3 (10px Grid + Crossing Allowed):** Allowed to punch through other lines perpendicularly at 90° (triggers massive Crossing Penalty).
- **Tier 4 (Overlap Allowed):** 10px Grid. Ban on overlapping orphan lines is lifted.
- **Fallback:** Direct line vectors are rendered as a last resort.

### 3.2. Bans and Taxes
- **Bend Penalty (100):** Tax for making a 90° turn. Cleans out Z-staircases.
- **Backtrack Penalty (200):** Tax for moving away from the target.
- **Crossing Penalty (1500):** Applied on Tier 3 for piercing a foreign line.
- **Strict Bundling Ban:** Lines of varying `edgeType` physically cannot fuse, even under extreme spatial constraints.
- **Topological U-turn Ban:** Absolute ban on 180° turns within a single grid cell.
- **Text Abbreviation Penalty (100):** Heuristic tax. If a route cannot harbor the length of `edge.label` on any single straight segment, a flat 100 penalty is incurred. A* prefers routes with longer straightways but won't orbit infinitely just for text.

### 3.3. Premiums and Discounts
Mechanics forcing A* to make aesthetic, "human-like" choices:
- **Z-alignment (Median Bend = 20):** Discount applied if the sole Z-kink happens strictly at the mathematical midpoint between figures.
- **T-Fork / Busing (100):** Active only for Org Charts (`tree`). Permits lines to fuse into a single "Trunk Buss" (cost drops from 20 to 0.5 per cell step).

---

## STAGE 4. Vector Post-Processing (SVG)

Final touches before coordinates convert to React components:
1. Pruning of collinear coordinates.
2. **Fillets:** For every 90° corner, a quadratic Bezier (`Q`) curve is injected to create a smooth engineering angle.
3. **Jumps:** Scans `ctx.occupiedLines`. Coordinates derived from Tier 3 crossings receive a micro-gap — the line interrupts pixels prior to intersection and resumes after (using the path `M` command).

### Text Truncation Rules
Post-processing and React-UI strictly obey three laws of geometrical text rendering:
1. **Orientation Strictness:** Text exclusively reads Left-to-Right. Vertical lines read Bottom-to-Top.
2. **No Bundle Zone:** Text physically disappears on segments where the line fuses/buses with another.
3. **Hard Truncate:** If the entire text string does not fit on the maximum available straight segment (accounting for ±20px intersection margins), it is **completely hidden**. Ellipses are banned.
4. **Radial Exemption:** On Radial/Mind Maps, edge text labels are forcibly deactivated for visual cleanliness as radii are typically short and dense.

### Topology-Specific Visual Layers (`DiagramRenderer.jsx`)
- **Sequence (Lifelines):** Every node drops a vertical dashed line (`6, 4`) downward by 2000px.
- **Matrix (Groups):** Matrix cell clusters receive an SVG dashed bounding frame (`rx=8`) with the group name centered at the top.
- **ERD (Crow's Foot):** Endpoints (vectors) mount appropriate SVG markers. A vertical tick (`cf-one`) means 1. A 3-pronged fork (`cf-many`) indicates M:N relationships.

---
*Document up to date: `cci_project` engine.*
