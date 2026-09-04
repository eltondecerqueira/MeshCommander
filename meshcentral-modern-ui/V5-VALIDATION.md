# MeshCentral Modern UI V5 — Validation Plan

## Objective
Validate a persistent Command Center experience while keeping the original MeshCentral 1.2.5 engine, authentication, permissions, KVM, terminal, files, Intel AMT and power dialogs untouched.

## Safety model
- `master`: original fork baseline.
- `feature/meshcentral-modern-ui-v1`: V3 validated shell.
- `feature/meshcentral-modern-ui-v4`: V4 validated embedded native tools.
- `feature/meshcentral-modern-ui-v5`: V5 candidate.
- Classic UI remains the immediate operational fallback.
- `node_modules` and `config.json` are never modified by the installer.
- Existing `meshcentral-web` assets are backed up before every update.
- Installer validates JavaScript syntax before writing.

## V5 acceptance checks

### Shell and state
- [ ] V5 marker reports `v5`.
- [ ] Devices page loads with real counts.
- [ ] Selected device survives browser refresh in the same session.
- [ ] Search, group filter, status filter and sort survive refresh.
- [ ] Favorite devices remain after browser restart.
- [ ] Groups page shows real MeshCentral groups and counts.

### Native tool integration
For an online agent-managed Windows device:
- [ ] Desktop opens inside Command Center.
- [ ] Connect starts a real Desktop session.
- [ ] Switch Desktop -> Terminal -> Desktop without recreating the Desktop iframe.
- [ ] Desktop session remains available when returning to its tab.
- [ ] Terminal opens and connects.
- [ ] Files opens and connects.
- [ ] Events renders for the selected device.
- [ ] Details / Intel AMT renders.
- [ ] Console renders when permitted.
- [ ] `Encerrar aba` destroys only the active embedded tool.
- [ ] Selecting a different device closes embedded frames from the previous device.
- [ ] Fullscreen works for embedded tool frame.
- [ ] Native new-tab fallback works.

### Power safety
- [ ] Power quick action opens the original MeshCentral power dialog.
- [ ] No power action is sent directly by V5.
- [ ] Original permission checks remain enforced.
- [ ] Cancel closes without any power change.

### Administrative sections
- [ ] Events opens embedded.
- [ ] Files opens embedded.
- [ ] My Account opens embedded.
- [ ] Users opens embedded for authorized users.
- [ ] Server opens embedded for authorized users.
- [ ] Native new-tab fallback works.

### Rollback
- [ ] `Abrir visão nativa` immediately reveals native Modern UI.
- [ ] `UI Settings -> Classic` works.
- [ ] Reinstalling V4 assets restores V4 without server restart when `meshcentral-web` is already active.
- [ ] `rollback.js` restores/removes override if required.

## Promotion gate
Do not merge or treat V5 as the primary interface until Desktop/KVM, Terminal, Files, Power, Intel AMT and Classic rollback have all been validated on the production-like environment.
