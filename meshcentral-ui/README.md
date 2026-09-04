# MeshCommander Modern UI dentro do MeshCentral

Este pacote e especifico para instalacoes em que o MeshCommander e servido pelo MeshCentral atraves de:

`node_modules/meshcentral/public/commander.htm`

A abordagem imita o conceito do `Toggle Modern UI` do proprio MeshCentral: o `commander.htm` continua sendo a mesma aplicacao e a logica Intel AMT/KVM/SOL/IDER nao e reescrita. Um pequeno JavaScript alterna apenas o atributo `data-mesh-ui=modern`, ativando/desativando `styles-modern.css` e persistindo a escolha no `localStorage` do navegador.

## Arquivos

- `meshcommander-modern-toggle.js` — adiciona o botao Classic UI / Modern UI e salva a escolha por navegador.
- `install-modern-toggle.js` — gera a pagina de teste ou instala a customizacao.
- `../styles-modern.css` — camada visual moderna.

## Descoberta importante do MeshCentral

Nao e recomendado manter customizacoes permanentes dentro de `node_modules/meshcentral/public`. O MeshCentral suporta oficialmente uma arvore externa `meshcentral-web/public`; quando ela existe ao iniciar o servidor, arquivos nela sao servidos antes dos arquivos padrao de `node_modules/meshcentral/public`.

Assim, a estrategia recomendada e:

1. validar primeiro com `canary`, sem restart e sem alterar `/commander.htm`;
2. opcionalmente usar `direct` para trocar o `commander.htm` de forma atomica e sem restart;
3. depois migrar para `override` em `meshcentral-web/public` para sobreviver a atualizacoes do pacote.

## 1. Canary — recomendado para primeiro teste

No diretorio do checkout deste fork:

```bash
node meshcentral-ui/install-modern-toggle.js /CAMINHO/node_modules/meshcentral/public canary
```

Isso cria:

```text
node_modules/meshcentral/public/
├── commander.htm                  # original, intacto
├── commander-modern.htm           # teste com toggle
├── styles/
│   └── meshcommander-modern.css
└── scripts/
    └── meshcommander-modern-toggle.js
```

Abra diretamente:

`https://SEU-MESHCENTRAL/commander-modern.htm`

Nao e necessario reiniciar o Node/MeshCentral.

## 2. Direct — zero downtime, mas dentro de node_modules

Depois do canary validado:

```bash
node meshcentral-ui/install-modern-toggle.js /CAMINHO/node_modules/meshcentral/public direct
```

O instalador cria um backup timestampado de `commander.htm` e faz a substituicao por rename atomico. Sessoes ja abertas continuam carregadas no navegador; novas aberturas usam a versao com toggle.

Nao exige restart, mas uma atualizacao do MeshCentral pode sobrescrever os arquivos em `node_modules`.

## 3. Override — permanente e recomendado

```bash
node meshcentral-ui/install-modern-toggle.js /CAMINHO/node_modules/meshcentral/public override
```

O destino sera calculado como:

```text
<MESHCENTRAL-ROOT>/meshcentral-web/public/
├── commander.htm
├── styles/meshcommander-modern.css
└── scripts/meshcommander-modern-toggle.js
```

Se `meshcentral-web/public` ja existia quando o processo MeshCentral foi iniciado, o arquivo pode passar a ser servido sem restart. Se a pasta foi criada agora, e necessario um unico restart controlado para o MeshCentral registrar `webPublicOverridePath`.

## Comportamento do toggle

- primeira abertura: Classic UI, por seguranca;
- usuario habilita `Modern UI` no botao superior;
- escolha fica salva em `localStorage`;
- desabilitar retorna imediatamente ao visual classico;
- nenhum handler de AMT, WSMAN, KVM, SOL, IDER ou energia e substituido.

## Rollback

### Canary

Use normalmente `/commander.htm` e remova `commander-modern.htm` quando quiser.

### Direct

Restaure o arquivo `.backup-<timestamp>` criado pelo instalador.

### Override

Renomeie/remova `meshcentral-web/public/commander.htm`; se necessario reinicie o MeshCentral para voltar ao arquivo original da distribuicao.
