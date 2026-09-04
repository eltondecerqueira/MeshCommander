#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function fail(message) {
  console.error('\nERROR: ' + message + '\n');
  process.exit(1);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function insertHeadAsset(source, tag) {
  // MeshCentral ships a heavily minified commander.htm. HTML minifiers are
  // allowed to omit </head>, so prefer it when present and otherwise inject
  // immediately before the first real <body ...> tag. If <body> is omitted as
  // well, fall back to inserting after the final </style> or inside <head>.
  const lower = source.toLowerCase();
  const headClose = lower.indexOf('</head>');
  if (headClose >= 0) {
    return source.slice(0, headClose) + tag + source.slice(headClose);
  }

  const bodyOpen = lower.indexOf('<body');
  if (bodyOpen >= 0) {
    return source.slice(0, bodyOpen) + tag + source.slice(bodyOpen);
  }

  const lastStyleClose = lower.lastIndexOf('</style>');
  if (lastStyleClose >= 0) {
    const pos = lastStyleClose + '</style>'.length;
    return source.slice(0, pos) + tag + source.slice(pos);
  }

  const headOpen = lower.indexOf('<head');
  if (headOpen >= 0) {
    const headOpenEnd = source.indexOf('>', headOpen);
    if (headOpenEnd >= 0) {
      const pos = headOpenEnd + 1;
      return source.slice(0, pos) + tag + source.slice(pos);
    }
  }

  fail('Nao foi possivel localizar uma area segura do HEAD no commander.htm. Nenhum arquivo foi alterado.');
}

function insertBodyAsset(source, tag) {
  // </body> and </html> are optional in HTML and are commonly removed by the
  // MeshCommander compiler/minifier. Prefer those anchors, otherwise append the
  // script at EOF. An external script at EOF is still part of the document body.
  const lower = source.toLowerCase();
  const bodyClose = lower.lastIndexOf('</body>');
  if (bodyClose >= 0) {
    return source.slice(0, bodyClose) + tag + source.slice(bodyClose);
  }

  const htmlClose = lower.lastIndexOf('</html>');
  if (htmlClose >= 0) {
    return source.slice(0, htmlClose) + tag + source.slice(htmlClose);
  }

  return source + tag;
}

function injectCommander(source) {
  if (source.includes('data-meshcommander-modern-ui="1"')) return source;

  const cssTag = '<link rel="stylesheet" href="styles/meshcommander-modern.css" data-meshcommander-modern-ui="1">';
  const jsTag = '<script src="scripts/meshcommander-modern-toggle.js" data-meshcommander-modern-ui="1"></script>';

  let output = insertHeadAsset(source, cssTag);
  output = insertBodyAsset(output, jsTag);
  return output;
}

const publicDirArg = process.argv[2];
const mode = (process.argv[3] || 'canary').toLowerCase();

if (!publicDirArg || ['canary', 'direct', 'override'].indexOf(mode) < 0) {
  console.log('Uso:');
  console.log('  node meshcentral-ui/install-modern-toggle.js /caminho/node_modules/meshcentral/public canary');
  console.log('  node meshcentral-ui/install-modern-toggle.js /caminho/node_modules/meshcentral/public direct');
  console.log('  node meshcentral-ui/install-modern-toggle.js /caminho/node_modules/meshcentral/public override');
  console.log('');
  console.log('canary   -> cria commander-modern.htm ao lado do commander.htm, sem substituir producao.');
  console.log('direct   -> faz backup e substitui commander.htm de forma atomica, sem reiniciar o Node.');
  console.log('override -> usa meshcentral-web/public para persistir customizacao fora de node_modules.');
  process.exit(publicDirArg ? 1 : 0);
}

const publicDir = path.resolve(publicDirArg);
const sourceCommander = path.join(publicDir, 'commander.htm');
const packageRoot = path.resolve(__dirname, '..');
const modernCssSource = path.join(packageRoot, 'styles-modern.css');
const toggleJsSource = path.join(__dirname, 'meshcommander-modern-toggle.js');

if (!fs.existsSync(publicDir)) fail('Diretorio public nao existe: ' + publicDir);
if (!fs.existsSync(sourceCommander)) fail('commander.htm nao encontrado: ' + sourceCommander);
if (!fs.existsSync(modernCssSource)) fail('styles-modern.css nao encontrado no checkout do MeshCommander: ' + modernCssSource);
if (!fs.existsSync(toggleJsSource)) fail('toggle JS nao encontrado: ' + toggleJsSource);

const original = fs.readFileSync(sourceCommander, 'utf8');
const patched = injectCommander(original);

if (!patched.includes('styles/meshcommander-modern.css') || !patched.includes('scripts/meshcommander-modern-toggle.js')) {
  fail('Validacao interna falhou: os assets modernos nao foram injetados. Nenhum arquivo foi alterado.');
}

let targetPublicDir = publicDir;
let targetCommander;

if (mode === 'canary') {
  targetCommander = path.join(publicDir, 'commander-modern.htm');
} else if (mode === 'direct') {
  targetCommander = sourceCommander;
} else {
  // publicDir = <meshcentral-root>/node_modules/meshcentral/public
  // target   = <meshcentral-root>/meshcentral-web/public
  const meshcentralRoot = path.resolve(publicDir, '..', '..', '..');
  targetPublicDir = path.join(meshcentralRoot, 'meshcentral-web', 'public');
  targetCommander = path.join(targetPublicDir, 'commander.htm');
}

ensureDir(targetPublicDir);
ensureDir(path.join(targetPublicDir, 'styles'));
ensureDir(path.join(targetPublicDir, 'scripts'));

fs.copyFileSync(modernCssSource, path.join(targetPublicDir, 'styles', 'meshcommander-modern.css'));
fs.copyFileSync(toggleJsSource, path.join(targetPublicDir, 'scripts', 'meshcommander-modern-toggle.js'));

if (mode === 'direct') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = sourceCommander + '.backup-' + timestamp;
  fs.copyFileSync(sourceCommander, backup);
  console.log('Backup: ' + backup);
}

const tmpFile = targetCommander + '.tmp-' + process.pid;
fs.writeFileSync(tmpFile, patched, 'utf8');
fs.renameSync(tmpFile, targetCommander);

console.log('');
console.log('MeshCommander Modern UI instalado.');
console.log('Modo: ' + mode);
console.log('Origem: ' + sourceCommander);
console.log('Destino: ' + targetCommander);
console.log('CSS: ' + path.join(targetPublicDir, 'styles', 'meshcommander-modern.css'));
console.log('JS: ' + path.join(targetPublicDir, 'scripts', 'meshcommander-modern-toggle.js'));
console.log('');

if (mode === 'canary') {
  console.log('Teste sem reinicio: abra /commander-modern.htm');
  console.log('A pagina /commander.htm permanece intacta.');
} else if (mode === 'direct') {
  console.log('Nao e necessario reiniciar o MeshCentral: commander.htm e um arquivo estatico.');
  console.log('ATENCAO: atualizacoes do pacote MeshCentral podem sobrescrever esta alteracao em node_modules.');
} else {
  console.log('A customizacao esta fora de node_modules e sobrevive melhor a updates.');
  console.log('Se meshcentral-web/public nao existia quando o MeshCentral iniciou, sera necessario um unico restart para o override ser detectado.');
}
