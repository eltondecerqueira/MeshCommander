(function () {
  'use strict';

  var VERSION = 'v8';
  var params = new URLSearchParams(window.location.search);
  var EMBED = params.get('mcmembed') === '1';
  var SEARCH_LIMIT = 10;
  var STABLE_DELAY = 1400;
  var stableNodes = Object.create(null);
  var candidates = Object.create(null);
  var lockedNodeId = null;
  var applyingStable = false;
  var userNavigated = false;

  function q(id) { return document.getElementById(id); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function text(v) { return (v == null || v === '') ? '—' : String(v); }
  function esc(v) { return text(v).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function later(fn, ms) { window.setTimeout(function () { try { fn(); } catch (e) {} }, ms || 0); }
  function nodeMap() { return (window.nodes && typeof window.nodes === 'object') ? window.nodes : ((window.meshNodes && typeof window.meshNodes === 'object') ? window.meshNodes : {}); }
  function meshMap() { return (window.meshes && typeof window.meshes === 'object') ? window.meshes : {}; }
  function meshName(n) { var m = n && n.meshid ? meshMap()[n.meshid] : null; return text(m && (m.name || m.mname)); }
  function nodeName(n) { return text(n && (n.name || n.host || n.computerName || n._id)); }
  function nodeIp(n) { return text(n && (n.ip || n.ipaddr || n.addr || n.host)); }
  function nodeOs(n) { return text(n && (n.osdesc || n.os || n.platform || (n.agent && n.agent.name))); }
  function agentVersion(n) { var a = n && n.agent; return a ? text(a.ver || a.version || a.id || 'Detectado') : '—'; }
  function amtVersion(n) { var a = n && n.intelamt; return a ? text(a.ver || a.version || a.vers || a.Version) : '—'; }
  function statusOf(n) { return Number(n && n.conn || 0) > 0 ? ((n.warning || n.warn || n.health === 'warning' || n.health === 'critical') ? 'attention' : 'online') : 'offline'; }
  function statusLabel(s) { return s === 'online' ? 'Online' : (s === 'attention' ? 'Atenção' : 'Offline'); }
  function caps(n) { return Number(n && n.agent && n.agent.caps || 0); }

  function snapshot(n, id) {
    if (!n) return null;
    var s = statusOf(n);
    var snap = {
      id:id || n._id,
      name:nodeName(n),
      ip:nodeIp(n),
      os:nodeOs(n),
      group:meshName(n),
      status:s,
      agent:agentVersion(n),
      amt:amtVersion(n),
      caps:caps(n),
      hasAmt:!!n.intelamt
    };
    snap.fp = [snap.name,snap.ip,snap.os,snap.group,snap.status,snap.agent,snap.amt,snap.caps].join('|');
    return snap;
  }

  function sampleStableNodes() {
    var now = Date.now(), map = nodeMap();
    Object.keys(map).forEach(function (id) {
      var snap = snapshot(map[id], id); if (!snap) return;
      var stable = stableNodes[id];
      if (!stable) { stableNodes[id] = snap; delete candidates[id]; return; }
      if (stable.fp === snap.fp) { delete candidates[id]; return; }
      var c = candidates[id];
      if (!c || c.snap.fp !== snap.fp) { candidates[id] = { snap:snap, since:now }; return; }
      if ((now - c.since) >= STABLE_DELAY) { stableNodes[id] = snap; delete candidates[id]; }
    });
    applyStableUi();
  }

  function selectedId() {
    if (lockedNodeId) return lockedNodeId;
    var active = document.querySelector('.mcm5-device-row.active[data-nodeid]');
    if (active) return active.dataset.nodeid;
    try {
      var st = JSON.parse(sessionStorage.getItem('meshcommander-v5-state') || '{}');
      return st.selectedId || null;
    } catch (e) { return null; }
  }

  function setLockedNode(id) {
    if (!id) return;
    lockedNodeId = id;
    try { sessionStorage.setItem('meshcommander-v8-selected', id); } catch (e) {}
  }

  function restoreLockedNode() {
    try { lockedNodeId = sessionStorage.getItem('meshcommander-v8-selected') || null; } catch (e) {}
  }

  function ensureV5Selection() {
    if (!lockedNodeId) return;
    var active = document.querySelector('.mcm5-device-row.active[data-nodeid]');
    if (active && active.dataset.nodeid === lockedNodeId) return;
    var row = document.querySelector('.mcm5-device-row[data-nodeid="' + cssEscape(lockedNodeId) + '"]');
    if (row && !row.dataset.mcm8Syncing) {
      row.dataset.mcm8Syncing = '1';
      row.click();
      later(function () { delete row.dataset.mcm8Syncing; }, 100);
    }
  }

  function cssEscape(v) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(v));
    return String(v).replace(/["\\]/g, '\\$&');
  }

  function setText(id, value) { var el=q(id); if (el && el.textContent !== value) el.textContent=value; }
  function setClass(id, cls) { var el=q(id); if (el && el.className !== cls) el.className=cls; }

  function applyStableUi() {
    if (EMBED || applyingStable) return;
    var id = selectedId(), n = id && stableNodes[id]; if (!n) return;
    applyingStable = true;
    try {
      setText('mcm5DeviceName', n.name);
      setText('mcm5DeviceMeta', [n.ip,n.group,n.os].filter(function(x){return x && x !== '—';}).join('  |  ') || '—');
      setText('mcm5DeviceStatus', statusLabel(n.status));
      setClass('mcm5DeviceStatus', 'mcm5-pill ' + n.status);
      setText('mcm5ScreenTitle', n.name);
      setText('mcm5RemoteState', statusLabel(n.status));
      setClass('mcm5RemoteState', 'mcm5-pill ' + n.status);
      setText('mcm5HealthPill', statusLabel(n.status));
      setClass('mcm5HealthPill', 'mcm5-pill ' + n.status);

      var info=q('mcm5Info');
      if (info) {
        var html = [
          ['Nome',n.name],['Estado',statusLabel(n.status)],['Endereço IP',n.ip],['Grupo',n.group],
          ['Sistema Operacional',n.os],['Agente',n.agent],['Intel AMT',n.amt],['Node ID',id]
        ].map(function(x){return '<div><dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd></div>';}).join('');
        if (info.innerHTML !== html) info.innerHTML = html;
      }
      var health=q('mcm5Health');
      if (health) {
        var desktop = !!(n.caps & 1) || n.hasAmt, terminal=!!(n.caps & 2), files=!!(n.caps & 4), consoleCap=!!(n.caps & 8);
        var hh = [
          '<div><span>Conectividade</span><b class="'+n.status+'">'+statusLabel(n.status)+'</b></div>',
          '<div><span>Desktop</span><b class="'+(desktop?'online':'')+'">'+(desktop?'Disponível':'Não detectado')+'</b></div>',
          '<div><span>Terminal</span><b class="'+(terminal?'online':'')+'">'+(terminal?'Disponível':'Não detectado')+'</b></div>',
          '<div><span>Arquivos</span><b class="'+(files?'online':'')+'">'+(files?'Disponível':'Não detectado')+'</b></div>',
          '<div><span>Console</span><b>'+(consoleCap?'Disponível':'—')+'</b></div>',
          '<div><span>Intel AMT</span><b>'+esc(n.amt)+'</b></div>'
        ].join('');
        if (health.innerHTML !== hh) health.innerHTML = hh;
      }

      qa('.mcm5-device-row[data-nodeid]').forEach(function(row){
        var sn=stableNodes[row.dataset.nodeid]; if(!sn)return;
        var name=row.querySelector('.mcm5-dev-name b'); if(name && name.textContent!==sn.name)name.textContent=sn.name;
        var ip=row.querySelector('.mcm5-ip'); if(ip && ip.textContent!==sn.ip)ip.textContent=sn.ip;
        var st=row.querySelector('.mcm5-status'); if(st){st.className='mcm5-status '+sn.status; st.innerHTML='<i></i>'+statusLabel(sn.status);}
      });
      ensureV5Selection();
    } finally { applyingStable=false; }
  }

  function installDetailObserver() {
    var pane=document.querySelector('.mcm5-detailpane'); if(!pane || pane.dataset.mcm8Observed)return;
    pane.dataset.mcm8Observed='1';
    var obs=new MutationObserver(function(){ if(applyingStable)return; later(applyStableUi,0); });
    obs.observe(pane,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  }

  function allNodesForSearch() {
    var map=nodeMap(), out=[];
    Object.keys(map).forEach(function(id){var n=map[id];if(n)out.push({id:id,n:n});});
    return out;
  }

  function installSearch() {
    var input=q('mcm5GlobalSearch'); if(!input || q('mcm8SearchResults'))return;
    var host=input.closest('.mcm5-global-search') || input.parentElement;
    host.classList.add('mcm8-search-host');
    var box=document.createElement('div'); box.id='mcm8SearchResults'; box.className='mcm8-search-results'; box.hidden=true; host.appendChild(box);

    function render() {
      var query=input.value.trim().toLowerCase();
      if(!query){box.hidden=true;box.innerHTML='';return;}
      var deviceMatches=allNodesForSearch().filter(function(x){var n=x.n;return [nodeName(n),nodeIp(n),nodeOs(n),meshName(n),(n.tags||[]).join(' ')].join(' ').toLowerCase().indexOf(query)>=0;}).slice(0,SEARCH_LIMIT);
      var groups=Object.keys(meshMap()).map(function(id){return{id:id,name:text(meshMap()[id]&&(meshMap()[id].name||meshMap()[id].mname))};}).filter(function(g){return g.name.toLowerCase().indexOf(query)>=0;}).slice(0,4);
      var html='';
      if(deviceMatches.length){html+='<div class="mcm8-search-section"><span>Dispositivos</span>';deviceMatches.forEach(function(x){var s=statusOf(x.n);html+='<button data-mcm8-node="'+esc(x.id)+'"><i class="'+s+'"></i><div><b>'+esc(nodeName(x.n))+'</b><small>'+esc(meshName(x.n))+' · '+esc(nodeIp(x.n))+'</small></div><em>'+statusLabel(s)+'</em></button>';});html+='</div>';}
      if(groups.length){html+='<div class="mcm8-search-section"><span>Grupos</span>';groups.forEach(function(g){html+='<button data-mcm8-group="'+esc(g.id)+'"><i class="group"></i><div><b>'+esc(g.name)+'</b><small>Abrir dispositivos deste grupo</small></div><em>Grupo</em></button>';});html+='</div>';}
      if(!html)html='<div class="mcm8-search-empty">Nenhum resultado encontrado.</div>';
      box.innerHTML=html; box.hidden=false;
    }

    function openNode(id) {
      setLockedNode(id); userNavigated=true;
      var top=document.querySelector('#mcm7PrimaryNav [data-page="devices"]'); if(top)top.click();
      later(function(){
        var all=document.querySelector('.mcm5-tabs [data-filter="all"]'); if(all)all.click();
        var group=q('mcm5GroupFilter'); if(group){group.value='all';group.dispatchEvent(new Event('change',{bubbles:true}));}
        var local=q('mcm5LocalSearch'); var n=nodeMap()[id]; if(local&&n){local.value=nodeName(n);local.dispatchEvent(new Event('input',{bubbles:true}));}
        later(function(){var row=document.querySelector('.mcm5-device-row[data-nodeid="'+cssEscape(id)+'"]');if(row)row.click();},120);
      },80);
      box.hidden=true;
    }

    function openGroup(id) {
      userNavigated=true;
      var top=document.querySelector('#mcm7PrimaryNav [data-page="devices"]'); if(top)top.click();
      later(function(){var group=q('mcm5GroupFilter');if(group){group.value=id;group.dispatchEvent(new Event('change',{bubbles:true}));}},100);
      box.hidden=true;
    }

    input.addEventListener('input',render,true);
    input.addEventListener('focus',render,true);
    input.addEventListener('keydown',function(e){
      if(e.key==='Escape'){box.hidden=true;return;}
      if(e.key==='Enter'&&!box.hidden){var first=box.querySelector('button');if(first){e.preventDefault();first.click();}}
    },true);
    box.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.dataset.mcm8Node)openNode(b.dataset.mcm8Node);else if(b.dataset.mcm8Group)openGroup(b.dataset.mcm8Group);});
    document.addEventListener('click',function(e){if(!host.contains(e.target))box.hidden=true;});
    document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();render();}},true);
  }

  function forceOperationsLanding() {
    if (EMBED || userNavigated) return;
    var nav=document.querySelector('#mcm7PrimaryNav [data-page="dashboard"]');
    if(nav){nav.click();try{sessionStorage.setItem('meshcommander-v8-page','dashboard');}catch(e){}}
  }

  function installLandingGuard() {
    var nav=q('mcm7PrimaryNav'); if(nav){nav.addEventListener('click',function(e){if(e.target.closest('[data-page]'))userNavigated=true;},true);}
    later(forceOperationsLanding,150);
    later(forceOperationsLanding,650);
    window.addEventListener('load',function(){later(forceOperationsLanding,700);},{once:true});
  }

  function normalizeNativeDialog() {
    var dlg=q('dialog'); if(!dlg)return;
    var visible=window.getComputedStyle(dlg).display!=='none';
    document.body.classList.toggle('mcm8-native-dialog-open',visible);
    dlg.classList.toggle('mcm8-integrated-dialog',visible);
    var editor=q('d4editorarea');
    dlg.classList.toggle('mcm8-file-editor-dialog',!!(visible&&editor));
    if(editor){editor.classList.add('mcm8-file-editor-area');editor.setAttribute('spellcheck','false');}
  }

  function installNativeDialogObserver() {
    var dlg=q('dialog');
    if(!dlg){later(installNativeDialogObserver,300);return;}
    normalizeNativeDialog();
    var obs=new MutationObserver(function(){later(normalizeNativeDialog,0);});
    obs.observe(dlg,{attributes:true,attributeFilter:['style','class'],childList:true,subtree:true});
    document.addEventListener('keydown',function(e){if(e.key==='Escape')later(normalizeNativeDialog,50);},true);
  }

  function makeNativeHeadless() {
    document.documentElement.setAttribute('data-mc-modern-native',VERSION);
    document.body.classList.add('mcm8-native-headless');
    var badge=q('mcm6NativeBadge');if(badge)badge.remove();
    installNativeDialogObserver();
  }

  function bootMain() {
    document.documentElement.setAttribute('data-mc-modern-overlay',VERSION);
    document.body.classList.add('mcm8-active');
    restoreLockedNode();
    installSearch(); installLandingGuard(); installDetailObserver();
    sampleStableNodes();
    window.setInterval(sampleStableNodes,450);
    document.addEventListener('click',function(e){var row=e.target.closest('.mcm5-device-row[data-nodeid]');if(row&&!row.dataset.mcm8Syncing)setLockedNode(row.dataset.nodeid);},true);
    var version=document.querySelector('.mcm5-version');if(version)version.textContent='UI v8 · Service Desk Preview';
  }

  function waitMain() {
    var tries=0;(function retry(){tries++;if(q('mcmV5Shell')&&q('mcm7PrimaryNav')){bootMain();return;}if(tries<80)later(retry,100);})();
  }

  if (EMBED) {
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',makeNativeHeadless,{once:true});else makeNativeHeadless();
  } else {
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',waitMain,{once:true});else waitMain();
  }
})();
