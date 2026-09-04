#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
function die(m){ console.error('\nERROR: '+m+'\n'); process.exit(1); }
function warn(m){ console.warn('AVISO: '+m); }
function read(f){ try{return fs.readFileSync(f,'utf8');}catch(e){return null;} }
function ensure(d){ fs.mkdirSync(d,{recursive:true}); }
function backup(f){ if(!fs.existsSync(f))return null; const s=new Date().toISOString().replace(/[:.]/g,'-'); const b=f+'.backup-'+s; fs.copyFileSync(f,b); return b; }
function atomic(f,c){ const t=f+'.tmp-'+process.pid+'-'+Date.now(); fs.writeFileSync(t,c,'utf8'); fs.renameSync(t,f); }
function injectHead(src,tag){ if(src.includes('</head>'))return src.replace('</head>','    '+tag+'\n</head>'); if(src.includes('<body'))return src.replace('<body',tag+'\n<body'); die('Nao foi possivel localizar ponto seguro para inserir CSS. Nada foi alterado.'); }
function injectBody(src,tag){ if(src.includes('</body>'))return src.replace('</body>','    '+tag+'\n</body>'); if(src.includes('</html>'))return src.replace('</html>',tag+'\n</html>'); return src+'\n'+tag+'\n'; }

const args=process.argv.slice(2), dry=args.includes('--dry-run'), rootArg=args.find(x=>!x.startsWith('-'));
if(!rootArg||args.includes('-h')||args.includes('--help')){
  console.log('Uso: node install.js /caminho/raiz-do-meshcentral [--dry-run]');
  console.log('V9 = V5 workspace + V6 native skin + V7 Service Desk + V8 stabilization + V9 compliance/inventory.');
  console.log('Nao altera config.json, node_modules nem reinicia MeshCentral.');
  process.exit(rootArg?0:1);
}
const root=path.resolve(rootArg), pkg=path.join(root,'node_modules','meshcentral'), pkgViews=path.join(pkg,'views'), pkgPublic=path.join(pkg,'public');
const pkgJson=path.join(pkg,'package.json'), coreFile=path.join(pkg,'meshcentral.js'), original=path.join(pkgViews,'default3.handlebars');
if(!fs.existsSync(pkg)||!fs.existsSync(pkgViews)||!fs.existsSync(pkgPublic))die('Estrutura node_modules/meshcentral incompleta em: '+root);
if(!fs.existsSync(original))die('default3.handlebars nao encontrado.');
const core=read(coreFile)||''; if(!(core.includes('meshcentral-web/views')||core.includes('webViewsOverridePath'))||!(core.includes('meshcentral-web/public')||core.includes('webPublicOverridePath')))die('Esta versao nao expoe meshcentral-web/views + public.');
let version='desconhecida'; try{version=JSON.parse(fs.readFileSync(pkgJson,'utf8')).version||version;}catch(e){warn('Nao foi possivel ler package.json.');}

const manifest=[
 ['base-css','css','styles/mesh-modern-v1.css',500,'<link rel="stylesheet" href="styles/mesh-modern-v1.css" data-mesh-modern-v1-css="1">'],
 ['base-js','js','scripts/mesh-modern-v1.js',1000,'<script src="scripts/mesh-modern-v1.js" data-mesh-modern-v1-js="1"></script>'],
 ['v6-css','css','styles/mesh-modern-native-v6.css',1000,'<link rel="stylesheet" href="styles/mesh-modern-native-v6.css" data-mesh-modern-v6-css="1">'],
 ['v6-js','js','scripts/mesh-modern-native-v6.js',1000,'<script src="scripts/mesh-modern-native-v6.js" data-mesh-modern-v6-js="1"></script>'],
 ['v7-css','css','styles/mesh-commandcenter-v7.css',1000,'<link rel="stylesheet" href="styles/mesh-commandcenter-v7.css" data-mesh-modern-v7-css="1">'],
 ['v7-js','js','scripts/mesh-commandcenter-v7.js',1000,'<script src="scripts/mesh-commandcenter-v7.js" data-mesh-modern-v7-js="1"></script>'],
 ['v8-css','css','styles/mesh-commandcenter-v8.css',1000,'<link rel="stylesheet" href="styles/mesh-commandcenter-v8.css" data-mesh-modern-v8-css="1">'],
 ['v8-js','js','scripts/mesh-commandcenter-v8.js',1000,'<script src="scripts/mesh-commandcenter-v8.js" data-mesh-modern-v8-js="1"></script>'],
 ['v9-css','css','styles/mesh-commandcenter-v9.css',1000,'<link rel="stylesheet" href="styles/mesh-commandcenter-v9.css" data-mesh-modern-v9-css="1">'],
 ['v9-js','js','scripts/mesh-commandcenter-v9.js',1000,'<script src="scripts/mesh-commandcenter-v9.js" data-mesh-modern-v9-js="1"></script>']
].map(function(x){return{key:x[0],kind:x[1],rel:x[2],min:x[3],tag:x[4]};});
const srcRoot=__dirname;
manifest.forEach(function(a){a.source=path.join(srcRoot,'public',a.rel);if(!fs.existsSync(a.source))die('Asset nao encontrado: '+a.source);a.text=read(a.source);if(!a.text||a.text.length<a.min)die('Asset vazio/incompleto: '+a.rel);if(a.kind==='js'){try{new Function(a.text);}catch(e){die('Erro de sintaxe em '+a.rel+': '+e.message);}}});
[['base-js','v5'],['v6-js','v6'],['v7-js','v7'],['v8-js','v8'],['v9-js','v9']].forEach(function(v){var a=manifest.find(x=>x.key===v[0]);if(a&&!a.text.includes("var VERSION = '"+v[1]+"'"))warn(a.rel+' nao declara VERSION '+v[1]+'.');});

