#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function die(message) {
    console.error('\nERROR: ' + message + '\n');
    process.exit(1);
}

function warn(message) {
    console.warn('AVISO: ' + message);
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function backupIfExists(file) {
    if (!fs.existsSync(file)) return null;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = file + '.backup-' + stamp;
    fs.copyFileSync(file, backup);
    return backup;
}

function readText(file) {
    try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
}

function injectTemplate(source) {
    const marker = 'data-mesh-modern-v1="1"';
    if (source.includes(marker)) return source;

    const cssTag = '<link rel="stylesheet" href="styles/mesh-modern-v1.css" data-mesh-modern-v1="1">';
    const jsTag = '<script src="scripts/mesh-modern-v1.js" data-mesh-modern-v1="1"></script>';

    let output = source;
    if (output.includes('</head>')) {
        output = output.replace('</head>', '    ' + cssTag + '\n</head>');
    } else if (output.includes('<body')) {
        output = output.replace('<body', cssTag + '\n<body');
    } else {
        die('Nao foi possivel localizar um ponto seguro para inserir o CSS em default3.handlebars. Nada foi alterado.');
    }

    if (output.includes('</body>')) {
        output = output.replace('</body>', '    ' + jsTag + '\n</body>');
    } else if (output.includes('</html>')) {
        output = output.replace('</html>', jsTag + '\n</html>');
    } else {
        output += '\n' + jsTag + '\n';
    }

    if (!output.includes('styles/mesh-modern-v1.css') || !output.includes('scripts/mesh-modern-v1.js')) {
        die('Validacao interna falhou ao injetar CSS/JS em default3.handlebars. Nada foi alterado.');
    }
    return output;
}

const arg = process.argv[2];
if (!arg || arg === '-h' || arg === '--help') {
    console.log('Uso: node install.js /caminho/raiz-do-meshcentral');
    console.log('');
    console.log('A raiz deve conter node_modules/meshcentral.');
    console.log('O instalador cria um override SOMENTE da UI Modern em meshcentral-web/views/default3.handlebars.');
    console.log('Ele NAO altera config.json, NAO altera node_modules e NAO reinicia o MeshCentral.');
    process.exit(arg ? 0 : 1);
}

const root = path.resolve(arg);
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
if (!hasViewsOverride || !hasPublicOverride) {
    die('Esta versao do MeshCentral (' + version + ') nao expõe o mecanismo meshcentral-web/views + public esperado. Nada foi alterado.');
}

const sourceRoot = __dirname;
const cssSource = path.join(sourceRoot, 'public', 'styles', 'mesh-modern-v1.css');
const jsSource = path.join(sourceRoot, 'public', 'scripts', 'mesh-modern-v1.js');
if (!fs.existsSync(cssSource)) die('CSS do tema nao encontrado: ' + cssSource);
if (!fs.existsSync(jsSource)) die('JS do tema nao encontrado: ' + jsSource);

const overrideWebRoot = path.join(root, 'meshcentral-web');
const overrideViews = path.join(overrideWebRoot, 'views');
const overridePublic = path.join(overrideWebRoot, 'public');
const stylesDir = path.join(overridePublic, 'styles');
const scriptsDir = path.join(overridePublic, 'scripts');
const default3Target = path.join(overrideViews, 'default3.handlebars');
const cssTarget = path.join(stylesDir, 'mesh-modern-v1.css');
const jsTarget = path.join(scriptsDir, 'mesh-modern-v1.js');

ensureDir(overrideViews);
ensureDir(stylesDir);
ensureDir(scriptsDir);

const existingOverride = readText(default3Target);
const templateSource = existingOverride || readText(packageDefault3);
if (!templateSource) die('Nao foi possivel ler default3.handlebars.');
const patchedTemplate = injectTemplate(templateSource);

const templateBackup = backupIfExists(default3Target);
const cssBackup = backupIfExists(cssTarget);
const jsBackup = backupIfExists(jsTarget);

fs.copyFileSync(cssSource, cssTarget);
fs.copyFileSync(jsSource, jsTarget);

const tmpTemplate = default3Target + '.tmp-' + process.pid;
fs.writeFileSync(tmpTemplate, patchedTemplate, 'utf8');
fs.renameSync(tmpTemplate, default3Target);

console.log('');
console.log('MeshCentral Modern UI v1 - override instalado com sucesso');
console.log('Versao MeshCentral: ' + version);
console.log('Raiz:               ' + root);
console.log('Pacote original:     ' + packageDir);
console.log('Modern original:     ' + packageDefault3);
console.log('Modern override:     ' + default3Target);
console.log('CSS override:        ' + cssTarget);
console.log('JS override:         ' + jsTarget);
if (templateBackup) console.log('Backup template:     ' + templateBackup);
if (cssBackup) console.log('Backup CSS:          ' + cssBackup);
if (jsBackup) console.log('Backup JS:           ' + jsBackup);
console.log('');
console.log('Nenhum arquivo dentro de node_modules foi alterado.');
console.log('O config.json nao foi alterado.');
console.log('Classic permanece original. Somente default3 (Modern) recebeu o overlay.');
console.log('');
console.log('PROXIMO PASSO: faça um unico restart controlado do processo MeshCentral');
console.log('para que meshcentral-web/views e meshcentral-web/public sejam detectados.');
console.log('Antes do restart, confirme o gerenciador com:');
console.log("  ps -eo pid,user,cmd | grep -i '[m]eshcentral'");
console.log('');
console.log('Depois do restart: UI Settings -> Modern.');
console.log('Rollback imediato: UI Settings -> Classic.');
console.log('');
