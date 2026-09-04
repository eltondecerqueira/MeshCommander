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
            qa('iframe.mcm5-native-frame, #mcm5ToolFrames iframe, #mcm5SectionFrame').some(function (f) {
                if (f.contentWindow === ev.source) { frame = f; return true; }
                return false;
            });
            if (!frame) return;
            frame.dataset.mcm6State = data.state || '';
            frame.dataset.mcm6Panel = String(data.panel || '');
            var wrap = frame.closest('.mcm5-framewrap,.mcm5-toolframe,.mcm5-section-frame');
            if (wrap) wrap.classList.toggle('mcm6-native-ready', data.state === 'ready');
            var sync = q('mcm5LiveText');
            if (sync && data.state === 'ready') sync.textContent = (data.title || 'Ferramenta') + ' pronta';
        });

        // Keep the safe V5 shell while making the current candidate obvious.
        var shell = q('mcmV5Shell');
        if (shell) shell.classList.add('mcm6-shell-enhanced');
    }

    function boot() {
        if (EMBED) initEmbedded();
        else enhanceParent();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
    else boot();
})();
