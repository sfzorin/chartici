import assert from 'node:assert';
import readline from 'node:readline';
import fs from 'fs';
import path from 'path';
import { buildDiagram } from '../services/aiGenerate.js';
import { DIAGRAM_SCHEMAS } from '../utils/diagramSchemas.js';

const originalFetch = global.fetch;

function askPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Live E2E AI Tests require a password. Enter password (or press Enter to skip): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function getDeepSeekKey() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^DEEPSEEK_API_KEY=(.*)$/m);
    if (match) return match[1].trim();
  } catch (err) { }
  return null;
}

if (typeof global.localStorage === 'undefined') {
  global.localStorage = {
    getItem: () => null,
    setItem: () => {}
  };
}

async function runLiveTests() {
  const pass = await askPassword();

  if (pass !== '2555') {
    console.log('⏭️  Skipping Live E2E AI Tests (incorrect pass or skipped).');
    return;
  }

  const apiKey = getDeepSeekKey();
  if (!apiKey) {
    console.error('❌ Cannot run E2E Test: DEEPSEEK_API_KEY not found in root .env file.');
    process.exit(1);
  }

  console.log('✅ Password accepted. Starting LIVE tests against DeepSeek API...\n');

  global.fetch = async (url, options) => {
    if (url.includes('/api/generate')) {
      const body = JSON.parse(options.body);
      
      const res = await originalFetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: body.messages,
          temperature: body.temperature || 0.1
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        console.error('DeepSeek Error:', data);
        return { ok: false, json: async () => ({ success: false, error: data.error }) };
      }
      return { 
        ok: true, 
        json: async () => ({ success: true, content: data.choices[0].message.content }) 
      };
    }
    return originalFetch(url, options);
  };

  const testTypes = Object.keys(DIAGRAM_SCHEMAS);
  let passedCount = 0;

  for (const type of testTypes) {
    console.log('[LIVE] Testing diagram generation for: ' + type);
    
    const testPrompt = 'Generate a simple conceptual ' + type + ' structure representing a small online store (users, products, orders). Make sure to format outputs exactly strictly using the tables.';

    try {
      const res = await buildDiagram('E2E Store Test', type, testPrompt);
      
      if (!res.success) {
         console.error('❌ [' + type + '] failed: ' + res.error);
      } else {
         const nodesCount = res.cci.data.groups.reduce((acc, g) => acc + g.nodes.length, 0);
         console.log('   ✅ Success! Produced ' + res.cci.data.groups.length + ' groups with ' + nodesCount + ' nodes.');
         passedCount++;
      }
    } catch (e) {
      console.error('❌ [' + type + '] threw an unexpected error: ', e);
    }
  }

  global.fetch = originalFetch;
  console.log('\\n🏁 LIVE SUITE SUMMARY: ' + passedCount + '/' + testTypes.length + ' real LLM tests passed.\\n');
}

runLiveTests().catch(e => {
  console.error(e);
  process.exit(1);
});
