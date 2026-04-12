import flowchart from './flowchart/engine.js';
import tree      from './tree/engine.js';
import sequence  from './sequence/engine.js';
import erd       from './erd/engine.js';
import radial    from './radial/engine.js';
import timeline  from './timeline/engine.js';
import matrix    from './matrix/engine.js';
import piechart  from './piechart/engine.js';

export const ENGINES = {
    flowchart, tree, sequence, erd, radial, timeline, matrix, piechart
};

export const getEngine    = (type) => ENGINES[type] || ENGINES.flowchart;
export const getAllEngines = () => ENGINES;
