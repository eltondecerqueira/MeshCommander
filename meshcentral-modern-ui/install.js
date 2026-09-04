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
function injectBeforeHeadEnd(source, tag) {
    if (source.includes('</head>')) return source.replace('</head>', '    ' + tag + '\n</head>');
    if (source.includes('<body')) return source.replace('<body', tag + '\n<body');
    die('Nao foi possivel localizar um ponto seguro para inserir CSS em default3.handlebars. Nada foi alterado.');
}
function injectBeforeBodyEnd(source, tag) {
    if (source.includes('</body>')) return source.replace('</body>', '    ' + tag + '\n</body>');
    if (source.includes('</html>')) return source.replace('</html>', tag + '\n</html>');
    return source + '\n' + tag + '\n';
}
function injectTemplate(source) {
    let output = source;

    const baseMarker = 'data-mesh-modern-v1="1"';
    const baseCss = '<link rel="stylesheet" href="styles/mesh-modern-v1.css" data-mesh-modern-v1="1">';
    const baseJs = '<script src="scripts/mesh-modern-v1.js" data-mesh-modern-v1="1"></script>';
    if (!output.includes(baseMarker)) {
        output = injectBeforeHeadEnd(output, baseCss);
        output = injectBeforeBodyEnd(output, baseJs);
    }

    const v6Marker = 'data-mesh-modern-v6="1"';
    const v6Css = '<link rel="stylesheet" href="styles/mesh-modern-native-v6.css" data-mesh-modern-v6="1">';
    const v6Js = '<script src="scripts/mesh-modern-native-v6.js" data-mesh-modern-v6="1"></script>';
    if (!output.includes(v6Marker)) {
        output = injectBeforeHeadEnd(output, v6Css);
        output = injectBeforeBodyEnd(output, v6Js);
    }

    const expected = [
        'styles/mesh-modern-v1.css',
        'scripts/mesh-modern-v1.js',
        'styles/mesh-modern-native-v6.css',
        'scripts/mesh-modern-native-v6.js'
    ];
    expected.forEach(function (item) {
        if (!output.includes(item)) die('Validacao interna falhou ao injetar ' + item + '. Nada foi alterado.');
    });
    return output;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rootArg = args.find(x => !x.startsWith('-'));
if (!rootArg || args.includes('-h') || args.includes('--help')) {
    console.log('Uso: node install.js /caminho/raiz-do-meshcentral [--dry-run]');
    console.log('');
    console.log('V6 mantem o Command Center V5 e adiciona skin para ferramentas nativas embutidas.');
    console.log('Valida JS antes de escrever, cria backups e usa gravacao atomica.');
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
    try { version = JSON.parse(fs.readFileSync(packageJson, 'utf8')).version || version; }
    catch (e) { warn('Nao foi possivel ler a versao em package.json.'); }
}

const meshcentralText = readText(meshcentralJs);
if (!meshcentralText) die('Nao foi possivel ler meshcentral.js.');
const hasViewsOverride = meshcentralText.includes('meshcentral-web/views') || meshcentralText.includes("'../../meshcentral-web/views'") || meshcentralText.includes('webViewsOverridePath');
const hasPublicOverride = meshcentralText.includes('meshcentral-web/public') || meshcentralText.includes("'../../meshcentral-web/public'") || meshcentralText.includes('webPublicOverridePath');
if (!hasViewsOverride || !hasPublicOverride) die('Esta versao do MeshCentral (' + version + ') nao expoe o mecanismo meshcentral-web/views + public esperado. Nada foi alterado.');

const sourceRoot = __dirname;
const baseCssSource = path.join(sourceRoot, 'public', 'styles', 'mesh-modern-v1.css');
const baseJsSource = path.join(sourceRoot, 'public', 'scripts', 'mesh-modern-v1.js');
const v6CssSource = path.join(sourceRoot, 'public', 'styles', 'mesh-modern-native-v6.css');
const v6JsSource = path.join(sourceRoot, 'public', 'scripts', 'mesh-modern-native-v6.js');
[baseCssSource, baseJsSource, v6CssSource, v6JsSource].forEach(function (file) {
    if (!fs.existsSync(file)) die('Asset da UI nao encontrado: ' + file);
});

const baseCssText = readText(baseCssSource);
const baseJsText = readText(baseJsSource);
const v6CssText = readText(v6CssSource);
const v6JsText = readText(v6JsSource);
if (!baseCssText || baseCssText.length < 500) die('CSS base parece vazio ou incompleto. Nada foi alterado.');
if (!baseJsText || baseJsText.length < 1000) die('JavaScript base parece vazio ou incompleto. Nada foi alterado.');
if (!v6CssText || v6CssText.length < 1000) die('CSS V6 parece vazio ou incompleto. Nada foi alterado.');
if (!v6JsText || v6JsText.length < 1000) die('JavaScript V6 parece vazio ou incompleto. Nada foi alterado.');
try { new Function(baseJsText); } catch (e) { die('JavaScript base possui erro de sintaxe: ' + e.message + '. Nada foi alterado.'); }
try { new Function(v6JsText); } catch (e) { die('JavaScript V6 possui erro de sintaxe: ' + e.message + '. Nada foi alterado.'); }
if (!baseJsText.includes("var VERSION = 'v5'")) warn('O JavaScript base nao declara VERSION v5.');
if (!v6JsText.includes("var VERSION = 'v6'")) warn('O JavaScript adicional nao declara VERSION v6.');

const overrideWebRoot = path.join(root, 'meshcentral-web');
const overrideViews = path.join(overrideWebRoot, 'views');
const overridePublic = path.join(overrideWebRoot, 'public');
const stylesDir = path.join(overridePublic, 'styles');
const scriptsDir = path.join(overridePublic, 'scripts');
const default3Target = path.join(overrideViews, 'default3.handlebars');
const baseCssTarget = path.join(stylesDir, 'mesh-modern-v1.css');
const baseJsTarget = path.join(scriptsDir, 'mesh-modern-v1.js');
const v6CssTarget = path.join(stylesDir, 'mesh-modern-native-v6.css');
const v6JsTarget = path.join(scriptsDir, 'mesh-modern-native-v6.js');
const overrideWasPresent = fs.existsSync(default3Target) && fs.existsSync(baseCssTarget) && fs.existsSync(baseJsTarget);

const existingOverride = readText(default3Target);
const templateSource = existingOverride || readText(packageDefault3);
if (!templateSource) die('Nao foi possivel ler default3.handlebars.');
const patchedTemplate = injectTemplate(templateSource);

console.log('');
console.log('MeshCentral Modern UI V6 - preflight OK');
console.log('Versao MeshCentral: ' + version);
console.log('Raiz:               ' + root);
console.log('Override ja ativo:  ' + (overrideWasPresent ? 'sim' : 'nao'));
console.log('JS base:            sintaxe OK');
console.log('JS V6:              sintaxe OK');
console.log('CSS V6:             arquivo presente');
console.log('Template V6:        injecao validada');
if (dryRun) {
    console.log('Modo dry-run: nenhum arquivo foi alterado.');
    process.exit(0);
}

ensureDir(overrideViews);
ensureDir(stylesDir);
ensureDir(scriptsDir);
const backups = [
    ['template', backupIfExists(default3Target)],
    ['css-base', backupIfExists(baseCssTarget)],
    ['js-base', backupIfExists(baseJsTarget)],
    ['css-v6', backupIfExists(v6CssTarget)],
    ['js-v6', backupIfExists(v6JsTarget)]
];

atomicWrite(baseCssTarget, baseCssText);
atomicWrite(baseJsTarget, baseJsText);
atomicWrite(v6CssTarget, v6CssText);
atomicWrite(v6JsTarget, v6JsText);
atomicWrite(default3Target, patchedTemplate);

console.log('');
console.log('MeshCentral Modern UI V6 - override atualizado com sucesso');
console.log('Modern override:    ' + default3Target);
console.log('CSS base:           ' + baseCssTarget);
console.log('JS base:            ' + baseJsTarget);
console.log('CSS V6:             ' + v6CssTarget);
console.log('JS V6:              ' + v6JsTarget);
backups.forEach(function (b) { if (b[1]) console.log('Backup ' + b[0] + ':      ' + b[1]); });
console.log('');
console.log('Nenhum arquivo dentro de node_modules foi alterado.');
console.log('O config.json nao foi alterado.');
console.log('Classic permanece original.');
console.log('V5 continua sendo o shell estrutural; V6 moderniza o conteudo nativo embutido.');
console.log('');
if (overrideWasPresent) {
    console.log('Como meshcentral-web ja estava ativo, NAO reinicie o servidor por esta atualizacao.');
    console.log('No navegador use F12 > Network > Disable cache e Ctrl+Shift+R.');
} else {
    console.log('Primeira ativacao do meshcentral-web detectada. Um unico restart controlado pode ser necessario.');
}
console.log('Rollback imediato: UI Settings -> Classic.');
console.log('Rollback para V5: execute o install.js da branch feature/meshcentral-modern-ui-v5.');
console.log('');
