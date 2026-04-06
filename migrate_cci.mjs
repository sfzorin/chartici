import fs from 'fs';
import path from 'path';

function migrateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!data.data) return;

    let modified = false;
    let nodeMap = {}; 

    const safeId = (str, index) => {
      if (!str) return `id_${index}`;
      return str.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '') + '_' + index;
    };

    let nodeCounter = 1;
    let groupCounter = 1;

    (data.data.groups || []).forEach(g => {
      if (g.groupLabel !== undefined) {
        g.label = g.groupLabel;
        delete g.groupLabel;
        modified = true;
      }
      if (g.text !== undefined) {
         if (!g.label) g.label = g.text;
         delete g.text;
         modified = true;
      }
      if (!g.id) {
        g.id = `g_${groupCounter++}`;
        modified = true;
      } else {
        groupCounter++;
      }

      (g.nodes || []).forEach(n => {
        if (n.nodeLabel !== undefined) {
          n.label = n.nodeLabel;
          delete n.nodeLabel;
          modified = true;
        }
        if (n.text !== undefined) {
           if (!n.label) n.label = n.text;
           delete n.text;
           modified = true;
        }
        if (!n.id) {
          n.id = safeId(n.label, nodeCounter++);
          modified = true;
        } else {
          nodeCounter++;
        }
        if (n.label) {
          nodeMap[n.label] = n.id;
        }
      });
    });

    (data.data.nodes || []).forEach(n => {
       if (n.nodeLabel !== undefined) {
          n.label = n.nodeLabel;
          delete n.nodeLabel;
          modified = true;
       }
       if (n.text !== undefined) {
          if (!n.label) n.label = n.text;
          delete n.text;
          modified = true;
       }
       if (!n.id) {
          n.id = safeId(n.label, nodeCounter++);
          modified = true;
       } else {
          nodeCounter++;
       }
       if (n.label) {
          nodeMap[n.label] = n.id;
       }
    });

    (data.data.edges || []).forEach(e => {
      if (e.edgeLabel !== undefined) {
        e.label = e.edgeLabel;
        delete e.edgeLabel;
        modified = true;
      }
      
      let sLabel = e.sourcelabel || e.sourceLabel || e.source;
      let tLabel = e.targetlabel || e.targetLabel || e.target;
      
      if (sLabel && !e.sourceId) {
         e.sourceId = nodeMap[sLabel] || e.from || sLabel;
         modified = true;
      }
      if (tLabel && !e.targetId) {
         e.targetId = nodeMap[tLabel] || e.to || tLabel;
         modified = true;
      }
      
      if (e.sourcelabel !== undefined) { delete e.sourcelabel; modified = true; }
      if (e.sourceLabel !== undefined) { delete e.sourceLabel; modified = true; }
      if (e.targetlabel !== undefined) { delete e.targetlabel; modified = true; }
      if (e.targetLabel !== undefined) { delete e.targetLabel; modified = true; }
      if (e.from !== undefined) { e.sourceId = e.sourceId || e.from; delete e.from; modified = true; }
      if (e.to !== undefined) { e.targetId = e.targetId || e.to; delete e.to; modified = true; }
    });

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`Migrated: ${filePath}`);
    }
  } catch (err) {
    console.error(`Error migrating ${filePath}:`, err.message);
  }
}

const samplesDir = path.join(process.cwd(), 'samples');
if (fs.existsSync(samplesDir)) {
  fs.readdirSync(samplesDir).forEach(f => {
    if (f.endsWith('.cci')) {
      migrateFile(path.join(samplesDir, f));
    }
  });
}

fs.readdirSync(process.cwd()).forEach(f => {
  if (f.endsWith('.cci')) {
    migrateFile(path.join(process.cwd(), f));
  }
});
