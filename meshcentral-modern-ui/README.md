# MeshCentral Modern UI v1

Esta frente moderniza a interface **Modern** nativa do MeshCentral (`default3`) sem alterar a interface **Classic**, os agentes, protocolos, WebSocket, KVM, terminal, arquivos, Intel AMT ou banco de dados.

## Arquitetura

O MeshCentral ja possui o seletor Classic/Modern. A escolha Modern usa o template `default3`. O projeto aproveita o suporte oficial a `meshcentral-web` e `customFiles` para carregar CSS/JS somente no escopo `default3`.

```text
MeshCentral
├── Classic -> original
└── Modern  -> default3 + mesh-modern-v1.css + mesh-modern-v1.js
```

Os arquivos customizados ficam fora de `node_modules`:

```text
<meshcentral-root>/
├── node_modules/meshcentral/      # pacote NPM original
├── meshcentral-data/config.json
└── meshcentral-web/
    └── public/
        ├── styles/mesh-modern-v1.css
        └── scripts/mesh-modern-v1.js
```

## O que a V1 muda

- tipografia e hierarquia visual;
- cabeçalho;
- sidebar;
- navegação/submenus;
- plano de fundo e superficies;
- cards;
- tabelas;
- formularios;
- botoes;
- dialogs/modals;
- menus de contexto;
- toolbars de dispositivos;
- modo escuro;
- responsividade basica;
- scrollbars.

O modo `fulldesk` e deliberadamente preservado para reduzir risco no Remote Desktop.

## Instalacao

### 1. Localize a raiz

Entre no diretorio que contem `node_modules` e confirme:

```bash
pwd
ls -lh node_modules/meshcentral/public
ls -lh node_modules/meshcentral/views
```

### 2. Checkout do tema

```bash
cd /tmp
rm -rf meshcentral-modern-ui-src
git clone --depth 1 --branch feature/meshcentral-modern-ui-v1 \
  https://github.com/eltondecerqueira/MeshCommander.git \
  meshcentral-modern-ui-src
```

### 3. Instale apenas os arquivos de override

Volte para a raiz do MeshCentral e execute:

```bash
node /tmp/meshcentral-modern-ui-src/meshcentral-modern-ui/install.js "$(pwd)"
```

O instalador:

- valida `node_modules/meshcentral`;
- cria `meshcentral-web/public/styles`;
- cria `meshcentral-web/public/scripts`;
- faz backup se uma V1 ja existir;
- copia CSS e JS;
- NAO altera `node_modules`;
- NAO altera `config.json`;
- NAO reinicia o servidor.

### 4. Backup do config

```bash
cp -a meshcentral-data/config.json \
  meshcentral-data/config.json.backup-modern-ui-$(date +%Y%m%d-%H%M%S)
```

### 5. Edite o dominio no config.json

No dominio usado pelo servidor (comumente `domains -> ""`), mescle:

```json
"showModernUIToggle": true,
"customFiles": {
  "mesh-modern-v1": {
    "css": ["mesh-modern-v1.css"],
    "js": ["mesh-modern-v1.js"],
    "scope": ["default3"]
  }
}
```

Nao substitua outras propriedades existentes do dominio. Se `customFiles` ja existir, adicione somente a chave `mesh-modern-v1`.

Valide o JSON antes de reiniciar:

```bash
node -e "JSON.parse(require('fs').readFileSync('meshcentral-data/config.json')); console.log('config.json OK')"
```

### 6. Um unico restart controlado

O MeshCentral le a configuracao e detecta o override no startup. Portanto a ativacao persistente requer um restart controlado.

Use o mesmo gerenciador que ja opera seu servidor, por exemplo:

```bash
sudo systemctl restart meshcentral
```

ou PM2, se for o seu caso:

```bash
pm2 restart meshcentral
```

Nao use esses comandos sem confirmar como o seu processo atual foi iniciado.

### 7. Teste

Entre normalmente no MeshCentral e abra **UI Settings**.

- `Classic`: deve continuar original.
- `Modern`: deve carregar a V1 e mostrar um pequeno marcador `Modern UI v1` no canto inferior direito.

Teste pelo menos:

1. lista de dispositivos;
2. grupos;
3. busca;
4. detalhes de dispositivo;
5. Desktop;
6. Terminal;
7. Files;
8. Events;
9. console;
10. dialogs e menus;
11. dark mode;
12. fullscreen do Remote Desktop.

## Rollback imediato

Se houver qualquer problema visual, use **UI Settings -> Classic**. O Classic nao carrega o overlay porque `customFiles` esta limitado ao `default3`.

## Rollback completo

1. remova `mesh-modern-v1` de `customFiles` no config.json;
2. valide o JSON;
3. reinicie o MeshCentral;
4. opcionalmente remova:

```bash
rm -f meshcentral-web/public/styles/mesh-modern-v1.css
rm -f meshcentral-web/public/scripts/mesh-modern-v1.js
```

## Atualizacoes do MeshCentral

A customizacao fica em `meshcentral-web`, fora de `node_modules`, reduzindo o risco de ser sobrescrita por `npm update meshcentral`. Ainda assim, cada upgrade importante do MeshCentral deve ser testado com a V1 antes de promover para producao.
