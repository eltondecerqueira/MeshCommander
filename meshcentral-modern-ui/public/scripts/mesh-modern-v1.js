(function () {
    'use strict';

    var VERSION = 'v5';
    var STORAGE_KEY = 'meshcommander-v5-state';
    var FAVORITES_KEY = 'meshcommander-v5-favorites';
    var RECENTS_KEY = 'meshcommander-v5-recents';
    var urlParams = new URLSearchParams(window.location.search);
    var EMBED_MODE = urlParams.get('mcmembed') === '1';

    function q(id) { return document.getElementById(id); }
    function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function txt(v) { return (v == null || v === '') ? '—' : String(v); }
    function esc(v) { return txt(v).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; }); }
    function later(fn, delay) { window.setTimeout(function () { try { fn(); } catch (e) {} }, delay || 0); }
    function safeJsonParse(v, fallback) { try { return JSON.parse(v); } catch (e) { return fallback; } }

    var panelMap = { overview:10, desktop:11, terminal:12, files:13, console:15, events:16, details:17 };
    var toolNames = { overview:'Visão Geral', desktop:'Desktop / KVM', terminal:'Terminal', files:'Arquivos', events:'Eventos', details:'Detalhes / Intel AMT', console:'Console' };

    /* ---------------------------------------------------------------------
       Embedded native mode
       The original MeshCentral UI remains the execution engine. In this mode
       we only strip the outer chrome and navigate to a native panel/section.
       --------------------------------------------------------------------- */
    function setupEmbeddedNative() {
        function activateEmbed() {
            if (!document.body) return;
            document.body.classList.add('mcm-embedded-native');
            document.documentElement.setAttribute('data-mc-modern-embed', VERSION);
        }

        function navigate() {
            activateEmbed();
            var section = urlParams.get('mcmsection');
            var nodeid = urlParams.get('mcmnode');
            var panel = parseInt(urlParams.get('mcmpanel') || '10', 10);
            var auto = urlParams.get('mcmauto');

            if (section) {
                var sectionEl = q(section);
                if (!sectionEl || typeof sectionEl.click !== 'function') return false;
                sectionEl.click();
                return true;
            }

            if (!nodeid || typeof window.gotoDevice !== 'function') return false;
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
                    }, 800);
                }
                return true;
            } catch (e) { return false; }
        }

        activateEmbed();
        var tries = 0;
        function retry() {
            tries++;
            if (navigate() || tries > 35) return;
            later(retry, 200);
        }
        if (document.readyState === 'complete') later(retry, 100);
        else window.addEventListener('load', function () { later(retry, 100); }, { once:true });
        return;
    }

    if (EMBED_MODE) {
        setupEmbeddedNative();
        return;
    }

    /* ---------------------------------------------------------------------
       Main Command Center
       --------------------------------------------------------------------- */
    var restored = safeJsonParse(sessionStorage.getItem(STORAGE_KEY), {}) || {};
    var state = {
        query: restored.query || '',
        filter: restored.filter || 'all',
        group: restored.group || 'all',
        sort: restored.sort || 'name',
        selectedId: restored.selectedId || null,
        page: restored.page || 1,
        pageSize: restored.pageSize || 40,
        shellVisible: true,
        tool: restored.tool || 'overview',
        section: restored.section || 'devices',
        toolFrames: {},
        sectionFrameKey: null
    };
    var favorites = safeJsonParse(localStorage.getItem(FAVORITES_KEY), []) || [];
    var recents = safeJsonParse(localStorage.getItem(RECENTS_KEY), []) || [];

    function saveState() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                query:state.query, filter:state.filter, group:state.group, sort:state.sort,
                selectedId:state.selectedId, page:state.page, pageSize:state.pageSize,
                tool:state.tool, section:state.section
            }));
        } catch (e) {}
    }

    function saveFavorites() { try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.slice(0, 200))); } catch (e) {} }
    function saveRecents() { try { localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 20))); } catch (e) {} }

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
    function agentVersion(n) {
        if (!n || !n.agent) return '—';
        return txt(n.agent.ver || n.agent.version || n.agent.id || 'Detectado');
    }
    function agentCaps(n) { return Number(n && n.agent && n.agent.caps || 0); }
    function hasCap(n, bit) { return !!(agentCaps(n) & bit); }
    function isFavorite(id) { return favorites.indexOf(id) >= 0; }

    function meshEntries() {
        var list = [], map = window.meshes || {};
        Object.keys(map).forEach(function (id) {
            var m = map[id];
            if (!m || typeof m !== 'object') return;
            list.push({ id:id, name:txt(m.name || m.mname || id), mtype:m.mtype });
        });
        list.sort(function (a,b) { return a.name.localeCompare(b.name); });
        return list;
    }

    function countsFor(list) {
        var online = 0, attention = 0, offline = 0;
        list.forEach(function (n) {
            var s = statusOf(n);
            if (s === 'online') online++; else if (s === 'attention') attention++; else offline++;
        });
        return { total:list.length, online:online, attention:attention, offline:offline };
    }

    function counts() { return countsFor(allNodes()); }

    function filteredNodes() {
        var query = state.query.trim().toLowerCase();
        var list = allNodes().filter(function (n) {
            var s = statusOf(n);
            if (state.filter === 'favorites' && !isFavorite(n._id)) return false;
            if (state.filter !== 'all' && state.filter !== 'favorites' && state.filter !== s) return false;
            if (state.group !== 'all' && n.meshid !== state.group) return false;
            if (!query) return true;
            var hay = [nodeName(n), nodeIp(n), nodeOs(n), meshName(n), (n.tags || []).join(' ')].join(' ').toLowerCase();
            return hay.indexOf(query) >= 0;
        });
        list.sort(function (a,b) {
            if (state.sort === 'status') {
                var rank = { online:0, attention:1, offline:2 };
                var d = rank[statusOf(a)] - rank[statusOf(b)];
                if (d) return d;
            }
            if (state.sort === 'group') {
                var g = meshName(a).localeCompare(meshName(b));
                if (g) return g;
            }
            if (state.sort === 'ip') {
                var i = nodeIp(a).localeCompare(nodeIp(b), undefined, { numeric:true });
                if (i) return i;
            }
            if (isFavorite(a._id) !== isFavorite(b._id)) return isFavorite(a._id) ? -1 : 1;
            return nodeName(a).localeCompare(nodeName(b), undefined, { numeric:true });
        });
        return list;
    }

    function currentUserName() {
        try { return txt((window.userinfo && (window.userinfo.realname || window.userinfo.name)) || 'admin'); } catch (e) { return 'admin'; }
    }

    function currentUserInitial() {
        var n = currentUserName();
        return (n && n !== '—') ? n.charAt(0).toUpperCase() : 'A';
    }

    function buildShell() {
        if (q('mcmV5Shell')) return;
        var shell = document.createElement('div');
        shell.id = 'mcmV5Shell';
        shell.innerHTML = [
            '<aside class="mcm5-sidebar">',
              '<div class="mcm5-brand"><div class="mcm5-brandmark">M</div><div><b>MeshCommander</b><span>Remote Management</span></div></div>',
              '<nav class="mcm5-nav">',
                '<button class="mcm5-navitem active" data-section="devices"><span>▣</span><b>Dispositivos</b></button>',
                '<button class="mcm5-navitem" data-section="groups"><span>⌘</span><b>Grupos</b></button>',
                '<div class="mcm5-nav-sep"><span>Operação</span></div>',
                '<button class="mcm5-navitem" data-section="native" data-native="LeftMenuMyEvents" data-label="Eventos"><span>◷</span><b>Eventos</b></button>',
                '<button class="mcm5-navitem" data-section="native" data-native="LeftMenuMyFiles" data-label="Arquivos"><span>▤</span><b>Arquivos</b></button>',
                '<div class="mcm5-nav-sep"><span>Administração</span></div>',
                '<button class="mcm5-navitem" data-section="native" data-native="LeftMenuMyAccount" data-label="Minha Conta"><span>◎</span><b>Minha Conta</b></button>',
                '<button class="mcm5-navitem" data-section="native" data-native="LeftMenuMyUsers" data-label="Usuários"><span>♙</span><b>Usuários</b></button>',
                '<button class="mcm5-navitem" data-section="native" data-native="LeftMenuMyServer" data-label="Servidor"><span>⚙</span><b>Servidor</b></button>',
              '</nav>',
              '<div class="mcm5-sidebar-footer"><small>Conectado como</small><div class="mcm5-user"><span id="mcm5SidebarAvatar" class="mcm5-avatar">A</span><div><b id="mcm5UserName">admin</b><small>MeshCentral</small></div></div><div class="mcm5-version">UI '+VERSION+' · ambiente paralelo</div></div>',
            '</aside>',
            '<section class="mcm5-app">',
              '<header class="mcm5-topbar">',
                '<div class="mcm5-global-search"><span>⌕</span><input id="mcm5GlobalSearch" placeholder="Buscar dispositivos, grupos ou tags..."><kbd>Ctrl + K</kbd></div>',
                '<div class="mcm5-top-actions"><span id="mcm5LiveDot" class="mcm5-live-dot"></span><small id="mcm5LiveText">Sincronizado</small><button id="mcm5UiSettings" title="Configurações da interface">◐</button><span id="mcm5TopAvatar" class="mcm5-avatar small">A</span><b id="mcm5TopUser">admin</b></div>',
              '</header>',
              '<main class="mcm5-main">',
                '<section id="mcm5DevicesPage">',
                  '<div class="mcm5-pagehead"><div><h1>Dispositivos</h1><p>Gerencie, monitore e acesse seus dispositivos sem sair do Command Center</p></div><div class="mcm5-page-actions"><button id="mcm5OpenNativeTab" class="mcm5-btn">Nativo em nova aba</button><button id="mcm5NativeView" class="mcm5-btn primary">Abrir visão nativa</button></div></div>',
                  '<section class="mcm5-stats">',
                    '<button data-stat-filter="all"><span class="mcm5-stat-icon blue">▣</span><div><strong id="mcm5Total">0</strong><b>Dispositivos</b><small id="mcm5TotalSub">—</small></div></button>',
                    '<button data-stat-filter="online"><span class="mcm5-stat-icon green">✓</span><div><strong id="mcm5Online">0</strong><b>Online</b><small>Com comunicação ativa</small></div></button>',
                    '<button data-stat-filter="attention"><span class="mcm5-stat-icon amber">△</span><div><strong id="mcm5Attention">0</strong><b>Atenção</b><small>Requer verificação</small></div></button>',
                    '<button data-stat-filter="offline"><span class="mcm5-stat-icon red">!</span><div><strong id="mcm5Offline">0</strong><b>Offline</b><small>Sem comunicação</small></div></button>',
                  '</section>',
                  '<section class="mcm5-workspace">',
                    '<aside class="mcm5-devicepane">',
                      '<div class="mcm5-list-toolbar">',
                        '<div class="mcm5-tabs"><button data-filter="all" class="active">Todos</button><button data-filter="online">Online</button><button data-filter="attention">Atenção</button><button data-filter="offline">Offline</button><button data-filter="favorites">★</button></div>',
                        '<div class="mcm5-local-search"><span>⌕</span><input id="mcm5LocalSearch" placeholder="Buscar dispositivos..."></div>',
                        '<div class="mcm5-list-controls"><select id="mcm5GroupFilter" title="Filtrar por grupo"><option value="all">Todos os grupos</option></select><select id="mcm5Sort"><option value="name">Nome</option><option value="status">Status</option><option value="group">Grupo</option><option value="ip">IP</option></select></div>',
                      '</div>',
                      '<div class="mcm5-listhead"><span>Nome</span><span>Status</span><span>IP</span></div>',
                      '<div id="mcm5DeviceList" class="mcm5-devicelist"></div>',
                      '<div class="mcm5-listfooter"><span id="mcm5Range">0 dispositivos</span><div><button id="mcm5Prev">‹</button><span id="mcm5Page">1</span><button id="mcm5Next">›</button></div></div>',
                    '</aside>',
                    '<section class="mcm5-detailpane">',
                      '<div class="mcm5-devicehead"><div class="mcm5-device-title"><span class="mcm5-device-icon">▣</span><div><div class="mcm5-titleline"><h2 id="mcm5DeviceName">Selecione um dispositivo</h2><span id="mcm5DeviceStatus" class="mcm5-pill muted">—</span></div><p id="mcm5DeviceMeta">Escolha um item na lista à esquerda</p></div></div><div class="mcm5-device-actions"><button id="mcm5Favorite" class="mcm5-icon-btn" title="Favorito">☆</button><button id="mcm5OpenDeviceTab" class="mcm5-btn">Nova aba</button><button id="mcm5OpenDevice" class="mcm5-btn">Abrir nativo</button></div></div>',
                      '<div class="mcm5-detailtabs"><button class="active" data-tool="overview">Visão Geral</button><button data-tool="desktop">Desktop</button><button data-tool="terminal">Terminal</button><button data-tool="files">Arquivos</button><button data-tool="events">Eventos</button><button data-tool="details">Detalhes</button><button data-tool="console">Console</button></div>',
                      '<div id="mcm5OverviewView">',
                        '<div class="mcm5-detailgrid">',
                          '<section class="mcm5-remote-card">',
                            '<div class="mcm5-cardhead"><div><b>Console Remoto</b><small>Desktop/KVM usando o motor nativo</small></div><span id="mcm5RemoteState" class="mcm5-pill muted">Selecione um dispositivo</span></div>',
                            '<div class="mcm5-remote-preview"><div class="mcm5-screen"><div class="mcm5-screen-glow"></div><div class="mcm5-screen-icon">▣</div><h3 id="mcm5ScreenTitle">Remote Desktop</h3><p id="mcm5ScreenText">Abra uma sessão remota real sem abandonar o Command Center.</p></div></div>',
                            '<div class="mcm5-remote-actions"><button id="mcm5Connect" class="mcm5-btn primary">Conectar</button><button data-tool="desktop" class="mcm5-btn">Abrir Desktop</button><button data-tool="terminal" class="mcm5-btn">Terminal</button><button data-tool="files" class="mcm5-btn">Arquivos</button></div>',
                          '</section>',
                          '<aside class="mcm5-info-stack">',
                            '<section class="mcm5-info-card"><div class="mcm5-cardhead"><div><b>Informações do Dispositivo</b><small>Dados em tempo real do MeshCentral</small></div></div><dl id="mcm5Info"></dl></section>',
                            '<section class="mcm5-info-card"><div class="mcm5-cardhead"><div><b>Capacidades e Saúde</b><small>Recursos detectados</small></div><span id="mcm5HealthPill" class="mcm5-pill muted">—</span></div><div id="mcm5Health" class="mcm5-health"></div></section>',
                          '</aside>',
                        '</div>',
                        '<div class="mcm5-quick-actions"><article><span class="green">⏻</span><div><b>Energia</b><small>Diálogo nativo e permissões originais</small></div><button data-power="power">Abrir</button></article><article><span class="blue">▣</span><div><b>Desktop</b><small>KVM e controle remoto</small></div><button data-tool="desktop">Abrir</button></article><article><span class="cyan">›_</span><div><b>Terminal</b><small>Console remoto persistente</small></div><button data-tool="terminal">Abrir</button></article><article><span class="amber">⚡</span><div><b>Intel AMT</b><small>Detalhes e redirecionamento</small></div><button data-tool="details">Abrir</button></article></div>',
                      '</div>',
                      '<section id="mcm5ToolView" class="mcm5-toolview" hidden>',
                        '<div class="mcm5-toolhead"><div><div class="mcm5-tool-titleline"><b id="mcm5ToolTitle">Ferramenta</b><span id="mcm5ToolSession" class="mcm5-pill muted">Pronto</span></div><small id="mcm5ToolSubtitle">Motor nativo do MeshCentral integrado ao Command Center</small></div><div class="mcm5-tool-actions"><button id="mcm5ToolReload" class="mcm5-btn">Atualizar</button><button id="mcm5ToolFull" class="mcm5-btn">Tela cheia</button><button id="mcm5ToolNativeTab" class="mcm5-btn">Nova aba</button><button id="mcm5ToolClose" class="mcm5-btn danger">Encerrar aba</button></div></div>',
                        '<div id="mcm5FrameHost" class="mcm5-framehost"></div>',
                      '</section>',
                    '</section>',
                  '</section>',
                '</section>',
                '<section id="mcm5GroupsPage" hidden><div class="mcm5-pagehead"><div><h1>Grupos</h1><p>Visão consolidada dos grupos de dispositivos já existentes no MeshCentral</p></div><button id="mcm5GroupsNative" class="mcm5-btn">Abrir dispositivos nativos</button></div><div id="mcm5GroupsGrid" class="mcm5-groups-grid"></div></section>',
                '<section id="mcm5SectionPage" hidden><div class="mcm5-pagehead"><div><h1 id="mcm5SectionTitle">Seção</h1><p>Interface nativa integrada ao Command Center</p></div><div class="mcm5-page-actions"><button id="mcm5SectionReload" class="mcm5-btn">Atualizar</button><button id="mcm5SectionFull" class="mcm5-btn">Tela cheia</button><button id="mcm5SectionNativeTab" class="mcm5-btn primary">Nova aba</button></div></div><div class="mcm5-section-frame"><div id="mcm5SectionLoading" class="mcm5-frame-loading">Carregando seção nativa…</div><iframe id="mcm5SectionFrame" title="MeshCentral Native Section" allow="fullscreen; clipboard-read; clipboard-write" referrerpolicy="same-origin"></iframe></div></section>',
              '</main>',
            '</section>',
            '<div id="mcm5Toasts" class="mcm5-toasts"></div>'
        ].join('');
        document.body.appendChild(shell);
        document.body.classList.add('mcm-v5-active');
        document.documentElement.setAttribute('data-mc-modern-overlay', VERSION);
        q('mcm5UserName').textContent = currentUserName();
        q('mcm5TopUser').textContent = currentUserName();
        q('mcm5SidebarAvatar').textContent = currentUserInitial();
        q('mcm5TopAvatar').textContent = currentUserInitial();
        q('mcm5GlobalSearch').value = state.query;
        q('mcm5LocalSearch').value = state.query;
        q('mcm5Sort').value = state.sort;
        bindEvents();
        populateGroupFilter();
    }

    function bindEvents() {
        q('mcm5GlobalSearch').addEventListener('input', onSearch);
        q('mcm5LocalSearch').addEventListener('input', onSearch);
        qa('.mcm5-tabs button').forEach(function (b) { b.addEventListener('click', function () { setFilter(b.dataset.filter); }); });
        qa('[data-stat-filter]').forEach(function (b) { b.addEventListener('click', function () { setFilter(b.dataset.statFilter); }); });
        qa('.mcm5-navitem').forEach(function (b) { b.addEventListener('click', function () {
            if (b.dataset.section === 'devices') showDevicesPage();
            else if (b.dataset.section === 'groups') showGroupsPage();
            else openNativeSection(b.dataset.native, b.dataset.label || 'Seção');
        }); });
        qa('[data-tool]').forEach(function (b) { b.addEventListener('click', function () { showTool(b.dataset.tool); }); });
        qa('[data-power]').forEach(function (b) { b.addEventListener('click', openPowerDialog); });
        q('mcm5GroupFilter').addEventListener('change', function () { state.group = this.value; state.page = 1; saveState(); render(); });
        q('mcm5Sort').addEventListener('change', function () { state.sort = this.value; state.page = 1; saveState(); renderList(); });
        q('mcm5Prev').addEventListener('click', function () { if (state.page > 1) { state.page--; saveState(); renderList(); } });
        q('mcm5Next').addEventListener('click', function () { var pages = Math.max(1, Math.ceil(filteredNodes().length / state.pageSize)); if (state.page < pages) { state.page++; saveState(); renderList(); } });
        q('mcm5OpenDevice').addEventListener('click', openDeviceNativeCurrentTab);
        q('mcm5OpenDeviceTab').addEventListener('click', function () { openDeviceNativeNewTab(state.tool); });
        q('mcm5Connect').addEventListener('click', function () { showTool('desktop', true); });
        q('mcm5Favorite').addEventListener('click', toggleFavorite);
        q('mcm5NativeView').addEventListener('click', function () { setShellVisible(false); });
        q('mcm5OpenNativeTab').addEventListener('click', function () { window.open(cleanNativeUrl(), '_blank', 'noopener'); });
        q('mcm5UiSettings').addEventListener('click', function () { setShellVisible(false); later(function () { var b = q('uiMenuButton'); if (b && b.click) b.click(); }, 100); });
        q('mcm5ToolReload').addEventListener('click', reloadActiveTool);
        q('mcm5ToolFull').addEventListener('click', fullscreenActiveTool);
        q('mcm5ToolNativeTab').addEventListener('click', function () { openDeviceNativeNewTab(state.tool); });
        q('mcm5ToolClose').addEventListener('click', closeActiveTool);
        q('mcm5SectionReload').addEventListener('click', function () { var f = q('mcm5SectionFrame'); if (f && f.src) { q('mcm5SectionLoading').hidden = false; try { f.contentWindow.location.reload(); } catch (e) { f.src = f.src; } } });
        q('mcm5SectionFull').addEventListener('click', function () { requestFrameFullscreen(q('mcm5SectionFrame')); });
        q('mcm5SectionNativeTab').addEventListener('click', function () { window.open(cleanNativeUrl(), '_blank', 'noopener'); });
        q('mcm5SectionFrame').addEventListener('load', function () { q('mcm5SectionLoading').hidden = true; });
        q('mcm5GroupsNative').addEventListener('click', function () { setShellVisible(false); later(function () { var b = q('LeftMenuMyDevices'); if (b && b.click) b.click(); }, 100); });
        document.addEventListener('keydown', keyboardShortcuts);
    }

    function onSearch(e) {
        state.query = e.target.value;
        state.page = 1;
        if (e.target.id !== 'mcm5GlobalSearch') q('mcm5GlobalSearch').value = state.query;
        if (e.target.id !== 'mcm5LocalSearch') q('mcm5LocalSearch').value = state.query;
        saveState();
        renderList();
    }

    function keyboardShortcuts(e) {
        if (!state.shellVisible) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); q('mcm5GlobalSearch').focus(); return; }
        if ((e.ctrlKey || e.metaKey) && /^[1-7]$/.test(e.key) && state.section === 'devices') {
            var order = ['overview','desktop','terminal','files','events','details','console'];
            e.preventDefault();
            showTool(order[parseInt(e.key, 10) - 1]);
        }
    }

    function setFilter(filter) {
        state.filter = filter || 'all'; state.page = 1; saveState();
        qa('.mcm5-tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.filter === state.filter); });
        renderList();
    }

    function populateGroupFilter() {
        var sel = q('mcm5GroupFilter'); if (!sel) return;
        var html = ['<option value="all">Todos os grupos</option>'];
        meshEntries().forEach(function (m) { html.push('<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>'); });
        sel.innerHTML = html.join('');
        sel.value = meshEntries().some(function (m) { return m.id === state.group; }) ? state.group : 'all';
        state.group = sel.value;
    }

    function cleanNativeUrl() {
        var u = new URL(window.location.href);
        ['mcmembed','mcmnode','mcmpanel','mcmauto','mcmsection'].forEach(function (k) { u.searchParams.delete(k); });
        return u.toString();
    }

    function embeddedBaseUrl() {
        var u = new URL(cleanNativeUrl());
        u.searchParams.set('mcmembed', '1');
        return u;
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

    function nativeDeviceUrl(n, tool) {
        if (!n) return cleanNativeUrl();
        var panel = panelMap[tool] || 10;
        var u = new URL(cleanNativeUrl());
        u.searchParams.set('node', shortNodeId(n));
        u.searchParams.set('viewmode', String(panel));
        u.searchParams.set('gotonode', n._id);
        return u.toString();
    }

    function setShellVisible(show) {
        state.shellVisible = show;
        var shell = q('mcmV5Shell'); if (shell) shell.style.display = show ? 'grid' : 'none';
        document.body.classList.toggle('mcm-v5-active', show);
        if (!show && !q('mcmV5Return')) {
            var r = document.createElement('button'); r.id = 'mcmV5Return'; r.className = 'mcm5-return'; r.textContent = 'Voltar ao Command Center'; r.onclick = function () { setShellVisible(true); }; document.body.appendChild(r);
        }
        if (q('mcmV5Return')) q('mcmV5Return').style.display = show ? 'none' : 'block';
    }

    function setActiveNav(button) {
        qa('.mcm5-navitem').forEach(function (x) { x.classList.remove('active'); });
        if (button) button.classList.add('active');
    }

    function hidePages() {
        q('mcm5DevicesPage').hidden = true;
        q('mcm5GroupsPage').hidden = true;
        q('mcm5SectionPage').hidden = true;
    }

    function showDevicesPage() {
        hidePages(); state.section = 'devices'; q('mcm5DevicesPage').hidden = false;
        setActiveNav(document.querySelector('.mcm5-navitem[data-section="devices"]'));
        saveState(); render();
    }

    function showGroupsPage() {
        hidePages(); state.section = 'groups'; q('mcm5GroupsPage').hidden = false;
        setActiveNav(document.querySelector('.mcm5-navitem[data-section="groups"]'));
        saveState(); renderGroups();
    }

    function openNativeSection(nativeId, label) {
        hidePages(); state.section = nativeId; q('mcm5SectionPage').hidden = false; q('mcm5SectionTitle').textContent = label;
        setActiveNav(document.querySelector('.mcm5-navitem[data-native="' + nativeId + '"]'));
        var u = embeddedBaseUrl(); u.searchParams.set('mcmsection', nativeId);
        q('mcm5SectionLoading').hidden = false; q('mcm5SectionFrame').src = u.toString();
        saveState();
    }

    function selectedNode() {
        var map = nodeMap();
        if (state.selectedId && map[state.selectedId]) return map[state.selectedId];
        var list = allNodes();
        for (var i = 0; i < list.length; i++) if (list[i]._id === state.selectedId) return list[i];
        return null;
    }

    function openDeviceNativeCurrentTab() {
        var n = selectedNode(); if (!n) return;
        setShellVisible(false);
        try { if (typeof window.gotoDevice === 'function') { window.gotoDevice(n._id, panelMap[state.tool] || 10, true); return; } } catch (e) {}
        window.location.href = nativeDeviceUrl(n, state.tool);
    }

    function openDeviceNativeNewTab(tool) { var n = selectedNode(); if (n) window.open(nativeDeviceUrl(n, tool || 'overview'), '_blank', 'noopener'); }

    function rememberRecent(id) {
        recents = [id].concat(recents.filter(function (x) { return x !== id; })).slice(0, 20);
        saveRecents();
    }

    function selectNode(id) {
        if (!id || state.selectedId === id) return;
        releaseToolFrames();
        state.selectedId = id; state.tool = 'overview'; rememberRecent(id); saveState();
        renderList(); renderDetail(); showTool('overview');
    }

    function toggleFavorite() {
        var n = selectedNode(); if (!n) return;
        if (isFavorite(n._id)) favorites = favorites.filter(function (x) { return x !== n._id; });
        else favorites.unshift(n._id);
        saveFavorites(); renderList(); renderDetail(); toast(isFavorite(n._id) ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.');
    }

    function toolFrameKey(tool) { return state.selectedId + '::' + tool; }

    function createToolFrame(tool, auto) {
        var n = selectedNode(); if (!n) return null;
        var key = toolFrameKey(tool), existing = state.toolFrames[key];
        if (existing && document.body.contains(existing.wrap)) return existing;

        var wrap = document.createElement('div'); wrap.className = 'mcm5-frame-slot'; wrap.dataset.tool = tool; wrap.dataset.node = n._id;
        wrap.innerHTML = '<div class="mcm5-frame-loading">Carregando ' + esc(toolNames[tool] || tool) + '…</div><iframe title="' + esc(toolNames[tool] || tool) + '" allow="fullscreen; clipboard-read; clipboard-write; autoplay" referrerpolicy="same-origin"></iframe>';
        var iframe = wrap.querySelector('iframe');
        iframe.addEventListener('load', function () { var loader = wrap.querySelector('.mcm5-frame-loading'); if (loader) loader.hidden = true; updateToolSession(); });
        q('mcm5FrameHost').appendChild(wrap);
        iframe.src = embeddedDeviceUrl(n, tool, auto || '');
        state.toolFrames[key] = { wrap:wrap, frame:iframe, tool:tool, node:n._id, auto:auto || '' };
        return state.toolFrames[key];
    }

    function activeToolFrame() { return state.toolFrames[toolFrameKey(state.tool)] || null; }

    function showTool(tool, autoConnect) {
        var n = selectedNode(); if (!n) return;
        state.tool = tool || 'overview'; saveState();
        qa('.mcm5-detailtabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tool === state.tool); });
        if (state.tool === 'overview') {
            q('mcm5OverviewView').hidden = false; q('mcm5ToolView').hidden = true;
            qa('.mcm5-frame-slot').forEach(function (x) { x.classList.remove('active'); });
            return;
        }
        q('mcm5OverviewView').hidden = true; q('mcm5ToolView').hidden = false;
        q('mcm5ToolTitle').textContent = toolNames[state.tool] || 'Ferramenta';
        q('mcm5ToolSubtitle').textContent = nodeName(n) + ' · sessão nativa preservada ao trocar de abas';
        var entry = createToolFrame(state.tool, autoConnect ? state.tool : '');
        qa('.mcm5-frame-slot').forEach(function (x) { x.classList.toggle('active', entry && x === entry.wrap); });
        updateToolSession();
    }

    function reloadActiveTool() {
        var e = activeToolFrame(); if (!e) return;
        var loader = e.wrap.querySelector('.mcm5-frame-loading'); if (loader) loader.hidden = false;
        try { e.frame.contentWindow.location.reload(); } catch (x) { e.frame.src = e.frame.src; }
    }

    function fullscreenActiveTool() { var e = activeToolFrame(); if (e) requestFrameFullscreen(e.wrap); }

    function closeActiveTool() {
        var key = toolFrameKey(state.tool), e = state.toolFrames[key];
        if (e) { try { e.frame.src = 'about:blank'; } catch (x) {} if (e.wrap && e.wrap.parentNode) e.wrap.parentNode.removeChild(e.wrap); delete state.toolFrames[key]; }
        toast('Aba ' + (toolNames[state.tool] || state.tool) + ' encerrada.');
        showTool('overview');
    }

    function releaseToolFrames() {
        Object.keys(state.toolFrames).forEach(function (key) {
            var e = state.toolFrames[key];
            try { e.frame.src = 'about:blank'; } catch (x) {}
            if (e.wrap && e.wrap.parentNode) e.wrap.parentNode.removeChild(e.wrap);
        });
        state.toolFrames = {};
    }

    function updateToolSession() {
        if (state.tool === 'overview') return;
        var e = activeToolFrame(), label = 'Carregado', cls = 'online';
        if (!e) { label = 'Não carregado'; cls = 'muted'; }
        else {
            try {
                var w = e.frame.contentWindow;
                if (state.tool === 'desktop') label = w.desktop ? 'Sessão ativa' : 'Pronto para conectar';
                else if (state.tool === 'terminal') label = w.terminal ? 'Sessão ativa' : 'Pronto';
                else if (state.tool === 'files') label = w.files ? 'Sessão ativa' : 'Pronto';
                else label = 'Carregado';
            } catch (x) { label = 'Carregado'; }
        }
        var p = q('mcm5ToolSession'); if (p) { p.textContent = label; p.className = 'mcm5-pill ' + cls; }
    }

    function openPowerDialog() {
        var n = selectedNode(); if (!n) return;
        state.tool = 'details';
        q('mcm5OverviewView').hidden = true; q('mcm5ToolView').hidden = false;
        qa('.mcm5-detailtabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tool === 'details'); });
        q('mcm5ToolTitle').textContent = 'Energia / Intel AMT'; q('mcm5ToolSubtitle').textContent = 'Ação protegida pelo diálogo nativo e permissões originais do MeshCentral';
        var entry = createToolFrame('details', 'power'); qa('.mcm5-frame-slot').forEach(function (x) { x.classList.toggle('active', entry && x === entry.wrap); });
        saveState();
    }

    function requestFrameFullscreen(el) {
        if (!el) return;
        try { if (el.requestFullscreen) el.requestFullscreen(); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); } catch (e) {}
    }

    function renderCounts() {
        var c = counts();
        q('mcm5Total').textContent = c.total; q('mcm5Online').textContent = c.online; q('mcm5Attention').textContent = c.attention; q('mcm5Offline').textContent = c.offline;
        q('mcm5TotalSub').textContent = c.online + ' Online · ' + c.offline + ' Offline';
    }

    function renderList() {
        var list = filteredNodes();
        var pages = Math.max(1, Math.ceil(list.length / state.pageSize)); if (state.page > pages) state.page = pages;
        var start = (state.page - 1) * state.pageSize, items = list.slice(start, start + state.pageSize), html = [];
        items.forEach(function (n) {
            var s = statusOf(n), active = n._id === state.selectedId ? ' active' : '', fav = isFavorite(n._id) ? ' favorite' : '';
            html.push('<button class="mcm5-device-row' + active + fav + '" data-nodeid="' + esc(n._id) + '"><span class="mcm5-dev-name"><i>' + (isFavorite(n._id) ? '★' : '▣') + '</i><span><b>' + esc(nodeName(n)) + '</b><small>' + esc(meshName(n)) + '</small></span></span><span class="mcm5-status ' + s + '"><i></i>' + statusLabel(s) + '</span><span class="mcm5-ip">' + esc(nodeIp(n)) + '</span></button>');
        });
        q('mcm5DeviceList').innerHTML = html.join('') || '<div class="mcm5-empty">Nenhum dispositivo encontrado.</div>';
        qa('[data-nodeid]', q('mcm5DeviceList')).forEach(function (b) { b.addEventListener('click', function () { selectNode(b.dataset.nodeid); }); });
        q('mcm5Page').textContent = state.page + ' / ' + pages;
        q('mcm5Range').textContent = list.length ? ((start + 1) + '–' + Math.min(start + state.pageSize, list.length) + ' de ' + list.length) : '0 dispositivos';
        q('mcm5Prev').disabled = state.page <= 1; q('mcm5Next').disabled = state.page >= pages;
    }

    function renderDetail() {
        var n = selectedNode();
        if (!n) {
            q('mcm5DeviceName').textContent = 'Selecione um dispositivo'; q('mcm5DeviceMeta').textContent = 'Escolha um item na lista à esquerda';
            q('mcm5DeviceStatus').textContent = '—'; q('mcm5DeviceStatus').className = 'mcm5-pill muted'; q('mcm5Favorite').textContent = '☆';
            q('mcm5Info').innerHTML = '<div class="mcm5-empty">Nenhum dispositivo selecionado.</div>'; q('mcm5Health').innerHTML = '<div class="mcm5-empty">—</div>'; return;
        }
        var s = statusOf(n), online = isOnline(n), caps = agentCaps(n);
        q('mcm5DeviceName').textContent = nodeName(n); q('mcm5DeviceMeta').textContent = [nodeIp(n), meshName(n), nodeOs(n)].filter(function (x) { return x && x !== '—'; }).join('  |  ') || '—';
        q('mcm5DeviceStatus').textContent = statusLabel(s); q('mcm5DeviceStatus').className = 'mcm5-pill ' + s; q('mcm5Favorite').textContent = isFavorite(n._id) ? '★' : '☆';
        q('mcm5ScreenTitle').textContent = nodeName(n); q('mcm5ScreenText').textContent = online ? 'Dispositivo online. Desktop, Terminal e Arquivos podem permanecer abertos em abas persistentes.' : 'Dispositivo offline. As funções ficam disponíveis novamente quando a comunicação retornar.';
        q('mcm5RemoteState').className = 'mcm5-pill ' + s; q('mcm5RemoteState').textContent = statusLabel(s); q('mcm5HealthPill').className = 'mcm5-pill ' + s; q('mcm5HealthPill').textContent = statusLabel(s);
        q('mcm5Info').innerHTML = [
            ['Nome', nodeName(n)], ['Estado', statusLabel(s)], ['Endereço IP', nodeIp(n)], ['Grupo', meshName(n)], ['Sistema Operacional', nodeOs(n)], ['Agente', agentVersion(n)], ['Intel AMT', amtVersion(n)], ['Node ID', n._id]
        ].map(function (x) { return '<div><dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd></div>'; }).join('');
        q('mcm5Health').innerHTML = [
            '<div><span>Conectividade</span><b class="' + s + '">' + statusLabel(s) + '</b></div>',
            '<div><span>Desktop</span><b class="' + (hasCap(n,1) || n.intelamt ? 'online' : '') + '">' + (hasCap(n,1) || n.intelamt ? 'Disponível' : 'Não detectado') + '</b></div>',
            '<div><span>Terminal</span><b class="' + (hasCap(n,2) ? 'online' : '') + '">' + (hasCap(n,2) ? 'Disponível' : 'Não detectado') + '</b></div>',
            '<div><span>Arquivos</span><b class="' + (hasCap(n,4) ? 'online' : '') + '">' + (hasCap(n,4) ? 'Disponível' : 'Não detectado') + '</b></div>',
            '<div><span>Console</span><b>' + (hasCap(n,8) ? 'Disponível' : '—') + '</b></div>',
            '<div><span>Intel AMT</span><b>' + esc(amtVersion(n)) + '</b></div>',
            '<div><span>Caps</span><b>' + caps + '</b></div>'
        ].join('');
    }

    function renderGroups() {
        var groups = meshEntries(), nodes = allNodes(), html = [];
        groups.forEach(function (g) {
            var list = nodes.filter(function (n) { return n.meshid === g.id; }), c = countsFor(list);
            html.push('<button class="mcm5-group-card" data-groupid="' + esc(g.id) + '"><div class="mcm5-group-icon">⌘</div><div class="mcm5-group-main"><h3>' + esc(g.name) + '</h3><p>' + c.total + ' dispositivos</p><div><span class="online">● ' + c.online + ' online</span><span class="offline">● ' + c.offline + ' offline</span></div></div><span class="mcm5-group-arrow">›</span></button>');
        });
        q('mcm5GroupsGrid').innerHTML = html.join('') || '<div class="mcm5-empty">Nenhum grupo encontrado.</div>';
        qa('[data-groupid]', q('mcm5GroupsGrid')).forEach(function (b) { b.addEventListener('click', function () { state.group = b.dataset.groupid; state.page = 1; saveState(); showDevicesPage(); q('mcm5GroupFilter').value = state.group; renderList(); }); });
    }

    function render() {
        if (!q('mcmV5Shell')) return;
        renderCounts(); populateGroupFilter();
        var list = filteredNodes();
        if (!state.selectedId || !nodeMap()[state.selectedId]) {
            state.selectedId = list.length ? list[0]._id : null; saveState();
        }
        renderList(); renderDetail();
        if (state.section === 'groups') renderGroups();
    }

    function toast(message) {
        var host = q('mcm5Toasts'); if (!host) return;
        var el = document.createElement('div'); el.className = 'mcm5-toast'; el.textContent = message; host.appendChild(el);
        later(function () { el.classList.add('show'); }, 20); later(function () { el.classList.remove('show'); later(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250); }, 2200);
    }

    function updateLiveIndicator() {
        var dot = q('mcm5LiveDot'), label = q('mcm5LiveText'); if (!dot || !label) return;
        var online = counts().online;
        dot.className = 'mcm5-live-dot ' + (online > 0 ? 'online' : 'offline'); label.textContent = online + ' online · atualizado agora';
    }

    function activate() {
        if (!document.body) return;
        buildShell(); render(); updateLiveIndicator();
        if (state.section === 'groups') showGroupsPage();
        else if (state.section && state.section !== 'devices' && state.section.indexOf('LeftMenu') === 0) {
            var b = document.querySelector('.mcm5-navitem[data-native="' + state.section + '"]'); if (b) openNativeSection(state.section, b.dataset.label || 'Seção'); else showDevicesPage();
        } else showDevicesPage();
        if (state.tool !== 'overview' && selectedNode()) showTool(state.tool);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', activate, { once:true }); else activate();
    window.addEventListener('load', function () { activate(); later(render, 500); }, { once:true });
    window.setInterval(function () {
        if (!q('mcmV5Shell') || !state.shellVisible) return;
        renderCounts(); updateLiveIndicator(); renderDetail(); updateToolSession();
    }, 3000);
})();
