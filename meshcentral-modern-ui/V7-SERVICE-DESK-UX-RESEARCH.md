# V7 — Service Desk UX research and product direction

## Research summary

Patterns reviewed across modern RMM / remote-support products (NinjaOne, ScreenConnect, TeamViewer Remote/RMM, Endpoint Central, Splashtop) and MeshCentral community feedback:

1. **Actionable dashboard, not decorative dashboard** — health summaries should lead directly to the affected device/group.
2. **Single-pane device workflow** — technicians should switch Desktop, Terminal, Files, Events and inventory without losing the device context.
3. **Background actions are first-class** — common fixes should not require taking over the user's screen.
4. **Automation is tied to conditions** — detect a condition, run a known remediation, notify/ticket only when required.
5. **Groups/views are operational filters** — large environments need saved views, hierarchy/labels and automatic placement.
6. **Recent activity and running actions matter** — technicians need to see what is happening now and what another technician already did.
7. **Remote access reliability is more important than visual novelty** — the native MeshCentral session engines remain the execution layer.
8. **The permanent left sidebar costs workspace width** — V7 replaces it with a top workspace navigation and an overflow menu.

## V7 information architecture

Top navigation:

- Visão Geral
- Dispositivos
- Grupos
- Automação
- Atividade
- Mais
  - Minha Conta
  - Eventos nativos
  - Arquivos do servidor
  - Usuários
  - Servidor
  - Interface nativa

The device workspace from V5/V6 remains intact. Only global navigation changes.

## Dashboard metrics available immediately from the browser model

Derived from `nodes`, `meshes`, `agent` and `intelamt` already present in the MeshCentral web application:

- total endpoints;
- online/offline now;
- attention heuristics already used by the Command Center;
- device groups;
- OS family distribution;
- Agent presence;
- Intel AMT coverage;
- Desktop capability coverage;
- Terminal capability coverage;
- Files capability coverage;
- Console capability coverage;
- health by group;
- recent devices selected in the Command Center;
- availability samples observed by the browser while V7 is running.

The browser-observed availability chart is explicitly labelled as such. It is **not** presented as authoritative server history.

## MeshCentral data we can exploit next

MeshCentral core also stores/exposes richer data that should feed a server-side analytics collector rather than being faked in UI:

- `sysinfo` documents (hardware/system inventory);
- `lastconnect` documents (last connection metadata/time);
- network information via `getnetworkinfo`;
- system information via `getsysinfo`;
- persisted event history / `listevents`;
- device connection events;
- MeshCtrl `deviceinfo` combines nodes, sysinfo, network and lastconnect.

These allow the next analytics layer to provide authoritative:

- offline ageing (15m / 1h / 24h / 7d);
- reconnect frequency;
- fleet inventory and hardware models;
- network/subnet/site distribution;
- agent-version compliance;
- OS/build compliance;
- AMT coverage/compliance;
- event volume by group/device;
- support activity trends.

Continuous CPU/RAM/disk-utilisation **time series** should not be invented from static sysinfo. Where continuous endpoint performance is required, add an explicit collector/playbook that records measurements at a controlled interval.

## Service Desk automation roadmap

### Phase A — V7 (safe)

- Automation Center UX;
- playbook catalogue;
- local rule design and simulation;
- sidecar worker in dry-run;
- no automatic endpoint changes caused by installing the UI.

### Phase B — collector

- dedicated service account;
- ingest MeshCtrl listdevices/listevents/deviceinfo;
- persistent SQLite/PostgreSQL store for metrics/history;
- execution audit log;
- expose read-only `/api/ops/*` endpoints to V7.

### Phase C — controlled remediation

Approval-required playbooks first:

- collect diagnostics;
- restart approved Windows services;
- clear approved temp locations;
- refresh network/DNS;
- force agent check-in/reconnect where supported;
- notify logged-in user;
- move endpoint to group according to approved subnet rules.

Every action must record technician/rule, target, timestamp, result and command/playbook version.

### Phase D — autonomous remediation

Only low-risk, idempotent actions that have passed production observation should become autonomous. Use cooldowns, maintenance windows, scope limits and circuit breakers.

## Product principle

**Modern UI on top, MeshCentral execution underneath, automation beside it.**

Do not rewrite the remote-control engines until there is a measurable reason. Invest effort in technician workflow, data visibility, automation and auditability.
