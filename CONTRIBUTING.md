# Contributing

Thanks for helping improve Chartici.

The project is currently focused on one goal: reliable, book-ready technical diagrams. Please prefer small, practical improvements over broad rewrites.

## Development Setup

```bash
npm install
npm run dev
```

Optional backend for AI generation:

```bash
cd backend
npm install
DEEPSEEK_API_KEY=sk-... npm run dev
```

## Before You Open A PR

Run:

```bash
npm run build
npm run test:engine
npm run lint
```

`npm run lint` may report existing warnings. New changes should not add errors.

## Good First Areas

- improve sample diagrams
- add parser regression tests for malformed AI Markdown
- improve SVG export reliability
- improve mobile editing ergonomics
- tighten diagram-specific layouts
- improve docs

## Code Style

- Follow existing React and module patterns.
- Keep edits scoped.
- Prefer registries over scattered conditionals:
  - node shapes: `src/diagram/nodes.jsx`
  - edge styles: `src/diagram/edges.js`
  - colors: `src/diagram/colors.js`
  - diagram schemas: `src/engines/<type>/engine.js`
- Do not add legacy aliases unless there is a strong migration reason.
- Keep `.cci` examples on the current format.

## Diagram Quality Bar

A diagram type is not "done" if it only renders one happy-path example.

For user-facing diagram behavior, check:

- nodes do not overlap
- edges are visible when the type supports edges
- labels fit inside nodes or are intentionally hidden
- export SVG matches the browser view
- mobile controls remain usable
- examples smoke-test cleanly

## AI Prompt Changes

When changing AI prompts:

1. Keep the output Markdown-table based.
2. Keep examples short.
3. Keep labels short.
4. Add parser tests for new tolerated formats.
5. Run `npm run test:engine`.

The repair pass should catch occasional malformed answers, but prompts should still aim for canonical output.

## Adding A Diagram Type

Create:

- `src/engines/<type>/engine.js`
- `src/engines/<type>/ai_prompt.js`
- `src/engines/<type>/format.md`
- samples in `samples/` and `public/samples/`
- tests or smoke coverage

Then register the engine in `src/engines/index.js`.

## Commit Guidelines

Use concise, descriptive commit messages:

```text
Fix sequence lane edge spacing
Add parser repair pass
Document current CCI format
```

## Security

Never commit API keys or production secrets. The backend expects `DEEPSEEK_API_KEY` from the environment.
