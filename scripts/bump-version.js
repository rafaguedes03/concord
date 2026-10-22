// Atualiza a versão do Concord em todos os lugares que o auto-update usa.
// Uso: node scripts/bump-version.js [versao] [notas]
// (também lê UPDATE_VERSION / UPDATE_NOTES do ambiente, usado pelo GERAR-ATUALIZACAO.bat)
// Sem versão informada, incrementa o patch (1.5.1 -> 1.5.2).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const appJsxPath = path.join(root, 'src', 'renderer', 'src', 'App.jsx');
const versionJsonPath = path.join(root, 'server', 'public', 'version.json');

const pkgText = fs.readFileSync(pkgPath, 'utf8');
const current = JSON.parse(pkgText).version;

let next = (process.argv[2] || process.env.UPDATE_VERSION || '').trim();
if (!next) {
  const [major, minor, patch] = current.split('.').map(Number);
  next = `${major}.${minor}.${patch + 1}`;
}
if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`[ERRO] Versão inválida: "${next}" (use o formato 1.2.3)`);
  process.exit(1);
}

const notes = (process.argv[3] || process.env.UPDATE_NOTES || '').trim() || `Concord v${next}`;

// App.jsx (CURRENT_APP_VERSION, comparado com o version.json do servidor)
const appJsx = fs.readFileSync(appJsxPath, 'utf8');
if (!/const CURRENT_APP_VERSION = '[^']+'/.test(appJsx)) {
  console.error('[ERRO] CURRENT_APP_VERSION não encontrado em App.jsx');
  process.exit(1);
}
fs.writeFileSync(appJsxPath, appJsx.replace(/(const CURRENT_APP_VERSION = ')[^']+(')/, `$1${next}$2`));

// package.json (app.getVersion)
fs.writeFileSync(pkgPath, pkgText.replace(/("version":\s*")[^"]+(")/, `$1${next}$2`));

// server/public/version.json (servido em /download/version.json)
let versionJson = {};
try {
  versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
} catch (e) {}
versionJson.version = next;
versionJson.releaseNotes = notes;
versionJson.asarUrl = versionJson.asarUrl || '/download/app.asar';
versionJson.zipUrl = versionJson.zipUrl || '/download/app.zip';
fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2) + '\n');

console.log(`Versão: ${current} -> ${next}`);
console.log(`Notas: ${notes}`);
