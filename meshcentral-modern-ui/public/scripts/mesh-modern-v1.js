(function () {
    'use strict';

    var labels = {
        LeftMenuMyDevices: 'Devices',
        LeftMenuMyAccount: 'Account',
        LeftMenuMyEvents: 'Events',
        LeftMenuMyFiles: 'Files',
        LeftMenuMyUsers: 'Users',
        LeftMenuMyServer: 'Server'
    };

    function decorateSidebar() {
        Object.keys(labels).forEach(function (id) {
            var el = document.getElementById(id);
            if (!el || el.querySelector('.mcm-nav-label')) return;
            var span = document.createElement('span');
            span.className = 'mcm-nav-label';
            span.textContent = labels[id];
            el.appendChild(span);
            el.setAttribute('title', labels[id]);
        });
    }

    function activate() {
        if (!document.body) return;
        document.body.classList.add('mc-modern-v1');
        document.documentElement.setAttribute('data-mc-modern-overlay', 'v1.1');
        decorateSidebar();

        if (!document.getElementById('mcmModernMarker')) {
            var marker = document.createElement('div');
            marker.id = 'mcmModernMarker';
            marker.textContent = 'Modern UI v1.1';
            marker.setAttribute('aria-hidden', 'true');
            document.body.appendChild(marker);
        } else {
            document.getElementById('mcmModernMarker').textContent = 'Modern UI v1.1';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', activate, { once: true });
    } else {
        activate();
    }

    window.addEventListener('load', function () {
        activate();
        setTimeout(activate, 250);
    }, { once: true });
})();
