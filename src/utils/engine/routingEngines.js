import { DIAGRAM_SCHEMAS } from '../diagramSchemas.js';

export const EdgeRoutingRegistry = {
  getStyle: (diagramType) => {
    const dt = diagramType === 'org_chart' ? 'tree' : diagramType;
    const schema = DIAGRAM_SCHEMAS[dt];
    if (schema && schema.engineManifest) {
      return schema.engineManifest.edgeStyle; // 'orthogonal_astar', 'straight_clipped', 'none'
    }
    return 'orthogonal_astar'; // Default fallback
  }
};
