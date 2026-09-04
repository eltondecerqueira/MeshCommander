# MeshCentral Modern UI V9 — Validation

V9 remains a canary overlay. Do not promote to `master` until this checklist passes in the production-like environment.

## Safety baseline

- Classic UI must remain unchanged.
- `node_modules/meshcentral` must remain unchanged.
- `meshcentral-data/config.json` must remain unchanged.
- `install.js --dry-run` must pass before applying.
- Existing V8, V7 and V6 branches remain available for rollback.

## Critical regression: device identity/state

1. Select one known online endpoint.
2. Keep the page open for at least 60 seconds.
3. Confirm device name does not alternate with another endpoint.
4. Confirm Online/Offline does not flicker on the 3-second V5 refresh cycle.
5. Repeat with an offline endpoint.
6. Search/select a different endpoint and confirm the lock follows the explicit selection.

V9 fixes the root cause in MeshCentral 1.2.5: `window.nodes` is an array, so endpoint lookup must always use `_id`, never the array index.

## Dashboard compliance

Validate cards:
- Antivirus problem: compare at least 3 Windows endpoints against the Classic UI Windows Security Center status.
- Last seen >15 / >30 / >60 days: spot check against Classic UI last-connect values.
- Duplicates: validate repeated hostnames and, when available, UUID matches.
- Encryption: treat the count as coverage-based until sysinfo/BitLocker has been collected. Never interpret missing telemetry as unencrypted.

## Registry

1. Open a Windows endpoint that exposes Registry in Classic.
2. In Command Center, open `Registro`.
3. Browse HKLM and another hive.
4. Test a harmless edit only on an approved test endpoint.
5. Confirm permissions/consent/event logging remain native.
6. Confirm a user with No Registry permission does not gain access through V9.

Registry uses native MeshCentral panel 9 and protocol 4; V9 only hosts it inside the Command Center.

## Software

1. Open `Software` on an online Windows endpoint.
2. Confirm installed applications load exactly as in Classic/native UI.
3. Return to `Inventário` and search for one visible application.
4. Confirm the endpoint appears in results.
5. Confirm coverage counter increases only for actually indexed endpoints.

Important: MeshCentral 1.2.5 software inventory is live and not a fleet-wide cached database. V9 builds a progressive browser-side index from endpoints whose Software view has been loaded. Do not claim 100% fleet coverage until a collector is deployed.

## Automation — clean temporaries

Only test on an approved Windows test endpoint.

1. Select an online Windows endpoint.
2. Open Automation -> Ações rápidas -> Limpar temporários.
3. Confirm the confirmation dialog names the correct endpoint.
4. Execute.
5. Verify MeshCentral audit/event history records the `runcommands` action.
6. Confirm only `%TEMP%` and `C:\Windows\Temp` are targeted.
7. Confirm offline or non-Windows endpoints are blocked.

## Existing device functions

Regression test after V9:
- Desktop/KVM: mouse, keyboard, Ctrl+Alt+Del, fullscreen.
- Terminal: connect, type, switch tabs, return to same session.
- Files: browse, upload, download, edit file and close editor.
- Events.
- Details / Intel AMT.
- Console.
- Power dialog (open/cancel; execute only on approved test device).

## Rollback

### V9 -> V8

```bash
cd /home/administrator/meshcentral
node /tmp/meshcentral-modern-ui-v8/meshcentral-modern-ui/install.js "$(pwd)"
```

Then hard refresh with cache disabled. No MeshCentral restart is required when `meshcentral-web` is already active.

### Immediate full fallback

`UI Settings -> Classic`
