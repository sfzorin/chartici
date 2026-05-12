import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  borderColorVar,
  colorVar,
  resolveColorIndex,
  textColorVar,
} from '../diagram/colors.js';
import { sanitizeColors } from '../utils/sanitizeColors.js';
import { test, expect, summary } from './testRunner.mjs';

console.log('\n🎨 Semantic Colors');

test('Resolves base semantic color names to palette slots', () => {
  expect(resolveColorIndex('navy'), 1, 'navy slot');
  expect(resolveColorIndex('teal'), 2, 'teal slot');
  expect(resolveColorIndex('yellow'), 3, 'yellow slot');
  expect(resolveColorIndex('green'), 4, 'green slot');
  expect(resolveColorIndex('gray'), 5, 'gray slot');
  expect(resolveColorIndex('red'), 6, 'red slot');
  expect(resolveColorIndex('purple'), 7, 'purple slot');
  expect(resolveColorIndex('brown'), 8, 'brown slot');
  expect(resolveColorIndex('blue'), 9, 'blue slot');
  expect(resolveColorIndex('orange'), 10, 'orange slot');
});

test('Resolves meaning aliases to semantic palette slots', () => {
  expect(resolveColorIndex('success'), 4, 'success alias');
  expect(resolveColorIndex('safe'), 4, 'safe alias');
  expect(resolveColorIndex('ok'), 4, 'ok alias');
  expect(resolveColorIndex('warning'), 3, 'warning alias');
  expect(resolveColorIndex('hold'), 3, 'hold alias');
  expect(resolveColorIndex('danger'), 6, 'danger alias');
  expect(resolveColorIndex('fail'), 6, 'fail alias');
  expect(resolveColorIndex('critical'), 6, 'critical alias');
  expect(resolveColorIndex('info'), 9, 'info alias');
  expect(resolveColorIndex('data'), 9, 'data alias');
  expect(resolveColorIndex('neutral'), 5, 'neutral alias');
});

test('Rejects numeric color ids as CCI colors', () => {
  expect(resolveColorIndex(1), null, 'numeric number unsupported');
  expect(resolveColorIndex('1'), null, 'numeric string unsupported');
});

test('Allows hex colors and rejects other non-palette color values', () => {
  expect(resolveColorIndex('#ffffff'), '#ffffff', 'six-digit hex supported');
  expect(resolveColorIndex('#fff'), '#fff', 'three-digit hex supported');
  expect(resolveColorIndex('transparent'), null, 'transparent unsupported');
  expect(resolveColorIndex('white'), null, 'white unsupported');
  expect(resolveColorIndex('pink'), null, 'unknown named color unsupported');
});

test('Builds CSS variable references from semantic colors', () => {
  expect(colorVar('red'), 'var(--color-6)', 'red fill var');
  expect(textColorVar('green'), 'var(--text-color-4)', 'green text var');
  expect(borderColorVar('blue'), 'var(--border-color-9)', 'blue border var');
});

test('Sanitizer preserves recognized semantic color tokens', () => {
  const out = sanitizeColors([{ id: 'a', color: 'danger' }], true);
  expect(out[0].color, 'danger', 'preserves semantic color token');
});

test('Sanitizer preserves valid hex colors', () => {
  const out = sanitizeColors([{ id: 'a', color: '#aabbcc' }], true);
  expect(out[0].color, '#aabbcc', 'preserves hex color');
});

test('Sample CCI files use semantic color names instead of numeric color ids', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const samplesDir = path.resolve(here, '../../samples');
  const files = fs.readdirSync(samplesDir).filter(name => name.endsWith('.cci'));

  const numericColors = [];
  const walk = (value, file, trail = []) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, file, [...trail, index]));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'color' && (typeof child === 'number' || /^\d+$/.test(String(child).trim()))) {
        numericColors.push(`${file}:${[...trail, key].join('.')}`);
      }
      walk(child, file, [...trail, key]);
    }
  };

  files.forEach(file => {
    const parsed = JSON.parse(fs.readFileSync(path.join(samplesDir, file), 'utf8'));
    walk(parsed, file);
  });

  if (numericColors.length) {
    throw new Error(`numeric sample colors remain: ${numericColors.slice(0, 5).join(', ')}`);
  }
});

summary('engine.colors.test.mjs');
