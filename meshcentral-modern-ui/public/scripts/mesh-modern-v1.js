(function () {
    'use strict';

    var VERSION = 'v3';
    var state = { query: '', filter: 'all', selectedId: null, page: 1, pageSize: 40, shellVisible: true };

    function q(id) { return document.getElementById(id); }
    function txt(v) { return (v == null || v === '') ? '—' : String(v); }
    function esc(v) { return txt(v).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

    function nodeMap() {
        if (window.nodes && typeof window.nodes === 'object') return window.nodes;
        if (window.meshNodes && typeof window.meshNodes === 'object') return window.meshNodes;
        return {};
    }

    function allNodes() {
        var m = nodeMap(), out = [];
        Object.keys(m).forEach(function (k) {
            var n = m[k];
            if (!n || typeof n !== 'object') return;
            if (!n._id) n._id = k;
            out.push(n);
        });
        out.sort(function (a,b) { return txt(a.name || a.host || a._id).localeCompare(txt(b.name || b.host || b._id)); });
        return out;
    }

    function isOnline(n) { return Number(n && n.conn || 0) > 0; }
    function isAttention(n) {
        if (!n) return false;
        if (n.warning || n.warn || n.health === 'warning' || n.health === 'critical') return true;
        if (Array.isArray(n.tags) && n.tags.some(function (x) { return /warn|alert|attention/i.test(x); })) return true;
        return false;
    }
    function statusOf(n) { if (!isOnline(n)) return 'offline'; if (isAttention(n)) return 'attention'; return 'online'; }
    function statusLabel(s) { return s === 'online' ? 'Online' : (s === 'attention' ? 'Atenção' : 'Offline'); }
    function nodeName(n) { return txt(n && (n.name || n.host || n.computerName || n._id)); }
    function nodeIp(n) { return txt(n && (n.ip || n.ipaddr || n.addr || n.host)); }
    function nodeOs(n) { return txt(n && (n.osdesc || n.os || n.platform || n.agent && n.agent.name)); }
    function amtVersion(n) {
        var a = n && n.intelamt;
        if (!a) return '—';
        return txt(a.ver || a.version || a.vers || a.Version);
    }
    function meshName(n) {
        try {
            var m = window.meshes && n && n.meshid ? window.meshes[n.meshid] : null;
            return txt(m && (m.name || m.mname));
        } catch (e) { return '—'; }
    }

    function filteredNodes() {
        var list = allNodes();
        var query = state.query.trim().toLowerCase();
        return list.filter(function (n) {
            var s = statusOf(n);
            if (state.filter !== 'all' && state.filter !== s) return false;
            if (!query) return true;
            var hay = [nodeName(n), nodeIp(n), nodeOs(n), meshName(n), (n.tags || []).join(' ')].join(' ').toLowerCase();
            return hay.indexOf(query) >= 0;
        });
    }

    function counts() {
        var list = allNodes(), online = 0, attention = 0, offline = 0;
        list.forEach(function (n) {
            var s = statusOf(n);
            if (s === 'online') online++; else if (s === 'attention') attention++; else offline++;
        });
        return { total: list.length, online: online, attention: attention, offline: offline };
    }

    function buildShell() {
        if (q('mcmV3Shell')) return;
        var shell = document.createElement('div');
        shell.id = 'mcmV3Shell';
        shell.innerHTML = [
            '<aside class="mcm3-sidebar">',
              '<div class="mcm3-brand"><div class="mcm3-brandmark">M</div><div><b>MeshCommander</b><span>Remote Management</span></div></div>',
              '<nav class="mcm3-nav">',
                '<button class="mcm3-navitem active" data-native="LeftMenuMyDevices"><span>▣</span><b>Dispositivos</b></button>',
                '<button class="mcm3-navitem" data-native="LeftMenuMyAccount"><span>◎</span><b>Minha Conta</b></button>',
                '<button class="mcm3-navitem" data-native="LeftMenuMyEvents"><span>◷</span><b>Eventos</b></button>',
                '<button class="mcm3-navitem" data-native="LeftMenuMyFiles"><span>▤</span><b>Arquivos</b></button>',
                '<button class="mcm3-navitem" data-native="LeftMenuMyUsers"><span>♙</span><b>Usuários</b></button>',
                '<button class="mcm3-navitem" data-native="LeftMenuMyServer"><span>⚙</span><b>Servidor</b></button>',
              '</nav>',
              '<div class="mcm3-sidebar-footer"><small>Conectado como</small><div class="mcm3-user"><span class="mcm3-avatar">A</span><div><b id="mcm3UserName">admin</b><small>Administrator</small></div></div><div class="mcm3-version">MeshCentral 1.2.5 · UI '+VERSION+'</div></div>',
            '</aside>',
            '<section class="mcm3-app">',
              '<header class="mcm3-topbar"><div class="mcm3-global-search">⌕ <input id="mcm3GlobalSearch" placeholder="Buscar dispositivos, grupos ou tags..."><kbd>Ctrl + K</kbd></div><div class="mcm3-top-actions"><span>◔</span><span>◌</span><span class="mcm3-avatar small">A</span><b>admin</b></div></header>',
              '<main class="mcm3-main">',
                '<div class="mcm3-pagehead"><div><h1>Dispositivos</h1><p>Gerencie e monitore seus dispositivos conectados ao MeshCentral</p></div><button id="mcm3NativeView" class="mcm3-btn primary">Abrir visão nativa</button></div>',
                '<section class="mcm3-stats">',
                  '<article><span class="mcm3-stat-icon blue">▣</span><div><strong id="mcm3Total">0</strong><b>Dispositivos</b><small id="mcm3TotalSub">—</small></div></article>',
                  '<article><span class="mcm3-stat-icon green">✓</span><div><strong id="mcm3Online">0</strong><b>Online</b><small>Com agente conectado</small></div></article>',
                  '<article><span class="mcm3-stat-icon amber">△</span><div><strong id="mcm3Attention">0</strong><b>Atenção</b><small>Requer verificação</small></div></article>',
                  '<article><span class="mcm3-stat-icon red">!</span><div><strong id="mcm3Offline">0</strong><b>Offline</b><small>Sem comunicação</small></div></article>',
                '</section>',
                '<section class="mcm3-workspace">',
                  '<aside class="mcm3-devicepane">',
                    '<div class="mcm3-tabs"><button data-filter="all" class="active">Todos</button><button data-filter="online">Online</button><button data-filter="attention">Atenção</button><button data-filter="offline">Offline</button></div>',
                    '<div class="mcm3-local-search">⌕ <input id="mcm3LocalSearch" placeholder="Buscar dispositivos..."></div>',
                    '<div class="mcm3-listhead"><span>Nome</span><span>Status</span><span>IP</span></div>',
                    '<div id="mcm3DeviceList" class="mcm3-devicelist"></div>',
                    '<div class="mcm3-listfooter"><span id="mcm3Range">0 dispositivos</span><div><button id="mcm3Prev">‹</button><span id="mcm3Page">1</span><button id="mcm3Next">›</button></div></div>',
                  '</aside>',
                  '<section class="mcm3-detailpane">',
                    '<div class="mcm3-devicehead"><div class="mcm3-device-title"><span class="mcm3-device-icon">▣</span><div><h2 id="mcm3DeviceName">Selecione um dispositivo</h2><p id="mcm3DeviceMeta">Escolha um item na lista à esquerda</p></div></div><button id="mcm3OpenDevice" class="mcm3-btn">Abrir dispositivo</button></div>',
                    '<div class="mcm3-detailtabs"><button class="active" data-tool="overview">Visão Geral</button><button data-tool="desktop">Desktop</button><button data-tool="terminal">Terminal</button><button data-tool="files">Arquivos</button><button data-tool="events">Eventos</button><button data-tool="details">Detalhes</button></div>',
                    '<div class="mcm3-detailgrid">',
                      '<section class="mcm3-remote-card">',
                        '<div class="mcm3-cardhead"><b>Console Remoto</b><span id="mcm3RemoteState" class="mcm3-pill muted">Selecione um dispositivo</span></div>',
                        '<div class="mcm3-remote-preview"><div class="mcm3-screen"><div class="mcm3-screen-icon">▣</div><h3 id="mcm3ScreenTitle">Remote Desktop</h3><p id="mcm3ScreenText">Abra uma sessão Desktop usando o motor nativo do MeshCentral.</p></div></div>',
                        '<div class="mcm3-remote-actions"><button id="mcm3Connect" class="mcm3-btn primary">Conectar</button><button data-tool="desktop" class="mcm3-btn">Tela cheia</button><button id="mcm3NativeTools" class="mcm3-btn">Ferramentas nativas</button></div>',
                      '</section>',
                      '<aside class="mcm3-info-stack">',
                        '<section class="mcm3-info-card"><div class="mcm3-cardhead"><b>Informações do Dispositivo</b></div><dl id="mcm3Info"></dl></section>',
                        '<section class="mcm3-info-card"><div class="mcm3-cardhead"><b>Saúde do Dispositivo</b><span id="mcm3HealthPill" class="mcm3-pill muted">—</span></div><div id="mcm3Health" class="mcm3-health"></div></section>',
                      '</aside>',
                    '</div>',
                    '<div class="mcm3-quick-actions">',
                      '<article><span class="green">⏻</span><div><b>Ligar</b><small>Ação de energia</small></div><button data-power="on">Abrir</button></article>',
                      '<article><span class="red">⏻</span><div><b>Desligar</b><small>Ação de energia</small></div><button data-power="off">Abrir</button></article>',
                      '<article><span class="blue">↻</span><div><b>Reiniciar</b><small>Ação de energia</small></div><button data-power="reset">Abrir</button></article>',
                      '<article><span class="amber">⚡</span><div><b>Intel AMT</b><small>Energia e redirecionamento</small></div><button data-tool="details">Abrir</button></article>',
                    '</div>',
                  '</section>',
                '</section>',
              '</main>',
            '</section>'
        ].join('');
        document.body.appendChild(shell);
        document.body.classList.add('mcm-v3-active');
        document.documentElement.setAttribute('data-mc-modern-overlay', VERSION);
        bindEvents();
    }

    function bindEvents() {
        q('mcm3GlobalSearch').addEventListener('input', function (e) { state.query = e.target.value; state.page = 1; q('mcm3LocalSearch').value = e.target.value; render(); });
        q('mcm3LocalSearch').addEventListener('input', function (e) { state.query = e.target.value; state.page = 1; q('mcm3GlobalSearch').value = e.target.value; render(); });
        document.querySelectorAll('.mcm3-tabs button').forEach(function (b) { b.addEventListener('click', function () { document.querySelectorAll('.mcm3-tabs button').forEach(function(x){x.classList.remove('active');}); b.classList.add('active'); state.filter = b.dataset.filter; state.page = 1; render(); }); });
        document.querySelectorAll('.mcm3-navitem').forEach(function (b) { b.addEventListener('click', function () { if (b.dataset.native === 'LeftMenuMyDevices') return; openNativeSection(b.dataset.native); }); });
        document.querySelectorAll('[data-tool]').forEach(function (b) { b.addEventListener('click', function () { openDeviceTool(b.dataset.tool); }); });
        document.querySelectorAll('[data-power]').forEach(function (b) { b.addEventListener('click', function () { openDeviceTool('details'); }); });
        q('mcm3Prev').addEventListener('click', function(){ if(state.page>1){state.page--;render();} });
        q('mcm3Next').addEventListener('click', function(){ var pages=Math.max(1,Math.ceil(filteredNodes().length/state.pageSize)); if(state.page<pages){state.page++;render();} });
        q('mcm3OpenDevice').addEventListener('click', function(){ openDeviceTool('overview'); });
        q('mcm3Connect').addEventListener('click', function(){ openDeviceTool('desktop'); });
        q('mcm3NativeTools').addEventListener('click', function(){ openDeviceTool('overview'); });
        q('mcm3NativeView').addEventListener('click', function(){ setShellVisible(false); });
        document.addEventListener('keydown', function(e){ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();q('mcm3GlobalSearch').focus();} });
    }

    function setShellVisible(show) {
        state.shellVisible = show;
        var shell = q('mcmV3Shell'); if (shell) shell.style.display = show ? 'grid' : 'none';
        document.body.classList.toggle('mcm-v3-active', show);
        if (!show && !q('mcmV3Return')) {
            var r = document.createElement('button'); r.id='mcmV3Return'; r.textContent='Voltar ao Command Center'; r.className='mcm3-return'; r.onclick=function(){setShellVisible(true);}; document.body.appendChild(r);
        }
        if (q('mcmV3Return')) q('mcmV3Return').style.display = show ? 'none' : 'block';
    }

    function openNativeSection(id) {
        setShellVisible(false);
        setTimeout(function(){ var el=q(id); if(el && typeof el.click==='function') el.click(); },50);
    }

    function selectedNode() {
        var list = allNodes();
        for (var i=0;i<list.length;i++) if (list[i]._id === state.selectedId) return list[i];
        return null;
    }

    function nativeNodeUrl(n) {
        if (!n) return window.location.href;
        var u = new URL(window.location.href);
        u.searchParams.set('viewmode','10');
        u.searchParams.set('gotonode', n._id);
        return u.toString();
    }

    function openDeviceTool(tool) {
        var n = selectedNode(); if (!n) return;
        try {
            if (typeof window.gotoDevice === 'function') { window.gotoDevice(n._id); setShellVisible(false); return; }
            if (typeof window.gotoNode === 'function') { window.gotoNode(n._id); setShellVisible(false); return; }
        } catch(e) {}
        window.location.href = nativeNodeUrl(n);
    }

    function render() {
        var c = counts();
        q('mcm3Total').textContent = c.total; q('mcm3Online').textContent = c.online; q('mcm3Attention').textContent = c.attention; q('mcm3Offline').textContent = c.offline;
        q('mcm3TotalSub').textContent = c.online + ' Online · ' + c.offline + ' Offline';
        var list = filteredNodes(), pages = Math.max(1, Math.ceil(list.length/state.pageSize));
        if (state.page > pages) state.page = pages;
        var start=(state.page-1)*state.pageSize, slice=list.slice(start,start+state.pageSize);
        var holder=q('mcm3DeviceList'); holder.innerHTML='';
        slice.forEach(function(n){
            var row=document.createElement('button'); row.className='mcm3-device-row'+(n._id===state.selectedId?' selected':''); row.dataset.id=n._id;
            var st=statusOf(n);
            row.innerHTML='<span class="mcm3-device-name"><i>▣</i><b>'+esc(nodeName(n))+'</b></span><span class="mcm3-status '+st+'"><i></i>'+statusLabel(st)+'</span><span class="mcm3-ip">'+esc(nodeIp(n))+'</span>';
            row.addEventListener('click',function(){state.selectedId=n._id;render();}); holder.appendChild(row);
        });
        q('mcm3Range').textContent = list.length ? (start+1)+'–'+Math.min(start+state.pageSize,list.length)+' de '+list.length : '0 dispositivos';
        q('mcm3Page').textContent = state.page+' / '+pages;
        q('mcm3Prev').disabled=state.page<=1; q('mcm3Next').disabled=state.page>=pages;
        if (!state.selectedId && list.length) state.selectedId=list[0]._id;
        renderDetail(selectedNode());
    }

    function renderDetail(n) {
        if (!n) {
            q('mcm3DeviceName').textContent='Selecione um dispositivo'; q('mcm3DeviceMeta').textContent='Escolha um item na lista à esquerda'; q('mcm3Info').innerHTML=''; q('mcm3Health').innerHTML=''; return;
        }
        var st=statusOf(n), stLabel=statusLabel(st);
        q('mcm3DeviceName').textContent=nodeName(n);
        q('mcm3DeviceMeta').textContent=[nodeIp(n), meshName(n), nodeOs(n)].filter(function(x){return x&&x!=='—';}).join('  |  ') || 'MeshCentral device';
        q('mcm3RemoteState').className='mcm3-pill '+st; q('mcm3RemoteState').textContent=stLabel;
        q('mcm3ScreenTitle').textContent=nodeName(n); q('mcm3ScreenText').textContent=isOnline(n)?'Dispositivo conectado. Abra Desktop para iniciar a sessão remota nativa.':'Dispositivo offline. A sessão remota ficará disponível quando o agente reconectar.';
        q('mcm3Info').innerHTML = [
            ['Nome',nodeName(n)],['Estado',stLabel],['Endereço IP',nodeIp(n)],['Grupo',meshName(n)],['Sistema Operacional',nodeOs(n)],['Intel AMT',amtVersion(n)],['Node ID',n._id]
        ].map(function(x){return '<div><dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd></div>';}).join('');
        q('mcm3HealthPill').className='mcm3-pill '+(st==='online'?'online':st); q('mcm3HealthPill').textContent=st==='online'?'Saudável':stLabel;
        var bars = st==='offline' ? [0,0,0] : [92,78,86];
        q('mcm3Health').innerHTML='<div><span>Conectividade</span><b>'+ (isOnline(n)?'Ativa':'Offline') +'</b></div><div class="mcm3-meter"><i style="width:'+bars[0]+'%"></i></div><div><span>Agente</span><b>'+txt(n.agent && (n.agent.ver || n.agent.version || 'Conectado'))+'</b></div><div class="mcm3-meter"><i style="width:'+bars[1]+'%"></i></div><div><span>Intel AMT</span><b>'+amtVersion(n)+'</b></div><div class="mcm3-meter"><i style="width:'+bars[2]+'%"></i></div>';
    }

    function activate() {
        if (!document.body) return;
        document.body.classList.add('mc-modern-v1');
        buildShell();
        render();
        setTimeout(render,500);
        setTimeout(render,1800);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate, {once:true}); else activate();
    window.addEventListener('load', activate, {once:true});
    setInterval(function(){ if(q('mcmV3Shell') && state.shellVisible) render(); }, 5000);
})();
