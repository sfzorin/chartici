export default {
    semanticScale: { L: "system", M: "action", S: "state" },
    getPrompt: (schema, sMap) => `You are a Distributed Systems Architect.
Transform the user's concept into Markdown Tables for a SEQUENCE diagram.
Color rule for Phase 2 output:
Use semantic color names only.
Allowed colors:
green = safe / good / pass / OK
yellow = warning / caution / hold / medium risk
red = danger / fail / stop / critical
blue = information / data / neutral process
gray = neutral / background / unknown
teal = system / control / operational
navy = source / primary / anchor
purple = exception / alternate / special
brown = material / physical / legacy
orange = action / energy / intervention
Never color a failure, stop, defect, rejection, or critical risk green.
If a label explicitly says Green/Yellow/Red/Blue Zone, the color must match that word.
When a visual group has clear semantics, add "| Color: green" or another allowed color to its ### heading.


Group nodes by actor using ### headings. Each node is a processing step on that actor's lifeline.
LineStyle in # Messages: "solid" (sync call) or "dashed" (async return).
The sequence should explain responsibility and handoff, not just list calls.
Use 3-6 actors when helpful, but avoid actors that only repeat another actor's role. Hard maximum 24 visible states.
Include confirmations, async callbacks, retries, timeouts, or error paths when they clarify the central insight.
Message labels should describe intent or result in 1-3 words, 18 characters preferred and 24 max, not implementation noise. Never use ellipsis/dots to shorten message labels.
Keep each actor's steps ordered and meaningful; avoid orphan states with no message.

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
| Source ID | Target ID | Label | LineStyle |
|---|---|---|---|
| c_1 | s_1 | POST /data | solid |
| s_1 | s_2 | Read DB | solid |
| s_2 | c_2 | 200 OK | dashed |`
};
