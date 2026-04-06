export function getDiagramRules(diagramType) {
  const baseLayout = {
    MIN_GAP_X: 60,
    MIN_GAP_Y: 60
  };

  const baseRouting = {
    PADDING: 20,
    STUB_LENGTH: 20,

    // A* penalty weights
    LENGTH_PENALTY: 1,
    BEND_PENALTY: 100,
    CROSSING_PENALTY: 1500
  };

  switch (diagramType) {
    case 'tree':
    case 'org_chart':
      return {
        layout: { ...baseLayout, MIN_GAP_X: 60, MIN_GAP_Y: 60 },
        routing: baseRouting
      };
    case 'erd':
      return {
        layout: { ...baseLayout, MIN_GAP_X: 80, MIN_GAP_Y: 80, RANKER: 'network-simplex' },
        routing: baseRouting
      };
    case 'sequence':
    case 'timeline':
      return {
        layout: { ...baseLayout, MIN_GAP_X: 120, MIN_GAP_Y: 80, RANKER: 'network-simplex' },
        routing: baseRouting
      };
    case 'radial':
    case 'matrix':
      return {
        layout: { ...baseLayout, MIN_GAP_X: 60, MIN_GAP_Y: 60, RANKER: 'network-simplex' },
        routing: baseRouting
      };
    case 'flowchart':
    default:
      return {
        layout: { ...baseLayout, RANKER: 'network-simplex' },
        routing: baseRouting
      };
  }
}
