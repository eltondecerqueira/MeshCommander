# Pós-V8 — arquitetura alvo do MeshCommander Service Desk Console

## Objetivo
Fazer o operador sentir que existe uma única aplicação. O MeshCentral continua sendo engine de autenticação, autorização, WebSocket, Agent, KVM, Terminal, Files, Intel AMT e eventos, mas o chrome/UX fica sob responsabilidade do Command Center.

## Fase A — V8 (estabilização)
- landing Central de Operações;
- busca global;
- estabilidade do device state;
- file editor/modal integrado;
- tipografia e paleta suave;
- native frames em modo headless.

## Fase B — Device Workspace first-class
Criar componentes próprios de apresentação para:
- Overview;
- Hardware / inventory;
- Network;
- Events / logs;
- Details / AMT;
- Power;
- Files toolbar + file list shell;
- Terminal header/session controls;
- Desktop/KVM toolbar/session controls.

O conteúdo de execução pode continuar em native engine frames quando necessário, mas sem menus, cabeçalhos ou layout legado visíveis.

## Fase C — Telemetry Collector
Persistir séries temporais que o UI atual não possui de forma confiável:
- disponibilidade;
- lastconnect;
- eventos;
- network info;
- sysinfo/inventory snapshots;
- Agent version;
- AMT coverage;
- hardware/OS distribution;
- incident recurrence.

Nunca inventar CPU/RAM/disco histórico: só mostrar série após coleta real.

## Fase D — Service Desk automation
- playbooks versionados;
- dry-run;
- approval gates;
- RBAC;
- cooldown e idempotência;
- audit trail;
- remediation validation;
- ticket/escalation adapters;
- auto-grouping por regra;
- background diagnostics;
- scheduled maintenance.

## Guardrails
- Classic sempre preservado até promoção definitiva;
- `node_modules` intocado;
- `config.json` intocado pela UI;
- mudanças de escrita usam permissões e APIs nativas;
- energia nunca bypassa confirmação/permissões;
- automação começa dry-run e só ganha enforcement por ação explicitamente validada;
- cada versão tem rollback por branch + hard refresh.
