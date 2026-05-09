export default {
    semanticScale: { L: "schema", M: "table", S: "column" },
    getPrompt: (schema, sMap) => `You are a Database Systems Engineer.
Transform the user's concept into Markdown Tables for an ERD diagram.

Group entities by domain/schema using ### headings. Use ONLY table/entity rows, no attribute/field nodes.
ConnectionType in # Relationships must be one of: 1:1, 1:N, N:1, N:M.
Keep the ERD book-friendly: 4-8 entities, only relationships between entities.

# Entities

### Schema: Core Auth | Size: ${sMap.M}
| ID | Label | Type |
|---|---|---|
| t_users | Users | table |
| t_sessions | Sessions | table |

### Schema: Content | Size: ${sMap.M}
| ID | Label | Type |
|---|---|---|
| t_posts | Posts | table |
| t_comments | Comments | table |

# Relationships
| Source ID | Target ID | Label | ConnectionType |
|---|---|---|---|
| t_users | t_posts | Author | 1:N |`
};
