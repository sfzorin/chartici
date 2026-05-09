# Developer Panel Proposal

This is a proposal for future developer tooling. It is not implemented yet.

## Goal

Add an optional in-browser panel for tuning layout and routing parameters while looking at a live diagram.

This would help contributors debug:

- node spacing
- group overlay padding
- edge routing penalties
- crossing behavior
- label clearance
- diagram-specific layout constants

## Non-Goals

- No production-facing UI.
- No backend admin panel.
- No prompt editing UI.
- No persistent project-format changes unless the feature graduates from experimental tooling.

## Possible UI

A collapsible panel over the canvas with controls grouped by subsystem:

### Layout

- horizontal gap
- vertical gap
- group padding
- rank separation
- node separation
- lock-position behavior

### Routing

- bend penalty
- crossing penalty
- obstacle padding
- bus routing bonus
- fallback strategy
- edge label clearance

### Rendering

- overlay opacity
- lane padding
- selection bounds
- export cleanup diagnostics

## Persistence

Early versions should store overrides in `localStorage` only.

If the panel becomes stable, overrides can be exported as JSON for test fixtures. They should not be written into `.cci` project files by default.

## Implementation Sketch

1. Add `DevPanel.jsx`.
2. Keep override state in `App.jsx` or a small hook.
3. Pass overrides to `DiagramRenderer`.
4. Thread relevant values into layout and routing calls.
5. Add a visible "reset overrides" action.
6. Add diagnostics showing the active diagram type, engine manifest, node count, edge count, and route count.

## Safety

Developer overrides must never affect normal users unless explicitly enabled. A query parameter such as `?devPanel=1` is enough for the first version.
