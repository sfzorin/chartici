// Routing config for timeline
// portStrategy: 'topdown' | 'none' | 'none'
// Used by portAssigner.js to select the correct port penalty strategy
export default {
    portStrategy: 'none',

    // No port penalty — all exits are equal (radial/tree/piechart layouts).
    portPenalty(portId, w, h) {
        return 0;
    },
};
