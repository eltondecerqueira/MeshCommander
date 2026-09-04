(function () {
    'use strict';

    var VERSION = 'v4';
    var urlParams = new URLSearchParams(window.location.search);
    var EMBED_MODE = urlParams.get('mcmembed') === '1';

    function q(id) { return document.getElementById(id); }
    function txt(v) { return (v == null || v === '') ? '—' : String(v); }
    function esc(v) { return txt(v).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
    function later(fn, delay) { window.setTimeout(function () { try { fn(); } catch (e) {} }, delay || 0); }

    var panelMap = {
        overview: 10,
        desktop: 11,
        terminal: 12,
        files: 13,
        console: 15,
        events: 16,
        details: 17
    };

    function setupEmbeddedNative() {
        function activateEmbed() {
            if (!document.body) return;
            document.body.classList.add('mcm-embedded-native');
            document.documentElement.setAttribute('data-mc-modern-embed', VERSION);
        }

        function runNavigation() {
            activateEmbed();
            var section = urlParams.get('mcmsection');
            var nodeid = urlParams.get('mcmnode');
            var panel = parseInt(urlParams.get('mcmpanel') || '10', 10);
            var auto = urlParams.get('mcmauto');

            if (section) {
                var sectionEl = q(section);
                if (sectionEl && typeof sectionEl.click === 'function') {
                    sectionEl.click();
                    return true;
                }
                return false;
            }

            if (nodeid && typeof window.gotoDevice === 'function') {
                try {
                    window.gotoDevice(nodeid, panel, true);
                    if (auto) {
                        later(function () {
                            try {
                                if (auto === 'desktop' && typeof window.connectDesktop === 'function' && window.desktop == null) window.connectDesktop(null, 3);
                                if (auto === 'terminal' && typeof window.connectTerminal === 'function' && window.terminal == null) window.connectTerminal(null, 1);
                                if (auto === 'files' && typeof window.connectFiles === 'function' && window.files == null) window.connectFiles(null);
                                if (auto === 'power' && typeof window.showPowerActionDlg === 'function') window.showPowerActionDlg();
                            } catch (e) {}
                        }, 700);
                    }
                    return true;
                } catch (e) {}
            }
            return false;
        }

        activateEmbed();
        var tries = 0;
        function retry() {
            tries++;
            if (runNavigation() || tries > 25) return;
            later(retry, 200);
        }
        if (document.readyState === 'complete') later(retry, 100);
        else window.addEventListener('load', function () { later(retry, 100); }, { once: true });
        return;
    }

    if (EMBED_MODE) {
        setupEmbeddedNative();
        return;
    }

    var state = {
        query: '',
        filter: 'all',
        selectedId: null,
        page: 1,
        pageSize: 40,
        shellVisible: true,
        tool: 'overview',
        section: 'devices'
    };

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
        out.sort(function (a, b) { return txt(a.name || a.host || a._id).localeCompare(txt(b.name || b.host || b._id)); });
        return out;
    }

    function isOnline(n) { return Number((n && n.conn) || 0) > 0; }
    function isAttention(n) {
        if (!n || !isOnline(n)) return false;
        if (n.warning || n.warn || n.health === 'warning' || n.health === 'critical') return true;
        if (Array.isArray(n.tags) && n.tags.some(function (x) { return /warn|alert|attention|critical/i.test(String(x)); })) return true;
        return false;
    }
    function statusOf(n) { if (!isOnline(n)) return 'offline'; if (isAttention(n)) return 'attention'; return 'online'; }
    function statusLabel(s) { return s === 'online' ? 'Online' : (s === 'attention' ? 'Atenção' : 'Offline'); }
    function nodeName(n) { return txt(n && (n.name || n.host || n.computerName || n._id)); }
    function nodeIp(n) { return txt(n && (n.ip || n.ipaddr || n.addr || n.host)); }
    function nodeOs(n) { return txt(n && (n.osdesc || n.os || n.platform || (n.agent && n.agent.name))); }
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
    function shortNodeId(n) {
        var id = n && n._id ? String(n._id) : '';
        var p = id.split('/');
        return p[p.length - 1] || id;
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

    function currentUserName() {
        try { return txt((window.userinfo && (window.userinfo.name || window.userinfo.realname)) || 'admin'); } catch (e) { return 'admin'; }
    }

    function buildShell() {
        if (q('mcmV4Shell')) return;
        var shell = document.createElement('div');
        shell.id = 'mcmV4Shell';
        shell.innerHTML = [
            '<aside class="mcm4-sidebar">',
              '<div class="mcm4-brand"><div class="mcm4-brandmark">M</div><div><b>MeshCommander</b><span>Remote Management</span></div></div>',
              '<nav class="mcm4-nav">',
                '<button class="mcm4-navitem active" data-section="devices"><span>▣</span><b>Dispositivos</b></button>',
                '<button class="mcm4-navitem" data-section="native" data-native="LeftMenuMyAccount" data-label="Minha Conta"><span>◎</span><b>Minha Conta</b></button>',
                '<button class="mcm4-navitem" data-section="native" data-native="LeftMenuMyEvents" data-label="Eventos"><span>◷</span><b>Eventos</b></button>',
                '<button class="mcm4-navitem" data-section="native" data-native="LeftMenuMyFiles" data-label="Arquivos"><span>▤</span><b>Arquivos</b></button>',
                '<button class="mcm4-navitem" data-section="native" data-native="LeftMenuMyUsers" data-label="Usuários"><span>♙</span><b>Usuários</b></button>',
                '<button class="mcm4-navitem" data-section="native" data-native="LeftMenuMyServer" data-label="Servidor"><span>⚙</span><b>Servidor</b></button>',
              '</nav>',
              '<div class="mcm4-sidebar-footer"><small>Conectado como</small><div class="mcm4-user"><span class="mcm4-avatar">A</span><div><b id="mcm4UserName">admin</b><small>Administrator</small></div></div><div class="mcm4-version">MeshCentral 1.2.5 · UI '+VERSION+'</div></div>',
            '</aside>',
            '<section class="mcm4-app">',
              '<header class="mcm4-topbar"><div class="mcm4-global-search">⌕ <input id="mcm4GlobalSearch" placeholder="Buscar dispositivos, grupos ou tags..."><kbd>Ctrl + K</kbd></div><div class="mcm4-top-actions"><button id="mcm4UiSettings" title="Configurações da interface">◔</button><span>◌</span><span class="mcm4-avatar small">A</span><b id="mcm4TopUser">admin</b></div></header>',
              '<main class="mcm4-main">',
                '<section id="mcm4DevicesPage">',
                  '<div class="mcm4-pagehead"><div><h1>Dispositivos</h1><p>Gerencie e monitore seus dispositivos conectados ao MeshCentral</p></div><div class="mcm4-page-actions"><button id="mcm4OpenNativeTab" class="mcm4-btn">Abrir nativo em nova aba</button><button id="mcm4NativeView" class="mcm4-btn primary">Abrir visão nativa</button></div></div>',
                  '<section class="mcm4-stats">',
                    '<article><span class="mcm4-stat-icon blue">▣</span><div><strong id="mcm4Total">0</strong><b>Dispositivos</b><small id="mcm4TotalSub">—</small></div></article>',
                    '<article><span class="mcm4-stat-icon green">✓</span><div><strong id="mcm4Online">0</strong><b>Online</b><small>Com agente conectado</small></div></article>',
                    '<article><span class="mcm4-stat-icon amber">△</span><div><strong id="mcm4Attention">0</strong><b>Atenção</b><small>Requer verificação</small></div></article>',
                    '<article><span class="mcm4-stat-icon red">!</span><div><strong id="mcm4Offline">0</strong><b>Offline</b><small>Sem comunicação</small></div></article>',
                  '</section>',
                  '<section class="mcm4-workspace">',
                    '<aside class="mcm4-devicepane">',
                      '<div class="mcm4-tabs"><button data-filter="all" class="active">Todos</button><button data-filter="online">Online</button><button data-filter="attention">Atenção</button><button data-filter="offline">Offline</button></div>',
                      '<div class="mcm4-local-search">⌕ <input id="mcm4LocalSearch" placeholder="Buscar dispositivos..."></div>',
                      '<div class="mcm4-listhead"><span>Nome</span><span>Status</span><span>IP</span></div>',
                      '<div id="mcm4DeviceList" class="mcm4-devicelist"></div>',
                      '<div class="mcm4-listfooter"><span id="mcm4Range">0 dispositivos</span><div><button id="mcm4Prev">‹</button><span id="mcm4Page">1</span><button id="mcm4Next">›</button></div></div>',
                    '</aside>',
                    '<section class="mcm4-detailpane">',
                      '<div class="mcm4-devicehead"><div class="mcm4-device-title"><span class="mcm4-device-icon">▣</span><div><h2 id="mcm4DeviceName">Selecione um dispositivo</h2><p id="mcm4DeviceMeta">Escolha um item na lista à esquerda</p></div></div><div class="mcm4-device-actions"><button id="mcm4OpenDeviceTab" class="mcm4-btn">Abrir em nova aba</button><button id="mcm4OpenDevice" class="mcm4-btn">Abrir nativo</button></div></div>',
                      '<div class="mcm4-detailtabs">',
                        '<button class="active" data-tool="overview">Visão Geral</button>',
                        '<button data-tool="desktop">Desktop</button>',
                        '<button data-tool="terminal">Terminal</button>',
                        '<button data-tool="files">Arquivos</button>',
                        '<button data-tool="events">Eventos</button>',
                        '<button data-tool="details">Detalhes</button>',
                        '<button data-tool="console">Console</button>',
                      '</div>',
                      '<div id="mcm4OverviewView">',
                        '<div class="mcm4-detailgrid">',
                          '<section class="mcm4-remote-card">',
                            '<div class="mcm4-cardhead"><b>Console Remoto</b><span id="mcm4RemoteState" class="mcm4-pill muted">Selecione um dispositivo</span></div>',
                            '<div class="mcm4-remote-preview"><div class="mcm4-screen"><div class="mcm4-screen-icon">▣</div><h3 id="mcm4ScreenTitle">Remote Desktop</h3><p id="mcm4ScreenText">Abra uma sessão Desktop usando o motor nativo do MeshCentral.</p></div></div>',
                            '<div class="mcm4-remote-actions"><button id="mcm4Connect" class="mcm4-btn primary">Conectar</button><button id="mcm4DesktopPreview" class="mcm4-btn">Abrir Desktop</button><button id="mcm4NativeTools" class="mcm4-btn">Ferramentas nativas</button></div>',
                          '</section>',
                          '<aside class="mcm4-info-stack">',
                            '<section class="mcm4-info-card"><div class="mcm4-cardhead"><b>Informações do Dispositivo</b></div><dl id="mcm4Info"></dl></section>',
                            '<section class="mcm4-info-card"><div class="mcm4-cardhead"><b>Saúde do Dispositivo</b><span id="mcm4HealthPill" class="mcm4-pill muted">—</span></div><div id="mcm4Health" class="mcm4-health"></div></section>',
                          '</aside>',
                        '</div>',
                        '<div class="mcm4-quick-actions">',
                          '<article><span class="green">⏻</span><div><b>Energia</b><small>Ligar, desligar e reiniciar</small></div><button data-power="power">Abrir</button></article>',
                          '<article><span class="blue">▣</span><div><b>Desktop</b><small>KVM e controle remoto</small></div><button data-tool="desktop">Abrir</button></article>',
                          '<article><span class="cyan">›_</span><div><b>Terminal</b><small>Console remoto</small></div><button data-tool="terminal">Abrir</button></article>',
                          '<article><span class="amber">⚡</span><div><b>Intel AMT</b><small>Energia e redirecionamento</small></div><button data-tool="details">Abrir</button></article>',
                        '</div>',
                      '</div>',
                      '<section id="mcm4ToolView" class="mcm4-toolview" hidden>',
                        '<div class="mcm4-toolhead"><div><b id="mcm4ToolTitle">Ferramenta</b><small id="mcm4ToolSubtitle">Motor nativo do MeshCentral integrado ao Command Center</small></div><div><button id="mcm4ToolReload" class="mcm4-btn">Atualizar</button><button id="mcm4ToolFull" class="mcm4-btn">Tela cheia</button><button id="mcm4ToolNativeTab" class="mcm4-btn">Nova aba</button></div></div>',
                        '<div class="mcm4-framewrap"><div id="mcm4FrameLoading" class="mcm4-frame-loading">Carregando ferramenta nativa…</div><iframe id="mcm4NativeFrame" title="MeshCentral Native Tool" allow="fullscreen; clipboard-read; clipboard-write; autoplay" referrerpolicy="same-origin"></iframe></div>',
                      '</section>',
                    '</section>',
                  '</section>',
                '</section>',
                '<section id="mcm4SectionPage" hidden>',
                  '<div class="mcm4-pagehead"><div><h1 id="mcm4SectionTitle">Seção</h1><p>Interface nativa integrada ao Command Center</p></div><div class="mcm4-page-actions"><button id="mcm4SectionReload" class="mcm4-btn">Atualizar</button><button id="mcm4SectionFull" class="mcm4-btn">Tela cheia</button><button id="mcm4SectionNativeTab" class="mcm4-btn primary">Abrir nativo em nova aba</button></div></div>',
                  '<div class="mcm4-section-frame"><div id="mcm4SectionLoading" class="mcm4-frame-loading">Carregando seção nativa…</div><iframe id="mcm4SectionFrame" title="MeshCentral Native Section" allow="fullscreen; clipboard-read; clipboard-write" referrerpolicy="same-origin"></iframe></div>',
                '</section>',
              '</main>',
            '</section>'
        ].join('');
        document.body.appendChild(shell);
        document.body.classList.add('mcm-v4-active');
        document.documentElement.setAttribute('data-mc-modern-overlay', VERSION);
        q('mcm4UserName').textContent = currentUserName();
        q('mcm4TopUser').textContent = currentUserName();
        bindEvents();
    }

    function bindEvents() {
        q('mcm4GlobalSearch').addEventListener('input', function (e) { state.query = e.target.value; state.page = 1; q('mcm4LocalSearch').value = e.target.value; render(); });
        q('mcm4LocalSearch').addEventListener('input', function (e) { state.query = e.target.value; state.page = 1; q('mcm4GlobalSearch').value = e.target.value; render(); });
        document.querySelectorAll('.mcm4-tabs button').forEach(function (b) { b.addEventListener('click', function () { document.querySelectorAll('.mcm4-tabs button').forEach(function(x){x.classList.remove('active');}); b.classList.add('active'); state.filter = b.dataset.filter; state.page = 1; render(); }); });
        document.querySelectorAll('.mcm4-navitem').forEach(function (b) {
            b.addEventListener('click', function () {
                if (b.dataset.section === 'devices') showDevicesPage();
                else openNativeSection(b.dataset.native, b.dataset.label || 'Seção');
            });
        });
        document.querySelectorAll('[data-tool]').forEach(function (b) { b.addEventListener('click', function () { showTool(b.dataset.tool); }); });
        document.querySelectorAll('[data-power]').forEach(function (b) { b.addEventListener('click', function () { openPowerDialog(); }); });
        q('mcm4Prev').addEventListener('click', function(){ if(state.page>1){state.page--;render();} });
        q('mcm4Next').addEventListener('click', function(){ var pages=Math.max(1,Math.ceil(filteredNodes().length/state.pageSize)); if(state.page<pages){state.page++;render();} });
        q('mcm4OpenDevice').addEventListener('click', function(){ openDeviceNativeCurrentTab(); });
        q('mcm4OpenDeviceTab').addEventListener('click', function(){ openDeviceNativeNewTab(state.tool === 'overview' ? 'overview' : state.tool); });
        q('mcm4Connect').addEventListener('click', function(){ showTool('desktop', true); });
        q('mcm4DesktopPreview').addEventListener('click', function(){ showTool('desktop'); });
        q('mcm4NativeTools').addEventListener('click', function(){ showTool('details'); });
        q('mcm4NativeView').addEventListener('click', function(){ setShellVisible(false); });
        q('mcm4OpenNativeTab').addEventListener('click', function(){ window.open(cleanNativeUrl(), '_blank', 'noopener'); });
        q('mcm4ToolReload').addEventListener('click', function(){ var f=q('mcm4NativeFrame'); if(f && f.src){ q('mcm4FrameLoading').hidden=false; f.contentWindow.location.reload(); } });
        q('mcm4ToolFull').addEventListener('click', function(){ requestFrameFullscreen(q('mcm4NativeFrame')); });
        q('mcm4ToolNativeTab').addEventListener('click', function(){ openDeviceNativeNewTab(state.tool); });
        q('mcm4SectionReload').addEventListener('click', function(){ var f=q('mcm4SectionFrame'); if(f && f.src){ q('mcm4SectionLoading').hidden=false; f.contentWindow.location.reload(); } });
        q('mcm4SectionFull').addEventListener('click', function(){ requestFrameFullscreen(q('mcm4SectionFrame')); });
        q('mcm4SectionNativeTab').addEventListener('click', function(){ window.open(cleanNativeUrl(), '_blank', 'noopener'); });
        q('mcm4UiSettings').addEventListener('click', function(){ setShellVisible(false); later(function(){ var b=q('uiMenuButton'); if(b && b.click) b.click(); },100); });
        q('mcm4NativeFrame').addEventListener('load', function(){ q('mcm4FrameLoading').hidden=true; });
        q('mcm4SectionFrame').addEventListener('load', function(){ q('mcm4SectionLoading').hidden=true; });
        document.addEventListener('keydown', function(e){ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k' && state.shellVisible){e.preventDefault();q('mcm4GlobalSearch').focus();} });
    }

    function cleanNativeUrl() {
        var u = new URL(window.location.href);
        ['mcmembed','mcmnode','mcmpanel','mcmauto','mcmsection'].forEach(function(k){u.searchParams.delete(k);});
        return u.toString();
    }

    function embeddedBaseUrl() {
        var u = new URL(window.location.href);
        ['mcmembed','mcmnode','mcmpanel','mcmauto','mcmsection'].forEach(function(k){u.searchParams.delete(k);});
        u.searchParams.set('mcmembed','1');
        return u;
    }

    function setShellVisible(show) {
        state.shellVisible = show;
        var shell = q('mcmV4Shell'); if (shell) shell.style.display = show ? 'grid' : 'none';
        document.body.classList.toggle('mcm-v4-active', show);
        if (!show && !q('mcmV4Return')) {
            var r = document.createElement('button');
            r.id='mcmV4Return';
            r.textContent='Voltar ao Command Center';
            r.className='mcm4-return';
            r.onclick=function(){setShellVisible(true);};
            document.body.appendChild(r);
        }
        if (q('mcmV4Return')) q('mcmV4Return').style.display = show ? 'none' : 'block';
    }

    function setActiveNav(button) {
        document.querySelectorAll('.mcm4-navitem').forEach(function(x){ x.classList.remove('active'); });
        if (button) button.classList.add('active');
    }

    function showDevicesPage() {
        state.section = 'devices';
        q('mcm4DevicesPage').hidden = false;
        q('mcm4SectionPage').hidden = true;
        setActiveNav(document.querySelector('.mcm4-navitem[data-section="devices"]'));
        render();
    }

    function openNativeSection(nativeId, label) {
        state.section = nativeId;
        q('mcm4DevicesPage').hidden = true;
        q('mcm4SectionPage').hidden = false;
        q('mcm4SectionTitle').textContent = label;
        var btn = document.querySelector('.mcm4-navitem[data-native="'+nativeId+'"]');
        setActiveNav(btn);
        var u = embeddedBaseUrl();
        u.searchParams.set('mcmsection', nativeId);
        q('mcm4SectionLoading').hidden = false;
        q('mcm4SectionFrame').src = u.toString();
    }

    function selectedNode() {
        var list = allNodes();
        for (var i=0;i<list.length;i++) if (list[i]._id === state.selectedId) return list[i];
        return null;
    }

    function nativeDeviceUrl(n, tool) {
        if (!n) return cleanNativeUrl();
        var panel = panelMap[tool] || 10;
        var u = new URL(cleanNativeUrl());
        u.searchParams.set('node', shortNodeId(n));
        u.searchParams.set('viewmode', String(panel));
        u.searchParams.set('gotonode', n._id);
        return u.toString();
    }

    function embeddedDeviceUrl(n, tool, auto) {
        var panel = panelMap[tool] || 10;
        var u = embeddedBaseUrl();
        u.searchParams.set('mcmnode', n._id);
        u.searchParams.set('mcmpanel', String(panel));
        u.searchParams.set('node', shortNodeId(n));
        u.searchParams.set('viewmode', String(panel));
        if (auto) u.searchParams.set('mcmauto', auto);
        return u.toString();
    }

    function openDeviceNativeCurrentTab() {
        var n = selectedNode(); if (!n) return;
        setShellVisible(false);
        try {
            if (typeof window.gotoDevice === 'function') { window.gotoDevice(n._id, panelMap[state.tool] || 10, true); return; }
        } catch (e) {}
        window.location.href = nativeDeviceUrl(n, state.tool);
    }

    function openDeviceNativeNewTab(tool) {
        var n = selectedNode(); if (!n) return;
        window.open(nativeDeviceUrl(n, tool || 'overview'), '_blank', 'noopener');
    }

    function toolTitle(tool) {
        return ({desktop:'Desktop / KVM',terminal:'Terminal',files:'Arquivos',events:'Eventos',details:'Detalhes / Intel AMT',console:'Console'})[tool] || 'Ferramenta';
    }

    function showTool(tool, autoConnect) {
        var n = selectedNode();
        if (!n) return;
        state.tool = tool || 'overview';
        document.querySelectorAll('.mcm4-detailtabs button').forEach(function(b){ b.classList.toggle('active', b.dataset.tool === state.tool); });
        if (state.tool === 'overview') {
            q('mcm4OverviewView').hidden = false;
            q('mcm4ToolView').hidden = true;
            return;
        }
        q('mcm4OverviewView').hidden = true;
        q('mcm4ToolView').hidden = false;
        q('mcm4ToolTitle').textContent = toolTitle(state.tool);
        q('mcm4ToolSubtitle').textContent = nodeName(n) + ' · motor nativo do MeshCentral integrado';
        var auto = autoConnect ? state.tool : '';
        loadToolFrame(n, state.tool, auto);
    }

    function loadToolFrame(n, tool, auto) {
        var frame = q('mcm4NativeFrame');
        var next = embeddedDeviceUrl(n, tool, auto);
        q('mcm4FrameLoading').hidden = false;
        frame.dataset.node = n._id;
        frame.dataset.tool = tool;
        frame.src = next;
    }

    function openPowerDialog() {
        var n = selectedNode(); if (!n) return;
        state.tool = 'details';
        document.querySelectorAll('.mcm4-detailtabs button').forEach(function(b){ b.classList.toggle('active', b.dataset.tool === 'details'); });
        q('mcm4OverviewView').hidden = true;
        q('mcm4ToolView').hidden = false;
        q('mcm4ToolTitle').textContent = 'Energia / Intel AMT';
        q('mcm4ToolSubtitle').textContent = 'A ação continua usando o diálogo e as permissões nativas do MeshCentral';
        loadToolFrame(n, 'overview', 'power');
    }

    function requestFrameFullscreen(frame) {
        if (!frame) return;
        try {
            if (frame.requestFullscreen) frame.requestFullscreen();
            else if (frame.webkitRequestFullscreen) frame.webkitRequestFullscreen();
        } catch (e) {}
    }

    function selectNode(id) {
        state.selectedId = id;
        state.tool = 'overview';
        renderDetail();
        renderList();
        showTool('overview');
    }

    function renderCounts() {
        var c = counts();
        q('mcm4Total').textContent = c.total;
        q('mcm4Online').textContent = c.online;
        q('mcm4Attention').textContent = c.attention;
        q('mcm4Offline').textContent = c.offline;
        q('mcm4TotalSub').textContent = c.online + ' Online · ' + c.offline + ' Offline';
    }

    function renderList() {
        var list = filteredNodes();
        var pages = Math.max(1, Math.ceil(list.length / state.pageSize));
        if (state.page > pages) state.page = pages;
        var start = (state.page - 1) * state.pageSize;
        var pageItems = list.slice(start, start + state.pageSize);
        var html = [];
        pageItems.forEach(function(n){
            var s = statusOf(n), active = n._id === state.selectedId ? ' active' : '';
            html.push('<button class="mcm4-device-row'+active+'" data-nodeid="'+esc(n._id)+'"><span class="mcm4-dev-name"><i>▣</i><b>'+esc(nodeName(n))+'</b></span><span class="mcm4-status '+s+'"><i></i>'+statusLabel(s)+'</span><span class="mcm4-ip">'+esc(nodeIp(n))+'</span></button>');
        });
        q('mcm4DeviceList').innerHTML = html.join('') || '<div class="mcm4-empty">Nenhum dispositivo encontrado.</div>';
        q('mcm4DeviceList').querySelectorAll('[data-nodeid]').forEach(function(b){ b.addEventListener('click', function(){ selectNode(b.dataset.nodeid); }); });
        q('mcm4Page').textContent = state.page + ' / ' + pages;
        q('mcm4Range').textContent = list.length ? ((start+1)+'–'+Math.min(start+state.pageSize,list.length)+' de '+list.length+' dispositivos') : '0 dispositivos';
        q('mcm4Prev').disabled = state.page <= 1;
        q('mcm4Next').disabled = state.page >= pages;
    }

    function renderDetail() {
        var n = selectedNode();
        if (!n) {
            q('mcm4DeviceName').textContent = 'Selecione um dispositivo';
            q('mcm4DeviceMeta').textContent = 'Escolha um item na lista à esquerda';
            q('mcm4Info').innerHTML = '<div class="mcm4-empty">Nenhum dispositivo selecionado.</div>';
            q('mcm4Health').innerHTML = '<div class="mcm4-empty">—</div>';
            q('mcm4RemoteState').textContent = 'Selecione um dispositivo';
            return;
        }
        var s = statusOf(n), online = isOnline(n);
        q('mcm4DeviceName').textContent = nodeName(n);
        q('mcm4DeviceMeta').textContent = [nodeIp(n), meshName(n), nodeOs(n)].filter(function(x){return x && x !== '—';}).join('  |  ') || '—';
        q('mcm4ScreenTitle').textContent = nodeName(n);
        q('mcm4ScreenText').textContent = online ? 'Dispositivo online. Abra Desktop para iniciar uma sessão remota real.' : 'Dispositivo offline. A sessão remota ficará disponível quando o agente reconectar.';
        q('mcm4RemoteState').className = 'mcm4-pill ' + s;
        q('mcm4RemoteState').textContent = statusLabel(s);
        q('mcm4HealthPill').className = 'mcm4-pill ' + s;
        q('mcm4HealthPill').textContent = statusLabel(s);
        q('mcm4Info').innerHTML = [
            ['Nome', nodeName(n)],
            ['Estado', statusLabel(s)],
            ['Endereço IP', nodeIp(n)],
            ['Grupo', meshName(n)],
            ['Sistema Operacional', nodeOs(n)],
            ['Intel AMT', amtVersion(n)],
            ['Node ID', n._id]
        ].map(function(x){return '<div><dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd></div>';}).join('');
        q('mcm4Health').innerHTML = [
            '<div><span>Conectividade</span><b class="'+s+'">'+statusLabel(s)+'</b></div>',
            '<div><span>Agente</span><b>'+(n.agent ? 'Detectado' : '—')+'</b></div>',
            '<div><span>Intel AMT</span><b>'+esc(amtVersion(n))+'</b></div>',
            '<div><span>Último IP</span><b>'+esc(nodeIp(n))+'</b></div>'
        ].join('');
    }

    function render() {
        if (!q('mcmV4Shell')) return;
        renderCounts();
        renderList();
        if (!state.selectedId) {
            var list = filteredNodes();
            if (list.length) state.selectedId = list[0]._id;
        }
        renderDetail();
    }

    function activate() {
        if (!document.body) return;
        buildShell();
        render();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate, { once: true });
    else activate();
    window.addEventListener('load', function(){ activate(); later(render, 400); }, { once: true });
    window.setInterval(function(){ if(q('mcmV4Shell') && state.shellVisible && state.section === 'devices') renderCounts(); }, 5000);
})();
