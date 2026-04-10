import fs from 'fs';
import path from 'path';

const makeNode = (id, label, value) => {
  const n = { id, label };
  if (value !== undefined) n.value = value;
  return n;
};

const makeGroup = (label, type, size, nodes) => {
  let g = { type, size, nodes };
  if (label !== "Spine" && label !== "Root" && label !== "Data") {
     g.label = label;
  }
  return g;
};

const makeEdge = (source, target, connectionType, lineStyle, label) => {
  const e = { sourceId: source, targetId: target, connectionType, lineStyle };
  if (label) e.label = label;
  return e;
};

const docs = {
  "flowchart_1_medium": {
    meta: { type: "flowchart", version: "1.0.0" },
    title: { text: "App Authentication Flow", size: "L" },
    data: {
      groups: [
        makeGroup("User Input", "process", "M", [makeNode("s1", "App Launch"), makeNode("d1", "Verify Session")]),
        makeGroup("Auth Flow", "process", "M", [makeNode("l1", "Show Login"), makeNode("e1", "Try Auth")])
      ],
      edges: [
        makeEdge("s1", "d1", "target", "solid"),
        makeEdge("d1", "l1", "target", "solid", "No"),
        makeEdge("l1", "e1", "target", "solid"),
        makeEdge("e1", "d1", "target", "solid")
      ]
    }
  },
  "flowchart_2_complex": {
    meta: { type: "flowchart", version: "1.0.0" },
    title: { text: "Payment Gateway Logic", size: "L" },
    data: {
      groups: [
        makeGroup("Intake", "process", "M", [makeNode("p1", "Webhook Recv"), makeNode("s1", "Clean Body"), makeNode("d_v", "Is Valid JSON?")]),
        makeGroup("Router", "process", "L", [makeNode("r1", "Inspect Event"), makeNode("d_e", "Event Type?")]),
        makeGroup("Payments", "process", "L", [makeNode("pay1", "Process Charge"), makeNode("d_f", "Has Funds?")]),
        makeGroup("Persistence", "process", "M", [makeNode("db1", "Commit DB"), makeNode("end", "Finish")])
      ],
      edges: [
        makeEdge("p1", "s1", "target", "solid"),
        makeEdge("s1", "d_v", "target", "solid"),
        makeEdge("d_v", "r1", "target", "solid", "Yes"),
        makeEdge("r1", "d_e", "target", "solid"),
        makeEdge("d_e", "pay1", "target", "solid", "Pay"),
        makeEdge("pay1", "d_f", "target", "solid"),
        makeEdge("d_f", "db1", "target", "solid", "Yes"),
        makeEdge("db1", "end", "target", "solid")
      ]
    }
  },
  "erd_1_medium": {
    meta: { type: "erd", version: "1.0.0" },
    title: { text: "Sales Schema", size: "L" },
    data: {
      groups: [
        makeGroup("Orders Table", "process", "M", [makeNode("t_o", "Orders"), makeNode("c_i", "Order ID"), makeNode("c_amount", "Amount")]),
        makeGroup("Users Table", "process", "M", [makeNode("t_u", "Users"), makeNode("c_u", "User ID"), makeNode("c_email", "Email")])
      ],
      edges: [
        makeEdge("t_o", "c_i", "1:1", "solid", "PK"),
        makeEdge("t_o", "c_amount", "1:1", "solid"),
        makeEdge("t_u", "c_u", "1:1", "solid", "PK"),
        makeEdge("t_u", "c_email", "1:1", "solid"),
        makeEdge("t_u", "t_o", "1:N", "solid", "places")
      ]
    }
  },
  "erd_2_complex": {
    meta: { type: "erd", version: "1.0.0" },
    title: { text: "Enterprise Personnel DB", size: "L" },
    data: {
      groups: [
        makeGroup("Employees", "process", "L", [makeNode("t_e", "Employees"), makeNode("c_eid", "Emp ID"), makeNode("c_ename", "Name")]),
        makeGroup("Departments", "process", "M", [makeNode("t_d", "Departments"), makeNode("c_did", "Dept ID")]),
        makeGroup("Projects", "process", "M", [makeNode("t_p", "Projects"), makeNode("c_pid", "Proj ID")]),
        makeGroup("Assignments", "process", "S", [makeNode("t_a", "Assignments"), makeNode("c_hrs", "Hours Logged")])
      ],
      edges: [
        makeEdge("t_e", "c_eid", "1:1", "solid", "PK"),
        makeEdge("t_e", "c_ename", "1:1", "solid"),
        makeEdge("t_d", "c_did", "1:1", "solid", "PK"),
        makeEdge("t_p", "c_pid", "1:1", "solid", "PK"),
        makeEdge("t_a", "c_hrs", "1:1", "solid"),
        makeEdge("t_d", "t_e", "1:N", "solid", "employs"),
        makeEdge("t_e", "t_a", "1:N", "solid", "assigned"),
        makeEdge("t_p", "t_a", "1:N", "solid", "includes")
      ]
    }
  },
  "sequence_1_medium": {
    meta: { type: "sequence", version: "1.0.0" },
    title: { text: "Basic Auth Protocol", size: "L" },
    data: {
      groups: [
         makeGroup("Client", "process", "M", [makeNode("c1", "Request Login"), makeNode("c2", "Save Token")]),
         makeGroup("Server", "process", "L", [makeNode("s1", "Validate"), makeNode("s2", "Generate JWT")])
      ],
      edges: [
         makeEdge("c1", "s1", "target", "solid", "POST /login"),
         makeEdge("s1", "s2", "target", "solid", "Verify DB"),
         makeEdge("s2", "c2", "target", "dashed", "200 OK + Token")
      ]
    }
  },
  "sequence_2_complex": {
    meta: { type: "sequence", version: "1.0.0" },
    title: { text: "OAuth 2.0 Web Flow", size: "L" },
    data: {
      groups: [
         makeGroup("Web App", "process", "M", [makeNode("w1", "Init Login"), makeNode("w2", "Receive Code"), makeNode("w3", "Store Token")]),
         makeGroup("Auth Gateway", "process", "L", [makeNode("a1", "Validate App"), makeNode("a2", "Exchange Token"), makeNode("a3", "Issue Cookie")]),
         makeGroup("OAuth Provider", "process", "M", [makeNode("o1", "Show Consent"), makeNode("o2", "Redirect Back"), makeNode("o3", "Validate Secret")])
      ],
      edges: [
         makeEdge("w1", "a1", "target", "solid", "Click Login"),
         makeEdge("a1", "o1", "target", "solid", "Redirect to Provider"),
         makeEdge("o1", "o2", "target", "dashed", "User Accepts"),
         makeEdge("o2", "w2", "target", "dashed", "302 Redirect ?code="),
         makeEdge("w2", "a2", "target", "solid", "POST Code"),
         makeEdge("a2", "o3", "target", "solid", "Exchange code"),
         makeEdge("o3", "a3", "target", "dashed", "200 OK JWT"),
         makeEdge("a3", "w3", "target", "dashed", "Set-Cookie")
      ]
    }
  },
  "radial_1_medium": {
    meta: { type: "radial", version: "1.0.0" },
    title: { text: "DevOps Topology", size: "L" },
    data: {
      groups: [
         makeGroup("Core", "process", "L", [makeNode("hub", "Control Plane")]),
         makeGroup("CI/CD", "process", "M", [makeNode("c1", "GitHub Actions"), makeNode("c2", "Jenkins")]),
         makeGroup("Metrics", "process", "M", [makeNode("m1", "Datadog"), makeNode("m2", "Prometheus")])
      ],
      edges: [
         makeEdge("hub", "c1", "target", "solid"),
         makeEdge("hub", "c2", "target", "dashed"),
         makeEdge("hub", "m1", "target", "solid"),
         makeEdge("hub", "m2", "target", "solid")
      ]
    }
  },
  "radial_2_complex": {
    meta: { type: "radial", version: "1.0.0" },
    title: { text: "Global Database Architecture", size: "L" },
    data: {
      groups: [
         makeGroup("Core", "process", "L", [makeNode("center", "Master Relational Node")]),
         makeGroup("Replicas", "process", "L", [makeNode("r1", "EU Replica"), makeNode("r2", "US Replica"), makeNode("r3", "Asia Replica")]),
         makeGroup("Caching", "process", "M", [makeNode("c1", "Redis Cluster"), makeNode("c2", "Memcached V2")]),
         makeGroup("Analytics Sync", "process", "S", [makeNode("a1", "Snowflake Sink"), makeNode("a2", "Metabase")])
      ],
      edges: [
         makeEdge("center", "r1", "target", "solid", "sync"),
         makeEdge("center", "r2", "target", "solid", "sync"),
         makeEdge("center", "r3", "target", "solid", "sync"),
         makeEdge("center", "c1", "target", "dashed"),
         makeEdge("center", "c2", "target", "dashed"),
         makeEdge("center", "a1", "target", "solid"),
         makeEdge("a1", "a2", "target", "dashed")
      ]
    }
  },
  "matrix_1_medium": {
    meta: { type: "matrix", version: "1.0.0" },
    title: { text: "Priorities Q3", size: "L" },
    data: {
      groups: [
         makeGroup("High Impact / Low Effort", "process", "L", [makeNode("m_1", "Optimize CDN"), makeNode("m_2", "Compress Images")]),
         makeGroup("High Impact / High Effort", "process", "M", [makeNode("m_3", "DB Sharding")])
      ],
      edges: []
    }
  },
  "matrix_2_complex": {
    meta: { type: "matrix", version: "1.0.0" },
    title: { text: "Feature Roadmap 2026", size: "L" },
    data: {
      groups: [
         makeGroup("Q1", "process", "L", [makeNode("q1_1", "Core API V3"), makeNode("q1_2", "Graph DB Migration")]),
         makeGroup("Q2", "process", "M", [makeNode("q2_1", "Mobile App Launch"), makeNode("q2_2", "SSO Support")]),
         makeGroup("Q3", "process", "M", [makeNode("q3_1", "AI Agent Integrations"), makeNode("q3_2", "Voice Commands")]),
         makeGroup("Backlog", "process", "S", [makeNode("bg1", "Dark Theme Tweaks"), makeNode("bg2", "Accessibility API")])
      ],
      edges: [
         makeEdge("q1_1", "q2_1", "target", "solid")
      ]
    }
  },
  "timeline_1_medium": {
    meta: { type: "timeline", version: "1.0.0" },
    title: { text: "Product Release Plan", size: "L" },
    data: {
      groups: [
         makeGroup("Spine", "chevron", "L", [makeNode("p1", "Discovery"), makeNode("p2", "Execution")]),
         makeGroup("Discovery Events", "process", "M", [makeNode("e1", "Kickoff Sync"), makeNode("e2", "Design Approval")]),
         makeGroup("Execution Events", "process", "M", [makeNode("e3", "Sprint 1"), makeNode("e4", "Soft Launch")])
      ],
      edges: [
         makeEdge("p1", "e1", "target", "solid"),
         makeEdge("p1", "e2", "target", "dashed"),
         makeEdge("p2", "e3", "target", "solid"),
         makeEdge("p2", "e4", "target", "solid")
      ]
    }
  },
  "timeline_2_complex": {
    meta: { type: "timeline", version: "1.0.0" },
    title: { text: "History of Web Infrastructure", size: "L" },
    data: {
      groups: [
         makeGroup("Spine", "chevron", "L", [makeNode("era1", "The 1990s"), makeNode("era2", "The 2000s"), makeNode("era3", "The 2010s"), makeNode("era4", "The 2020s")]),
         makeGroup("Early Web", "process", "S", [makeNode("ev1", "HTML Created"), makeNode("ev2", "JavaScript V1")]),
         makeGroup("Web 2.0", "process", "M", [makeNode("ev3", "AJAX Born"), makeNode("ev4", "Cloud AWS Launch")]),
         makeGroup("Mobile & SPA", "process", "L", [makeNode("ev5", "React.js Release"), makeNode("ev6", "Docker Standardized")]),
         makeGroup("AI Era", "process", "L", [makeNode("ev7", "GPT Access"), makeNode("ev8", "AI Powered IDEs")])
      ],
      edges: [
         makeEdge("era1", "ev1", "target", "solid"),
         makeEdge("era1", "ev2", "target", "solid"),
         makeEdge("era2", "ev3", "target", "solid"),
         makeEdge("era2", "ev4", "target", "solid"),
         makeEdge("era3", "ev5", "target", "solid"),
         makeEdge("era3", "ev6", "target", "dashed"),
         makeEdge("era4", "ev7", "target", "solid"),
         makeEdge("era4", "ev8", "target", "solid")
      ]
    }
  },
  "tree_1_medium": {
    meta: { type: "tree", version: "1.0.0" },
    title: { text: "Startup Org Chart", size: "L" },
    data: {
      groups: [
         makeGroup("Root", "process", "L", [makeNode("c_ceo", "CEO Office")]),
         makeGroup("Product", "process", "M", [makeNode("d_prod", "Head of Product"), makeNode("d_eng", "Lead Engineer")]),
         makeGroup("Sales", "process", "S", [makeNode("d_sales", "Account Exec")])
      ],
      edges: [
         makeEdge("c_ceo", "d_prod", "target", "solid"),
         makeEdge("c_ceo", "d_sales", "target", "solid"),
         makeEdge("d_prod", "d_eng", "target", "dashed")
      ]
    }
  },
  "tree_2_complex": {
    meta: { type: "tree", version: "1.0.0" },
    title: { text: "Directory Structure Schema", size: "L" },
    data: {
      groups: [
         makeGroup("Root", "process", "L", [makeNode("f_root", "src/")]),
         makeGroup("Components", "process", "M", [makeNode("f_com", "components/"), makeNode("f_btn", "Button.jsx"), makeNode("f_nav", "Navbar.jsx")]),
         makeGroup("Utils", "process", "S", [makeNode("f_util", "utils/"), makeNode("f_hlp", "helpers.js")]),
         makeGroup("State", "process", "M", [makeNode("f_st", "store/"), makeNode("f_rdx", "index.js")])
      ],
      edges: [
         makeEdge("f_root", "f_com", "target", "solid"),
         makeEdge("f_root", "f_util", "target", "solid"),
         makeEdge("f_root", "f_st", "target", "solid"),
         makeEdge("f_com", "f_btn", "target", "dashed"),
         makeEdge("f_com", "f_nav", "target", "dashed"),
         makeEdge("f_util", "f_hlp", "target", "dashed"),
         makeEdge("f_st", "f_rdx", "target", "dashed")
      ]
    }
  },
  "piechart_1_medium": {
    meta: { type: "piechart", version: "1.0.0" },
    title: { text: "Resource Allocation", size: "L" },
    data: {
      nodes: [
         makeNode("slice_1", "Engineering Budget", 45),
         makeNode("slice_2", "Marketing Budget", 30),
         makeNode("slice_3", "Office & Admin", 15),
         makeNode("slice_4", "Legal Reserve", 10)
      ]
    }
  },
  "piechart_2_complex": {
    meta: { type: "piechart", version: "1.0.0" },
    title: { text: "Cloud Spending Breakdown", size: "L" },
    data: {
      nodes: [
         makeNode("c1", "EC2 Instances", 40.5),
         makeNode("c2", "RDS Postgres", 22.8),
         makeNode("c3", "S3 Storage", 15.2),
         makeNode("c4", "CloudFront CDN", 10.0),
         makeNode("c5", "Elasticache Redis", 8.3),
         makeNode("c6", "Route 53 DNS", 3.2)
      ]
    }
  }
};

const outputDir = path.join(process.cwd(), 'src/assets/samples');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

Object.entries(docs).forEach(([k, config]) => {
  const fileContent = JSON.stringify(config, null, 2);
  fs.writeFileSync(path.join(outputDir, k + '.cci'), fileContent);
  fs.writeFileSync(path.join(process.cwd(), 'samples', k + '.cci'), fileContent);
  fs.writeFileSync(path.join(process.cwd(), 'public/samples', k + '.cci'), fileContent);
  console.log('Wrote', k);
});
