import schema from './schema.js';
import layout from './layout.js';
import routing from './routing.js';
import ai_prompt from './ai_prompt.js';
import parser from './parser.js';

export default {
    type: 'erd',
    name: 'Entity-Relationship',
    schema,
    layout,
    routing,
    ai_prompt,
    parser
};
