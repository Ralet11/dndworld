const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '..', 'insomnia_dungeonworld.json');
const TEMPLATE_PATH = path.join(__dirname, 'insomnia_template.json');

function loadTemplate() {
  const exists = fs.existsSync(TEMPLATE_PATH);
  if (!exists) {
    throw new Error('Missing scripts/insomnia_template.json. Generate it from the collection before running this script.');
  }
  return JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
}

function withDefaults(resource, timestamp, sortKey) {
  const copy = JSON.parse(JSON.stringify(resource));
  copy.metaSortKey = sortKey;
  copy.created = timestamp;
  copy.modified = timestamp;

  if (copy._type === 'request') {
    copy.settingStoreCookies = true;
    copy.settingSendCookies = true;
    copy.settingDisableRenderRequestBody = false;
    copy.headers = copy.headers || [];
    copy.parameters = copy.parameters || [];
    copy.authentication = copy.authentication || {};
    copy.body = copy.body || {};
  }

  return copy;
}

function main() {
  const template = loadTemplate();
  const timestamp = Date.now();
  const exportData = {
    _type: 'export',
    __export_format: 4,
    __export_date: new Date(timestamp).toISOString(),
    __export_source: 'codex.cli',
    resources: [],
  };

  const baseSort = timestamp;
  let counter = 0;
  const nextSort = () => -(baseSort + counter++);

  (template.resources || []).forEach((resource) => {
    exportData.resources.push(withDefaults(resource, timestamp, nextSort()));
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(exportData, null, 2));
  console.log('Generated insomnia_dungeonworld.json');
}

main();
