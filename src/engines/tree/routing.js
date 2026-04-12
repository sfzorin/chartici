// Routing config for tree
// portStrategy: 'topdown' | 'dynamic' | 'none'
// Used by portAssigner.js to select the correct port penalty strategy
export default {
    portStrategy: 'topdown',
    // A* flags — tree-specific routing behaviours
    allowSiblingCrossings: true,  // T-fork branching from shared bus trunk is allowed
    enableBusRouting: true,        // shared trunk lines are cheap (bus-premium cost model)

    // Topdown flow: bifurcation ports use standard penalty.
    // Primary Left/Right exits are also penalized to encourage vertical paths.
    portPenalty(portId, w, h) {
        if (portId === 'BifTop'    || portId === 'BifBottom') return w * 2;
        if (portId === 'BifLeft'   || portId === 'BifRight')  return h * 2;
        return 0;
    },
};
