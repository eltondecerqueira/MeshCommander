#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function die(message) {
    console.error('\nERROR: ' + message + '\n');
    process.exit(1);
}

function latestBackup(file) {
    const dir = path.dirname(file);
    const base = path.basename(file) + '.backup-';
    if (!fs.existsSync(dir)) return null;
    const matches = fs.readdirSync(dir)
        .filter((name) => name.startsWith(base))
        .sort();
    return matches.length ? path.join(dir, matches[matches.length - 1]) : null;
}

function rollbackFile(file) {
    const backup = latestBackup(file);
    if (backup) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        if (fs.existsSync(file)) {
            const current = file + '.disabled-' + stamp;
            fs.renameSync(file, current);
            console.log('Desativado: ' + current);
        }
        fs.copyFileSync(backup, file);
        console.log('Restaurado: ' + file + ' <- ' + backup);
        return;
    }

    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log('Removido:   ' + file);
    } else {
        console.log('Ausente:    ' + file);
    }
}

const arg = process.argv[2];
if (!arg || arg === '-h' || arg === '--help') {
    console.log('Uso: node rollback.js /caminho/raiz-do-meshcentral');
    console.log('');
    console.log('Remove somente os arquivos da Modern UI v1.');
    console.log('Se havia override anterior e o instalador criou backup, restaura o backup mais recente.');
    console.log('Nao altera node_modules, config.json e nao reinicia o servico automaticamente.');
    process.exit(arg ? 0 : 1);
}

const root = path.resolve(arg);
const packageDir = path.join(root, 'node_modules', 'meshcentral');
if (!fs.existsSync(packageDir)) die('node_modules/meshcentral nao encontrado em: ' + root);

const webRoot = path.join(root, 'meshcentral-web');
const files = [
    path.join(webRoot, 'views', 'default3.handlebars'),
    path.join(webRoot, 'public', 'styles', 'mesh-modern-v1.css'),
    path.join(webRoot, 'public', 'scripts', 'mesh-modern-v1.js')
];

console.log('');
console.log('MeshCentral Modern UI v1 - rollback');
console.log('Raiz: ' + root);
console.log('');

for (const file of files) rollbackFile(file);

console.log('');
console.log('Rollback de arquivos concluido.');
console.log('Nenhum arquivo dentro de node_modules foi alterado.');
console.log('O config.json nao foi alterado.');
console.log('');
console.log('Agora reinicie o MeshCentral para voltar ao template original:');
console.log('  sudo systemctl restart meshcentral');
console.log('Depois valide:');
console.log('  systemctl status meshcentral --no-pager');
console.log('  journalctl -u meshcentral -n 80 --no-pager');
console.log('');
