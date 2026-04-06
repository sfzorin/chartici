const fs = require('fs');
const path = require('path');

const dirs = [
  path.join(__dirname, 'samples'),
  path.join(__dirname, 'src', 'assets', 'samples'),
  path.join(__dirname, 'public', 'samples')
];

let modifiedCount = 0;

for (const samplesDir of dirs) {
  if (!fs.existsSync(samplesDir)) continue;
  
  const files = fs.readdirSync(samplesDir).filter(f => f.endsWith('.chartici'));

  for (const file of files) {
    const filePath = path.join(samplesDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      let changed = false;

      if (data.diagramType) {
        if (['decision_tree', 'org_chart', 'concept_map'].includes(data.diagramType)) {
          data.diagramType = 'tree';
          changed = true;
        }
      }

      if (data.aspect) {
        if (data.aspect === '3:2') {
          data.aspect = '16:9';
          changed = true;
        } else if (data.aspect === '2:3') {
          data.aspect = '9:16';
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        modifiedCount++;
        console.log(`Updated ${filePath}`);
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message);
    }
  }
}
console.log(`Migration complete. Updated ${modifiedCount} files.`);
