/**
 * diagramSchemas.js — тонкий агрегатор поверх плагинов движков.
 *
 * Каждый плагин хранит схему в src/engines/<тип>/engine.js → поле .schema.
 * Этот файл строит DIAGRAM_SCHEMAS, объединяя схемы всех движков.
 *
 * ПРАВИЛО ЗАВИСИМОСТЕЙ: этот файл МОЖЕТ импортировать из src/engines/,
 * так как engines/* являются чистыми модулями данных без импортов из src/utils/.
 * Циклических зависимостей не возникает.
 */
import { getAllEngines } from '../engines/index.js';

const engines = getAllEngines();

// Строим DIAGRAM_SCHEMAS из плагинов — engine.schema является полным объектом данных
export const DIAGRAM_SCHEMAS = Object.fromEntries(
  Object.entries(engines).map(([key, engine]) => [key, engine.schema])
);

export const DIAGRAM_TYPES = Object.keys(DIAGRAM_SCHEMAS)
  .map(key => ({
    id: DIAGRAM_SCHEMAS[key].id,
    name: DIAGRAM_SCHEMAS[key].name
  }));
