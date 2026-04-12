import flowchart from './flowchart/index.js';
import tree from './tree/index.js';
import sequence from './sequence/index.js';
import erd from './erd/index.js';
import radial from './radial/index.js';
import timeline from './timeline/index.js';
import matrix from './matrix/index.js';
import piechart from './piechart/index.js';

export const ENGINES = {
    flowchart, tree, sequence, erd, radial, timeline, matrix, piechart
};

export const getEngine = (type) => ENGINES[type] || ENGINES.flowchart;
export const getAllEngines = () => ENGINES;
