#!/usr/bin/env node
/**
 * Chartici MCP Server
 * 
 * AI-powered diagram rendering via Model Context Protocol.
 * Exposes the Chartici .cci format spec and save tool to AI assistants.
 * 
 * Usage: npx chartici-mcp
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsPath = path.join(__dirname, "user_guide.md");

const server = new McpServer({
  name: "chartici",
  version: "1.0.0",
});

// ─── Resource: Docs ──────────────────────────────────────────
server.resource(
  "docs",
  "chartici://docs",
  {
    description: "Chartici .cci format specification — diagram types, design tokens, node/edge schema. Read this before generating any diagram.",
    mimeType: "text/markdown"
  },
  async () => ({
    contents: [{
      uri: "chartici://docs",
      mimeType: "text/markdown",
      text: fs.readFileSync(docsPath, "utf-8")
    }]
  })
);

// ─── Tool: Save Diagram ──────────────────────────────────────
server.tool(
  "save_diagram",
  "Save a Chartici .cci diagram to a file. Generate the .cci JSON following the format from the chartici://docs resource, then save it with this tool. The user can open the file in Chartici (chartici.com) to render it.",
  {
    filename: z.string().describe("Filename without extension, e.g. 'my_org_chart'"),
    content: z.string().describe("Complete .cci JSON content as a string"),
    directory: z.string().optional().describe("Save directory path. Defaults to current directory.")
  },
  async ({ filename, content, directory }) => {
    try {
      const parsed = JSON.parse(content);
      const pretty = JSON.stringify(parsed, null, 2);
      const dir = directory || process.cwd();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const safeName = filename.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filePath = path.join(dir, `${safeName}.cci`);
      fs.writeFileSync(filePath, pretty, 'utf-8');
      return {
        content: [{ type: "text", text: `✅ Saved: ${filePath}\n\nOpen chartici.com and paste this file's contents to render.` }]
      };
    } catch (e) {
      return { content: [{ type: "text", text: `❌ Error: ${e.message}` }] };
    }
  }
);

// ─── Start ───────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🎨 Chartici MCP Server running");
}

main().catch(console.error);
