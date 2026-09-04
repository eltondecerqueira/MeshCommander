#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function die(message) { console.error('\nERROR: ' + message + '\n'); process.exit(1); }
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
function injectHead(source, tag) {
    if (source.includes('</head>')) return source.replace('</head>', '    ' + tag + '\n</head>');
    if (source.includes('<body')) return source.replace('<body', tag + '\n<body');
    die('Nao foi possivel localizar ponto seguro para inserir CSS. Nada foi alterado.');
}
function injectBody(source, tag) {
    if (source.includes('</body>')) return source.replace('</body>', '    ' + tag + '\n</body>');
    if (source.includes('</html>')) return source.replace('</html>', tag + '\n</html>');
    return source + '\n' + tag + '\n';
}
function hasAsset(source, rel) { return source.includes(rel); }
function countAsset(source, rel) { return source.split(rel).length - 1; }

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rootArg = args.find(x => !x.startsWith('-'));
if (!rootArg || args.includes('-h') || args.includes('--help')) {
    console.log('Uso: node install.js /caminho/raiz-do-meshcentral [--dry-run]');
    console.log('V8 = V5 workspace + V6 native skin + V7 Service Desk + V8 stabilization/unified UX.');
    console.log('Nao altera config.json, node_modules nem reinicia MeshCentral.');
    process.exit(rootArg ? 0 : 1);
}

const root = path.resolve(rootArg);
const packageDir = path.join(root, 'node_modules', 'meshcentral');
const packageViews = path.join(packageDir, 'views');
const packagePublic = path.join(packageDir, 'public');
const packageJson = path.join(packageDir, 'package.json');
const meshcentralJs = path.join(packageDir, 'meshcentral.js');
const packageDefault3 = path.join(packageViews, 'default3.handlebars');

if (!fs.existsSync(packageDir)) die('node_modules/meshcentral nao encontrado em: ' + root);
if (!fs.existsSync(packageViews) || !fs.existsSync(packagePublic)) die('Estrutura public/views do MeshCentral nao encontrada.');
if (!fs.existsSync(packageDefault3)) die('default3.handlebars nao encontrado.');
if (!fs.existsSync(meshcentralJs)) die('meshcentral.js nao encontrado.');

let version = 'desconhecida';
try { version = JSON.parse(fs.readFileSync(packageJson, 'utf8')).version || version; } catch (e) { warn('Nao foi possivel ler package.json.'); }
const core = readText(meshcentralJs) || '';
const hasViewsOverride = core.includes('meshcentral-web/views') || core.includes('webViewsOverridePath');
const hasPublicOverride = core.includes('meshcentral-web/public') || core.includes('webPublicOverridePath');
if (!hasViewsOverride || !hasPublicOverride) die('MeshCentral ' + version + ' nao expoe meshcentral-web/views + public.');

const sourceRoot = __dirname;
const assets = [
    { key:'base-css', kind:'css', rel:'styles/mesh-modern-v1.css', tag:'<link rel="stylesheet" href="styles/mesh-modern-v1.css" data-mesh-modern-v1-css="1">', min:500 },
    { key:'base-js', kind:'js', rel:'scripts/mesh-modern-v1.js', tag:'<script src="scripts/mesh-modern-v1.js" data-mesh-modern-v1-js="1"></script>', min:1000 },
    { key:'v6-css', kind:'css', rel:'styles/mesh-modern-native-v6.css', tag:'<link rel="stylesheet" href="styles/mesh-modern-native-v6.css" data-mesh-modern-v6-css="1">', min:1000 },
    { key:'v6-js', kind:'js', rel:'scripts/mesh-modern-native-v6.js', tag:'<script src="scripts/mesh-modern-native-v6.js" data-mesh-modern-v6-js="1"></script>', min:1000 },
    { key:'v7-css', kind:'css', rel:'styles/mesh-commandcenter-v7.css', tag:'<link rel="stylesheet" href="styles/mesh-commandcenter-v7.css" data-mesh-modern-v7-css="1">', min:1000 },
    { key:'v7-js', kind:'js', rel:'scripts/mesh-commandcenter-v7.js', tag:'<script src="scripts/mesh-commandcenter-v7.js" data-mesh-modern-v7-js="1"></script>', min:1000 },
    { key:'v8-css', kind:'css', rel:'styles/mesh-commandcenter-v8.css', tag:'<link rel="stylesheet" href="styles/mesh-commandcenter-v8.css" data-mesh-modern-v8-css="1">', min:1000 },
    { key:'v8-js', kind:'js', rel:'scripts/mesh-commandcenter-v8.js', tag:'<script src="scripts/mesh-commandcenter-v8.js" data-mesh-modern-v8-js="1"></script>', min:1000 }
];