const override=path.join(root,'meshcentral-web'), views=path.join(override,'views'), pub=path.join(override,'public'), styles=path.join(pub,'styles'), scripts=path.join(pub,'scripts'), target=path.join(views,'default3.handlebars');
manifest.forEach(function(a){a.target=path.join(pub,a.rel);});
let template=read(target)||read(original); if(!template)die('Nao foi possivel ler default3.handlebars.');
const before={}; manifest.forEach(a=>before[a.key]=template.includes(a.rel));
manifest.filter(a=>a.kind==='css').forEach(function(a){if(!template.includes(a.rel))template=injectHead(template,a.tag);});
manifest.filter(a=>a.kind==='js').forEach(function(a){if(!template.includes(a.rel))template=injectBody(template,a.tag);});
manifest.forEach(function(a){var count=template.split(a.rel).length-1;if(count<1)die('Falha ao validar injecao de '+a.rel);if(count>1)warn('Template contem '+count+' referencias a '+a.rel+'.');});

console.log('\nMeshCentral Modern UI V9 - preflight OK');
console.log('Versao MeshCentral: '+version); console.log('Raiz:               '+root); console.log('Override ja ativo:  '+(fs.existsSync(target)?'sim':'nao'));
console.log('JS V5/V6/V7/V8/V9:  sintaxe OK'); console.log('CSS V5/V6/V7/V8/V9: presente'); console.log('Template V9:         injecao validada');
console.log('Assets detectados antes do reparo:'); manifest.forEach(a=>console.log('  '+a.key.padEnd(9)+': '+(before[a.key]?'presente':'ausente -> sera injetado')));
if(dry){console.log('Modo dry-run: nenhum arquivo foi alterado.');process.exit(0);}
ensure(views);ensure(styles);ensure(scripts);const backups=[['template',backup(target)]];manifest.forEach(a=>backups.push([a.key,backup(a.target)]));manifest.forEach(a=>atomic(a.target,a.text));atomic(target,template);
console.log('\nMeshCentral Modern UI V9 - atualizado com sucesso');console.log('Modern override:    '+target);manifest.forEach(a=>console.log((a.key+':').padEnd(20)+a.target));backups.forEach(b=>{if(b[1])console.log(('Backup '+b[0]+':').padEnd(20)+b[1]);});
console.log('\nNenhum arquivo dentro de node_modules foi alterado.');console.log('O config.json nao foi alterado. Classic permanece original.');console.log('V9 adiciona conformidade AV/last-seen, duplicidades, Registry panel 9, Software panel 18, indice progressivo de software e quick automation segura.');
console.log(fs.existsSync(target)?'NAO reinicie o servidor. Use Ctrl+Shift+R com cache desabilitado.':'Primeira ativacao do meshcentral-web: um restart controlado pode ser necessario.');
console.log('Rollback V9 -> V8: execute o install.js da branch feature/meshcentral-modern-ui-v8.');console.log('Rollback total: UI Settings -> Classic.\n');
