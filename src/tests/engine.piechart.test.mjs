import { layoutPiechart } from '../utils/layouts/layoutPiechart.js';
import { test, expect, summary, makeNode } from './testRunner.mjs';

console.log('\n🍕 Piechart Engine: Distribution Logic');

const nodes = [
  makeNode('A', 0, 0, 'pie_slice', 'M', { value: 60 }),
  makeNode('B', 0, 0, 'pie_slice', 'M', { value: 30 }),
  makeNode('C', 0, 0, 'pie_slice', 'M', { value: 10 })
];

const totalVal = 100;
const slices = layoutPiechart(nodes, [], { PADDING: 0 });

test('Calculates percentages correctly', () => {
  expect(slices.length, 3, 'slices count');
  expect(slices[0].pieStartAngle, 0, 'first starts at 0');
  
  const expectedEndA = (60 / totalVal) * Math.PI * 2;
  expect(Math.abs(slices[0].pieEndAngle - expectedEndA) < 0.001, true, 'slice A end');
  
  expect(slices[1].pieStartAngle, slices[0].pieEndAngle, 'slice B starts where A ends');
  
  const expectedEndB = expectedEndA + (30 / totalVal) * Math.PI * 2;
  expect(Math.abs(slices[1].pieEndAngle - expectedEndB) < 0.001, true, 'slice B end');
  
  expect(Math.abs(slices[2].pieEndAngle - Math.PI * 2) < 0.001, true, 'slice C ends exactly at 2PI');
});

test('Forces node types to pie_slice', () => {
    // If they were passed as 'process' or something else, layoutPiechart should force 'pie_slice'
    const wrongTypeNodes = [makeNode('X', 0, 0, 'process', 'M', { value: 100 })];
    const res = layoutPiechart(wrongTypeNodes, [], { PADDING: 0 });
    expect(res[0].type, 'pie_slice', 'type forced');
});

summary('engine.piechart.test.mjs');
