# MeshCentral Modern UI V8 — Validation

## Promotion gate
Do not promote V8 until all items below pass on the real MeshCentral 1.2.5 environment.

### Landing / navigation
- [ ] Fresh page load lands on **Central de Operações**.
- [ ] Top navigation remains usable after the late MeshCentral/V5 load cycle.
- [ ] Navigating manually away from Central de Operações is not overridden afterwards.

### Search
- [ ] Ctrl+K focuses global search.
- [ ] Search returns device name, IP, OS, group and tag matches.
- [ ] Search returns group matches.
- [ ] Clicking a device result opens the Devices workspace and selects the correct endpoint.
- [ ] Enter opens the first result.
- [ ] Escape closes results.

### Stable state
- [ ] Selected device name does not oscillate during background refresh.
- [ ] Online/offline badge does not flicker because of transient MeshCentral object updates.
- [ ] IP/OS/group fields remain stable.
- [ ] User selection is not silently replaced by another device.
- [ ] Genuine state changes are reflected after the stability window.

### Files / editor
- [ ] Files native engine loads inside Command Center.
- [ ] Edit text file opens as an integrated full-frame editor.
- [ ] Text area is selectable/editable.
- [ ] Save works.
- [ ] Cancel/close works.
- [ ] After closing editor, file list is fully interactive.
- [ ] Upload/download/navigation remain functional.

### Unified device tools
- [ ] Desktop/KVM feels visually continuous with the device workspace.
- [ ] Terminal feels visually continuous with the device workspace.
- [ ] Files feels visually continuous with the device workspace.
- [ ] Events / Details / Console use the same palette and typography.
- [ ] Desktop mouse/keyboard/Ctrl+Alt+Del/fullscreen are unchanged.
- [ ] Persistent Desktop -> Terminal -> Desktop session behavior remains intact.

### Visual
- [ ] Segoe UI Variable / Segoe UI font stack renders correctly on Edge/Windows.
- [ ] Palette is softer and readable in dark mode.
- [ ] Device list is readable at normal browser zoom.
- [ ] No controls are clipped at 1366x768, 1920x1080 and the production workstation resolution.

### Rollback
- [ ] Reinstalling V7 restores V7 without restart.
- [ ] Reinstalling V6 restores V6 without restart.
- [ ] UI Settings -> Classic remains fully original.
