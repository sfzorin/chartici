import { getEngine } from '../engines/index.js';

const DEFAULT_LAYOUT_RULES = {
  MIN_GAP_X: 60,
  MIN_GAP_Y: 60,
};

const DEFAULT_ROUTING_RULES = {
  PADDING: 10,
  STUB_LENGTH: 20,

  // A* path cost weights
  LENGTH_PENALTY: 1,
  BEND_PENALTY: 100,
  CROSSING_PENALTY: 1500,
  COLLISION_OVERLAP_PENALTY: 500,

  // Z-bend discount near the median point
  Z_BEND_DISCOUNT: 20,

  // Penalty for moving away from the target
  BACKTRACK_PENALTY: 200,

  // Bus/trunk bundling, enabled only by engines with routing.enableBusRouting.
  BUS_STEP_COST: 0.5,
  BUS_OVERLAP_PENALTY_FACTOR: 2,
  T_FORK_EXACT_DISCOUNT: 100,
  T_FORK_TRUNK_DISCOUNT: 80,
};

export function getDiagramRules(diagramType) {
  const normalizedType = diagramType === 'org_chart' ? 'tree' : diagramType;
  const engine = getEngine(normalizedType);

  return {
    layout: {
      ...DEFAULT_LAYOUT_RULES,
      ...(engine?.layout?.rules || {}),
    },
    routing: {
      ...DEFAULT_ROUTING_RULES,
      ...(engine?.routing?.rules || {}),
    },
  };
}
