# MeshCentral Modern UI V6 — Native Device Experience

## Objetivo
Modernizar também o conteúdo nativo embutido das ferramentas de dispositivo sem reimplementar os motores do MeshCentral.

A V5 já entrega o Command Center e mantém Desktop/KVM, Terminal, Files, Events, Details/Intel AMT e Console em frames same-origin. A V6 aplica uma camada visual e de integração dentro desses frames para reduzir ao mínimo a sensação de "voltar para a interface antiga".

## Escopo
- Desktop/KVM: canvas, toolbar, mensagens, seletores e avisos modernizados.
- Terminal: área de terminal, toolbar, selects e mensagens modernizados.
- Files: toolbar, lista/tabela, inputs, botões e estados modernizados.
- Events, Details/Intel AMT e Console: tabelas, formulários, tabs, cards e diálogos modernizados.
- Diálogo nativo de energia: aparência alinhada ao Command Center, preservando confirmação e permissões originais.
- Seções administrativas embutidas recebem tratamento genérico de superfícies, tabelas, formulários e modais.
- Bridge same-origin informa ao Command Center quando a ferramenta nativa terminou de preparar o painel.

## Regra de segurança
A V6 NÃO substitui:
- WebSocket;
- KVM;
- teclado/mouse;
- Ctrl+Alt+Del;
- Terminal;
- transferência de arquivos;
- Intel AMT;
- power actions;
- permissões;
- autenticação.

Todos os IDs e handlers originais permanecem no DOM. A V6 adiciona classes, estilos e elementos auxiliares não operacionais.

## Isolamento
- `master`: original;
- `feature/meshcentral-modern-ui-v4`: V4 validada;
- `feature/meshcentral-modern-ui-v5`: V5 validada;
- `feature/meshcentral-modern-ui-v6`: candidata atual.

Classic continua sendo o fallback imediato.

## Promotion gate
Não promover até validar em máquinas reais:
1. Desktop/KVM conecta e desconecta;
2. teclado e mouse;
3. Ctrl+Alt+Del;
4. fullscreen;
5. seleção de monitor/sessão quando disponível;
6. Terminal connect/disconnect e digitação;
7. Files upload/download/rename/delete;
8. Events;
9. Details/Intel AMT;
10. Console;
11. energia com diálogo/confirmação original;
12. retorno V6 -> V5 e Modern -> Classic.
