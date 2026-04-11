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
`,
  timeline: `
<thinking>test</thinking>
# Timeline Spine
| Spine ID | Phase/Era Label | Color (0-11) |
|---|---|---|
| e1 | Q1 Phase 1 | 0 |
# Events
### Phase: Engineering Tasks | Size: S
| Spine ID | Label |
|---|---|
| e1 | Bootstrapping |
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
  return {
    ok: true,
    json: async () => ({
      success: true,
      content: MOCK_RESPONSES[currentTestType]
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
    assert.ok(prompt.includes(type.toUpperCase()) || prompt.includes('Diagram'), \`Prompt for \${type} should be valid\`);
    
    // 2. Check parsing CCI
    currentTestType = type;
    const res = await buildDiagram('Test ' + type, type, 'extended prompt');
    assert.strictEqual(res.success, true, \`buildDiagram should succeed for \${type}\`);
    assert.ok(res.cci.data.groups.length > 0, \`Parsed CCI for \${type} should have groups\`);
    
    const allNodes = res.cci.data.groups.flatMap(g => g.nodes);
    assert.ok(allNodes.length > 0, \`Parsed CCI for \${type} should have nodes in groups\`);
    
    // Check parasitic header bug test
    const parasiticNodes = allNodes.filter(n => n.label === 'Label' || n.label === 'Event Label' || n.label === 'Node Label' || n.label === 'Title' || n.label === 'Title (Label)' || n.label === 'Phase/Era Label');
    assert.strictEqual(parasiticNodes.length, 0, \`Should not have parsed table headers as valid nodes for \${type}\`);
  }
}

runTests().then(() => {
  global.fetch = originalFetch;
}).catch(e => {
  console.error(e);
  process.exit(1);
});
