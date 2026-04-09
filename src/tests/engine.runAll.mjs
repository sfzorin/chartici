import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = fs.readdirSync(__dirname).filter(f => f.startsWith('engine.') && f.endsWith('.test.mjs') && f !== 'engine.runAll.mjs');

let totalFiles = 0;
let passedFiles = 0;
let failedFiles = 0;

console.log(`\n🧪 Chartici Engine Test Suite`);
console.log(`==================================================`);

for (const file of files) {
  totalFiles++;
  console.log(`\n▶️ Running ${file}...`);
  try {
    const out = execSync(`npx tsx ${path.join(__dirname, file)}`, { encoding: 'utf8', stdio: 'inherit' });
    passedFiles++;
  } catch (err) {
    failedFiles++;
    console.error(`\n❌ Tests in ${file} FAILED.`);
  }
}

console.log(`\n==================================================`);
console.log(`🏁 SUITE SUMMARY: ${passedFiles}/${totalFiles} test files passed.`);
if (failedFiles > 0) {
  console.error(`❌ ${failedFiles} test files failed!`);
  process.exit(1);
} else {
  console.log(`✅ All engine tests passed!`);
}
