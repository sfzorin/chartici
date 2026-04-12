// Routing config for tree
// portStrategy: 'topdown' | 'dynamic' | 'none'
// Used by portAssigner.js to select the correct port penalty strategy
export default {
    portStrategy: 'topdown',
    // A* flags — tree-specific routing behaviours
    allowSiblingCrossings: true,  // T-fork branching from shared bus trunk is allowed
    enableBusRouting: true,        // shared trunk lines are cheap (bus-premium cost model)
};
