(function () {
  'use strict';

  var STORAGE_KEY = 'meshcommander.modernUI.enabled';
  var ROOT_ATTR = 'data-mesh-ui';
  var MODERN_VALUE = 'modern';
  var controlId = 'mcModernUiToggle';

  function storageGet() {
    try { return window.localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function storageSet(value) {
    try { window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch (e) { }
  }

  function isModernEnabled() {
    return document.documentElement.getAttribute(ROOT_ATTR) === MODERN_VALUE;
  }

  function applyMode(enabled, persist) {
    if (enabled) {
      document.documentElement.setAttribute(ROOT_ATTR, MODERN_VALUE);
      if (document.body) document.body.setAttribute(ROOT_ATTR, MODERN_VALUE);
    } else {
      document.documentElement.removeAttribute(ROOT_ATTR);
      if (document.body) document.body.removeAttribute(ROOT_ATTR);
    }

    var input = document.getElementById('mcModernUiCheckbox');
    if (input) input.checked = !!enabled;

    var text = document.getElementById('mcModernUiText');
    if (text) text.textContent = enabled ? 'Modern UI' : 'Classic UI';

    if (persist !== false) storageSet(!!enabled);
  }

  function createToggle() {
    if (!document.body || document.getElementById(controlId)) return;

    var wrap = document.createElement('div');
    wrap.id = controlId;
    wrap.title = 'Alternar entre a interface clássica e a interface moderna';
    wrap.style.cssText = [
      'position:fixed',
      'top:3px',
      'right:8px',
      'z-index:2147483647',
      'height:20px',
      'display:flex',
      'align-items:center',
      'gap:7px',
      'padding:0 8px',
      'border:1px solid rgba(255,255,255,.12)',
      'border-radius:6px',
      'background:rgba(26,31,39,.92)',
      'color:#f4f7fb',
      'font:600 11px/20px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'box-shadow:0 2px 10px rgba(0,0,0,.28)',
      'backdrop-filter:blur(8px)',
      'cursor:pointer',
      'user-select:none'
    ].join(';');

    var input = document.createElement('input');
    input.id = 'mcModernUiCheckbox';
    input.type = 'checkbox';
    input.setAttribute('aria-label', 'Toggle Modern UI');
    input.style.cssText = 'margin:0;width:12px;height:12px;cursor:pointer;accent-color:#3b82f6';

    var text = document.createElement('span');
    text.id = 'mcModernUiText';
    text.textContent = 'Modern UI';

    wrap.appendChild(input);
    wrap.appendChild(text);
    document.body.appendChild(wrap);

    input.addEventListener('change', function () {
      applyMode(input.checked, true);
    });

    wrap.addEventListener('click', function (event) {
      if (event.target === input) return;
      input.checked = !input.checked;
      applyMode(input.checked, true);
    });

    input.checked = isModernEnabled();
    text.textContent = input.checked ? 'Modern UI' : 'Classic UI';
  }

  function boot() {
    var stored = storageGet();
    // Safety first: first visit stays on the classic UI until the user enables Modern UI.
    applyMode(stored === '1', false);
    createToggle();
  }

  window.MeshCommanderModernUI = {
    enable: function () { applyMode(true, true); },
    disable: function () { applyMode(false, true); },
    toggle: function () { applyMode(!isModernEnabled(), true); },
    enabled: isModernEnabled
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
