import { layoutSugiyamaDAG } from '../layoutSugiyama.js';
import { layoutRadial } from '../layoutRadial.js';
import { layoutTimeline } from '../layoutTimeline.js';
import { layoutMatrix } from '../layoutMatrix.js';
import { layoutTree } from '../layoutTree.js';
import { layoutPiechart } from '../layoutPiechart.js';
import { DIAGRAM_SCHEMAS } from '../../diagramSchemas.js';

const layoutFunctions = {
  sugiyama: (nodes, edges, rules, isHorizontal, dt) => layoutSugiyamaDAG(nodes, edges, isHorizontal, rules, dt !== 'sequence' && dt !== 'erd', dt),
  radial: layoutRadial,
  timeline: layoutTimeline,
  matrix: layoutMatrix,
  tree: (nodes, edges, rules, isHorizontal) => layoutTree(nodes, edges, isHorizontal, rules),
  piechart: layoutPiechart
};

export const EngineRegistry = {};

Object.keys(DIAGRAM_SCHEMAS).forEach(key => {
  const schema = DIAGRAM_SCHEMAS[key];
  if (!schema.engineManifest) return;
  
  const manifest = schema.engineManifest;
  const layoutFn = layoutFunctions[manifest.layout];
  
  EngineRegistry[key] = {
    isHorizontalFlow: manifest.isHorizontalFlow,
    execute: (nodes, edges, rules) => {
      // Pass isHorizontal and diagramType specifically for certain layouts
      return layoutFn(nodes, edges, rules, manifest.isHorizontalFlow, key);
    }
  };
});
