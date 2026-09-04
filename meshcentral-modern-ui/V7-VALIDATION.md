# V7 validation — Service Desk UX, dashboards and automation lab

Do not promote V7 until this checklist is completed in the real MeshCentral 1.2.5 environment.

## Installation safety

- [ ] `install.js --dry-run` returns preflight OK.
- [ ] No `node_modules` file changes.
- [ ] No `config.json` changes.
- [ ] No MeshCentral restart required when override is already active.
- [ ] `data-mc-modern-overlay` returns `v7`.
- [ ] UI Settings → Classic still opens original UI.
- [ ] Reinstalling V6 restores the V6 experience.

## Global navigation

- [ ] Permanent sidebar is gone in V7.
- [ ] Visão Geral works.
- [ ] Dispositivos works.
- [ ] Grupos works.
- [ ] Automação works.
- [ ] Atividade works.
- [ ] Mais → Minha Conta works.
- [ ] Mais → Eventos works.
- [ ] Mais → Arquivos works.
- [ ] Mais → Usuários works.
- [ ] Mais → Servidor works.
- [ ] Interface nativa escape still works.

## Dashboard

- [ ] Endpoint total matches the device list.
- [ ] Online/offline counts match V6/V5.
- [ ] Group count is reasonable.
- [ ] Intel AMT coverage is reasonable.
- [ ] OS distribution reflects actual estate.
- [ ] Health-by-group cards open the correct group filter.
- [ ] Service Desk queue opens the correct device.
- [ ] Availability trend is labelled as browser-observed data.
- [ ] No chart claims CPU/RAM/disk historical data that MeshCentral core has not collected as a time series.

## Device workflow regression

- [ ] Select device from V7 Devices.
- [ ] Desktop/KVM connects.
- [ ] Keyboard/mouse works.
- [ ] Ctrl+Alt+Del works.
- [ ] Fullscreen works.
- [ ] Terminal works.
- [ ] Files works.
- [ ] Events works.
- [ ] Details/AMT works.
- [ ] Console works.
- [ ] Hardware modern tab works.
- [ ] Network modern tab works.
- [ ] Config modern tab works.
- [ ] Tools modern tab works.
- [ ] Persistent sessions still behave exactly like V5/V6.

## Automation Lab

- [ ] Playbook cards render.
- [ ] New rule modal works.
- [ ] Rule simulation reports match count only.
- [ ] Creating/deleting a rule does not alter MeshCentral database.
- [ ] Installing V7 does not start `meshcentral-automation/worker.js`.
- [ ] Worker remains dry-run until separately deployed and approved.

## Service Desk acceptance

Ask at least one technician to perform these tasks without guidance:

1. Find an offline PC.
2. Filter to a location/group.
3. Open an online PC and connect Desktop.
4. Switch Desktop → Terminal → Desktop.
5. Find recent devices.
6. Identify the group with most offline devices.
7. Find where automation rules are created.
8. Return to the native UI.

Capture click count and time-to-task compared with V6/native UI.
