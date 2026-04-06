# chartici-mcp

MCP server for [Chartici](https://chartici.com) — professional diagrams from a single AI prompt.

## Quick Start

```bash
npx -y chartici-mcp@latest
```

## Connect to Claude Desktop

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

Restart Claude. Then just say:

> "Draw an org chart for my company"

## Works With

- **Claude Desktop**
- **ChatGPT** (via MCP bridge)
- **Gemini / Google AI Studio**
- **DeepSeek**
- **Cursor, Windsurf, Cline**, and any MCP-compatible client

## What It Does

Your AI reads the Chartici format spec automatically and generates `.cci` diagram files. Supports: flowcharts, org charts, ERDs, sequence diagrams, mind maps, timelines, matrices.

## Author

[Sergey Zorin](https://www.linkedin.com/in/sfzorin/)

## License

MIT
