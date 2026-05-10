export default {
    semanticScale: { L: "highlight", M: "standard" },
    getPrompt: (schema, sMap) => `You are a Data Visualization Analyst.
Transform the user's concept into a Markdown Table for a PIECHART.

Output exactly one table "# Pie Slices". Size controls visual emphasis:
${sMap.L} = breakout/highlighted slice, ${sMap.M} = standard slice.
Use 4-10 slices. Values must be meaningful proportions that add up to roughly 100.
Do not provide Color columns or custom colors; the renderer assigns a balanced palette.
Highlight only the most important slice with ${sMap.L}; keep the rest ${sMap.M}.
Use piechart only when the user's idea is about composition, share, allocation, distribution, or relative weight.
Slice labels should be comparable parts of one whole. Do not mix causes, outcomes, and categories in the same pie.
If the user gives no data, infer plausible illustrative proportions only for conceptual diagrams; keep them rounded and explain the distribution through labels.
Avoid tiny slices unless they are genuinely meaningful outliers.

# Pie Slices
| Title (Label) | Size | Value |
|---|---|---|
| Revenue | ${sMap.L} | 45.5 |
| Costs | ${sMap.M} | 30 |
| Taxes | ${sMap.M} | 15 |
| Profit | ${sMap.M} | 9.5 |`
};
