#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function die(message) {
    console.error('\nERROR: ' + message + '\n');
    process.exit(1);
}
function warn(message) { console.warn('AVISO: ' + message); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function readText(file) { try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; } }
function backupIfExists(file) {
    if (!fs.existsSync(file)) return null;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = file + '.backup-' + stamp;
    fs.copyFileSync(file, backup);
    return backup;
}
function atomicWrite(file, content) {
    const tmp = file + '.tmp-' + process.pid + '-' + Date.now();
    fs.writeFileSync(tmp, content, 'utf8');
    fs.renameSync(tmp, file);
}
function injectTemplate(source) {
    const marker = 'data-mesh-modern-v1="1"';
    if (source.includes(marker)) return source;
    const cssTag = '<link rel="stylesheet" href="styles/mesh-modern-v1.css" data-mesh-modern-v1="1">';
    const jsTag = '<script src="scripts/mesh-modern-v1.js" data-mesh-modern-v1="1"></script>';
    let output = source;
    if (output.includes('</head>')) output = output.replace('</head>', '    ' + cssTag + '\n</head>');
    else if (output.includes('<body')) output = output.replace('<body', cssTag + '\n<body');
    else die('Nao foi possivel localizar um ponto seguro para inserir o CSS em default3.handlebars. Nada foi alterado.');

    if (output.includes('</body>')) output = output.replace('</body>', '    ' + jsTag + '\n</body>');
    else if (output.includes('</html>')) output = output.replace('</html>', jsTag + '\n</html>');
    else output += '\n' + jsTag + '\n';

    if (!output.includes('styles/mesh-modern-v1.css') || !output.includes('scripts/mesh-modern-v1.js')) {
        die('Validacao interna falhou ao injetar CSS/JS em default3.handlebars. Nada foi alterado.');
    }
    return output;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rootArg = args.find(x => !x.startsWith('-'));
if (!rootArg || args.includes('-h') || args.includes('--help')) {
    console.log('Uso: node install.js /caminho/raiz-do-meshcentral [--dry-run]');
    console.log('');
    console.log('Valida a UI antes de escrever, cria backups e usa gravacao atomica.');
    console.log('Nao altera config.json, nao altera node_modules e nao reinicia MeshCentral.');
    process.exit(rootArg ? 0 : 1);
}

const root = path.resolve(rootArg);
const packageDir = path.join(root, 'node_modules', 'meshcentral');
const packagePublic = path.join(packageDir, 'public');
const packageViews = path.join(packageDir, 'views');
const packageJson = path.join(packageDir, 'package.json');
const meshcentralJs = path.join(packageDir, 'meshcentral.js');
const packageDefault3 = path.join(packageViews, 'default3.handlebars');

if (!fs.existsSync(packageDir)) die('node_modules/meshcentral nao encontrado em: ' + root);
if (!fs.existsSync(packagePublic)) die('public do MeshCentral nao encontrado: ' + packagePublic);
if (!fs.existsSync(packageViews)) die('views do MeshCentral nao encontrado: ' + packageViews);
if (!fs.existsSync(packageDefault3)) die('default3.handlebars nao encontrado. Esta instalacao nao possui a UI Modern esperada.');
if (!fs.existsSync(meshcentralJs)) die('meshcentral.js nao encontrado: ' + meshcentralJs);

let version = 'desconhecida';
if (fs.existsSync(packageJson)) {
    try { version = JSON.parse(fs.readFileSync(packageJson, 'utf8')).version || version; } catch (e) { warn('Nao foi possivel ler a versao em package.json.'); }
}

const meshcentralText = readText(meshcentralJs);
if (!meshcentralText) die('Nao foi possivel ler meshcentral.js.');
const hasViewsOverride = meshcentralText.includes('meshcentral-web/views') || meshcentralText.includes("'../../meshcentral-web/views'") || meshcentralText.includes('webViewsOverridePath');
const hasPublicOverride = meshcentralText.includes('meshcentral-web/public') || meshcentralText.includes("'../../meshcentral-web/public'") || meshcentralText.includes('webPublicOverridePath');
if (!hasViewsOverride || !hasPublicOverride) die('Esta versao do MeshCentral (' + version + ') nao expoe o mecanismo meshcentral-web/views + public esperado. Nada foi alterado.');

const sourceRoot = __dirname;
const cssSource = path.join(sourceRoot, 'public', 'styles', 'mesh-modern-v1.css');
const jsSource = path.join(sourceRoot, 'public', 'scripts', 'mesh-modern-v1.js');
if (!fs.existsSync(cssSource)) die('CSS do tema nao encontrado: ' + cssSource);
if (!fs.existsSync(jsSource)) die('JS do tema nao encontrado: ' + jsSource);

const cssText = readText(cssSource);
const jsText = readText(jsSource);
if (!cssText || cssText.length < 500) die('CSS da UI parece vazio ou incompleto. Nada foi alterado.');
if (!jsText || jsText.length < 1000) die('JavaScript da UI parece vazio ou incompleto. Nada foi alterado.');
try { new Function(jsText); } catch (e) { die('JavaScript da UI possui erro de sintaxe: ' + e.message + '. Nada foi alterado.'); }
if (!jsText.includes("var VERSION = 'v5'")) warn('O JavaScript nao declara explicitamente VERSION v5. Revise antes de promover.');
if (!cssText.includes('mcmV5Shell')) warn('O CSS nao contem o seletor mcmV5Shell esperado.');

const overrideWebRoot = path.join(root, 'meshcentral-web');
const overrideViews = path.join(overrideWebRoot, 'views');
const overridePublic = path.join(overrideWebRoot, 'public');
const stylesDir = path.join(overridePublic, 'styles');
const scriptsDir = path.join(overridePublic, 'scripts');
const default3Target = path.join(overrideViews, 'default3.handlebars');
const cssTarget = path.join(stylesDir, 'mesh-modern-v1.css');
const jsTarget = path.join(scriptsDir, 'mesh-modern-v1.js');
const overrideWasPresent = fs.existsSync(default3Target) && fs.existsSync(cssTarget) && fs.existsSync(jsTarget);

const existingOverride = readText(default3Target);
const templateSource = existingOverride || readText(packageDefault3);
if (!templateSource) die('Nao foi possivel ler default3.handlebars.');
const patchedTemplate = injectTemplate(templateSource);

console.log('');
console.log('MeshCentral Modern UI V5 - preflight OK');
console.log('Versao MeshCentral: ' + version);
console.log('Raiz:               ' + root);
console.log('Override ja ativo:  ' + (overrideWasPresent ? 'sim' : 'nao'));
console.log('JS validado:        sintaxe OK');
console.log('CSS validado:       arquivo presente');
if (dryRun) {
    console.log('Modo dry-run: nenhum arquivo foi alterado.');
    process.exit(0);
}

ensureDir(overrideViews);
ensureDir(stylesDir);
ensureDir(scriptsDir);
const templateBackup = backupIfExists(default3Target);
const cssBackup = backupIfExists(cssTarget);
const jsBackup = backupIfExists(jsTarget);

atomicWrite(cssTarget, cssText);
atomicWrite(jsTarget, jsText);
atomicWrite(default3Target, patchedTemplate);

console.log('');
console.log('MeshCentral Modern UI V5 - override atualizado com sucesso');
console.log('Modern override:    ' + default3Target);
console.log('CSS override:       ' + cssTarget);
console.log('JS override:        ' + jsTarget);
if (templateBackup) console.log('Backup template:    ' + templateBackup);
if (cssBackup) console.log('Backup CSS:         ' + cssBackup);
if (jsBackup) console.log('Backup JS:          ' + jsBackup);
console.log('');
console.log('Nenhum arquivo dentro de node_modules foi alterado.');
console.log('O config.json nao foi alterado.');
console.log('Classic permanece original.');
console.log('');
if (overrideWasPresent) {
    console.log('Como meshcentral-web ja estava ativo, NAO reinicie o servidor apenas por esta atualizacao.');
    console.log('No navegador use F12 > Network > Disable cache e Ctrl+Shift+R.');
} else {
    console.log('Primeira ativacao do meshcentral-web detectada. Um unico restart controlado pode ser necessario.');
}
console.log('Rollback imediato: UI Settings -> Classic.');
console.log('');
