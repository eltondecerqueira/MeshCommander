# MeshCommander Fleet Telemetry Collector

Optional, read-only sidecar for metrics that are not present in the live `nodes` array, especially BitLocker/encryption and stronger hardware identity.

It runs the official MeshCentral CLI:

```text
meshctrl.js listdevices --details --json
```

and writes a compact snapshot to:

```text
/home/administrator/meshcentral/meshcentral-web/public/meshcommander/v9-fleet.json
```

It does **not** modify the MeshCentral database, agents, `config.json` or `node_modules`.

## Authentication

Prefer a dedicated read-only/service account or a MeshCentral login key file with the minimum permissions needed to read device details.

Environment variables:

- `MCT_URL` — e.g. `wss://srd.rj.sebrae.com.br`
- `MCT_USER` — account name, when password auth is used
- `MCT_PASS` — password; avoid putting it in shell history
- `MCT_LOGIN_KEY_FILE` — preferred login-key file alternative to password
- `MCT_DOMAIN` — optional MeshCentral login domain (`--logindomain`)
- `MESHCENTRAL_ROOT` — defaults to `/home/administrator/meshcentral`
- `MCT_OUTPUT` — optional output override

## First manual test

```bash
cd /tmp/meshcentral-modern-ui-v9

MCT_URL='wss://srd.rj.sebrae.com.br' \
MCT_USER='READ_ONLY_ACCOUNT' \
MCT_PASS='...' \
node meshcentral-telemetry/collector.js
```

Do not store credentials in the repository. For production scheduling use a protected environment file or login key.

Then verify:

```bash
ls -lh /home/administrator/meshcentral/meshcentral-web/public/meshcommander/v9-fleet.json
head -c 300 /home/administrator/meshcentral/meshcentral-web/public/meshcommander/v9-fleet.json
```

The V9 browser overlay can load this file and merge the BitLocker summary into the compliance cards.

## Frequency

Hardware/encryption inventory changes slowly. A 6-hour or daily schedule is normally enough. Do not poll thousands of devices every minute.

## Important limitation

Software inventory in MeshCentral 1.2.5 is a live device API and is not part of the cached `getDeviceDetails` fleet export. V9 therefore builds a progressive browser-side software index as each endpoint's Software panel is loaded. A dedicated software collector is a separate phase and should be rate-limited for a fleet of ~1000 endpoints.
