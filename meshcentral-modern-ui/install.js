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

const arg = process.argv[2];
if (!arg || arg === '-h' || arg === '--help') {
    console.log('Uso: node install.js /caminho/raiz-do-meshcentral');
    console.log('');
    console.log('A raiz deve conter node_modules/meshcentral.');
    console.log('O instalador executa preflight de compatibilidade e copia somente CSS/JS para meshcentral-web/public.');
    console.log('Ele NAO altera config.json, NAO altera node_modules e NAO reinicia o MeshCentral.');
    process.exit(arg ? 0 : 1);
}

const root = path.resolve(arg);
const packageDir = path.join(root, 'node_modules', 'meshcentral');
const packagePublic = path.join(packageDir, 'public');
const packageViews = path.join(packageDir, 'views');
const packageJson = path.join(packageDir, 'package.json');
const schemaFile = path.join(packageDir, 'meshcentral-config-schema.json');
const default3 = path.join(packageViews, 'default3.handlebars');
const dataDir = path.join(root, 'meshcentral-data');
const configFile = path.join(dataDir, 'config.json');

if (!fs.existsSync(packageDir)) die('node_modules/meshcentral nao encontrado em: ' + root);
if (!fs.existsSync(packagePublic)) die('public do MeshCentral nao encontrado: ' + packagePublic);
if (!fs.existsSync(packageViews)) die('views do MeshCentral nao encontrado: ' + packageViews);
if (!fs.existsSync(default3)) die('default3.handlebars nao encontrado. Esta instalacao nao possui a UI Modern esperada.');

let version = 'desconhecida';
if (fs.existsSync(packageJson)) {
    try { version = JSON.parse(fs.readFileSync(packageJson, 'utf8')).version || version; } catch (e) { warn('Nao foi possivel ler a versao em package.json.'); }
}

const schemaText = readText(schemaFile);
if (!schemaText) die('meshcentral-config-schema.json nao encontrado ou nao pode ser lido: ' + schemaFile);
if (schemaText.indexOf('"customFiles"') < 0) {
    die('Esta versao do MeshCentral (' + version + ') nao declara customFiles no schema. Nao altere o config.json ainda; sera necessario usar o modo de compatibilidade para esta versao.');
}
if (schemaText.indexOf('default3') < 0) {
    die('O schema possui customFiles, mas nao foi localizado o escopo default3. Nao altere o config.json ainda.');
}

const sourceRoot = __dirname;
const cssSource = path.join(sourceRoot, 'public', 'styles', 'mesh-modern-v1.css');
const jsSource = path.join(sourceRoot, 'public', 'scripts', 'mesh-modern-v1.js');
if (!fs.existsSync(cssSource)) die('CSS do tema nao encontrado: ' + cssSource);
if (!fs.existsSync(jsSource)) die('JS do tema nao encontrado: ' + jsSource);

const overrideRoot = path.join(root, 'meshcentral-web', 'public');
const stylesDir = path.join(overrideRoot, 'styles');
const scriptsDir = path.join(overrideRoot, 'scripts');
const cssTarget = path.join(stylesDir, 'mesh-modern-v1.css');
const jsTarget = path.join(scriptsDir, 'mesh-modern-v1.js');

ensureDir(stylesDir);
ensureDir(scriptsDir);

const cssBackup = backupIfExists(cssTarget);
const jsBackup = backupIfExists(jsTarget);

fs.copyFileSync(cssSource, cssTarget);
fs.copyFileSync(jsSource, jsTarget);

console.log('');
console.log('MeshCentral Modern UI v1 - preflight OK e arquivos instalados');
console.log('Versao:  ' + version);
console.log('Raiz:    ' + root);
console.log('Pacote:  ' + packageDir);
console.log('Modern:  ' + default3);
console.log('Schema:  customFiles + default3 detectados');
console.log('CSS:     ' + cssTarget);
console.log('JS:      ' + jsTarget);
if (cssBackup) console.log('Backup CSS: ' + cssBackup);
if (jsBackup) console.log('Backup JS:  ' + jsBackup);
console.log('Config:  ' + (fs.existsSync(configFile) ? configFile : 'nao localizado automaticamente'));
console.log('');
console.log('IMPORTANTE: nenhum arquivo dentro de node_modules foi alterado.');
console.log('O config.json tambem nao foi alterado.');
console.log('');
console.log('Adicione/mescle no dominio desejado em config.json:');
console.log('');
console.log('"showModernUIToggle": true,');
console.log('"customFiles": {');
console.log('  "mesh-modern-v1": {');
console.log('    "css": ["mesh-modern-v1.css"],');
console.log('    "js": ["mesh-modern-v1.js"],');
console.log('    "scope": ["default3"]');
console.log('  }');
console.log('}');
console.log('');
console.log('Depois da alteracao do config.json, valide o JSON e faca um unico restart controlado do MeshCentral.');
console.log('Classic continua sem este overlay; Modern (default3) carrega o tema.');
console.log('');
