const fs = require('fs');

const trPath = 'src/lib/data/translations.ts';
let code = fs.readFileSync(trPath, 'utf8');

const keysData = JSON.parse(fs.readFileSync('scripts/_keys_landing_all.json', 'utf8'));

// Format keys for insertion into hi and en
const hiEntries = Object.entries(keysData).map(([k, v]) => `    '${k}': ${JSON.stringify(v.hi)},`).join('\n');
const enEntries = Object.entries(keysData).map(([k, v]) => `    '${k}': ${JSON.stringify(v.en)},`).join('\n');

// Find insertion point in hi (before admin.noticeTitle)
const hiTarget = "    'admin.noticeTitle': 'प्रदर्शन पहुँच सूचना — प्रणाली व्यवस्थापक (Admin) भूमिका आवश्यक',";
if (!code.includes(hiTarget)) {
  console.error('hiTarget not found!');
  process.exit(1);
}
code = code.replace(hiTarget, hiEntries + '\n' + hiTarget);

// Find insertion point in en (before admin.noticeTitle)
const enTarget = "    'admin.noticeTitle': 'Demonstration Access Notice — System Administrator Role Required',";
if (!code.includes(enTarget)) {
  console.error('enTarget not found!');
  process.exit(1);
}
code = code.replace(enTarget, enEntries + '\n' + enTarget);

fs.writeFileSync(trPath, code, 'utf8');
console.log('Successfully injected keys into translations.ts');
