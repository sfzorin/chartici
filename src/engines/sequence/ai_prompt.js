export default {
    semanticScale: { L: "system", M: "action", S: "state" },
    getPrompt: (schema, sMap) => `You are a Distributed Systems Architect.
Transform the user's concept into Markdown Tables for a SEQUENCE diagram.

Group nodes by actor using ### headings. Each node is a processing step on that actor's lifeline.
ConnectionType in # Messages: "solid" (sync call) or "dashed" (async return).

# States

### Actor: Client | Size: ${sMap.M}
| ID | Label |
|---|---|
| c_1 | Init Request |
| c_2 | Display Results |

### Actor: API Server | Size: ${sMap.M}
| ID | Label |
|---|---|
| s_1 | Validate Auth |
| s_2 | Query DB |

# Messages
| Source ID | Target ID | Label | ConnectionType |
|---|---|---|---|
| c_1 | s_1 | POST /data | solid |
| s_1 | s_2 | Read DB | solid |
| s_2 | c_2 | 200 OK | dashed |`
};
