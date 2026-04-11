import fs from 'fs';
import path from 'path';

const makeNode = (id, label, type = 'process', value) => {
  const n = { id, label, type };
  if (value !== undefined) n.value = value;
  return n;
};

let colorCounter = 0;
const makeGroup = (label, type, size, nodes) => {
  let g = { type, size, nodes, color: String(colorCounter % 8) };
  colorCounter++;
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
  // Flowchart
  "flowchart_1_simple": {
    meta: { type: "flowchart", version: "1.0.0" },
    theme: "vibrant-rainbow",
    title: { text: "E-Commerce Checkout Pipeline" },
    data: {
      groups: [
        makeGroup("Triggers", "process", "M", [makeNode("t_start", "User Clicks Checkout", "oval"), makeNode("t_end", "Show Order Success", "oval")]),
        makeGroup("Decisions", "process", "L", [makeNode("d_cart", "Cart Empty?", "rhombus"), makeNode("d_stock", "Items in Stock?", "rhombus"), makeNode("d_pay", "Payment Approved?", "rhombus")]),
        makeGroup("API & Processes", "process", "M", [makeNode("p_reserve", "Reserve Inventory", "process"), makeNode("p_charge", "Stripe API Charge", "process"), makeNode("p_db", "Log Order DB", "process")]),
        makeGroup("Error Handling", "process", "S", [makeNode("err_cart", "Prompt to Shop", "process"), makeNode("err_stock", "Show Out of Stock", "process"), makeNode("err_pay", "Show Decline Msg", "process")])
      ],
      edges: [
        makeEdge("t_start", "d_cart", "target", "solid"),
        makeEdge("d_cart", "err_cart", "target", "solid", "Yes"),
        makeEdge("d_cart", "d_stock", "target", "solid", "No"),
        makeEdge("d_stock", "err_stock", "target", "solid", "No"),
        makeEdge("d_stock", "p_reserve", "target", "solid", "Yes"),
        makeEdge("p_reserve", "p_charge", "target", "dashed", "Initiate Pay"),
        makeEdge("p_charge", "d_pay", "target", "solid"),
        makeEdge("d_pay", "err_pay", "target", "solid", "No"),
        makeEdge("err_pay", "p_charge", "target", "solid", "Retry"),
        makeEdge("d_pay", "p_db", "target", "solid", "Yes"),
        makeEdge("p_db", "t_end", "target", "solid")
      ]
    }
  },
  "flowchart_2_complex": {
    meta: { type: "flowchart", version: "1.0.0" },
    theme: "blue-teal-slate",
    title: { text: "Microservice Orchestration Logic" },
    data: {
      groups: [
        makeGroup("Client Origin", "process", "L", [makeNode("c_req", "Client Request", "oval"), makeNode("c_res", "Response to Client", "oval")]),
        makeGroup("API Gateway", "process", "M", [makeNode("g_auth", "Rate Limited?", "rhombus"), makeNode("g_token", "Valid JWT?", "rhombus")]),
        makeGroup("Orchestrator", "process", "M", [makeNode("o_start", "Initiate Saga", "circle"), makeNode("o_wait", "Wait All Tasks", "process"), makeNode("o_commit", "Commit Transactions", "process")]),
        makeGroup("Services", "process", "L", [makeNode("s_pay", "Process Payment", "process"), makeNode("s_inv", "Update Inventory", "process"), makeNode("s_ship", "Schedule Shipping", "process")]),
        makeGroup("Compensation", "process", "M", [makeNode("comp_pay", "Refund Payment", "process"), makeNode("comp_inv", "Restore Stock", "process"), makeNode("comp_all", "Rollback State", "process")])
      ],
      edges: [
        makeEdge("c_req", "g_auth", "target", "solid"),
        makeEdge("g_auth", "c_res", "target", "solid", "Yes (429)"),
        makeEdge("g_auth", "g_token", "target", "solid", "No"),
        makeEdge("g_token", "c_res", "target", "solid", "No (401)"),
        makeEdge("g_token", "o_start", "target", "solid", "Yes"),
        makeEdge("o_start", "s_pay", "target", "solid"),
        makeEdge("o_start", "s_inv", "target", "solid"),
        makeEdge("o_start", "s_ship", "target", "solid"),
        makeEdge("s_pay", "o_wait", "target", "dashed", "Done"),
        makeEdge("s_inv", "o_wait", "target", "dashed", "Done"),
        makeEdge("s_ship", "o_wait", "target", "dashed", "Wait"),
        makeEdge("s_pay", "comp_pay", "target", "solid", "Failed"),
        makeEdge("s_inv", "comp_inv", "target", "solid", "Failed"),
        makeEdge("comp_pay", "comp_all", "target", "dashed"),
        makeEdge("comp_inv", "comp_all", "target", "dashed"),
        makeEdge("comp_all", "c_res", "target", "solid", "Error (500)"),
        makeEdge("o_wait", "o_commit", "target", "solid", "Success"),
        makeEdge("o_commit", "c_res", "target", "solid", "200 OK")
      ]
    }
  },

  // ERD
  "erd_1_simple": {
    meta: { type: "erd", version: "1.0.0" },
    theme: "indigo-green-red",
    title: { text: "Enterprise Personnel DB" },
    data: {
      groups: [
        makeGroup("Employees", "process", "L", [makeNode("t_e", "Employees", "process"), makeNode("c_eid", "Emp ID", "circle"), makeNode("c_ename", "Name", "circle")]),
        makeGroup("Departments", "process", "M", [makeNode("t_d", "Departments", "process"), makeNode("c_did", "Dept ID", "circle")]),
        makeGroup("Projects", "process", "M", [makeNode("t_p", "Projects", "process"), makeNode("c_pid", "Proj ID", "circle")]),
        makeGroup("Assignments", "process", "S", [makeNode("t_a", "Assignments", "process"), makeNode("c_hrs", "Hours Logged", "circle")])
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
  "erd_2_complex": {
    meta: { type: "erd", version: "1.0.0" },
    theme: "blue-orange",
    title: { text: "IoT Time-series Fabric" },
    data: {
      groups: [
        makeGroup("Devices", "process", "L", [makeNode("t_dev", "Device Specs", "process"), makeNode("c_mac", "MAC Address", "circle"), makeNode("c_firm", "Firmware V", "circle")]),
        makeGroup("Telemetry", "process", "L", [makeNode("t_tel", "Sensor Data", "process"), makeNode("c_ts", "Timestamp", "circle"), makeNode("c_val", "Value", "circle")]),
        makeGroup("Sites", "process", "M", [makeNode("t_site", "Location Site", "process"), makeNode("c_geo", "Coordinates", "circle")]),
        makeGroup("Alerts", "process", "M", [makeNode("t_alert", "Triggered Events", "process"), makeNode("c_level", "Severity", "circle")])
      ],
      edges: [
        makeEdge("t_dev", "c_mac", "1:1", "solid", "PK"),
        makeEdge("t_dev", "c_firm", "1:1", "solid"),
        makeEdge("t_tel", "c_ts", "1:1", "solid", "PK"),
        makeEdge("t_tel", "c_val", "1:1", "solid"),
        makeEdge("t_site", "c_geo", "1:1", "solid"),
        makeEdge("t_alert", "c_level", "1:1", "solid"),
        makeEdge("t_site", "t_dev", "1:N", "solid", "hosts"),
        makeEdge("t_dev", "t_tel", "1:N", "solid", "emits"),
        makeEdge("t_tel", "t_alert", "N:M", "solid", "triggers")
      ]
    }
  },

  // Sequence
  "sequence_1_simple": {
    meta: { type: "sequence", version: "1.0.0" },
    theme: "blue-orange",
    title: { text: "OAuth 2.0 Web Flow" },
    data: {
      groups: [
         makeGroup("Web App", "process", "M", [makeNode("w1", "Init Login", "process"), makeNode("w2", "Receive Code", "process"), makeNode("w3", "Store Token", "process")]),
         makeGroup("Auth Gateway", "process", "L", [makeNode("a1", "Validate App", "process"), makeNode("a2", "Exchange Token", "process"), makeNode("a3", "Issue Cookie", "process")]),
         makeGroup("OAuth Provider", "process", "M", [makeNode("o1", "Show Consent", "process"), makeNode("o2", "Redirect Back", "process"), makeNode("o3", "Validate Secret", "process")])
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
  "sequence_2_complex": {
    meta: { type: "sequence", version: "1.0.0" },
    theme: "muted-rainbow",
    title: { text: "Distributed Async Messaging" },
    data: {
      groups: [
         makeGroup("Producer", "process", "M", [makeNode("p1", "Publish Event", "process"), makeNode("p2", "Log ACK", "process")]),
         makeGroup("Message Broker", "process", "L", [makeNode("k1", "Receive & Partition", "process"), makeNode("k2", "Commit to Disk", "process"), makeNode("k3", "Dispatch to Subs", "process")]),
         makeGroup("Consumer A", "process", "M", [makeNode("ca1", "Consume Topic", "process"), makeNode("ca2", "Update Database", "process")]),
         makeGroup("Consumer B", "process", "S", [makeNode("cb1", "Read Event", "process"), makeNode("cb2", "Send Mail", "process")])
      ],
      edges: [
         makeEdge("p1", "k1", "target", "solid", "Topic(Order)"),
         makeEdge("k1", "k2", "target", "solid", "I/O"),
         makeEdge("k2", "ca1", "target", "solid", "Pull Request A"),
         makeEdge("ca1", "ca2", "target", "solid", "DB Transaction"),
         makeEdge("ca2", "k3", "target", "dashed", "ACK Offset A"),
         makeEdge("k3", "cb1", "target", "solid", "Push to B"),
         makeEdge("cb1", "cb2", "target", "solid", "SMTP"),
         makeEdge("cb2", "p2", "target", "dashed", "Final End-to-End ACK")
      ]
    }
  },

  // Radial
  "radial_1_simple": {
    meta: { type: "radial", version: "1.0.0" },
    theme: "blue-teal-slate",
    title: { text: "Global Database Architecture" },
    data: {
      groups: [
         makeGroup("Core", "process", "L", [makeNode("center", "Master Relational Node", "process")]),
         makeGroup("Replicas", "process", "L", [makeNode("r1", "EU Replica", "process"), makeNode("r2", "US Replica", "process"), makeNode("r3", "Asia Replica", "process")]),
         makeGroup("Caching", "process", "M", [makeNode("c1", "Redis Cluster", "process"), makeNode("c2", "Memcached V2", "process")]),
         makeGroup("Analytics Sync", "process", "S", [makeNode("a1", "Snowflake Sink", "process"), makeNode("a2", "Metabase", "process")])
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
  "radial_2_complex": {
    meta: { type: "radial", version: "1.0.0" },
    theme: "vibrant-rainbow",
    title: { text: "Zero Trust Mesh Orbit" },
    data: {
      groups: [
         makeGroup("Core Service", "process", "L", [makeNode("hub", "Istio Control Plane", "process")]),
         makeGroup("Ingress Orbit", "process", "M", [makeNode("in1", "WAF Rules", "process"), makeNode("in2", "DDoS Shield", "process"), makeNode("in3", "API Gateway", "process")]),
         makeGroup("Mesh Nodes", "process", "L", [makeNode("n1", "Envoy Sidecar A", "process"), makeNode("n2", "Envoy Sidecar B", "process"), makeNode("n3", "Envoy Sidecar C", "process")]),
         makeGroup("Observability Orbit", "process", "M", [makeNode("o1", "Jaeger Trace", "process"), makeNode("o2", "Elastic Logs", "process")])
      ],
      edges: [
         makeEdge("hub", "in1", "none", "solid"),
         makeEdge("hub", "in2", "none", "solid"),
         makeEdge("hub", "in3", "none", "solid"),
         makeEdge("hub", "n1", "none", "solid"),
         makeEdge("hub", "n2", "none", "solid"),
         makeEdge("hub", "n3", "none", "solid"),
         makeEdge("hub", "o1", "none", "solid"),
         makeEdge("hub", "o2", "none", "solid"),
         makeEdge("n1", "n2", "none", "dashed"),
         makeEdge("in3", "n1", "none", "dashed")
      ]
    }
  },

  // Matrix
  "matrix_1_simple": {
    meta: { type: "matrix", version: "1.0.0" },
    theme: "green-purple",
    title: { text: "Feature Roadmap 2026" },
    data: {
      groups: [
         makeGroup("Q1", "process", "L", [makeNode("q1_1", "Core API V3", "process"), makeNode("q1_2", "Graph DB Migration", "process")]),
         makeGroup("Q2", "process", "M", [makeNode("q2_1", "Mobile App Launch", "process"), makeNode("q2_2", "SSO Support", "process")]),
         makeGroup("Q3", "process", "M", [makeNode("q3_1", "AI Agent Integrations", "process"), makeNode("q3_2", "Voice Commands", "process")]),
         makeGroup("Backlog", "process", "S", [makeNode("bg1", "Dark Theme Tweaks", "process"), makeNode("bg2", "Accessibility API", "process")])
      ],
      edges: []
    }
  },
  "matrix_2_complex": {
    meta: { type: "matrix", version: "1.0.0" },
    theme: "blue-orange",
    title: { text: "9-Box Talent Assessment Grid" },
    data: {
      groups: [
         makeGroup("High Perf / High Pot (Stars)", "process", "L", [makeNode("s1", "Alice L.", "process"), makeNode("s2", "Bob M.", "process"), makeNode("s3", "Charlie D.", "process")]),
         makeGroup("Mid Perf / High Pot (High Potentials)", "process", "M", [makeNode("hp1", "David K.", "process"), makeNode("hp2", "Eve R.", "process")]),
         makeGroup("Low Perf / High Pot (Enigmas)", "process", "M", [makeNode("en1", "Frank T.", "process"), makeNode("en2", "Grace V.", "process")]),
         makeGroup("High Perf / Mid Pot (High Pros)", "process", "M", [makeNode("pro1", "Heidi S.", "process"), makeNode("pro2", "Ivan J.", "process"), makeNode("pro3", "Judy H.", "process"), makeNode("pro4", "Karl W.", "process")]),
         makeGroup("Mid Perf / Mid Pot (Core Players)", "process", "L", [makeNode("core1", "Leo P.", "process"), makeNode("core2", "Mía G.", "process"), makeNode("core3", "Noah C.", "process")]),
         makeGroup("Low Perf / Mid Pot (Inconsistent)", "process", "S", [makeNode("inc1", "Olivia F.", "process"), makeNode("inc2", "Paul B.", "process")]),
         makeGroup("High Perf / Low Pot (Workhorses)", "process", "M", [makeNode("wh1", "Quinn N.", "process"), makeNode("wh2", "Ryan X.", "process"), makeNode("wh3", "Sara Z.", "process")]),
         makeGroup("Mid Perf / Low Pot (Effective)", "process", "M", [makeNode("eff1", "Tom A.", "process"), makeNode("eff2", "Uma Y.", "process")]),
         makeGroup("Low Perf / Low Pot (Risk)", "process", "S", [makeNode("rsk1", "Victor Q.", "process"), makeNode("rsk2", "Wendy O.", "process")])
      ],
      edges: []
    }
  },

  // Timeline
  "timeline_1_simple": {
    meta: { type: "timeline", version: "1.0.0" },
    theme: "blue-teal-slate",
    title: { text: "History of Web Infrastructure" },
    data: {
      groups: [
         makeGroup("Spine", "chevron", "L", [makeNode("era1", "The 1990s", "chevron"), makeNode("era2", "The 2000s", "chevron"), makeNode("era3", "The 2010s", "chevron"), makeNode("era4", "The 2020s", "chevron")]),
         makeGroup("Early Web", "process", "S", [makeNode("ev1", "HTML Created", "process"), makeNode("ev2", "JavaScript V1", "process")]),
         makeGroup("Web 2.0", "process", "M", [makeNode("ev3", "AJAX Born", "process"), makeNode("ev4", "Cloud AWS Launch", "process")]),
         makeGroup("Mobile & SPA", "process", "L", [makeNode("ev5", "React.js Release", "process"), makeNode("ev6", "Docker Standardized", "process")]),
         makeGroup("AI Era", "process", "L", [makeNode("ev7", "GPT Access", "process"), makeNode("ev8", "AI Powered IDEs", "process")])
      ],
      edges: [
         makeEdge("era1", "era2", "none", "none"),
         makeEdge("era2", "era3", "none", "none"),
         makeEdge("era3", "era4", "none", "none"),
         makeEdge("ev1", "era1", "none", "dashed"),
         makeEdge("ev2", "era1", "none", "dashed"),
         makeEdge("ev3", "era2", "none", "dashed"),
         makeEdge("ev4", "era2", "none", "dashed"),
         makeEdge("ev5", "era3", "none", "dashed"),
         makeEdge("ev6", "era3", "none", "dashed"),
         makeEdge("ev7", "era4", "none", "dashed"),
         makeEdge("ev8", "era4", "none", "dashed")
      ]
    }
  },
  "timeline_2_complex": {
    meta: { type: "timeline", version: "1.0.0" },
    theme: "vibrant-rainbow",
    title: { text: "Space Exploration Milestones" },
    data: {
      groups: [
         makeGroup("Spine", "chevron", "L", [makeNode("m1", "1950s: Dawn", "chevron"), makeNode("m2", "1960s: Moon", "chevron"), makeNode("m3", "1990s: Orbiters", "chevron"), makeNode("m4", "2010s: Rovers", "chevron"), makeNode("m5", "2020s: Private", "chevron")]),
         makeGroup("Pioneers", "process", "M", [makeNode("p1", "Sputnik 1", "process"), makeNode("p2", "Gagarin Flight", "process")]),
         makeGroup("Apollo", "process", "L", [makeNode("a1", "Apollo 11 Landing", "process"), makeNode("a2", "Apollo 13 Crisis", "process")]),
         makeGroup("Stations", "process", "L", [makeNode("s1", "ISS Assembly Begins", "process"), makeNode("s2", "Hubble Launched", "process")]),
         makeGroup("Deep Space", "process", "M", [makeNode("d1", "Curiosity Mars", "process"), makeNode("d2", "Voyager Interstellar", "process")]),
         makeGroup("New Age", "process", "L", [makeNode("n1", "Artemis I", "process"), makeNode("n2", "Webb Telescope Scope", "process")])
      ],
      edges: [
         makeEdge("m1", "m2", "none", "none"),
         makeEdge("m2", "m3", "none", "none"),
         makeEdge("m3", "m4", "none", "none"),
         makeEdge("m4", "m5", "none", "none"),
         makeEdge("p1", "m1", "none", "dashed"),
         makeEdge("p2", "m1", "none", "dashed"),
         makeEdge("a1", "m2", "none", "dashed"),
         makeEdge("a2", "m2", "none", "dashed"),
         makeEdge("s1", "m3", "none", "dashed"),
         makeEdge("s2", "m3", "none", "dashed"),
         makeEdge("d1", "m4", "none", "dashed"),
         makeEdge("d2", "m4", "none", "dashed"),
         makeEdge("n1", "m5", "none", "dashed"),
         makeEdge("n2", "m5", "none", "dashed")
      ]
    }
  },

  // Tree
  "tree_1_simple": {
    meta: { type: "tree", version: "1.0.0" },
    theme: "indigo-green-red",
    title: { text: "Corporate Org Chart" },
    data: {
      groups: [
         makeGroup("Root", "process", "L", [makeNode("ceo", "CEO", "process")]),
         makeGroup("Execs", "process", "M", [makeNode("cto", "CTO", "process"), makeNode("cfo", "CFO", "process"), makeNode("cmo", "CMO", "process")]),
         makeGroup("Eng", "process", "S", [makeNode("e_fe", "Frontend", "process"), makeNode("e_be", "Backend", "process")]),
         makeGroup("Fin", "process", "S", [makeNode("f_acc", "Accounting", "process"), makeNode("f_tax", "Tax", "process")]),
         makeGroup("Mkt", "process", "S", [makeNode("m_seo", "SEO", "process"), makeNode("m_ads", "Paid Media", "process")])
      ],
      edges: [
         makeEdge("ceo", "cto", "none", "solid"),
         makeEdge("ceo", "cfo", "none", "solid"),
         makeEdge("ceo", "cmo", "none", "solid"),
         makeEdge("cto", "e_fe", "none", "solid"),
         makeEdge("cto", "e_be", "none", "solid"),
         makeEdge("cfo", "f_acc", "none", "solid"),
         makeEdge("cfo", "f_tax", "none", "solid"),
         makeEdge("cmo", "m_seo", "none", "solid"),
         makeEdge("cmo", "m_ads", "none", "solid")
      ]
    }
  },
  "tree_2_complex": {
    meta: { type: "tree", version: "1.0.0" },
    theme: "slate-rose",
    title: { text: "Corporate Org Chart" },
    data: {
      groups: [
         makeGroup("Executive", "process", "L", [makeNode("board", "Board of Directors", "process"), makeNode("ceo", "CEO", "process")]),
         makeGroup("Engineering Branch", "process", "M", [makeNode("vp_eng", "VP Engineering", "process"), makeNode("eng1", "Frontend Lead", "process"), makeNode("eng2", "Backend Lead", "process"), makeNode("eng3", "DevOps Lead", "process"), makeNode("eng4", "QA Lead", "process"), makeNode("eng5", "Data Lead", "process"), makeNode("eng6", "Mobile Lead", "process"), makeNode("eng7", "Security Lead", "process"), makeNode("eng8", "Architecture Lead", "process"), makeNode("eng9", "AI Strategy", "process")]),
         makeGroup("Sales Branch", "process", "M", [makeNode("vp_sales", "VP Global Sales", "process"), makeNode("sales1", "North America", "process"), makeNode("sales2", "EMEA Regions", "process"), makeNode("sales3", "APAC Regions", "process"), makeNode("sales4", "LATAM Regions", "process")]),
         makeGroup("HR Branch", "process", "S", [makeNode("vp_hr", "VP HR", "process"), makeNode("hr1", "Talent Acquisition", "process"), makeNode("hr2", "Compliance", "process")])
      ],
      edges: [
         makeEdge("board", "ceo", "target", "solid"),
         makeEdge("ceo", "vp_eng", "target", "solid"),
         makeEdge("ceo", "vp_sales", "target", "solid"),
         makeEdge("ceo", "vp_hr", "target", "solid"),
         makeEdge("vp_eng", "eng1", "target", "solid"),
         makeEdge("vp_eng", "eng2", "target", "solid"),
         makeEdge("vp_eng", "eng3", "target", "solid"),
         makeEdge("vp_eng", "eng4", "target", "solid"),
         makeEdge("vp_eng", "eng5", "target", "solid"),
         makeEdge("vp_eng", "eng6", "target", "solid"),
         makeEdge("vp_eng", "eng7", "target", "solid"),
         makeEdge("vp_eng", "eng8", "target", "solid"),
         makeEdge("vp_eng", "eng9", "target", "solid"),
         makeEdge("vp_sales", "sales1", "target", "solid"),
         makeEdge("vp_sales", "sales2", "target", "solid"),
         makeEdge("vp_sales", "sales3", "target", "solid"),
         makeEdge("vp_sales", "sales4", "target", "solid"),
         makeEdge("vp_hr", "hr1", "target", "solid"),
         makeEdge("vp_hr", "hr2", "target", "solid")
      ]
    }
  },

  // Piechart
  "piechart_1_simple": {
    meta: { type: "piechart", version: "1.0.0" },
    theme: "vibrant-rainbow",
    title: { text: "Cloud Spending Breakdown" },
    data: {
      nodes: [
         makeNode("c1", "EC2 Instances", "pie_slice", 40.5),
         makeNode("c2", "RDS Postgres", "pie_slice", 22.8),
         makeNode("c3", "S3 Storage", "pie_slice", 15.2),
         makeNode("c4", "CloudFront CDN", "pie_slice", 10.0),
         makeNode("c5", "Elasticache Redis", "pie_slice", 8.3),
         makeNode("c6", "Route 53 DNS", "pie_slice", 3.2)
      ]
    }
  },
  "piechart_2_complex": {
    meta: { type: "piechart", version: "1.0.0" },
    theme: "muted-rainbow",
    title: { text: "Global Mobile OS Market Share 2026" },
    data: {
      nodes: [
         makeNode("os1", "Android 15+", "pie_slice", 35.2),
         makeNode("os2", "Android Legacy", "pie_slice", 28.1),
         makeNode("os3", "iOS 18+", "pie_slice", 22.4),
         makeNode("os4", "iOS 17 & Older", "pie_slice", 6.8),
         makeNode("os5", "HarmonyOS", "pie_slice", 5.9),
         makeNode("os6", "KaiOS", "pie_slice", 1.2),
         makeNode("os7", "Others", "pie_slice", 0.4)
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
