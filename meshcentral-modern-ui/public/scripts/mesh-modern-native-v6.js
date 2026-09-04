(function () {
    'use strict';

    var VERSION = 'v6';
    var params = new URLSearchParams(window.location.search);
    var EMBED = params.get('mcmembed') === '1';
    var panel = parseInt(params.get('mcmpanel') || params.get('viewmode') || '0', 10) || 0;
    var section = params.get('mcmsection') || '';
    var nodeid = params.get('mcmnode') || params.get('gotonode') || '';
    var observer = null;
    var decorated = false;

    function q(id) { return document.getElementById(id); }
    function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function later(fn, delay) { window.setTimeout(function () { try { fn(); } catch (e) {} }, delay || 0); }

    function panelName(v) {
        return ({10:'Visão Geral',11:'Desktop / KVM',12:'Terminal',13:'Arquivos',15:'Console',16:'Eventos',17:'Detalhes / Intel AMT'})[v] || 'MeshCentral';
    }

    function detectPanelRoot() {
        var candidates = [];
        if (panel) candidates.push('p' + panel);
        if (panel === 11) candidates.push('p11');
        if (panel === 12) candidates.push('p12');
        if (panel === 13) candidates.push('p13','p10files');
        if (panel === 15) candidates.push('p15');
        if (panel === 16) candidates.push('p16');
        if (panel === 17) candidates.push('p17');
        for (var i = 0; i < candidates.length; i++) {
            var el = q(candidates[i]);
            if (el) return el;
        }
        var visible = qa('#column_l > div[id^="p"], #container > div[id^="p"]').filter(function (el) {
            var s = window.getComputedStyle(el);
            return s.display !== 'none' && s.visibility !== 'hidden';
        });
        return visible[0] || q('column_l') || q('container') || document.body;
    }

    function addClassMany(list, cls) {
        list.forEach(function (el) { if (el && !el.classList.contains(cls)) el.classList.add(cls); });
    }

    function decorateControls(root) {
        addClassMany(qa('button,input[type="button"],input[type="submit"],input[type="reset"]', root), 'mcm6-native-button');
        addClassMany(qa('input[type="text"],input[type="password"],input[type="search"],input[type="number"],input[type="email"],textarea,select', root), 'mcm6-native-control');
        addClassMany(qa('table', root), 'mcm6-native-table');
        addClassMany(qa('.areaHead,.areaHead2,.areaHead3,.toolbar,.toolBar,.tab,.tab2,.tab3', root), 'mcm6-native-toolbar');
        addClassMany(qa('.warningbox,.warningBox,.warning,.alert,.alert-warning,.alert-danger', root), 'mcm6-native-warning');
        addClassMany(qa('.dialog,.modal,.modal-dialog,.modal-content,[id*="Dialog"],[id*="dialog"]', document), 'mcm6-native-dialog');
        addClassMany(qa('.contextMenu,.contextmenu,.menu', document), 'mcm6-native-menu');
    }

    function decorateDesktop(root) {
        document.body.classList.add('mcm6-desktop');
        var desk = q('Desk');
        if (desk) desk.classList.add('mcm6-desktop-canvas');
        ['deskarea0','deskarea1','deskarea2','DeskParent','DeskArea'].forEach(function (id) {
            var el = q(id); if (el) el.classList.add('mcm6-desktop-area');
        });
        ['p11DeskConsoleMsg','p11DeskSessionSelector','DeskMonitorSelectionSpan','deskMobileActionsPanel'].forEach(function (id) {
            var el = q(id); if (el) el.classList.add('mcm6-floating-panel');
        });
    }

    function decorateTerminal(root) {
        document.body.classList.add('mcm6-terminal');
        ['Term','terminal','xterm','termarea','p12TermConsoleMsg'].forEach(function (id) {
            var el = q(id); if (el) el.classList.add('mcm6-terminal-surface');
        });
        addClassMany(qa('.xterm,.xterm-screen,.terminal,pre', root), 'mcm6-terminal-surface');
    }

    function decorateFiles(root) {
        document.body.classList.add('mcm6-files');
        addClassMany(qa('[id*="file" i],[class*="file" i]', root), 'mcm6-files-surface');
    }

    function decorateDetails(root) {
        document.body.classList.add('mcm6-details');
        addClassMany(qa('fieldset,.groupbox,.form-group,.card,.panel', root), 'mcm6-native-card');
    }

    function installEmbedBadge(root) {
        if (q('mcm6NativeBadge')) return;
        var badge = document.createElement('div');
        badge.id = 'mcm6NativeBadge';
        badge.setAttribute('aria-hidden', 'true');
        badge.innerHTML = '<span></span><b>' + panelName(panel) + '</b><small>motor nativo</small>';
        (q('column_l') || document.body).appendChild(badge);
    }

    function applyNativeSkin() {
        if (!document.body) return false;
        document.documentElement.setAttribute('data-mc-modern-native', VERSION);
        document.body.classList.add('mcm-native-v6');
        if (panel) document.body.classList.add('mcm6-panel-' + panel);
        if (section) document.body.classList.add('mcm6-section-native');

        var root = detectPanelRoot();
        if (!root) return false;
        root.classList.add('mcm6-native-root');
        root.setAttribute('data-mcm6-panel', String(panel || section || 'native'));
        decorateControls(root);
        if (panel === 11) decorateDesktop(root);
        else if (panel === 12) decorateTerminal(root);
        else if (panel === 13) decorateFiles(root);
        else if (panel === 17 || panel === 10) decorateDetails(root);
        installEmbedBadge(root);
        decorated = true;
        notifyParent('ready');
        return true;
    }

    function notifyParent(state) {
        if (window.parent === window) return;
        try {
            window.parent.postMessage({
                source:'meshcommander-v6',
                type:'native-state',
                state:state,
                panel:panel,
                section:section,
                nodeid:nodeid,
                title:panelName(panel)
            }, window.location.origin);
        } catch (e) {}
    }

    function watchNativeDom() {
        if (observer || !document.body) return;
        observer = new MutationObserver(function (mutations) {
            var shouldRefresh = false;
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].addedNodes && mutations[i].addedNodes.length) { shouldRefresh = true; break; }
            }
            if (shouldRefresh) later(applyNativeSkin, 30);
        });
        observer.observe(document.body, { childList:true, subtree:true });
    }

    function initEmbedded() {
        var tries = 0;
        function attempt() {
            tries++;
            applyNativeSkin();
            watchNativeDom();
            if (!decorated && tries < 40) later(attempt, 150);
        }
        attempt();
        window.addEventListener('load', function () { later(applyNativeSkin, 150); }, { once:true });
        window.addEventListener('beforeunload', function () { notifyParent('unloading'); });
    }

    function enhanceParent() {
        document.documentElement.setAttribute('data-mc-modern-overlay', VERSION);
        var version = q('mcm5Version') || document.querySelector('.mcm5-version');
        if (version) version.textContent = 'UI v6 · ambiente paralelo';

        window.addEventListener('message', function (ev) {
            if (ev.origin !== window.location.origin || !ev.data || ev.data.source !== 'meshcommander-v6') return;
            var data = ev.data;
            var frame = null;
            qa('iframe.mcm5-native-frame, #mcm5FrameHost iframe, #mcm5SectionFrame').some(function (f) {
                if (f.contentWindow === ev.source) { frame = f; return true; }
                return false;
            });
            if (!frame) return;
            frame.dataset.mcm6State = data.state || '';
            frame.dataset.mcm6Panel = String(data.panel || '');
            var wrap = frame.closest('.mcm5-framewrap,.mcm5-frame-slot,.mcm5-section-frame');
            if (wrap) wrap.classList.toggle('mcm6-native-ready', data.state === 'ready');
            var sync = q('mcm5LiveText');
            if (sync && data.state === 'ready') sync.textContent = (data.title || 'Ferramenta') + ' pronta';
        });

        var shell = q('mcmV5Shell');
        if (shell) shell.classList.add('mcm6-shell-enhanced');
        installDeviceInspector();
    }

    /* ------------------------------------------------------------------
       V6 read-only device inspector. This adds modern tabs without touching
       MeshCentral write paths. Editing/actions still route to native tools.
       ------------------------------------------------------------------ */
    function readV5State() {
        try { return JSON.parse(sessionStorage.getItem('meshcommander-v5-state') || '{}') || {}; }
        catch (e) { return {}; }
    }

    function selectedNodeFromShell() {
        var active = document.querySelector('.mcm5-device-row.active[data-nodeid]');
        var id = active ? active.dataset.nodeid : readV5State().selectedId;
        if (!id) return null;
        if (window.nodes && window.nodes[id]) return window.nodes[id];
        if (window.meshNodes && window.meshNodes[id]) return window.meshNodes[id];
        var map = window.nodes || window.meshNodes || {};
        var keys = Object.keys(map);
        for (var i = 0; i < keys.length; i++) {
            if (map[keys[i]] && map[keys[i]]._id === id) return map[keys[i]];
        }
        return null;
    }

    function val(v) { return (v == null || v === '') ? '—' : String(v); }
    function html(v) { return val(v).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
    function meshLabel(n) {
        try { var m = window.meshes && n && n.meshid ? window.meshes[n.meshid] : null; return val(m && (m.name || m.mname)); }
        catch (e) { return '—'; }
    }
    function amt(n) { return n && n.intelamt ? n.intelamt : {}; }
    function agent(n) { return n && n.agent ? n.agent : {}; }
    function capabilities(n) {
        var caps = Number(agent(n).caps || 0), out = [];
        if (caps & 1) out.push('Desktop');
        if (caps & 2) out.push('Terminal');
        if (caps & 4) out.push('Arquivos');
        if (caps & 8) out.push('Console');
        if (n && n.intelamt) out.push('Intel AMT');
        return out.length ? out : ['Nenhuma capacidade anunciada'];
    }

    function installInspectorStyles() {
        if (q('mcm6InspectorStyles')) return;
        var style = document.createElement('style');
        style.id = 'mcm6InspectorStyles';
        style.textContent = [
            '#mcm6InspectorView{padding:10px;min-height:420px;color:#eaf3ff;background:#0b1727}',
            '#mcm6InspectorView[hidden]{display:none!important}',
            '.mcm6-inspector-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}',
            '.mcm6-inspector-card{min-width:0;background:#0f1f33;border:1px solid #223650;border-radius:10px;overflow:hidden}',
            '.mcm6-inspector-card>header{min-height:38px;padding:0 11px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #223650}',
            '.mcm6-inspector-card>header b{font-size:10px;color:#eef6ff}.mcm6-inspector-card>header small{font-size:7px;color:#718aa9}',
            '.mcm6-kv{margin:0;padding:7px 11px}.mcm6-kv>div{min-height:29px;display:grid;grid-template-columns:132px minmax(0,1fr);align-items:center;gap:8px;border-bottom:1px solid #1b2e46}',
            '.mcm6-kv>div:last-child{border-bottom:0}.mcm6-kv dt{color:#839bb9;font-size:8px}.mcm6-kv dd{margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#d9e6f5;font-size:8.5px}',
            '.mcm6-chiplist{padding:11px;display:flex;gap:6px;flex-wrap:wrap}.mcm6-chip{padding:4px 8px;border-radius:999px;color:#83d0ff;background:#11395f;border:1px solid #245884;font-size:8px}',
            '.mcm6-toolgrid{padding:11px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.mcm6-toolgrid button{min-height:64px;padding:9px;color:#dceaff;text-align:left;background:#12243a;border:1px solid #2b4563;border-radius:8px;cursor:pointer}.mcm6-toolgrid button:hover{background:#17314f;border-color:#3e668e}.mcm6-toolgrid button b{display:block;font-size:9px}.mcm6-toolgrid button small{display:block;margin-top:4px;color:#7891b1;font-size:7px}',
            '.mcm6-inspector-actions{padding:10px 11px;border-top:1px solid #223650;display:flex;gap:7px;flex-wrap:wrap}.mcm6-inspector-actions button{min-height:29px;padding:0 10px;color:#dceaff;background:#13243a;border:1px solid #2d4664;border-radius:7px;cursor:pointer;font-size:8px}',
            '.mcm6-inspector-actions button.primary{color:#fff;background:#1769da;border-color:#3f8dff}',
            '@media(max-width:1000px){.mcm6-inspector-grid{grid-template-columns:1fr}.mcm6-toolgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}'
        ].join('');
        document.head.appendChild(style);
    }

    function ensureInspectorView() {
        var detail = document.querySelector('.mcm5-detailpane');
        if (!detail) return null;
        var view = q('mcm6InspectorView');
        if (view) return view;
        view = document.createElement('section');
        view.id = 'mcm6InspectorView';
        view.hidden = true;
        detail.appendChild(view);
        return view;
    }

    function nativeTool(tool) {
        var b = document.querySelector('.mcm5-detailtabs button[data-tool="' + tool + '"]');
        if (b) b.click();
    }

    function renderInspector(kind) {
        var view = ensureInspectorView();
        if (!view) return;
        var n = selectedNodeFromShell();
        if (!n) { view.innerHTML = '<div class="mcm6-inspector-card"><div style="padding:18px">Selecione um dispositivo.</div></div>'; return; }
        var a = agent(n), iamt = amt(n), tags = Array.isArray(n.tags) ? n.tags : [];
        var os = n.osdesc || n.os || n.platform || '—';
        var ip = n.ip || n.ipaddr || n.addr || n.host || '—';
        var conn = Number(n.conn || 0);
        var title = kind === 'hardware' ? 'Hardware e Agente' : kind === 'network' ? 'Rede e Conectividade' : kind === 'config' ? 'Configuração' : 'Ferramentas';
        var body = '';

        if (kind === 'hardware') {
            body = '<div class="mcm6-inspector-grid">' +
                card('Sistema','Dados anunciados pelo agente', kv([
                    ['Nome', n.name || n.host], ['Sistema operacional', os], ['Plataforma', n.platform], ['Grupo', meshLabel(n)], ['Agente', a.ver || a.version || a.id || (n.agent ? 'Detectado' : '—')], ['Agent ID', a.id]
                ])) +
                card('Intel AMT','Gerenciamento fora de banda', kv([
                    ['Versão', iamt.ver || iamt.version], ['Host', iamt.host], ['Estado', iamt.state], ['TLS', iamt.tls == null ? '—' : (iamt.tls ? 'Ativo' : 'Inativo')], ['SKU', iamt.sku]
                ])) +
                card('Capacidades','Recursos detectados','<div class="mcm6-chiplist">' + capabilities(n).map(function(x){return '<span class="mcm6-chip">'+html(x)+'</span>';}).join('') + '</div>') +
                card('Identificadores','Referência técnica', kv([['Node ID',n._id],['Mesh ID',n.meshid],['Tipo',n.mtype || n.type],['Ícone',n.icon]])) +
                '</div>' + actions([['details','Abrir inventário/detalhes nativos',true],['console','Console',false]]);
        } else if (kind === 'network') {
            body = '<div class="mcm6-inspector-grid">' +
                card('Conectividade','Estado atual', kv([['Endereço IP',ip],['Connection mask',conn],['Online',conn > 0 ? 'Sim':'Não'],['Grupo',meshLabel(n)],['Host AMT',iamt.host],['TLS AMT',iamt.tls == null ? '—' : (iamt.tls ? 'Ativo':'Inativo')]])) +
                card('Identidade de rede','Dados disponíveis', kv([['Hostname',n.host || n.name],['Node ID',n._id],['Mesh ID',n.meshid],['WAN/IP',n.wanonly || n.ip]])) +
                card('Tags','Organização','<div class="mcm6-chiplist">' + (tags.length ? tags.map(function(x){return '<span class="mcm6-chip">'+html(x)+'</span>';}).join('') : '<span class="mcm6-chip">Sem tags</span>') + '</div>') +
                card('Acesso remoto','Ferramentas de conectividade','<div class="mcm6-toolgrid">'+toolButton('desktop','Desktop / KVM','Controle gráfico')+toolButton('terminal','Terminal','Linha de comando')+toolButton('files','Arquivos','Transferência')+'</div>') +
                '</div>' + actions([['details','Abrir detalhes nativos',true]]);
        } else if (kind === 'config') {
            body = '<div class="mcm6-inspector-grid">' +
                card('Dispositivo','Configuração conhecida',kv([['Nome',n.name],['Grupo',meshLabel(n)],['Node ID',n._id],['Mesh ID',n.meshid],['Tipo',n.mtype || n.type],['Sistema',os]])) +
                card('Gerenciamento','Motores disponíveis',kv([['Agente',n.agent ? 'Ativo/detectado':'—'],['Intel AMT',n.intelamt ? 'Disponível':'—'],['Connection mask',conn],['Capacidades',capabilities(n).join(', ')]])) +
                card('Tags','Metadados','<div class="mcm6-chiplist">'+(tags.length ? tags.map(function(x){return '<span class="mcm6-chip">'+html(x)+'</span>';}).join('') : '<span class="mcm6-chip">Sem tags</span>')+'</div>') +
                card('Regra V6','Alterações sensíveis','<div style="padding:12px;color:#9db2cc;font-size:8px;line-height:1.6">A V6 não grava configuração diretamente. Use a tela nativa para editar propriedades, permissões, AMT ou ações administrativas.</div>') +
                '</div>' + actions([['details','Editar/abrir detalhes nativos',true],['events','Ver eventos',false]]);
        } else {
            body = '<div class="mcm6-inspector-grid">' +
                card('Acesso remoto','Sessões nativas persistentes','<div class="mcm6-toolgrid">'+toolButton('desktop','Desktop / KVM','Tela, teclado e mouse')+toolButton('terminal','Terminal','Shell remoto')+toolButton('files','Arquivos','Upload e download')+toolButton('console','Console','Console do agente')+'</div>') +
                card('Diagnóstico','Investigar dispositivo','<div class="mcm6-toolgrid">'+toolButton('events','Eventos / Logs','Histórico operacional')+toolButton('details','Detalhes / AMT','Inventário e AMT')+'<button data-mcm6-power><b>Energia</b><small>Diálogo nativo protegido</small></button></div>') +
                '</div>';
        }
        view.innerHTML = '<div style="margin-bottom:9px"><b style="font-size:12px">'+html(title)+'</b><div style="margin-top:2px;color:#7891b1;font-size:8px">'+html(n.name || n.host || n._id)+'</div></div>' + body;
        qa('[data-mcm6-tool]', view).forEach(function(b){ b.addEventListener('click', function(){ hideInspector(); nativeTool(b.dataset.mcm6Tool); }); });
        qa('[data-mcm6-power]', view).forEach(function(b){ b.addEventListener('click', function(){ hideInspector(); var p=document.querySelector('[data-power]'); if(p)p.click(); }); });
    }

    function kv(rows) { return '<dl class="mcm6-kv">'+rows.map(function(r){return '<div><dt>'+html(r[0])+'</dt><dd>'+html(r[1])+'</dd></div>';}).join('')+'</dl>'; }
    function card(title, sub, content) { return '<section class="mcm6-inspector-card"><header><b>'+html(title)+'</b><small>'+html(sub)+'</small></header>'+content+'</section>'; }
    function toolButton(tool, title, sub) { return '<button data-mcm6-tool="'+tool+'"><b>'+html(title)+'</b><small>'+html(sub)+'</small></button>'; }
    function actions(items) { return '<div class="mcm6-inspector-actions">'+items.map(function(x){return '<button class="'+(x[2]?'primary':'')+'" data-mcm6-tool="'+x[0]+'">'+html(x[1])+'</button>';}).join('')+'</div>'; }

    function hideInspector() {
        var view = q('mcm6InspectorView'); if (view) view.hidden = true;
        qa('.mcm5-detailtabs button[data-mcm6-insight]').forEach(function(b){ b.classList.remove('active'); });
    }

    function showInspector(kind, button) {
        var view = ensureInspectorView(); if (!view) return;
        var overview = q('mcm5OverviewView'), tool = q('mcm5ToolView');
        if (overview) overview.hidden = true;
        if (tool) tool.hidden = true;
        qa('.mcm5-detailtabs button').forEach(function(b){ b.classList.remove('active'); });
        if (button) button.classList.add('active');
        renderInspector(kind);
        view.hidden = false;
    }

    function installDeviceInspector() {
        installInspectorStyles();
        var tries = 0;
        function ready() {
            tries++;
            var tabs = document.querySelector('.mcm5-detailtabs');
            if (!tabs) { if (tries < 40) later(ready, 150); return; }
            if (!tabs.querySelector('[data-mcm6-insight]')) {
                [['hardware','Hardware'],['network','Rede'],['config','Configurações'],['tools','Ferramentas']].forEach(function(x){
                    var b = document.createElement('button');
                    b.type = 'button'; b.dataset.mcm6Insight = x[0]; b.textContent = x[1];
                    b.addEventListener('click', function(){ showInspector(x[0], b); });
                    tabs.appendChild(b);
                });
                qa('.mcm5-detailtabs button[data-tool]').forEach(function(b){ b.addEventListener('click', hideInspector); });
                ensureInspectorView();
            }
        }
        ready();
    }

    function boot() {
        if (EMBED) initEmbedded();
        else enhanceParent();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
    else boot();
})();
