# MeshCentral Modern UI v1

Esta frente moderniza a interface **Modern** nativa do MeshCentral (`default3`) sem alterar a interface **Classic**, os agentes, protocolos, WebSocket, KVM, terminal, arquivos, Intel AMT ou banco de dados.

## Arquitetura

O MeshCentral ja possui o seletor Classic/Modern. A V1 usa o mecanismo `meshcentral-web` que o proprio servidor procura no startup. Nao depende de `meshcentral-config-schema.json` e nao exige `customFiles`.

```text
MeshCentral
├── Classic -> default.handlebars original
└── Modern  -> meshcentral-web/views/default3.handlebars
                 + mesh-modern-v1.css
                 + mesh-modern-v1.js
```

O pacote NPM permanece intacto:

```text
<meshcentral-root>/
├── node_modules/meshcentral/                 # original
│   └── views/default3.handlebars             # original
└── meshcentral-web/
    ├── views/default3.handlebars              # override Modern
    └── public/
        ├── styles/mesh-modern-v1.css
        └── scripts/mesh-modern-v1.js
```

## Instalacao

Na raiz que contem `node_modules/meshcentral`:

```bash
cd /tmp
rm -rf meshcentral-modern-ui-src
git clone --depth 1 --branch feature/meshcentral-modern-ui-v1 \
  https://github.com/eltondecerqueira/MeshCommander.git \
  meshcentral-modern-ui-src

cd /CAMINHO/RAIZ/DO/MESHCENTRAL
node /tmp/meshcentral-modern-ui-src/meshcentral-modern-ui/install.js "$(pwd)"
```

O instalador:

- identifica a versao do MeshCentral pelo `package.json`;
- confirma que `default3.handlebars` existe;
- confirma suporte a override `meshcentral-web/views` e `meshcentral-web/public` no `meshcentral.js`;
- usa um `default3.handlebars` de override existente como base, se houver;
- caso contrario copia o `default3` original do pacote;
- injeta apenas as referencias ao CSS/JS da V1;
- cria backups quando ja existem overrides;
- nao altera `node_modules`;
- nao altera `config.json`;
- nao reinicia o servidor.

## Ativacao

A deteccao de `meshcentral-web` ocorre no startup. Depois da instalacao, confirme como o MeshCentral esta rodando:

```bash
ps -eo pid,user,cmd | grep -i '[m]eshcentral'
```

Reinicie somente usando o gerenciador real do ambiente (systemd, PM2 ou outro). Nao invente um comando de restart.

Depois entre normalmente e use:

- `UI Settings -> Classic`: interface original;
- `UI Settings -> Modern`: interface com a V1.

A V1 mostra um pequeno marcador `Modern UI v1` no canto inferior direito para confirmar que o overlay foi carregado.

## Rollback

Rollback imediato: escolha `UI Settings -> Classic`.

Para rollback completo, remova ou renomeie o override `meshcentral-web/views/default3.handlebars` e os dois arquivos da V1, depois reinicie o MeshCentral:

```bash
rm -f meshcentral-web/views/default3.handlebars
rm -f meshcentral-web/public/styles/mesh-modern-v1.css
rm -f meshcentral-web/public/scripts/mesh-modern-v1.js
```

Se havia um `default3.handlebars` customizado antes da instalacao, restaure o arquivo `.backup-*` criado pelo instalador em vez de simplesmente apagar.

## Testes recomendados

1. lista de dispositivos e grupos;
2. pesquisa e filtros;
3. detalhes do dispositivo;
4. Desktop/KVM;
5. Terminal;
6. Files;
7. Events;
8. dialogs e menus de contexto;
9. dark mode;
10. fullscreen do Remote Desktop.

O modo `fulldesk` e deliberadamente preservado para reduzir risco na sessao remota.
