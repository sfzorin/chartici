// ─── Core Data Structures ────────────────────────────────

/**
 * A diagram node (shape or text annotation).
 */
export interface DiagramNode {
  id: string;
  type: 'rect' | 'oval' | 'circle' | 'rhombus' | 'chevron' | 'text' | 'title';
  label: string;
  size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'AUTO';
  color?: number | string;
  x: number;
  y: number;
  groupId?: string;
  fillStyle?: string;

  // Text node binding
  bindTo?: string;
  offsetX?: number;
  offsetY?: number;

  // Position locking (title node)
  lockPos?: boolean;

  /** @deprecated Use groupId instead */
  group?: string;
}

/**
 * A group of visually linked nodes sharing style properties.
 */
export interface DiagramGroup {
  id: string;
  color?: number | string;
  type?: string;
  size?: string;
  outlined?: boolean;
  lockColor?: boolean;
  fillStyle?: string;
}

/**
 * A connection (edge) between two nodes.
 */
export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  type?: 'arrow' | 'none' | 'bidirectional';
  color?: number | string;
  strokeType?: 'solid' | 'dashed' | 'dotted';
  thickness?: number;
  lineStyle?: string;

  // Unified connection type: arrows or ERD crow's foot
  connectionType?: 'target' | 'both' | 'none' | '1:1' | '1:N' | 'N:1' | 'N:M';

  // Special flags
  style?: 'invisible';
  logical?: boolean;
  isBlank?: boolean;
}

/**
 * The top-level diagram data state managed by App.jsx.
 */
export interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups: DiagramGroup[];
  layoutTrigger?: number;
  config?: DiagramConfig;
}

/**
 * Diagram-level configuration stored alongside data.
 */
export interface DiagramConfig {
  aspect?: string;
  bgColor?: string;
  theme?: string;
  diagramType?: 'flowchart' | 'tree' | 'sequence' | 'erd' | 'radial' | 'timeline' | 'matrix';
  title?: string;
  titleSize?: string;
  titleX?: number;
  titleY?: number;
  titleLock?: boolean;
}

// ─── Routing Engine Types ────────────────────────────────

export interface BoundingBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
}

export interface Obstacle extends BoundingBox {
  id: string;
  vLeft: number;
  vRight: number;
  vTop: number;
  vBottom: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Port extends Point {
  dir: 'Top' | 'Bottom' | 'Left' | 'Right';
  penalty?: number;
}

export interface ComputedPath {
  pathD?: string;
  textPathD?: string;
  textPathLen?: number;
  pts?: Point[];
  isFallback?: boolean;
}

export interface RoutingRules {
  PADDING: number;
  STUB_LENGTH: number;
  BUS_LANE_SPACING: number;
  BEND_PENALTY: number;
  MIDPOINT_DEVIATION_WEIGHT: number;
  CROSSING_PENALTY: number;
  COLLISION_OVERLAP_PENALTY: number;
  CROSSING_PERPENDICULAR_PENALTY: number;
  SHARED_TURN_DISCOUNT: number;
}

// ─── File Format Types ───────────────────────────────────

/**
 * The .cci file export payload.
 */
export interface CharticiFilePayload {
  version: number;
  header: string;
  groups: CharticiGroup[];
  edges: DiagramEdge[];
  config: DiagramConfig;
}

export interface CharticiGroup extends DiagramGroup {
  nodes: Omit<DiagramNode, 'groupId' | 'group'>[];
}

// ─── Component Props ─────────────────────────────────────

export interface AppHeaderProps {
  appTheme: string;
  toggleAppTheme: () => void;
  diagramTitle: string;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  handleDownloadSVG: () => void;
  handleDownloadChartici: () => void;
  setDiagramData: (data: DiagramData | ((prev: DiagramData) => DiagramData)) => void;
  setDiagramTitle: (title: string) => void;
  setDialogConfig: (config: any) => void;
  setHelpTab: (tab: string) => void;
  setIsHelpOpen: (open: boolean) => void;
  LogoUrl: string;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export interface DiagramRendererProps {
  initialData: DiagramData;
  theme: string;
  svgRef: React.RefObject<SVGSVGElement>;
  aspectRatio: string;
  bgColor: string;
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  selectedEdgeId: string | null;
  onEdgeSelect: (id: string | null) => void;
  onNodesChange: (nodes: DiagramNode[]) => void;
  onSmartAlign: () => void;
  onAutoLayout: () => void;
  diagramTitle: string;
  diagramType: string;
  onConnect: (sourceId: string, targetId: string) => void;
  onAddNode: (type: DiagramNode['type']) => void;
}
