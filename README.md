# Chartici

AI-assisted SVG diagram editor for clear, book-ready technical illustrations.

Chartici turns structured Markdown or natural-language prompts into editable diagrams that export as clean SVG. It is built for diagrams that need to survive a publishing workflow: readable labels, stable layout, explicit vector shapes, and predictable colors.

## What It Does

- Generates diagrams from an LLM prompt through a two-step planning and Markdown-table workflow.
- Lets you edit nodes, groups, labels, colors, edges, canvas settings, and layout directly in the browser.
- Exports standalone SVG with CSS colors baked into the file.
- Saves and loads `.cci` project files.
- Supports a focused set of diagram types:
  - Flowchart
  - Timeline
  - Tree / hierarchy
  - Matrix
  - Sequence
  - ERD
  - Radial map
  - Pie chart

The current product direction is deliberately narrow: make a small set of core diagram types work well for one serious book workflow, instead of trying to be a universal diagramming tool.

## Screenshots / Demo

Run the app locally and open the included examples from the welcome screen:

```bash
npm install
npm run dev
```

Then open the Vite URL, usually `http://localhost:5173`.

## Quick Start

### Requirements

- Node.js 18+
- npm

### Frontend

```bash
git clone https://github.com/dannie-cc/chartici.git
cd chartici
npm install
npm run dev
```

Useful scripts:

```bash
npm run build
npm run lint
npm run test:engine
```

### Backend AI Proxy

The frontend calls `/api/generate`. In production this should be served by the backend proxy in `backend/`, which keeps the DeepSeek API key off the client.

```bash
cd backend
npm install
DEEPSEEK_API_KEY=sk-... npm run dev
```

The backend listens on `http://localhost:3001` by default. See [backend/README.md](backend/README.md) for API details and deployment notes.

## AI Generation Flow

Chartici does not ask the model for arbitrary JSON. The AI pipeline is intentionally Markdown-first:

1. **Plan:** choose a diagram type, title, and expanded prompt.
2. **Build:** ask the model for type-specific Markdown tables.
3. **Parse:** convert Markdown tables into `.cci`.
4. **Validate:** reject unreadable or structurally broken diagrams.
5. **Repair:** if parsing or validation fails, send the model its own broken answer plus concrete errors and ask for corrected Markdown once.

The parser accepts small Markdown variations, but the canonical output format is documented in:

- [docs/ai_prompt_format.md](docs/ai_prompt_format.md)
- `src/engines/<type>/ai_prompt.js`
- `src/engines/<type>/format.md`

## Project File Format

Chartici projects are JSON files with a `.cci` extension. The current format is v3-style:

```json
{
  "meta": { "type": "flowchart", "version": "3.0.0" },
  "theme": "basic",
  "title": { "text": "Example", "size": "M" },
  "data": {
    "config": { "aspect": "16:9", "bgColor": "white" },
    "groups": []
  }
}
```

Use these palette keys in new files:

- `basic`
- `ink`
- `library`
- `copper`
- `atlas`

Type-specific edge encoding is documented in each engine format file:

- [Flowchart](src/engines/flowchart/format.md)
- [Timeline](src/engines/timeline/format.md)
- [Tree](src/engines/tree/format.md)
- [Matrix](src/engines/matrix/format.md)
- [Sequence](src/engines/sequence/format.md)
- [ERD](src/engines/erd/format.md)
- [Radial](src/engines/radial/format.md)
- [Pie chart](src/engines/piechart/format.md)

## Repository Layout

```text
backend/                 Express proxy for DeepSeek
docs/                    User, AI, and architecture docs
public/samples/          Sample files shown by the app
samples/                 Source sample files used by the welcome screen
src/assets/              UI copy, prompts, guide text, static assets
src/components/          React UI and SVG renderer
src/diagram/             Node, edge, color, and canvas registries
src/engines/             Diagram-type plugins
src/services/            AI generation client/parser
src/tests/               Engine and parser tests
src/utils/               Layout, routing, import/export utilities
```

## Design Principles

- **SVG first.** The exported artifact should be useful in publishing tools.
- **Markdown for AI.** LLMs are better at tables than deeply nested schema output.
- **Few diagram types, better quality.** Broken obvious cases are bugs, not edge cases.
- **Explicit formats.** New `.cci` files should use the current keys and not rely on legacy aliases.
- **Book readability.** Compact structure, short labels, restrained palettes, and predictable layout matter more than decorative UI.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md).

Before opening a PR, run:

```bash
npm run build
npm run test:engine
npm run lint
```

Lint currently reports warnings in older parts of the app; new work should avoid adding new errors.

## License

Apache-2.0. See [LICENSE](LICENSE).
