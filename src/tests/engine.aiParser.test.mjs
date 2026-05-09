import assert from 'node:assert';
import { buildDiagram } from '../services/aiGenerate.js';
import { DIAGRAM_SCHEMAS } from '../utils/diagramSchemas.js';
import { getSystemPromptPhase2 } from '../assets/systemPrompts.js';

// Setup mock fetch
const originalFetch = global.fetch;

const MOCK_RESPONSES = {
  flowchart: `
<thinking>test</thinking>
# Steps
### Subsystem: Core App | Size: M
| Node ID | Label | Type | Next Steps |
|---|---|---|---|
| p_1 | Start Process | terminal | d_1 |
| d_1 | Verify Step | decision | p_2[Yes], e_1[No] |
| p_2 | Next Process | process | - |
| e_1 | Some event | event | - |
`,
  erd: `
<thinking>test</thinking>
# Entities
### Schema: Core Auth | Size: M
| Node ID | Label | Type |
|---|---|---|
| t_users | Users Table | table |
| c_id | ID | attribute |
# Relationships
| Source ID | Target ID | Label | ConnectionType |
|---|---|---|---|
| t_users | c_id | Primary Key | 1:1 |
`,
  sequence: `
<thinking>test</thinking>
# States
### Actor: Client | Size: M
| Node ID | Node Label |
|---|---|
| c_1 | Init Request |
### Actor: API Server | Size: M
| Node ID | Event Label |
|---|---|
| s_1 | Validate Auth |
# Messages
| Source ID | Target ID | Label | ConnectionType |
|---|---|---|---|
| c_1 | s_1 | POST /data | solid |
`,
  radial: `
<thinking>test</thinking>
# Root
| Spine ID | Label | Size |
|---|---|---|
| center_1 | Kernel API | L |
# Branches
### Orbit: Microservices | Parent ID: center_1 | Size: M
| Node ID | Label |
|---|---|
| s_1 | Auth |
`,
  matrix: `
<thinking>test</thinking>
# Elements
### Zone: High Priority | Size: M
| Node ID | Label |
|---|---|
| t_1 | Fix Database |
| t_2 | Patch Auth |
### Zone: Low Priority | Size: S
| Node ID | Label |
|---|---|
| t_3 | Update CSS |
`,
  timeline: `
<thinking>test</thinking>
# Timeline Spine
| Spine ID | Phase/Era Label | Color (0-11) |
|---|---|---|
| e1 | Q1 Phase 1 | 0 |
| e2 | Q2 Phase 2 | 2 |
# Events
### Phase: Engineering Tasks | Size: S
| Spine ID | Label |
|---|---|
| e1 | Bootstrapping |
| e2 | Launch |
`,
  tree: `
<thinking>test</thinking>
# Root
| Node ID | Label | Size |
|---|---|---|
| root_1 | CEO | L |
# Branches
### Branch: Engineering | Parent ID: root_1 | Size: M
| ID | Label |
|---|---|
| vp_1 | VP Engineering |
`,
  piechart: `
<thinking>test</thinking>
# Pie Slices
| Title | Size | Value |
|---|---|---|
| Revenue | L | 45.5 |
| Costs | M | 30 |
`
};

let currentTestType = null;
global.fetch = async (url, options) => {
  const response = MOCK_RESPONSES[currentTestType];
  const content = Array.isArray(response) ? response.shift() : response;
  return {
    ok: true,
    json: async () => ({
      success: true,
      content
    })
  };
};

if (typeof global.localStorage === 'undefined') {
  global.localStorage = {
    getItem: () => null,
    setItem: () => {}
  };
}

