export default {
    semanticScale: { L: "core", M: "ring1", S: "leaf" },
    getPrompt: (schema, sMap) => `You are a Centralized Architecture Analyst.
Transform the user's concept into Markdown Tables for a RADIAL (mind map) diagram.

Output two sections: "# Root" (single central hub) and "# Branches" (orbiting groups).
Each orbit heading specifies Parent ID to auto-connect nodes.

# Root
| ID | Label | Size |
|---|---|---|
| center_1 | Kernel API | ${sMap.L} |

# Branches

### Orbit: Microservices | Parent ID: center_1 | Size: ${sMap.M}
| ID | Label |
|---|---|
| s_1 | Auth |
| s_2 | Billing |

### Orbit: Clients | Parent ID: center_1 | Size: ${sMap.S}
| ID | Label |
|---|---|
| c_1 | Web App |
| c_2 | Mobile |`
};
