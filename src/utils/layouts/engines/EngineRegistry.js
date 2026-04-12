import { layoutSugiyamaDAG } from '../layoutSugiyama.js';
import { layoutRadial } from '../layoutRadial.js';
import { layoutTimeline } from '../layoutTimeline.js';
import { layoutMatrix } from '../layoutMatrix.js';
import { layoutTree } from '../layoutTree.js';
import { layoutPiechart } from '../layoutPiechart.js';
import { getAllEngines } from '../../../engines/index.js';

// engines/* are pure data modules with no utils imports — safe to import here, no circular dependency.
const layoutFunctions = {
  sugiyama: layoutSugiyamaDAG,
  radial:   layoutRadial,
  timeline: layoutTimeline,
  matrix:   layoutMatrix,
  tree:     layoutTree,
  piechart: layoutPiechart
};

export const EngineRegistry = {};

Object.entries(getAllEngines()).forEach(([key, engine]) => {
  const { algorithm, isHorizontalFlow } = engine.layout;
  const layoutFn = layoutFunctions[algorithm];
  if (!layoutFn) return;
  EngineRegistry[key] = {
    isHorizontalFlow,
    execute: (nodes, edges, rules) => layoutFn(nodes, edges, rules, isHorizontalFlow, key)
  };
});
