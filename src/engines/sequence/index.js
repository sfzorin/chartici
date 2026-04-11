import schema from './schema.js';
import layout from './layout.js';
import routing from './routing.js';
import ai_prompt from './ai_prompt.js';
import parser from './parser.js';

export default {
    type: 'sequence',
    name: 'Sequence',
    schema,
    layout,
    routing,
    ai_prompt,
    parser
};
