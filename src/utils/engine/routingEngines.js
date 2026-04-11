import { getEngine } from '../../engines/index.js';

export const EdgeRoutingRegistry = {
  getStyle: (diagramType) => {
    const dt = diagramType === 'org_chart' ? 'tree' : diagramType;
    const engine = getEngine(dt);
    if (engine?.layout?.edgeStyle) return engine.layout.edgeStyle;
    return 'orthogonal_astar'; // safe fallback
  }
};
