import assert from 'assert';
import { finalizeExportSvgString } from '../utils/exportSVG.js';

const sampleSvg = `
<svg xmlns="http://www.w3.org/2000/svg" style="background: var(--desk-bg)">
  <defs>
    <filter id="node-depth"><feDropShadow /></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#desk-grid)" />
  <rect class="canvas-grid-rect" x="0" y="0" width="800" height="450" fill="url(#canvas-grid)" />
  <g class="selection-ui"><rect x="1" y="1" width="10" height="10" /></g>
  <g class="port-ui"><circle cx="2" cy="2" r="3" /></g>
  <rect x="20" y="20" width="120" height="60" fill="var(--color-1)" stroke="transparent" filter="url(#node-depth)" />
  <text x="80" y="55" fill="var(--diagram-text, #101827)">Title</text>
</svg>`;

const exported = finalizeExportSvgString(sampleSvg, {
  '--color-1': '#2f7b7b',
  '--diagram-text': '#101827',
  '--desk-bg': '#d8e3ee',
});

assert.ok(exported.includes('<text'), 'export keeps text nodes');
assert.ok(exported.includes('#2f7b7b'), 'export bakes palette variables');
assert.ok(exported.includes('stroke="none"'), 'export converts transparent strokes to none');
assert.ok(!exported.includes('var('), 'export has no CSS variables');
assert.ok(!/filter/i.test(exported), 'export has no SVG/CSS filters');
assert.ok(!/transparent/i.test(exported), 'export has no transparent paint keyword');
assert.ok(!/canvas-grid-rect|selection-ui|port-ui|touch-port-hitbox|logical-link/.test(exported), 'export strips editor-only layers');
assert.ok(!/<g\s*(?:<|$)/.test(exported), 'export cleanup does not leave broken SVG tags');
