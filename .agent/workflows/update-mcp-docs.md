---
description: Update MCP server and user_guide.md based on recent code changes
---

# Update MCP & Documentation

This workflow updates the Chartici MCP server and the AI agent documentation (`user_guide.md`) based on recent code changes.

## Important: Hidden Features (DO NOT document)

The following features are **internal-only** and must NEVER appear in `user_guide.md` or MCP tool descriptions:

- **Node pinning/locking** (`lockPos`, `pinned`, manual drag position retention)
- **Text node type** (`type: "text"` — annotation nodes, free-form text blocks)
- **Text/label pinning** (manually positioned text annotations)
- **Title locking** (`titleLocked`, title position persistence)
- **Custom hex colors** (raw `#hex` color overrides, `customColor` field)
- **Debug overlays** (grid, routing visualization, port debug)

These features exist in code but are not exposed to AI agents.

## Steps

### 1. Review recent changes

// turbo
```
cd /Users/sergeyzorin/Desktop/diagram && git log --oneline -10
```

### 2. Get detailed diff of latest changes

// turbo
```
cd /Users/sergeyzorin/Desktop/diagram && git diff HEAD~2..HEAD --stat
```

### 3. Read the current docs file

// turbo
```
cat /Users/sergeyzorin/Desktop/diagram/src/assets/user_guide.md
```

### 4. Identify what changed that affects AI-facing documentation

Review the diff output and identify:
- New diagram types or subtypes
- New node types or shapes
- New edge properties (lineStyle, connectionType, cardinality)
- New layout behaviors (stacking, flow direction)
- Changed file format schema (.cci structure)
- New color palettes or design tokens
- New aspect ratio behaviors

Skip anything in the "Hidden Features" list above.

### 5. Update `user_guide.md`

Edit `/Users/sergeyzorin/Desktop/diagram/src/assets/user_guide.md` with the identified changes.

Rules:
- Keep the existing structure (format spec → schema → examples → tips)
- Keep the Author line: `> **Author:** [Sergey Zorin](https://www.linkedin.com/in/sfzorin/)`
- Add/update sections only for features an AI agent needs to know
- Include practical examples for any new feature
- Ensure all JSON examples are valid
- Keep the file concise — under 200 lines

### 6. Update MCP server if needed

If new tools are needed (e.g., new export format, validation), edit `/Users/sergeyzorin/Desktop/diagram/mcp-server.mjs`.

The MCP server exposes:
- **Resource**: `chartici://docs` — auto-serves user_guide.md
- **Tool**: `render_diagram` — .cci JSON → SVG
- **Tool**: `save_diagram` — save .cci to disk  
- **Tool**: `list_samples` / `read_sample` — browse examples

### 7. Update SVG renderer if needed

If new node types or visual features were added, update `/Users/sergeyzorin/Desktop/diagram/src/utils/svgRenderer.js` to render them correctly in headless SVG mode.

### 8. Test the MCP server

// turbo
```
cd /Users/sergeyzorin/Desktop/diagram && echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}' | npx tsx mcp-server.mjs 2>&1 | head -3
```

### 9. Test SVG rendering

// turbo
```
cd /Users/sergeyzorin/Desktop/diagram && npx tsx -e "
import { renderToSVG } from './src/utils/svgRenderer.js';
import fs from 'fs';
const cci = fs.readFileSync('samples/tree_1_simple.cci', 'utf-8');
const { svg, width, height } = renderToSVG(cci);
console.log('tree_1:', width, 'x', height, '- OK');
const cci2 = fs.readFileSync('samples/un_1_simple.cci', 'utf-8');
const r2 = renderToSVG(cci2);
console.log('un_1:', r2.width, 'x', r2.height, '- OK');
"
```

### 10. Run golden tests to verify no regressions

// turbo
```
cd /Users/sergeyzorin/Desktop/diagram && npx tsx src/tests/engine_golden.test.mjs 2>&1 | tail -2
```

### 11. Commit and push

```
cd /Users/sergeyzorin/Desktop/diagram && git add -A && git commit -m "docs: update MCP and user_guide for latest changes" && git push
```
