# V9 — Service Desk metrics and data coverage

## Immediate from the live MeshCentral page

These indicators use data already present in the MeshCentral `nodes` feed:

- Online / Offline / Attention
- Windows Security Center antivirus status (`wsc.antiVirus`)
- Linux security status when present (`lsc`)
- reported AV products (`av[]`)
- last connection (`lastconnect`)
- >15 / >30 / >60 day absence buckets
- likely duplicates by normalized hostname and UUID when present
- Intel AMT / Agent capabilities

Unknown security/last-seen data is kept separate; V9 never treats missing data as a failure.

## BitLocker / encryption

BitLocker belongs to cached system/hardware details, not the basic live node list. V9 supports two sources:

1. Progressive: when Details/sysinfo for a device is available in an embedded session, V9 can cache its encryption state.
2. Fleet snapshot: optional `meshcentral-telemetry/collector.js` calls the official read-only `meshctrl listdevices --details --json` and writes a compact public snapshot.

The dashboard always displays coverage (`known / total`). A zero with zero coverage must not be interpreted as zero unencrypted endpoints.

## Software inventory

MeshCentral 1.2.5 exposes Software as device panel 18 using a live agent API. V9 adds the panel to Command Center and builds a progressive browser-side index when the Software view is loaded.

Fleet software search shows an explicit coverage counter. A future rate-limited server-side software collector can replace the progressive index after validation.

## Registry

MeshCentral 1.2.5 added remote Registry management using panel 9/protocol 4. V9 exposes that native engine in Command Center. It does not bypass `No Registry` permissions, consent or event logging.

## Automation

V9's first write playbook is **Limpar temporários**. It is intentionally narrow:

- Windows only
- online Agent required
- explicit operator confirmation
- `%TEMP%` and `C:\Windows\Temp` only
- executes through MeshCentral `runcommands`
- existing MeshCentral permissions/audit path remains authoritative

Additional playbooks should follow the same allowlist + preview/confirmation model before autonomous rules are enabled.
