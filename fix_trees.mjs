import fs from 'fs';

const genFile = './scripts/generate_cci_samples.mjs';
let gen = fs.readFileSync(genFile, 'utf-8');

// Replace tree_1_medium implementation
const tree1 = `  "tree_1_medium": {
    meta: { type: "tree", version: "1.0.0" },
    title: { text: "Startup Org Chart" },
    data: {
      groups: [
         makeGroup("Organization", "process", "L", [
           makeNode("c_ceo", "CEO Office"),
           makeNode("d_prod", "Head of Product"),
           makeNode("d_eng", "Lead Engineer"),
           makeNode("d_sales", "Account Exec")
         ])
      ],
      edges: [
         makeEdge("c_ceo", "d_prod", "none", "solid"),
         makeEdge("c_ceo", "d_sales", "none", "solid"),
         makeEdge("d_prod", "d_eng", "none", "solid")
      ]
    }
  },`;

// Replace tree_2_complex implementation
const tree2 = `  "tree_2_complex": {
    meta: { type: "tree", version: "1.0.0" },
    title: { text: "Directory Structure Schema" },
    data: {
      groups: [
         makeGroup("Repository", "process", "M", [
           makeNode("f_root", "src/"),
           makeNode("f_com", "components/"),
           makeNode("f_btn", "Button.jsx"),
           makeNode("f_nav", "Navbar.jsx"),
           makeNode("f_util", "utils/"),
           makeNode("f_hlp", "helpers.js"),
           makeNode("f_api", "api.js"),
           makeNode("f_st", "store/"),
           makeNode("f_rdx", "index.js"),
           makeNode("f_auth", "auth.js")
         ])
      ],
      edges: [
         makeEdge("f_root", "f_com", "none", "solid"),
         makeEdge("f_root", "f_util", "none", "solid"),
         makeEdge("f_root", "f_st", "none", "solid"),
         makeEdge("f_com", "f_btn", "none", "solid"),
         makeEdge("f_com", "f_nav", "none", "solid"),
         makeEdge("f_util", "f_hlp", "none", "solid"),
         makeEdge("f_util", "f_api", "none", "solid"),
         makeEdge("f_st", "f_rdx", "none", "solid"),
         makeEdge("f_st", "f_auth", "none", "solid")
      ]
    }
  },`;

gen = gen.replace(/  "tree_1_medium": \{[\s\S]*?  "piechart_1_medium":/m, `${tree1}\n${tree2}\n  "piechart_1_medium":`);

fs.writeFileSync(genFile, gen);
