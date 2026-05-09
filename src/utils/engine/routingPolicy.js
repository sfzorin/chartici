import { getEngine } from '../../engines/index.js';

export function getRoutingPolicy(diagramType) {
  const normalizedType = diagramType === 'org_chart' ? 'tree' : diagramType;
  const routing = getEngine(normalizedType)?.routing || {};
  const enableBusRouting = !!routing.enableBusRouting;

  return {
    portStrategy: routing.portStrategy || 'dynamic',
    portPenalty: routing.portPenalty?.bind(routing),
    cardinalOnly: routing.cardinalOnly ?? normalizedType === 'erd',
    allowPortReuse: routing.allowPortReuse ?? enableBusRouting,
    allowCornerKisses: routing.allowCornerKisses ?? enableBusRouting,
    allowSiblingCrossings: routing.allowSiblingCrossings ?? false,
    enableBusRouting,
  };
}
