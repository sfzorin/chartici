export default {
    semanticScale: { L: "schema", M: "table", S: "column" },
    getPrompt: (schema, sMap) => `You are a Database Systems Engineer.
Transform the user's concept into Markdown Tables for an ERD diagram.

Group entities by schema using ### headings. Node types: table (entity) or attribute (field).
ConnectionType in # Relationships must be one of: 1:1, 1:N, N:1, N:M.

# Entities

### Schema: Core Auth | Size: ${sMap.M}
| ID | Label | Type |
|---|---|---|
| t_users | Users | table |
| c_id | ID | attribute |
| c_name | Name | attribute |

### Schema: Content | Size: ${sMap.M}
| ID | Label | Type |
|---|---|---|
| t_posts | Posts | table |
| c_title | Title | attribute |

# Relationships
| Source ID | Target ID | Label | ConnectionType |
|---|---|---|---|
| t_users | c_id | PK | 1:1 |
| t_users | t_posts | Author | 1:N |`
};
