export class RoutingContext {
    constructor(edges, allNodes, _unused, draggedNodeId = null, rules = null, diagramType = null) {
        this.edges = edges || [];
        this.allNodes = allNodes || [];
        this.draggedNodeId = draggedNodeId;
        this.diagramType = diagramType;
        this.rules = rules || {
            PADDING: 20, STUB_LENGTH: 20,
            LENGTH_PENALTY: 1, BEND_PENALTY: 100, CROSSING_PENALTY: 1500
        };

        this.nodeBoxes = new Map();
        this.obstacles = [];
        this.occupiedLines = [];
        this.occupiedTurns = [];

        // Spatial indices for O(1) lookups
        this._turnIndex = new Map();   // "x,y" → Turn[]
    }

    /** Add a turn and index it spatially */
    addTurn(turn) {
        this.occupiedTurns.push(turn);
        const key = `${turn.x},${turn.y}`;
        let bucket = this._turnIndex.get(key);
        if (!bucket) { bucket = []; this._turnIndex.set(key, bucket); }
        bucket.push(turn);
    }

    /** O(1) lookup: get all turns at exact (x, y) */
    getTurnsAt(x, y) {
        return this._turnIndex.get(`${x},${y}`) || null;
    }
}
