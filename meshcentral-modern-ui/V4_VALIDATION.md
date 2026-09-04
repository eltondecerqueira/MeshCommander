# MeshCentral Modern UI V4 — Validation Plan

## Objetivo
Validar a V4 em paralelo com a UI nativa antes de qualquer substituição definitiva.

## Garantias de isolamento
- `node_modules/meshcentral` não é alterado.
- `meshcentral-data/config.json` não é alterado.
- UI Classic permanece original.
- V3 permanece preservada em `feature/meshcentral-modern-ui-v1`.
- V4 usa o motor nativo do MeshCentral dentro de iframes same-origin.
- Ações sensíveis continuam usando diálogos, permissões e funções nativas.

## Smoke test obrigatório
1. Abrir Modern UI e confirmar `data-mc-modern-overlay = v4`.
2. Selecionar equipamento online e offline.
3. Desktop: abrir aba, conectar, mouse, teclado, clipboard e fullscreen.
4. Terminal: abrir, conectar, executar comando inofensivo, desconectar.
5. Files: listar diretórios, upload/download de arquivo de teste, cancelar transferência.
6. Events: abrir eventos do dispositivo.
7. Details: abrir detalhes e Intel AMT quando disponível.
8. Console: abrir console quando permitido.
9. Energia: abrir diálogo nativo; não executar ação destrutiva durante smoke test.
10. Sidebar: Minha Conta, Eventos, Arquivos, Usuários e Servidor.
11. Botões `Abrir nativo`, `Nova aba` e `Voltar ao Command Center`.
12. Trocar Modern -> Classic e confirmar UI original.

## Rollback V4 -> V3 sem restart
Reexecute o instalador da branch V3:

```bash
node /tmp/meshcentral-modern-ui-src/meshcentral-modern-ui/install.js /home/administrator/meshcentral
```

Depois faça `Ctrl+Shift+R` no navegador.

## Rollback total
Use `rollback.js` e reinicie o serviço somente se quiser remover completamente o override:

```bash
node /tmp/meshcentral-modern-ui-src/meshcentral-modern-ui/rollback.js /home/administrator/meshcentral
sudo systemctl restart meshcentral
```

## Critérios para promoção
A V4 só deve substituir a V3 como padrão após Desktop/KVM, Terminal, Files, Events, Details, Intel AMT, Console, navegação administrativa, fullscreen e rollback passarem no ambiente real.
