// Routing config for matrix
// portStrategy: 'topdown' | 'dynamic' | 'none'
// Used by portAssigner.js to select the correct port penalty strategy
export default {
    portStrategy: 'dynamic',

    // Bifurcation ports cost 2× the relevant dimension (standard penalty).
    // Primary ports (Top/Bottom/Left/Right) are free.
    portPenalty(portId, w, h) {
        if (portId === 'BifTop'    || portId === 'BifBottom') return w * 2;
        if (portId === 'BifLeft'   || portId === 'BifRight')  return h * 2;
        return 0;
    },
};
