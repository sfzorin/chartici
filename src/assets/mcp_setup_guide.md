# Chartici MCP — Quick Setup

Your AI draws diagrams for you. No copy-paste.

## 1. Install

```bash
npx -y chartici-mcp@latest
```

> Requires [Node.js 18+](https://nodejs.org)

## 2. Connect to your AI

### Claude Desktop

Settings → Developer → Edit Config:

```json
{
  "mcpServers": {
    "chartici": {
      "command": "npx",
      "args": ["-y", "chartici-mcp@latest"]
    }
  }
}
```

### ChatGPT (via MCP plugin)

Use any MCP bridge for ChatGPT (e.g. [MCP Bridge](https://github.com/nicobailey/mcp-bridge-chatgpt)):

```bash
npx -y chartici-mcp@latest
```

### Gemini / Google AI Studio

Add as an MCP tool source in your Gemini integration settings. Command:

```
npx -y chartici-mcp@latest
```

### DeepSeek

Use with any MCP-compatible client (Cursor, Continue, Cline). Same config:

```json
{
  "command": "npx",
  "args": ["-y", "chartici-mcp@latest"]
}
```

### Any MCP Client (Cursor, Windsurf, Cline, etc.)

Add Chartici as an MCP server with the command above.

## 3. Done

Just talk naturally:

- "Draw an org chart for my company"
- "ERD for a blog with users, posts, comments"
- "OAuth 2.0 sequence diagram"
- "Mind map of machine learning concepts"
- "Flowchart for user registration process"

Your AI will render the diagram as SVG automatically.
