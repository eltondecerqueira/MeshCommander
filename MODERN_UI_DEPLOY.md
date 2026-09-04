# MeshCommander Modern UI — rollout sem indisponibilidade

Esta branch adiciona uma camada visual moderna sem substituir nem alterar a lógica Intel AMT existente.

## Arquivos adicionados

- `modern.html` — ponto de entrada paralelo para teste/uso da interface moderna.
- `styles-modern.css` — tema visual moderno aplicado sobre o DOM legado.

O `index.html` original permanece intacto.

## Como testar no servidor atual sem parar o MeshCommander

1. Faça backup do diretório atual do MeshCommander.
2. Copie somente `modern.html` e `styles-modern.css` para o mesmo diretório em que está o `index.html` atual.
3. Não reinicie o serviço se o servidor já serve arquivos estáticos diretamente e detecta novos arquivos automaticamente.
4. Acesse a aplicação atual normalmente para confirmar que continua funcionando:
   - `/index.html`
5. Em outra aba, acesse:
   - `/modern.html`
6. Teste os fluxos críticos antes de promover a nova interface:
   - seleção/conexão de dispositivo;
   - System Status;
   - Remote Desktop/KVM;
   - Serial-over-LAN;
   - energia (ligar/desligar/reiniciar);
   - IDER;
   - hardware/rede;
   - arquivos, se usados;
   - diálogos/configurações.

## Estratégia recomendada de produção

### Fase 1 — paralelo

Mantenha:

- `/index.html` = interface clássica;
- `/modern.html` = interface moderna.

Isso permite validação com usuários reais sem downtime e com rollback instantâneo.

### Fase 2 — promover a moderna

Depois de validada, altere apenas a rota/página inicial do servidor para apontar para `modern.html`.

Não apague o `index.html`.

### Rollback

Volte a rota inicial para `index.html`. Como a lógica original não foi alterada, o rollback é imediato.

## Observação importante

A primeira versão é deliberadamente não invasiva: ela moderniza cores, tipografia, navegação, tabelas, formulários, alertas, menus, área de Remote Desktop e espaçamentos sem reescrever os handlers existentes.

A próxima etapa pode evoluir o layout para dashboard de dispositivos, cartões de status, busca global e painel de ações rápidas, mantendo a mesma estratégia de compatibilidade.
