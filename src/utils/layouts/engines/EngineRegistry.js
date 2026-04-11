import { layoutSugiyamaDAG } from '../layoutSugiyama.js';
import { layoutRadial } from '../layoutRadial.js';
import { layoutTimeline } from '../layoutTimeline.js';
import { layoutMatrix } from '../layoutMatrix.js';
import { layoutTree } from '../layoutTree.js';
import { layoutPiechart } from '../layoutPiechart.js';

// Layout manifest — intentionally NOT importing diagramSchemas.js to avoid a circular dependency:
// diagramSchemas → engines/index → [any plugin layout.js if it imported utils] → EngineRegistry → diagramSchemas
const LAYOUT_MANIFEST = {
  flowchart: { layout: 'sugiyama', isHorizontalFlow: true  },
  sequence:  { layout: 'sugiyama', isHorizontalFlow: true  },
  erd:       { layout: 'sugiyama', isHorizontalFlow: true  },
  tree:      { layout: 'tree',     isHorizontalFlow: false },
  radial:    { layout: 'radial',   isHorizontalFlow: false },
  timeline:  { layout: 'timeline', isHorizontalFlow: true  },
  matrix:    { layout: 'matrix',   isHorizontalFlow: true  },
  piechart:  { layout: 'piechart', isHorizontalFlow: false },
};

const layoutFunctions = {
  sugiyama: layoutSugiyamaDAG,
  radial:   layoutRadial,
  timeline: layoutTimeline,
  matrix:   layoutMatrix,
  tree:     layoutTree,
  piechart: layoutPiechart
};

export const EngineRegistry = {};

Object.entries(LAYOUT_MANIFEST).forEach(([key, manifest]) => {
  const layoutFn = layoutFunctions[manifest.layout];
  EngineRegistry[key] = {
    isHorizontalFlow: manifest.isHorizontalFlow,
    execute: (nodes, edges, rules) =>
      layoutFn(nodes, edges, rules, manifest.isHorizontalFlow, key)
  };
});
