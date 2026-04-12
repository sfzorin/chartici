export function getDiagramRules(diagramType) {
  const baseLayout = {
    MIN_GAP_X: 60,
    MIN_GAP_Y: 60
  };

  const baseRouting = {
    PADDING: 20,
    STUB_LENGTH: 20,

    // ── A* path cost weights ─────────────────────────────────────────────
    LENGTH_PENALTY: 1,          // за каждый шаг по сетке
    BEND_PENALTY: 100,          // за каждый поворот
    CROSSING_PENALTY: 1500,     // за пересечение чужой линии
    COLLISION_OVERLAP_PENALTY: 500, // за совмещение с чужой линией (не bus)

    // ── Z-изгиб: скидка за поворот в медиальной точке (Z-форма) ──────────
    Z_BEND_DISCOUNT: 20,

    // ── Откат: штраф за шаг в сторону от цели ────────────────────────────
    BACKTRACK_PENALTY: 200,

    // ── Bus/trunk bundling (tree, org_chart) ─────────────────────────────
    //   Включается только когда routing.enableBusRouting = true у движка
    BUS_STEP_COST: 0.5,         // стоимость шага по совмещённому bus — почти бесплатно
    BUS_OVERLAP_PENALTY_FACTOR: 2, // штраф за слипание с чужой линией (× gridStep)
    T_FORK_EXACT_DISCOUNT: 100, // скидка за T-развилку в точке поворота
    T_FORK_TRUNK_DISCOUNT: 80,  // скидка за ответвление с trunk-сегмента
  };

  switch (diagramType) {
    case 'tree':
    case 'org_chart':
      return {
        layout: { ...baseLayout },
        routing: {
          ...baseRouting,
          // Дерево: bus-маршруты критичны для красивых T-развилок
          T_FORK_EXACT_DISCOUNT: 120,
          T_FORK_TRUNK_DISCOUNT: 90,
          BUS_STEP_COST: 0.3,   // ещё дешевле — сильно притягивает к общей шине
        }
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
        layout: { ...baseLayout, RANKER: 'network-simplex' },
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
