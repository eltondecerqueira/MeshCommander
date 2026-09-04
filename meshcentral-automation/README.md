# MeshCommander Automation Sidecar — V0.1

This directory contains an **isolated** automation worker prototype. It is not installed by the UI installer and it does not modify MeshCentral core files or the database.

## Why a sidecar

MeshCentral already exposes `meshctrl.js`, which logs in over WebSocket and supports operations such as `listdevices`, `listevents`, `deviceinfo`, `runcommand`, `devicepower`, `movetodevicegroup`, messages and file actions. A separate worker lets us automate without patching the MeshCentral server process.

## Current safety posture

- `dryRun` defaults to `true`.
- Even with `dryRun:false`, command execution is blocked unless the environment contains `MCA_ALLOW_EXECUTION=YES_I_UNDERSTAND`.
- V0.1 allowlists only the `runcommand` action. Other actions remain log-only until tested one by one.
- Use a dedicated MeshCentral service account with the minimum rights needed. Never use the interactive administrator password in the JSON file.
- Secrets are read from environment variables, not committed files.
- Minimum polling interval is 60 seconds.
- Rules use cooldowns to avoid command storms.

## First dry-run

Copy the example:

```bash
cd /home/administrator/meshcentral
mkdir -p automation
cp /path/to/repo/meshcentral-automation/rules.example.json automation/rules.json
```

Set credentials only in the current shell for the first test:

```bash
export MCA_CONFIG=/home/administrator/meshcentral/automation/rules.json
export MCA_URL=wss://your-meshcentral-host
export MCA_USER=mesh-automation
export MCA_PASS='temporary-test-password'
node /path/to/repo/meshcentral-automation/worker.js
```

The worker should emit JSON log lines with `dry-run-match` and `cycle`. No endpoint command is executed while `dryRun` is true.

## Authentication

MeshCtrl supports username/password and login-key based automation. For production, decide the authentication model with security first. A login key is powerful and must be treated as a high-value secret; a dedicated service account with scoped permissions is preferable when operationally possible.

Supported environment variables:

- `MESHCENTRAL_ROOT`
- `MESHCTRL_PATH`
- `MCA_CONFIG`
- `MCA_URL`
- `MCA_USER`
- `MCA_PASS`
- `MCA_LOGIN_KEY_FILE`
- `MCA_DOMAIN`
- `MCA_ALLOW_EXECUTION`

## Rules implemented in V0.1

Conditions:

- `offline`
- `online`
- `noagent`
- `amtmissing`
- `subnet`
- `nameRegex`

Actions:

- `log` — always safe / no change
- `runcommand` — blocked unless both safety gates are explicitly enabled

Planned after validation:

- event-driven execution instead of polling;
- `lastconnect` duration rules;
- move-to-device-group;
- notification / ticket webhooks;
- sysinfo/networkinfo collection;
- health scripts and remediation playbooks;
- approval-required vs autonomous rule modes;
- execution history in the V7 Automation Center;
- rate limiting per site/group;
- maintenance windows.

## Important

The Automation Center in V7 is intentionally a design/simulation surface. The sidecar is not started automatically by installing V7. This separation is deliberate so UI testing cannot unexpectedly execute actions on endpoints.
