(function () {
  'use strict';

  var VERSION = 'v9';
  var params = new URLSearchParams(window.location.search);
  var EMBED = params.get('mcmembed') === '1';
  var EMBED_PANEL = parseInt(params.get('mcmpanel') || params.get('viewmode') || '0', 10);
  var EMBED_NODE = params.get('mcmnode') || null;
  var STABLE_MS = 1800;
  var stable = Object.create(null);
  var candidates = Object.create(null);
  var TELEMETRY_KEY = 'meshcommander-v9-telemetry';
  var SOFTWARE_KEY = 'meshcommander-v9-software';
  var selectedLock = null;
  var applying = false;

  function q(id) { return document.getElementById(id); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function text(v) { return (v == null || v === '') ? '—' : String(v); }
  function esc(v) { return text(v).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function later(fn, ms) { window.setTimeout(function () { try { fn(); } catch (e) {} }, ms || 0); }
  function getJson(key, fallback) { try { var x = JSON.parse(localStorage.getItem(key) || 'null'); return x || fallback; } catch (e) { return fallback; } }
  function putJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  function normalizeTs(v) { var n = Number(v || 0); if (!n) return 0; if (n < 100000000000) n *= 1000; return n; }
  function cssEscape(v) { if (window.CSS && CSS.escape) return CSS.escape(String(v)); return String(v).replace(/["\\]/g, '\\$&'); }

  /* MeshCentral 1.2.5 exposes nodes as an ARRAY in default3. Earlier overlays
     incorrectly treated it as an id-keyed object. Everything in V9 resolves
     devices by _id so refresh packets cannot silently point at array indexes. */
  function allNodes() {
    var src = (window.nodes && typeof window.nodes === 'object') ? window.nodes : ((window.meshNodes && typeof window.meshNodes === 'object') ? window.meshNodes : {});
    var out = [];
    if (Array.isArray(src)) {
      src.forEach(function (n) { if (n && typeof n === 'object') out.push(n); });
      return out;
    }
    Object.keys(src).forEach(function (id) { var n = src[id]; if (!n || typeof n !== 'object') return; if (!n._id) n._id = id; out.push(n); });
    return out;
  }
  function nodeById(id) { var a = allNodes(); for (var i = 0; i < a.length; i++) if (a[i]._id === id) return a[i]; return null; }
  function meshMap() { return (window.meshes && typeof window.meshes === 'object') ? window.meshes : {}; }
  function meshName(n) { var m = n && n.meshid ? meshMap()[n.meshid] : null; return text(m && (m.name || m.mname)); }
  function nodeName(n) { return text(n && (n.name || n.host || n.computerName || n._id)); }
  function nodeIp(n) { return text(n && (n.ip || n.ipaddr || n.addr || n.host)); }
  function nodeOs(n) { return text(n && (n.osdesc || n.os || n.platform || (n.agent && n.agent.name))); }
  function statusOf(n) { return Number(n && n.conn || 0) > 0 ? ((n.warning || n.warn || n.health === 'warning' || n.health === 'critical') ? 'attention' : 'online') : 'offline'; }
  function statusLabel(s) { return s === 'online' ? 'Online' : (s === 'attention' ? 'Atenção' : 'Offline'); }
  function selectedId() {
    if (selectedLock && nodeById(selectedLock)) return selectedLock;
    var active = document.querySelector('.mcm5-device-row.active[data-nodeid]');
    if (active && nodeById(active.dataset.nodeid)) return active.dataset.nodeid;
    try { var st = JSON.parse(sessionStorage.getItem('meshcommander-v5-state') || '{}'); if (st.selectedId && nodeById(st.selectedId)) return st.selectedId; } catch (e) {}
    return null;
  }
  function lockSelected(id) { if (!id || !nodeById(id)) return; selectedLock = id; try { sessionStorage.setItem('meshcommander-v9-selected', id); } catch (e) {} }
  function restoreSelected() { try { var id = sessionStorage.getItem('meshcommander-v9-selected'); if (id && nodeById(id)) selectedLock = id; } catch (e) {} }

  function snapshot(n) {
    if (!n || !n._id) return null;
    var a = n.agent || {}, ia = n.intelamt || {};
    var s = {
      id:n._id, name:nodeName(n), ip:nodeIp(n), os:nodeOs(n), group:meshName(n), status:statusOf(n),
      agent:text(a.ver || a.version || a.id || (n.agent ? 'Detectado' : '—')),
      amt:text(ia.ver || ia.version || ia.vers || ia.Version), caps:Number(a.caps || 0), hasAmt:!!n.intelamt
    };
    s.fp = [s.name,s.ip,s.os,s.group,s.status,s.agent,s.amt,s.caps].join('|');
    return s;
  }
  function sampleStable() {
    var now = Date.now();
    allNodes().forEach(function (n) {
      var s = snapshot(n); if (!s) return;
      if (!stable[s.id]) { stable[s.id] = s; return; }
      if (stable[s.id].fp === s.fp) { delete candidates[s.id]; return; }
      var c = candidates[s.id];
      if (!c || c.snap.fp !== s.fp) { candidates[s.id] = { snap:s, since:now }; return; }
      if ((now - c.since) >= STABLE_MS) { stable[s.id] = c.snap; delete candidates[s.id]; }
    });
    applyStableSelection();
  }
  function setText(id, value) { var el=q(id); if (el && el.textContent !== value) el.textContent=value; }
  function applyStableSelection() {
    if (EMBED || applying) return;
    var id=selectedId(), s=id && stable[id]; if(!s)return;
    applying=true;
    try {
      setText('mcm5DeviceName',s.name); setText('mcm5DeviceMeta',[s.ip,s.group,s.os].filter(function(x){return x&&x!=='—';}).join('  |  ')||'—');
      var p=q('mcm5DeviceStatus'); if(p){p.textContent=statusLabel(s.status);p.className='mcm5-pill '+s.status;}
      var rs=q('mcm5RemoteState'); if(rs){rs.textContent=statusLabel(s.status);rs.className='mcm5-pill '+s.status;}
      var hp=q('mcm5HealthPill'); if(hp){hp.textContent=statusLabel(s.status);hp.className='mcm5-pill '+s.status;}
      setText('mcm5ScreenTitle',s.name);
      var info=q('mcm5Info'); if(info){var h=[['Nome',s.name],['Estado',statusLabel(s.status)],['Endereço IP',s.ip],['Grupo',s.group],['Sistema Operacional',s.os],['Agente',s.agent],['Intel AMT',s.amt],['Node ID',id]].map(function(x){return '<div><dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd></div>';}).join('');if(info.innerHTML!==h)info.innerHTML=h;}
      qa('.mcm5-device-row[data-nodeid]').forEach(function(row){var r=stable[row.dataset.nodeid];if(!r)return;var nm=row.querySelector('.mcm5-dev-name b');if(nm&&nm.textContent!==r.name)nm.textContent=r.name;var ip=row.querySelector('.mcm5-ip');if(ip&&ip.textContent!==r.ip)ip.textContent=r.ip;var st=row.querySelector('.mcm5-status');if(st){var want='mcm5-status '+r.status;if(st.className!==want||st.textContent.trim()!==statusLabel(r.status)){st.className=want;st.innerHTML='<i></i>'+statusLabel(r.status);}}});
    } finally { applying=false; }
  }
  function installStableGuard() {
    restoreSelected(); sampleStable();
    var shell=q('mcmV5Shell'); if(shell&&!shell.dataset.mcm9Stable){shell.dataset.mcm9Stable='1';shell.addEventListener('click',function(e){var row=e.target.closest('.mcm5-device-row[data-nodeid]');if(row)lockSelected(row.dataset.nodeid);},true);var obs=new MutationObserver(function(){if(!applying)later(applyStableSelection,0);});obs.observe(shell,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});}
    window.setInterval(sampleStable,500);
  }

  function antivirusState(n) {
    if (!n) return 'unknown';
    if (n.wsc && n.wsc.antiVirus != null) return String(n.wsc.antiVirus).toUpperCase() === 'OK' ? 'ok' : 'bad';
    if (n.lsc && n.lsc.antiVirus != null) return String(n.lsc.antiVirus).toUpperCase() === 'OK' ? 'ok' : 'bad';
    if (Array.isArray(n.av) && n.av.length) return n.av.some(function (x) { return x && (x.enabled === true || x.enabled === 1 || String(x.enabled).toLowerCase() === 'true'); }) ? 'ok' : 'bad';
    return 'unknown';
  }
  function lastSeen(n) { return normalizeTs(n && (n.lastconnect || n.lastConnect || n.lastseen || n.lastSeen)); }
  function staleDays(n) { if (Number(n && n.conn || 0) > 0) return 0; var t=lastSeen(n); return t ? (Date.now()-t)/86400000 : -1; }
  function duplicateGroups() {
    var buckets=Object.create(null), uuid=Object.create(null), out=[];
    allNodes().forEach(function(n){var name=nodeName(n).trim().toLowerCase();if(name&&name!=='—')(buckets[name]||(buckets[name]=[])).push(n);var u=(n.uuid||(n.intelamt&&n.intelamt.uuid)||'').toString().toLowerCase();if(u)(uuid[u]||(uuid[u]=[])).push(n);});
    Object.keys(uuid).forEach(function(k){if(uuid[k].length>1)out.push({type:'UUID',key:k,nodes:uuid[k]});});
    Object.keys(buckets).forEach(function(k){if(buckets[k].length>1&&!out.some(function(g){return g.nodes.some(function(x){return buckets[k].indexOf(x)>=0;})&&g.nodes.length===buckets[k].length;}))out.push({type:'Nome',key:k,nodes:buckets[k]});});
    return out;
  }
  function compliance() {
    var a=allNodes(), avBad=[], avKnown=0, s15=[],s30=[],s60=[],unknownLast=[];
    a.forEach(function(n){var av=antivirusState(n);if(av!=='unknown')avKnown++;if(av==='bad')avBad.push(n);var d=staleDays(n);if(d<0){if(Number(n.conn||0)<=0)unknownLast.push(n);}else{if(d>=15)s15.push(n);if(d>=30)s30.push(n);if(d>=60)s60.push(n);}});
    var tel=getJson(TELEMETRY_KEY,{}), encBad=[],encKnown=0;
    Object.keys(tel).forEach(function(id){var x=tel[id];if(x&&x.encryption){encKnown++;if(x.encryption==='bad') {var n=nodeById(id);if(n)encBad.push(n);}}});
    var dup=duplicateGroups();
    return {total:a.length,avBad:avBad,avKnown:avKnown,s15:s15,s30:s30,s60:s60,unknownLast:unknownLast,encBad:encBad,encKnown:encKnown,duplicates:dup};
  }

  function ensureInsights() {
    var page=q('mcm7DashboardPage'); if(!page||q('mcm9Compliance'))return;
    var head=page.querySelector('.mcm7-pagehead');var sec=document.createElement('section');sec.id='mcm9Compliance';sec.className='mcm9-compliance';sec.innerHTML='<div class="mcm9-section-title"><div><b>Conformidade e ausência</b><span>Indicadores acionáveis do parque</span></div><button id="mcm9RefreshCompliance">Atualizar</button></div><div id="mcm9ComplianceGrid" class="mcm9-compliance-grid"></div>';
    if(head&&head.nextSibling)page.insertBefore(sec,head.nextSibling);else page.appendChild(sec);
    q('mcm9RefreshCompliance').onclick=renderCompliance;
  }
  function metricCard(kind,value,title,sub,list) { return '<button class="mcm9-metric '+kind+'" data-mcm9-list="'+kind+'"><span>'+value+'</span><div><b>'+esc(title)+'</b><small>'+esc(sub)+'</small></div></button>'; }
  function renderCompliance() {
    ensureInsights();var host=q('mcm9ComplianceGrid');if(!host)return;var c=compliance();
    host.innerHTML=[
      metricCard('av',c.avBad.length,'Antivírus com problema',c.avKnown+' de '+c.total+' com status conhecido'),
      metricCard('enc',c.encBad.length,'Sem criptografia',c.encKnown+' de '+c.total+' com BitLocker coletado'),
      metricCard('stale15',c.s15.length,'Sem reportar > 15 dias',c.unknownLast.length+' sem data conhecida'),
      metricCard('stale30',c.s30.length,'Sem reportar > 30 dias','Endpoints offline de longa duração'),
      metricCard('stale60',c.s60.length,'Sem reportar > 60 dias','Candidatos a revisão/limpeza'),
      metricCard('dup',c.duplicates.reduce(function(n,g){return n+g.nodes.length;},0),'Prováveis duplicadas',c.duplicates.length+' conjunto(s) por nome/UUID')
    ].join('');
    qa('[data-mcm9-list]',host).forEach(function(b){b.onclick=function(){var k=b.dataset.mcm9List;if(k==='av')showDeviceList('Antivírus com problema',c.avBad);else if(k==='enc')showDeviceList('Sem criptografia conhecida',c.encBad);else if(k==='stale15')showDeviceList('Sem reportar há mais de 15 dias',c.s15);else if(k==='stale30')showDeviceList('Sem reportar há mais de 30 dias',c.s30);else if(k==='stale60')showDeviceList('Sem reportar há mais de 60 dias',c.s60);else showDuplicates(c.duplicates);};});
  }

  function ensureModal() { if(q('mcm9Modal'))return q('mcm9Modal');var m=document.createElement('div');m.id='mcm9Modal';m.className='mcm9-modal';m.hidden=true;m.innerHTML='<div class="mcm9-modal-card"><header><div><b id="mcm9ModalTitle">Detalhes</b><small id="mcm9ModalSub"></small></div><button id="mcm9ModalClose">×</button></header><div id="mcm9ModalBody"></div></div>';document.body.appendChild(m);q('mcm9ModalClose').onclick=function(){m.hidden=true;};m.onclick=function(e){if(e.target===m)m.hidden=true;};return m; }
  function showDeviceList(title,list){var m=ensureModal();q('mcm9ModalTitle').textContent=title;q('mcm9ModalSub').textContent=list.length+' dispositivo(s)';q('mcm9ModalBody').innerHTML='<div class="mcm9-device-list">'+list.slice(0,300).map(function(n){var d=staleDays(n);return '<button data-mcm9-open="'+esc(n._id)+'"><div><b>'+esc(nodeName(n))+'</b><small>'+esc(meshName(n))+' · '+esc(nodeIp(n))+(d>0?' · '+Math.floor(d)+' dias':'')+'</small></div><span>'+statusLabel(statusOf(n))+'</span></button>';}).join('')+'</div>';qa('[data-mcm9-open]',q('mcm9ModalBody')).forEach(function(b){b.onclick=function(){m.hidden=true;openDevice(b.dataset.mcm9Open);};});m.hidden=false;}
  function showDuplicates(groups){var m=ensureModal();q('mcm9ModalTitle').textContent='Prováveis máquinas duplicadas';q('mcm9ModalSub').textContent='Detecção por nome e UUID disponível';q('mcm9ModalBody').innerHTML='<div class="mcm9-duplicates">'+groups.map(function(g){return '<section><header><b>'+esc(g.type)+': '+esc(g.key)+'</b><span>'+g.nodes.length+' registros</span></header>'+g.nodes.map(function(n){return '<button data-mcm9-open="'+esc(n._id)+'"><b>'+esc(nodeName(n))+'</b><small>'+esc(meshName(n))+' · '+esc(nodeIp(n))+' · '+statusLabel(statusOf(n))+'</small></button>';}).join('')+'</section>';}).join('')+'</div>';qa('[data-mcm9-open]',q('mcm9ModalBody')).forEach(function(b){b.onclick=function(){m.hidden=true;openDevice(b.dataset.mcm9Open);};});m.hidden=false;}

  function openDevice(id, tool) {
    var n=nodeById(id);if(!n)return;lockSelected(id);
    var dev=document.querySelector('#mcm7PrimaryNav [data-page="devices"]');if(dev)dev.click();
    later(function(){var all=document.querySelector('.mcm5-tabs [data-filter="all"]');if(all)all.click();var gf=q('mcm5GroupFilter');if(gf){gf.value='all';gf.dispatchEvent(new Event('change',{bubbles:true}));}var input=q('mcm5LocalSearch');if(input){input.value=nodeName(n);input.dispatchEvent(new Event('input',{bubbles:true}));}later(function(){var r=document.querySelector('.mcm5-device-row[data-nodeid="'+cssEscape(id)+'"]');if(r)r.click();if(tool)later(function(){openExtendedTool(tool);},120);},150);},80);
  }

  function shortId(n){var p=String(n&&n._id||'').split('/');return p[p.length-1]||'';}
  function embeddedUrl(n,panel){var u=new URL(window.location.href);['mcmembed','mcmnode','mcmpanel','mcmauto','mcmsection','gotonode'].forEach(function(k){u.searchParams.delete(k);});u.searchParams.set('mcmembed','1');u.searchParams.set('mcmnode',n._id);u.searchParams.set('mcmpanel',String(panel));u.searchParams.set('node',shortId(n));u.searchParams.set('viewmode',String(panel));return u.toString();}
  function ensureExtendedTools(){var tabs=document.querySelector('.mcm5-detailtabs');if(!tabs||tabs.dataset.mcm9)return;tabs.dataset.mcm9='1';var reg=document.createElement('button');reg.dataset.mcm9Tool='registry';reg.textContent='Registro';var sw=document.createElement('button');sw.dataset.mcm9Tool='software';sw.textContent='Software';tabs.appendChild(reg);tabs.appendChild(sw);[reg,sw].forEach(function(b){b.onclick=function(e){e.preventDefault();e.stopPropagation();openExtendedTool(b.dataset.mcm9Tool);};});var pane=document.querySelector('.mcm5-detailpane');if(pane&&!q('mcm9ExtendedView')){var v=document.createElement('section');v.id='mcm9ExtendedView';v.className='mcm5-toolview mcm9-extended';v.hidden=true;v.innerHTML='<div class="mcm5-toolhead"><div><div class="mcm5-tool-titleline"><b id="mcm9ToolTitle">Ferramenta</b><span class="mcm5-pill online">Integrado</span></div><small id="mcm9ToolSubtitle">Motor nativo do MeshCentral dentro do Command Center</small></div><div class="mcm5-tool-actions"><button id="mcm9ToolFull" class="mcm5-btn">Tela cheia</button><button id="mcm9ToolReload" class="mcm5-btn">Atualizar</button><button id="mcm9ToolClose" class="mcm5-btn danger">Fechar</button></div></div><div class="mcm9-framehost"><div id="mcm9ToolLoading" class="mcm5-frame-loading">Carregando…</div><iframe id="mcm9ToolFrame" allow="fullscreen; clipboard-read; clipboard-write" referrerpolicy="same-origin"></iframe></div>';pane.appendChild(v);q('mcm9ToolFull').onclick=function(){var x=q('mcm9ExtendedView');if(x&&x.requestFullscreen)x.requestFullscreen();};q('mcm9ToolReload').onclick=function(){var f=q('mcm9ToolFrame');if(f&&f.src)f.src=f.src;};q('mcm9ToolClose').onclick=function(){closeExtendedTool();};q('mcm9ToolFrame').onload=function(){q('mcm9ToolLoading').hidden=true;};}}
  function openExtendedTool(tool){ensureExtendedTools();var id=selectedId(),n=id&&nodeById(id);if(!n)return;lockSelected(id);var panel=tool==='registry'?9:18;qa('.mcm5-detailtabs button').forEach(function(b){b.classList.toggle('active',b.dataset.mcm9Tool===tool);});var ov=q('mcm5OverviewView'),tv=q('mcm5ToolView'),ev=q('mcm9ExtendedView');if(ov)ov.hidden=true;if(tv)tv.hidden=true;if(ev)ev.hidden=false;setText('mcm9ToolTitle',tool==='registry'?'Editor de Registro':'Software instalado');setText('mcm9ToolSubtitle',nodeName(n)+' · '+(tool==='registry'?'Registro remoto nativo, permissões originais':'Inventário de software do agente'));q('mcm9ToolLoading').hidden=false;var f=q('mcm9ToolFrame');var url=embeddedUrl(n,panel);if(f.dataset.tool!==tool||f.dataset.node!==id){f.dataset.tool=tool;f.dataset.node=id;f.src=url;} }
  function closeExtendedTool(){var ev=q('mcm9ExtendedView');if(ev)ev.hidden=true;var ov=q('mcm5OverviewView');if(ov)ov.hidden=false;qa('.mcm5-detailtabs button').forEach(function(b){b.classList.toggle('active',b.dataset.tool==='overview');});}

  function cacheSoftware(nodeid,apps){if(!nodeid||!Array.isArray(apps))return;var cache=getJson(SOFTWARE_KEY,{});cache[nodeid]={ts:Date.now(),apps:apps.slice(0,1200)};putJson(SOFTWARE_KEY,cache);renderInventory();}
  function scrapeSoftware(){if(!EMBED||EMBED_PANEL!==18||!EMBED_NODE)return;var root=q('p18')||document.querySelector('[id^="p18"]');if(!root)return;var rows=qa('tr',root),apps=[];rows.forEach(function(r){var cells=qa('td',r).map(function(c){return c.textContent.trim();}).filter(Boolean);if(cells.length>=1){var name=cells[0];if(name&&name.length<240&&!/name|software|application/i.test(name))apps.push({name:name,version:cells[1]||'',publisher:cells[2]||'',date:cells[3]||''});}});if(apps.length)try{window.parent.postMessage({source:'meshcommander-v9',type:'softwareInventory',nodeid:EMBED_NODE,apps:apps},window.location.origin);}catch(e){} }
  function findHardware(){return window.hardware||window.sysinfo||(window.currentNode&&window.currentNode.hardware)||null;}
  function encryptionSummary(hw){try{var w=hw&&hw.hardware&&hw.hardware.windows?hw.hardware.windows:(hw&&hw.windows?hw.windows:null);if(!w)return null;var vols=w.volumes;if(!vols)return null;var arr=Array.isArray(vols)?vols:Object.keys(vols).map(function(k){return vols[k];});var fixed=arr.filter(function(v){var t=Number(v&&v.driveType||v&&v.DriveType||0);return !t||t===3;});if(!fixed.length)return null;var encrypted=fixed.some(function(v){var method=Number(v&&v.encryptionMethod||v&&v.EncryptionMethod||0),status=Number(v&&v.volumeStatus||v&&v.VolumeStatus||0);return method>0||status===1||status===2||status===4;});return encrypted?'ok':'bad';}catch(e){return null;}}
  function postHardware(){if(!EMBED||EMBED_PANEL!==17||!EMBED_NODE)return;var hw=findHardware(),enc=encryptionSummary(hw);if(enc)try{window.parent.postMessage({source:'meshcommander-v9',type:'telemetry',nodeid:EMBED_NODE,encryption:enc},window.location.origin);}catch(e){} }
  function installEmbedCollectors(){if(!EMBED)return;if(EMBED_PANEL===18){var obs=new MutationObserver(function(){later(scrapeSoftware,200);});obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true});window.setInterval(scrapeSoftware,2500);}if(EMBED_PANEL===17)window.setInterval(postHardware,1500);}

  function installMessages(){if(EMBED)return;window.addEventListener('message',function(e){if(e.origin!==window.location.origin||!e.data||e.data.source!=='meshcommander-v9')return;if(e.data.type==='softwareInventory')cacheSoftware(e.data.nodeid,e.data.apps);if(e.data.type==='telemetry'){var t=getJson(TELEMETRY_KEY,{});t[e.data.nodeid]={ts:Date.now(),encryption:e.data.encryption};putJson(TELEMETRY_KEY,t);renderCompliance();}},false);}

  function ensureInventoryPage(){var main=document.querySelector('#mcmV5Shell .mcm5-main');if(!main||q('mcm9InventoryPage'))return;var nav=q('mcm7PrimaryNav');if(nav&&!nav.querySelector('[data-mcm9-page="inventory"]')){var b=document.createElement('button');b.dataset.mcm9Page='inventory';b.textContent='Inventário';var activity=nav.querySelector('[data-page="activity"]');nav.insertBefore(b,activity||null);b.onclick=function(){showInventoryPage();};}var page=document.createElement('section');page.id='mcm9InventoryPage';page.className='mcm7-page mcm9-inventory';page.hidden=true;page.innerHTML='<div class="mcm7-pagehead"><div><h1>Inventário e Conformidade</h1><p>Software, duplicidade, segurança e cobertura de telemetria.</p></div></div><div class="mcm9-inventory-grid"><section class="mcm9-card wide"><header><div><b>Pesquisar software</b><small>Índice progressivo: dispositivos são indexados ao abrir a aba Software</small></div><span id="mcm9SoftwareCoverage"></span></header><div class="mcm9-software-search"><input id="mcm9SoftwareSearch" placeholder="Ex.: Chrome, Teams, Java, AnyDesk..."><button id="mcm9SoftwareSearchBtn">Pesquisar</button></div><div id="mcm9SoftwareResults" class="mcm9-software-results"></div></section><section class="mcm9-card"><header><div><b>Máquinas duplicadas</b><small>Nome e UUID, quando disponível</small></div></header><div id="mcm9DupList"></div></section><section class="mcm9-card"><header><div><b>Cobertura de segurança</b><small>AV, BitLocker e last seen</small></div></header><div id="mcm9Coverage"></div></section></div>';main.appendChild(page);q('mcm9SoftwareSearchBtn').onclick=searchSoftware;q('mcm9SoftwareSearch').onkeydown=function(e){if(e.key==='Enter')searchSoftware();};}
  function hideAllPages(){['mcm5DevicesPage','mcm5GroupsPage','mcm5SectionPage','mcm7DashboardPage','mcm7AutomationPage','mcm7ActivityPage','mcm9InventoryPage'].forEach(function(id){var e=q(id);if(e)e.hidden=true;});}
  function showInventoryPage(){ensureInventoryPage();hideAllPages();q('mcm9InventoryPage').hidden=false;qa('#mcm7PrimaryNav button').forEach(function(b){b.classList.toggle('active',b.dataset.mcm9Page==='inventory');});renderInventory();}
  function searchSoftware(){var query=(q('mcm9SoftwareSearch').value||'').trim().toLowerCase(),host=q('mcm9SoftwareResults');if(!query){host.innerHTML='<div class="mcm9-empty">Digite o nome de um software.</div>';return;}var cache=getJson(SOFTWARE_KEY,{}),hits=[];Object.keys(cache).forEach(function(id){var n=nodeById(id),apps=cache[id]&&cache[id].apps||[];var matches=apps.filter(function(a){return [a.name,a.version,a.publisher].join(' ').toLowerCase().indexOf(query)>=0;});if(matches.length)hits.push({id:id,node:n,apps:matches});});host.innerHTML=hits.length?hits.map(function(x){return '<button data-mcm9-softnode="'+esc(x.id)+'"><div><b>'+esc(x.node?nodeName(x.node):x.id)+'</b><small>'+esc(x.node?meshName(x.node):'')+'</small></div><span>'+x.apps.slice(0,3).map(function(a){return esc(a.name+(a.version?' '+a.version:''));}).join('<br>')+'</span></button>';}).join(''):'<div class="mcm9-empty">Nenhum software encontrado no índice atual.</div>';qa('[data-mcm9-softnode]',host).forEach(function(b){b.onclick=function(){openDevice(b.dataset.mcm9Softnode,'software');};});}
  function renderInventory(){if(!q('mcm9InventoryPage'))return;var cache=getJson(SOFTWARE_KEY,{}),tel=getJson(TELEMETRY_KEY,{}),c=compliance(),total=allNodes().length;setText('mcm9SoftwareCoverage',Object.keys(cache).length+' / '+total+' dispositivos indexados');var dup=q('mcm9DupList');if(dup)dup.innerHTML=c.duplicates.length?c.duplicates.slice(0,15).map(function(g){return '<button data-mcm9-dup="'+esc(g.nodes[0]._id)+'"><b>'+esc(g.nodes[0].name||g.key)+'</b><small>'+g.nodes.length+' registros · '+esc(g.type)+'</small></button>';}).join(''):'<div class="mcm9-empty">Nenhuma duplicidade aparente.</div>';qa('[data-mcm9-dup]',dup).forEach(function(b){b.onclick=function(){openDevice(b.dataset.mcm9Dup);};});var cov=q('mcm9Coverage');if(cov)cov.innerHTML='<div><span>Antivírus conhecido</span><b>'+c.avKnown+' / '+total+'</b></div><div><span>BitLocker coletado</span><b>'+c.encKnown+' / '+total+'</b></div><div><span>Last seen desconhecido</span><b>'+c.unknownLast.length+'</b></div><div><span>Software indexado</span><b>'+Object.keys(cache).length+' / '+total+'</b></div>';}

  function selectedNode(){var id=selectedId();return id&&nodeById(id);}
  function isWindows(n){return /windows/i.test(nodeOs(n));}
  var CLEAN_TEMP_PS = "$ErrorActionPreference='SilentlyContinue'; $paths=@($env:TEMP,'C:\\Windows\\Temp') | Where-Object { $_ -and (Test-Path $_) }; foreach($p in $paths){ Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }; Write-Output 'MeshCommander: limpeza de temporarios concluida.'";
  function runCleanTemp(){var n=selectedNode();if(!n){alert('Selecione um dispositivo primeiro.');return;}if(Number(n.conn||0)<=0){alert('O dispositivo precisa estar online.');return;}if(!isWindows(n)){alert('Este playbook está liberado apenas para Windows nesta versão.');return;}if(!window.confirm('Limpar arquivos temporários em '+nodeName(n)+'?\n\nSerão usados apenas %TEMP% e C:\\Windows\\Temp. A ação será registrada pelo MeshCentral.'))return;if(!window.meshserver||typeof window.meshserver.send!=='function'){alert('Canal MeshCentral indisponível.');return;}try{window.meshserver.send({action:'runcommands',nodeids:[n._id],type:2,cmds:CLEAN_TEMP_PS,runAsUser:0,responseid:'mcm-v9-clean-temp'});toast('Limpeza de temporários enviada para '+nodeName(n)+'.');}catch(e){alert('Falha ao enviar ação: '+e.message);}}
  function toast(msg){var h=q('mcm5Toasts');if(!h)return;var e=document.createElement('div');e.className='mcm5-toast';e.textContent=msg;h.appendChild(e);later(function(){e.classList.add('show');},10);later(function(){e.classList.remove('show');later(function(){if(e.parentNode)e.parentNode.removeChild(e);},250);},3200);}
  function installAutomationQuick(){var page=q('mcm7AutomationPage');if(!page||q('mcm9QuickAutomation'))return;var body=q('mcm7AutomationBody')||page;var sec=document.createElement('section');sec.id='mcm9QuickAutomation';sec.className='mcm9-quick-automation';sec.innerHTML='<header><div><b>Ações rápidas</b><small>Playbooks simples usando permissões e auditoria do MeshCentral</small></div><span>SAFE ACTIONS</span></header><div><button id="mcm9CleanTemp"><i>⌁</i><div><b>Limpar temporários</b><small>%TEMP% e C:\\Windows\\Temp · Windows online</small></div><strong>Executar</strong></button><button disabled><i>↻</i><div><b>Reiniciar serviço</b><small>Próxima etapa: catálogo allowlisted</small></div><strong>Em breve</strong></button><button disabled><i>✓</i><div><b>Diagnóstico rápido</b><small>Rede, disco, eventos e agent</small></div><strong>Em breve</strong></button></div>';body.insertBefore(sec,body.firstChild);q('mcm9CleanTemp').onclick=runCleanTemp;}

  function patchTopNav(){ensureInventoryPage();ensureInsights();installAutomationQuick();}

  function bootMain(){if(EMBED)return;var tries=0;(function wait(){tries++;var shell=q('mcmV5Shell'),nav=q('mcm7PrimaryNav');if(!shell||!nav){if(tries<100)return later(wait,120);return;}document.documentElement.setAttribute('data-mc-modern-overlay',VERSION);document.body.classList.add('mcm9-active');installStableGuard();installMessages();patchTopNav();ensureExtendedTools();renderCompliance();renderInventory();window.setInterval(function(){renderCompliance();renderInventory();ensureExtendedTools();},10000);})();}

  if (EMBED) { document.documentElement.setAttribute('data-mc-modern-native',VERSION);document.body.classList.add('mcm9-native');installEmbedCollectors();return; }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootMain,{once:true});else bootMain();
})();
