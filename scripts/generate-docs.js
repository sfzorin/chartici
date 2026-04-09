import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DIAGRAM_SCHEMAS } from '../src/utils/diagramSchemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.resolve(__dirname, '../docs');

if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR);
}

const generateFormatSpec = () => {
    let md = `# Chartici .CCI Format Specification\n\n`;
    md += `The \`.cci\` (Chartici Concept Interchange) file format is a strict JSON blueprint used for generating, validating, and layout-rendering dynamic diagrams.\n\n`;

    md += `## 1. Top-Level Structure\n`;
    md += "```json\n{\n  \"data\": {\n    \"nodes\": [],\n    \"edges\": [],\n    \"groups\": [],\n    \"config\": {}\n  },\n  \"meta\": {\n    \"type\": \"flowchart\",\n    \"version\": \"1.0.0\"\n  }\n}\n```\n\n";

    md += `## 2. General Node Properties\n`;
    md += `Nodes define graphical entities. All sizes and coordinates use a virtual canvas pixel system.\n`;
    md += `- **\`id\`** (String): Unique identifier. System title use \`__SYSTEM_TITLE__\` internally.\n`;
    md += `- **\`type\`** (String): Visual shape. Must be one of: \`process, circle, oval, rhombus, text, chevron, pie_slice\`.\n`;
    md += `- **\`label\`** (String): Content of the node. Newlines \`\\n\` are supported.\n`;
    md += `- **\`x\`**, **\`y\`** (Number): Logical coordinates.\n`;
    md += `- **\`color\`** (Number | String): Either an integer \`1-9\` matching the predefined color palettes, OR a valid Hex string like \`#1E293B\`.\n`;
    md += `- **\`size\`** (String): Typography and boundary scaling. Allowed: \`AUTO, XS, S, M, L, XL\`. (Pie slices strictly enforce \`M\`).\n`;
    md += `- **\`lockPos\`** (Boolean): If \`true\`, the Auto-Layout (Heuristic) engine will NOT touch or move this node from its \`x,y\` position.\n`;
    md += `- **\`value\`** (Number): Quantitative value, heavily used in specific types (e.g., Pie Chart slices).\n`;
    md += `- **\`groupId\`** (String): Optional reference to a group ID.\n\n`;

    md += `## 3. General Edge Properties\n`;
    md += `- **\`id\`** (String): Unique edge ID.\n`;
    md += `- **\`from\`**, **\`to\`** (String): Must match existing node \`id\`s.\n`;
    md += `- **\`label\`** (String): Optional textual badge centered on the edge.\n`;
    md += `- **\`lineStyle\`** (String): \`solid, dashed, dotted, bold, bold-dashed, none\`. (\`none\` acts as a topological invsible spine link).\n`;
    md += `- **\`connectionType\`** (String): Arrow mapping: \`target, both, reverse, none\` or ERD specifics like \`1:1, 1:N, N:M\`.\n\n`;

    md += `## 4. Diagram Type Matrix\n`;
    md += `Chartici supports specialized validation and rendering logic depending on the active diagram type.\n\n`;

    Object.values(DIAGRAM_SCHEMAS).forEach(schema => {
        if (schema.id === 'default') return;
        md += `### ${schema.name} (\`type: "${schema.id}"\`)\n`;
        md += `**Purpose**: ${schema.description}\n`;
        md += `- **Allowed Nodes**: \`${schema.allowedNodes.join(', ')}\`\n`;
        md += `- **Allowed Edges**: \`${schema.allowedEdges.join(', ')}\`\n`;
        
        const feats = [];
        if (schema.features.hasNodeValue) feats.push("Data Values Required");
        if (!schema.features.allowConnections) feats.push("No Connections Allowed");
        if (!schema.features.hasGroups) feats.push("No Grouping Allowed");
        
        if (feats.length > 0) {
            md += `- **Feature Flags**: ${feats.join(' | ')}\n`;
        }
        
        if (schema.connectionRules && schema.connectionRules.length > 0) {
            md += `- **Strict Connection Rules**:\n`;
            schema.connectionRules.forEach(r => {
                md += `   - ${r}\n`;
            });
        }
        md += `\n`;
    });

    fs.writeFileSync(path.join(DOCS_DIR, 'cci_format_spec.md'), md);
};

const generateUserGuide = () => {
    let md = `# Chartici User Guide\n\n`;
    md += `Welcome to Chartici. This guide explains the available layout engines and diagram structures you can use when generating or editing charts.\n\n`;
    
    Object.values(DIAGRAM_SCHEMAS).forEach(schema => {
        if (schema.id === 'default') return;
        md += `### ✦ ${schema.name}\n`;
        md += `*${schema.description}*\n\n`;
        md += `**Editor Specifics:**\n`;
        md += `- **Tools**: You can use ${schema.allowedNodes.map(n => "**" + n + "**").join(', ')} elements.\n`;
        if (!schema.features.allowConnections) {
            md += `- **Connections**: Connections (Edges) are disabled for this type.\n`;
        }
        if (schema.features.hasNodeValue) {
            md += `- **Values**: Requires numerical values (available as a \`VALUE\` input inside the left sidebar).\n`;
        }
        
        md += `\n---\n\n`;
    });
    
    fs.writeFileSync(path.join(DOCS_DIR, 'user_guide.md'), md);
};

generateFormatSpec();
generateUserGuide();

console.log("Successfully generated /docs/cci_format_spec.md and /docs/user_guide.md from the central diagram schemas.");
