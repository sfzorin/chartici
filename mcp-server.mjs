#!/usr/bin/env node
/**
 * Chartici MCP Server
 * 
 * Exposes Chartici's diagramming engine to AI assistants via Model Context Protocol.
 * 
 * Resources:
 *   - chartici://docs — The full AI agent implementation guide (.cci format spec)
 * 
 * Tools:
 *   - render_diagram — Generate SVG from .cci JSON (primary output)
 *   - save_diagram   — Save .cci or .svg to disk
 *   - list_samples   — List available sample diagrams
 *   - read_sample    — Read a specific sample for reference
 * 
 * Run: node mcp-server.mjs
 * Config (Claude Desktop): "chartici": { "command": "node", "args": ["/path/to/mcp-server.mjs"] }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsPath = path.join(__dirname, "src/assets/user_guide.md");
const outputDir = path.join(__dirname, "output");

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// ─── Lazy-load the renderer (avoids startup crash if deps missing) ───
let renderToSVG = null;
async function getRenderer() {
  if (!renderToSVG) {
    const mod = await import("./src/utils/svgRenderer.js");
    renderToSVG = mod.renderToSVG;
  }
  return renderToSVG;
}

// ─── Create Server ───────────────────────────────────────────
const server = new McpServer({
  name: "chartici",
  version: "1.0.0",
});

// ─── Resource: Documentation ─────────────────────────────────
server.resource(
  "docs",
  "chartici://docs",
  {
    description: "Chartici .cci file format specification — diagram types, design tokens, node/edge schema, and examples. Read this before generating any diagram.",
    mimeType: "text/markdown"
  },
  async () => {
    const content = fs.readFileSync(docsPath, "utf-8");
    return {
      contents: [{
        uri: "chartici://docs",
        mimeType: "text/markdown",
        text: content
      }]
    };
  }
);

// ─── Tool: Render Diagram → SVG ──────────────────────────────
server.tool(
  "render_diagram",
  "Render a Chartici diagram to SVG. Provide valid label-based and id-based .cci JSON and receive the rendered SVG back. The SVG includes full layout, routing, colors, and labels. Optionally saves to disk.",
  {
    cci_json: z.string()
      .describe("Complete label-based and id-based .cci JSON content following the Chartici format spec"),
    save_path: z.string().optional()
      .describe("Optional: absolute file path to save the SVG (e.g. '/Users/me/diagram.svg')")
  },
  async ({ cci_json, save_path }) => {
    try {
      const render = await getRenderer();
      const { svg, width, height } = render(cci_json);
      
      // Optionally save
      if (save_path) {
        const dir = path.dirname(save_path);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const svgPath = save_path.endsWith('.svg') ? save_path : save_path + '.svg';
        fs.writeFileSync(svgPath, svg, 'utf-8');
        
        return {
          content: [
            { type: "text", text: `✅ SVG rendered (${width}×${height}px) and saved to: ${svgPath}` },
            { type: "text", text: svg }
          ]
        };
      }
      
      return {
        content: [
          { type: "text", text: `✅ SVG rendered successfully (${width}×${height}px):` },
          { type: "text", text: svg }
        ]
      };
    } catch (e) {
      return {
        content: [{ type: "text", text: `❌ Render error: ${e.message}\n\n${e.stack}` }]
      };
    }
  }
);

// ─── Tool: Save Diagram (.cci) ───────────────────────────────
server.tool(
  "save_diagram",
  "Save a label-based and id-based .cci diagram file to disk for later use in Chartici web app",
  {
    filename: z.string()
      .describe("Filename (without extension), e.g. 'my_org_chart'"),
    content: z.string()
      .describe("Complete .cci JSON content (label-based nodes & edges with explicit IDs)"),
    directory: z.string().optional()
      .describe("Optional save directory. Defaults to project's output/")
  },
  async ({ filename, content, directory }) => {
    try {
      const parsed = JSON.parse(content);
      const pretty = JSON.stringify(parsed, null, 2);
      const dir = directory || outputDir;
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const safeName = filename.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filePath = path.join(dir, `${safeName}.cci`);
      fs.writeFileSync(filePath, pretty, 'utf-8');

      return {
        content: [{ type: "text", text: `✅ Saved: ${filePath}\n\nOpen Chartici and paste this file's contents to render.` }]
      };
    } catch (e) {
      return { content: [{ type: "text", text: `❌ Error: ${e.message}` }] };
    }
  }
);

// ─── Tool: List Samples ──────────────────────────────────────
server.tool(
  "list_samples",
  "List all available Chartici sample diagrams with their types",
  {},
  async () => {
    const samplesDir = path.join(__dirname, "samples");
    if (!fs.existsSync(samplesDir)) {
      return { content: [{ type: "text", text: "No samples directory found" }] };
    }
    
    const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.cci'));
    const samples = files.map(f => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(samplesDir, f), 'utf-8'));
        const title = raw.title || raw.header || f;
        const type = raw.diagramType || 'unknown';
        return `• ${f} — ${title} (${type})`;
      } catch { return `• ${f}`; }
    });

    return {
      content: [{ type: "text", text: `📋 ${files.length} samples:\n\n${samples.join('\n')}` }]
    };
  }
);

// ─── Tool: Read Sample ───────────────────────────────────────
server.tool(
  "read_sample",
  "Read a Chartici sample file to use as reference for creating similar diagrams",
  {
    filename: z.string().describe("Sample filename, e.g. 'tree_2_medium.cci'")
  },
  async ({ filename }) => {
    const filePath = path.join(__dirname, "samples", filename);
    if (!fs.existsSync(filePath)) {
      return { content: [{ type: "text", text: `❌ Not found: ${filename}` }] };
    }
    return { content: [{ type: "text", text: fs.readFileSync(filePath, 'utf-8') }] };
  }
);

// ─── Start ───────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🎨 Chartici MCP Server running (stdio)");
}

main().catch(console.error);