async function runTests() {
  const types = Object.keys(DIAGRAM_SCHEMAS);
  
  for (const type of types) {
    if (!MOCK_RESPONSES[type]) continue;
    
    // 1. Check prompt generation
    const prompt = getSystemPromptPhase2(type);
    assert.ok(prompt.includes(type.toUpperCase()) || prompt.includes('Diagram'), `Prompt for ${type} should be valid`);
    
    // 2. Check parsing CCI
    currentTestType = type;
    const res = await buildDiagram('Test ' + type, type, 'extended prompt');
    assert.strictEqual(res.success, true, `buildDiagram should succeed for ${type}`);
    assert.ok(res.cci.data.groups.length > 0, `Parsed CCI for ${type} should have groups`);
    
    const allNodes = res.cci.data.groups.flatMap(g => g.nodes);
    assert.ok(allNodes.length > 0, `Parsed CCI for ${type} should have nodes in groups`);
    
    // Check parasitic header bug test
    const parasiticNodes = allNodes.filter(n => n.label === 'Label' || n.label === 'Event Label' || n.label === 'Node Label' || n.label === 'Title' || n.label === 'Title (Label)' || n.label === 'Phase/Era Label');
    assert.strictEqual(parasiticNodes.length, 0, `Should not have parsed table headers as valid nodes for ${type}`);
  }

  currentTestType = 'flowchart';
  MOCK_RESPONSES.flowchart = `
<output>
### Subsystem: Drafting | Size: M
| Node ID | Label | Type | Next Steps |
|---|---|---|---|
| p_1 | Capture Idea | terminal | p_2 |
| p_2 | Shape Argument | process | p_3 |
| p_3 | Finish Figure | terminal | - |
</output>
`;
  const wrapped = await buildDiagram('Wrapped flowchart', 'flowchart', 'extended prompt');
  assert.strictEqual(wrapped.success, true, 'buildDiagram should unwrap <output> without deleting Markdown');
  assert.ok(wrapped.cci.data.groups.length > 0, 'Wrapped Markdown should produce groups');
  assert.ok(wrapped.cci.data.groups.flatMap(g => g.nodes).length >= 3, 'Wrapped Markdown should produce nodes');

  currentTestType = 'flowchart';
  MOCK_RESPONSES.flowchart = [
    `
# Steps
### Subsystem: Sandwich | Size: M
| Node ID | Label | Type | Next Steps |
|---|---|---|---|
| p_1 | Choose Bread | process | p_2 |
| p_2 | Pick Spread | process | p_3 |
| p_3 | Add Filling | process | p_4 |
| p_4 | Add Toppings | process | p_5 |
| p_5 | Close & Cut | process | p_6 |
| p_6 | Eat & Enjoy | terminal | - |
`,
    `
# Steps
### Stage: Bread Choice | Size: M
| Node ID | Label | Type | Next Steps |
|---|---|---|---|
| p_1 | Choose Bread | decision | white[White], wheat[Wheat], wrap[Wrap] |
| white | White Bread | process | p_2 |
| wheat | Wheat Bread | process | p_2 |
| wrap | Wrap | process | p_2 |
### Stage: Flavor Choice | Size: M
| Node ID | Label | Type | Next Steps |
|---|---|---|---|
| p_2 | Pick Spread | decision | mayo[Mayo], mustard[Mustard] |
| mayo | Mayo | process | p_3 |
| mustard | Mustard | process | p_3 |
### Stage: Finish | Size: M
| Node ID | Label | Type | Next Steps |
|---|---|---|---|
| p_3 | Add Filling | process | p_4 |
| p_4 | Close & Cut | process | p_5 |
| p_5 | Eat & Enjoy | terminal | - |
`
  ];
  const repairedQuality = await buildDiagram('Sandwich Making', 'flowchart', `
- Start: Choose Bread (white, wheat, wrap)
- Step 1: Pick Spread (mayo, mustard, butter)
- Step 2: Add Main Filling (ham, turkey, cheese, jam)
- Step 3: Add Toppings (lettuce, tomato, cucumber, pickles)
- Step 4: Close & Cut
- End: Eat & Enjoy
`);
  const qualityNodes = repairedQuality.cci.data.groups.flatMap(g => g.nodes);
  const breadChoice = qualityNodes.find(n => n.id === 'p_1');
  assert.strictEqual(repairedQuality.success, true, 'low-quality straight flowchart should be repaired');
  assert.ok(repairedQuality.cci.data.groups.length > 1, 'repaired flowchart should use visual stage groups');
  assert.ok(String(breadChoice.nextSteps).split(',').length > 1, 'repaired flowchart should preserve choices as branches');

  currentTestType = 'sequence';
  MOCK_RESPONSES.sequence = `
### Actor: Author | Size: M
| Node ID | Label |
|---|---|
| a_1 | Send Draft |
### Actor: Editor | Size: M
| Node ID | Label |
|---|---|
| e_1 | Review Draft |
### Messages
| Source ID | Target ID | Label | LineStyle |
|---|---|---|---|
| a_1 | e_1 | Submit | solid |
`;
  const missingTopSection = await buildDiagram('Loose sequence', 'sequence', 'extended prompt');
  assert.strictEqual(missingTopSection.success, true, 'buildDiagram should infer sections from loose Markdown headings');
  assert.strictEqual(missingTopSection.cci.data.messages.length, 1, 'Loose sequence should keep explicit messages');

  currentTestType = 'flowchart';
  MOCK_RESPONSES.flowchart = [
    'I cannot make this diagram.',
    `
# Steps
### Subsystem: Repair | Size: M
| Node ID | Label | Type | Next Steps |
|---|---|---|---|
| p_1 | Start Repair | terminal | p_2 |
| p_2 | Return Tables | process | p_3 |
| p_3 | Done | terminal | - |
`
  ];
  const repaired = await buildDiagram('Repaired flowchart', 'flowchart', 'extended prompt');
  assert.strictEqual(repaired.success, true, 'buildDiagram should repair an unparsable first answer');
  assert.ok(repaired.cci.data.groups.flatMap(g => g.nodes).length >= 3, 'Repair pass should produce nodes');
}

runTests().then(() => {
  global.fetch = originalFetch;
}).catch(e => {
  console.error(e);
  process.exit(1);
});
