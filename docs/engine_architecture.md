# Engine Architecture

This document describes how Chartici turns `.cci` data into an editable SVG diagram.

## High-Level Flow

```text
.cci / AI Markdown
  -> parseCharticiFile()
  -> normalized nodes, groups, edges
  -> type-specific layout
  -> route edges
  -> React SVG renderer
  -> SVG export
```

The central rule is that diagram types share as much infrastructure as possible. A diagram engine only defines the differences: allowed nodes, edge encoding, layout strategy, routing preferences, and AI prompt shape.

## Directory Map

```text
src/
  components/
    DiagramRenderer.jsx        Main SVG renderer and interaction layer
    shapes/
      DiagramNode.jsx          Node SVG rendering
      DiagramEdge.jsx          Edge SVG rendering and markers
  diagram/
    canvas.js                  Canvas constants and aspect options
    colors.js                  Palettes and canvas color tokens
    edges.js                   Edge styles, arrow markers, ERD markers
    nodes.jsx                  Node registry: shapes, sizes, ports
  engines/
    <type>/engine.js           Engine schema, layout, routing, parser hooks
    <type>/ai_prompt.js        Type-specific Markdown prompt
    <type>/format.md           Type-specific .cci format reference
  services/
    aiGenerate.js              AI generation, Markdown parser, validation, repair
  utils/
    charticiFormat.js          .cci import/export
    nodeLayouter.js            Layout entry point
    layouts/                   Type-specific macro-layout helpers
    engine/                    Edge routing core
```

## Data Model

Runtime diagram data has three main arrays:

```js
{
  nodes: [],
  edges: [],
  groups: [],
  config: {}
}
```

`.cci` files are grouped JSON documents:

```json
{
  "meta": { "type": "flowchart", "version": "3.0.0" },
  "theme": "basic",
  "title": { "text": "Example", "size": "M" },
  "data": {
    "config": { "aspect": "16:9", "bgColor": "white" },
    "groups": []
  }
}
```

`parseCharticiFile()` flattens grouped nodes for the app state and resolves implicit edges where needed.

## Engine Plugins

Each engine lives in `src/engines/<type>/engine.js`.

An engine exports:

- `type` and `name`
- `schema`
- `layout`
- `routing`
- `parser`
- `ai_prompt`

The app consumes all engines through `src/engines/index.js` and `src/utils/diagramSchemas.js`.

## Schema Responsibilities

`engine.schema` defines UI and format constraints:

- `allowedNodes`
- allowed line styles and arrow types
- optional ERD connection types
- feature flags such as `allowConnections`, `supportsLegend`, `enforceMaxNodes`
- `ioFormat`, which controls how edges are encoded in `.cci`
- `engineManifest`, which controls renderer overlays and routing style

## Edge Encoding

Not all diagram types store edges the same way.

| Type | Encoding | Location |
|---|---|---|
| Flowchart | implicit | `node.nextSteps` |
| Tree | implicit | `group.parentId` |
| Radial | implicit | `group.parentId` |
| Timeline | implicit | `node.spineId` |
| Sequence | explicit | `data.messages[]` |
| ERD | explicit | `data.relationships[]` |
| Matrix | none | no edges |
| Pie chart | none | no edges |

Import/export hooks live in each engine's `parser` object.

## Layout Pipeline

The layout entry point is `layoutNodesHeuristically()` in `src/utils/nodeLayouter.js`.

It chooses the layout strategy from the diagram type and engine manifest:

- flowchart / sequence / ERD: Sugiyama-style layout
- tree / radial: hierarchy-oriented layout
- timeline: spine and event placement
- matrix: grouped grid placement
- piechart: slice geometry and optional legend placement

Layouts should produce stable, snapped coordinates. The renderer can still support manual movement and locked positions.

## Routing Pipeline

Edge paths are produced by `calculateAllPaths()` in `src/utils/engine/index.js`.

The router receives:

- normalized edges
- rendered node geometry
- diagram type
- optional drag state

Most diagram types use orthogonal routing. Radial uses direct or curved paths depending on the engine manifest. Edge rendering is controlled by `src/diagram/edges.js`.

## SVG Rendering

`DiagramRenderer.jsx` owns:

- pan and zoom
- selection
- drag interactions
- connection interactions
- sheet bounds
- overlays for matrix and sequence
- legend rendering
- title rendering

`DiagramNode.jsx` and `DiagramEdge.jsx` are deliberately registry-driven. If a new node or edge style can be represented in the registries, it should not require custom branches throughout the renderer.

## SVG Export

`downloadSVG()` in `src/utils/exportSVG.js` clones the live SVG and cleans it:

- removes desk background
- removes grid preview rectangles
- removes editor-only handles and selection UI
- removes logical helper links
- bakes CSS variables into concrete color values
- crops the viewBox to the paper sheet

There is no watermark.

## Empty Canvas Invariant

The editor must always render a valid paper sheet. Even when `nodes=[]`, the app state includes a valid `config`, and `DiagramRenderer` computes sheet bounds from `EMPTY_CANVAS`.

This prevents the user from drawing on the infinite desk background after a failed AI generation, a cancelled import, or a new blank project.

## AI Boundary

AI generation is not part of rendering. It ends at `.cci` data:

```text
LLM Markdown -> aiGenerate parser -> .cci-like object -> parseCharticiFile/loadParsedData -> normal app state
```

If AI output is malformed, `aiGenerate.js` performs one repair pass before returning an error.

## Adding A Diagram Type

1. Create `src/engines/<type>/engine.js`.
2. Create `src/engines/<type>/ai_prompt.js`.
3. Create `src/engines/<type>/format.md`.
4. Register the engine in `src/engines/index.js`.
5. Add or reuse a layout in `src/utils/layouts/`.
6. Add parser tests and sample smoke coverage.
7. Add public samples.

Prefer reusing existing node shapes, edge styles, and layout helpers before adding new primitives.

## Test Surface

Important commands:

```bash
npm run test:engine
npm run build
npm run lint
```

Important tests:

- `engine.aiParser.test.mjs` — AI Markdown parser and repair pass
- `engine.sampleSmoke.test.mjs` — sample import/layout/route smoke test
- diagram-specific engine tests for flowchart, timeline, tree, radial, etc.
