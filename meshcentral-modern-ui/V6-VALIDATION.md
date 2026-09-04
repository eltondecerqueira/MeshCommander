# V6 Validation Matrix

Use V6 only as a parallel Modern UI candidate. Classic and V5 remain fallback paths.

## Preflight
- [ ] `install.js --dry-run` reports JS base OK, JS V6 OK, CSS V6 present, template injection validated.
- [ ] No restart performed when `meshcentral-web` is already active.
- [ ] Browser reports `document.documentElement.getAttribute('data-mc-modern-overlay') === 'v6'`.
- [ ] Embedded tool frame reports `data-mc-modern-native="v6"`.

## Desktop / KVM
- [ ] Open online device.
- [ ] Open Desktop.
- [ ] Connect.
- [ ] Keyboard works.
- [ ] Mouse works.
- [ ] Ctrl+Alt+Del works.
- [ ] Clipboard behavior unchanged.
- [ ] Monitor/session selector works when available.
- [ ] Fullscreen works.
- [ ] Disconnect works.
- [ ] Return to Desktop after Terminal preserves session when expected by V5.

## Terminal
- [ ] Connect terminal.
- [ ] Type commands.
- [ ] Resize shell/panel.
- [ ] Disconnect/reconnect.
- [ ] Switch Desktop -> Terminal -> Desktop without breaking either session.

## Files
- [ ] Browse directories.
- [ ] Upload a test file.
- [ ] Download the test file.
- [ ] Rename test file.
- [ ] Delete test file.
- [ ] Context menu still works.

## Native device functions
- [ ] Events renders.
- [ ] Details renders.
- [ ] Intel AMT information renders when device supports it.
- [ ] Console renders.
- [ ] Native warnings remain visible.
- [ ] Native dialogs remain usable.

## Power safety
- [ ] Power action opens the original MeshCentral dialog.
- [ ] Permission restrictions remain enforced.
- [ ] Confirmation remains required where it was required before.
- [ ] Cancel does not execute an action.

## Administrative sections
- [ ] My Account.
- [ ] Events.
- [ ] Files.
- [ ] Users (authorized account only).
- [ ] Server (authorized account only).

## Rollback
- [ ] Modern -> Classic returns original UI immediately.
- [ ] Reinstall V5 assets and hard refresh returns V5 behavior.
- [ ] No change to `node_modules/meshcentral`.
- [ ] No change to `meshcentral-data/config.json`.