assets.forEach(a => {
    a.source = path.join(sourceRoot, 'public', a.rel);
    if (!fs.existsSync(a.source)) die('Asset nao encontrado: ' + a.source);
    a.text = readText(a.source);
    if (!a.text || a.text.length < a.min) die('Asset vazio/incompleto: ' + a.rel);
    if (a.kind === 'js') {
        try { new Function(a.text); } catch (e) { die('Erro de sintaxe em ' + a.rel + ': ' + e.message); }
    }
});
if (!assets.find(a => a.key === 'base-js').text.includes("var VERSION = 'v5'")) warn('Base JS nao declara v5.');
if (!assets.find(a => a.key === 'v6-js').text.includes("var VERSION = 'v6'")) warn('JS V6 nao declara v6.');
if (!assets.find(a => a.key === 'v7-js').text.includes("var VERSION = 'v7'")) warn('JS V7 nao declara v7.');
if (!assets.find(a => a.key === 'v8-js').text.includes("var VERSION = 'v8'")) warn('JS V8 nao declara v8.');

const overrideRoot = path.join(root, 'meshcentral-web');
const overrideViews = path.join(overrideRoot, 'views');
const overridePublic = path.join(overrideRoot, 'public');
const stylesDir = path.join(overridePublic, 'styles');
const scriptsDir = path.join(overridePublic, 'scripts');
const templateTarget = path.join(overrideViews, 'default3.handlebars');
const overrideWasPresent = fs.existsSync(templateTarget);

assets.forEach(a => { a.target = path.join(overridePublic, a.rel); });
let template = readText(templateTarget) || readText(packageDefault3);
if (!template) die('Nao foi possivel ler default3.handlebars.');

const beforeState = {};
assets.forEach(a => { beforeState[a.key] = hasAsset(template, a.rel); });
assets.filter(a => a.kind === 'css').forEach(a => {
    if (!hasAsset(template, a.rel)) template = injectHead(template, a.tag);
});
assets.filter(a => a.kind === 'js').forEach(a => {
    if (!hasAsset(template, a.rel)) template = injectBody(template, a.tag);
});
assets.forEach(a => {
    const count = countAsset(template, a.rel);
    if (count < 1) die('Falha ao validar injecao de ' + a.rel);
    if (count > 1) warn('Template contem ' + count + ' referencias a ' + a.rel + '. Nenhuma duplicata nova sera criada.');
});

console.log('');
console.log('MeshCentral Modern UI V8 - preflight OK');
console.log('Versao MeshCentral: ' + version);
console.log('Raiz:               ' + root);
console.log('Override ja ativo:  ' + (overrideWasPresent ? 'sim' : 'nao'));
console.log('JS V5/V6/V7/V8:     sintaxe OK');
console.log('CSS V5/V6/V7/V8:    presente');
console.log('Template V8:         injecao validada');
console.log('Assets detectados antes do reparo:');
assets.forEach(a => console.log('  ' + a.key.padEnd(9) + ': ' + (beforeState[a.key] ? 'presente' : 'ausente -> sera injetado')));
if (dryRun) {
    console.log('Modo dry-run: nenhum arquivo foi alterado.');
    process.exit(0);
}

ensureDir(overrideViews); ensureDir(stylesDir); ensureDir(scriptsDir);
const backups = [['template', backupIfExists(templateTarget)]];
assets.forEach(a => backups.push([a.key, backupIfExists(a.target)]));
assets.forEach(a => atomicWrite(a.target, a.text));
atomicWrite(templateTarget, template);

console.log('');
console.log('MeshCentral Modern UI V8 - atualizado com sucesso');
console.log('Modern override:    ' + templateTarget);
assets.forEach(a => console.log((a.key + ':').padEnd(20) + a.target));
backups.forEach(b => { if (b[1]) console.log(('Backup ' + b[0] + ':').padEnd(20) + b[1]); });
console.log('');
console.log('Nenhum arquivo dentro de node_modules foi alterado.');
console.log('O config.json nao foi alterado. Classic permanece original.');
console.log('V8 adiciona landing na Central de Operacoes, busca funcional, estabilizacao de device state, tipografia/paleta suave e dialog/editor integrado.');
console.log('');
if (overrideWasPresent) {
    console.log('NAO reinicie o servidor por esta atualizacao. Use Ctrl+Shift+R com cache desabilitado.');
} else {
    console.log('Primeira ativacao do meshcentral-web: um restart controlado pode ser necessario.');
}
console.log('Rollback V8 -> V7: execute o install.js da branch feature/meshcentral-modern-ui-v7.');
console.log('Rollback V8 -> V6: execute o install.js da branch feature/meshcentral-modern-ui-v6.');
console.log('Rollback total: UI Settings -> Classic.');
console.log('');
