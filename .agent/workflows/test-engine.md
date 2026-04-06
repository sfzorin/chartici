---
description: Run the routing engine golden reference tests
---
// turbo-all

## Routing Engine Tests

Always run in this order: golden first, then samples.

### Step 1: Golden Reference Tests (unit)

Small focused diagrams with exact expected behavior. Must ALWAYS pass.

```
npx tsx src/tests/engine_golden.test.mjs
```

If any ❌ appears — stop immediately and fix before proceeding.

### Step 2: Sample Metrics Report (integration)

Loads ALL .cci sample files, runs full layout+routing, reports per-sample and totals.

```
npx tsx src/tests/engine_samples.test.mjs
```

### Metrics tracked

| Metric | Symbol | Meaning |
|--------|--------|---------|
| Tier | T0-T3 | Which fallback tier succeeded (T0=strict, T3=overlap) |
| FB | FB:N | Emergency straight-line fallback (A* gave up) |
| NC | NC:N | Segments crossing through node boxes |
| EC | EC:N(sib:M) | Edge crossings (total, sibling=tree T-fork allowed) |
| SC | ❌SC:N | Self-crossings — HARD BAN, must be 0 |
| UB | UB:N | Unnecessary detours (3+ bends shortcuttable via clear L-path) |
| TO | ⏱️TO:N | A* hit time deadline |
| 🐢 | edge: Nms | Individual edges taking >50ms |
| NaN | ❌NaN:N | Broken pathD values |

### Severity levels
- **SC**: CRITICAL — self-crossing is always a bug, must be 0
- **NC/EC**: HIGH — path crosses node or other edge
- **FB/TO**: MEDIUM — engine gave up or timed out
- **UB**: MEDIUM — path makes detours it could skip
- **🐢**: INFO — performance metric

### Current baseline (2026-04-04, port assigner v1 + SC fix)
```
Golden: 39/39 passed
Samples: 141 edges | T0:141 | NC:0 | EC:0 | SC:0 | UB:14 | TO:0 | FB:0 | NaN:0
Tree port violations: 0
Self crossings: 0
Unnecessary detours: 14 (flowchart: 7, sequence: 7)
Total time: 470ms
```
