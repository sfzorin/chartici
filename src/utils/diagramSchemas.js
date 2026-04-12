/**
 * diagramSchemas.js — thin aggregator over engine plugins.
 *
 * Each engine plugin owns its schema data in src/engines/<type>/schema.js.
 * This file builds DIAGRAM_SCHEMAS by merging all engine schemas together.
 *
 * DEPENDENCY RULE: This file MAY import from src/engines/ because engines/* 
 * are pure data modules with zero imports from src/utils/.
 * No circular dependency is possible.
 */
import { getAllEngines } from '../engines/index.js';

const engines = getAllEngines();

// Build DIAGRAM_SCHEMAS from engine plugins — each engine.schema is the full data object
export const DIAGRAM_SCHEMAS = Object.fromEntries(
  Object.entries(engines).map(([key, engine]) => [key, engine.schema])
);

export const DIAGRAM_TYPES = Object.keys(DIAGRAM_SCHEMAS)
  .map(key => ({
    id: DIAGRAM_SCHEMAS[key].id,
    name: DIAGRAM_SCHEMAS[key].name
  }));
