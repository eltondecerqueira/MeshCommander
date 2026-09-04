(function () {
    'use strict';

    function activate() {
        if (!document.body) return;
        document.body.classList.add('mc-modern-v1');
        document.documentElement.setAttribute('data-mc-modern-overlay', 'v1');

        // Keep a tiny visual marker during the validation phase.
        // It is intentionally non-interactive and omitted in full remote desktop mode by CSS.
        if (!document.getElementById('mcmModernMarker')) {
            var marker = document.createElement('div');
            marker.id = 'mcmModernMarker';
            marker.textContent = 'Modern UI v1';
            marker.setAttribute('aria-hidden', 'true');
            document.body.appendChild(marker);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', activate, { once: true });
    } else {
        activate();
    }
})();
