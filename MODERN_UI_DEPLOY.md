# MeshCommander Modern UI — rollout sem indisponibilidade

Esta branch adiciona uma camada visual moderna sem substituir a lógica Intel AMT/KVM/SOL/IDER existente.

## Arquivos da UI moderna

- `styles-modern.css` — tema moderno aplicado ao DOM legado.
- `modern.html` — entrada paralela para instalações que servem o `index.html` do repositório-fonte.
- `modern-npm.html` — entrada paralela para instalações NPM que servem `public/default.htm`.

A página clássica permanece intacta em todos os casos.

## 1. Identifique o modo que está em produção

No servidor Linux, execute:

```bash
ps -eo pid,user,cmd | grep -Ei '[m]eshcommander|[m]eshcmd|[m]eshcentral'
systemctl list-units --type=service --all | grep -Ei 'mesh(commander|central)'
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' | grep -i mesh
sudo find / -path '*/node_modules/meshcommander/public/default.htm' -type f 2>/dev/null
sudo find / -path '*/MeshCentral/public/commander.htm' -type f 2>/dev/null
```

Interpretação:

- Encontrou `node_modules/meshcommander/public/default.htm` e processo `meshcommander.js`: instalação NPM.
- Processo `meshcmd meshcommander`: MeshCMD com UI embutida.
- Processo `meshcentral.js` e `public/commander.htm`: MeshCommander embutido no MeshCentral.
- Nenhum dos anteriores, mas o site serve um diretório que contém `index.html`, `amt-*.js`, `styles-commander*.css`: instalação estática/fonte.
- Container Docker: identifique primeiro o caminho equivalente dentro do container.

## 2. NPM — modo recomendado para teste paralelo

Se o comando `find` retornar, por exemplo:

```text
/opt/meshcommander/node_modules/meshcommander/public/default.htm
```

defina:

```bash
PUB=/opt/meshcommander/node_modules/meshcommander/public
```

Copie para esse diretório SOMENTE:

```text
modern-npm.html
styles-modern.css
```

Não substitua `default.htm`.

Valide os arquivos:

```bash
ls -lh "$PUB/default.htm" "$PUB/modern-npm.html" "$PUB/styles-modern.css"
```

A interface clássica continua em:

```text
/default.htm
```

A interface moderna fica em:

```text
/modern-npm.html
```

Como são arquivos adicionais no diretório público, teste primeiro sem reiniciar o serviço. Se o servidor responder 404 para o arquivo novo mesmo ele existindo no diretório público, aí o processo pode estar usando outra raiz ou uma lista de arquivos carregada no startup; confirme a raiz antes de reiniciar.

Rollback do teste: simplesmente volte a acessar `/default.htm`. Nenhum arquivo clássico foi alterado.

## 3. Instalação estática/fonte — IIS, Nginx, Apache ou outro servidor de arquivos

Localize o diretório que contém simultaneamente:

```text
index.html
amt-0.2.0.js
styles-commander.css
```

Copie para esse mesmo diretório:

```text
modern.html
styles-modern.css
```

Não substitua `index.html`.

Teste:

```text
/index.html   -> clássico
/modern.html  -> moderno
```

Em servidor puramente estático, novos arquivos normalmente ficam disponíveis sem restart. Confirme pelo navegador ou `curl -I` antes de mudar qualquer rota padrão.

## 4. MeshCentral

O MeshCentral não usa diretamente o `index.html` do repositório MeshCommander. O perfil `websitecompiler/MeshCentral2.wcc` compila a aplicação para um único arquivo `public/commander.htm` no projeto MeshCentral.

Portanto, NÃO copie `modern.html` por cima de `commander.htm`.

Para a integração definitiva com MeshCentral, a UI precisa ser incorporada ao fonte e recompilada com o WebSite Compiler usando `MeshCentral2.wcc`, gerando um novo `commander.htm`.

Para teste sem afetar produção, mantenha o `commander.htm` atual e publique a versão compilada nova com outro nome/rota, ou teste em uma segunda instância do MeshCentral antes da troca. A troca do `commander.htm` deve ser tratada como uma etapa posterior e validada especificamente no MeshCentral.

## 5. MeshCMD

`meshcmd meshcommander` inicia a UI embutida no executável. Não existe um diretório público simples onde estes dois arquivos possam ser adicionados com garantia.

Para teste sem afetar o MeshCMD em produção, suba uma instância NPM do MeshCommander em uma porta paralela e use `modern-npm.html`. Depois da validação, a versão embutida deve ser reconstruída/empacotada.

## 6. Firmware Intel AMT

Não use esta V1 diretamente em firmware. O firmware possui restrições severas de tamanho e é gerado pelos perfis do WebSite Compiler (`Firmware-MeshCommander.wcc`) para os artefatos em `output/Firmware-*.gz`.

A UI moderna com iframe/CSS separado é destinada inicialmente às versões hospedadas em servidor. Firmware deve ser uma frente separada de otimização/compilação.

## 7. Docker

Dentro do container, procure:

```bash
docker exec <container> sh -lc "find / -path '*/node_modules/meshcommander/public/default.htm' -type f 2>/dev/null"
```

Para um teste realmente sem parada, copie os dois arquivos para o container já em execução:

```bash
docker cp modern-npm.html <container>:<PUBLIC_DIR>/modern-npm.html
docker cp styles-modern.css <container>:<PUBLIC_DIR>/styles-modern.css
```

Isso é adequado para canário, mas é efêmero: ao recriar o container, os arquivos desaparecem. Depois da validação, incorpore-os à imagem ou use bind mount/volume no Compose.

## 8. Checklist antes de promover

Valide na interface moderna, sem fechar a clássica:

- seleção e conexão de dispositivo;
- System Status;
- Remote Desktop/KVM, teclado e mouse;
- Ctrl+Alt+Del e fullscreen, se usados;
- Serial-over-LAN;
- energia: ligar, desligar, reiniciar;
- IDER;
- hardware e rede;
- arquivos;
- diálogos/configurações;
- múltiplos equipamentos;
- TLS/16993, se usado;
- autenticação e credenciais salvas/listas de máquinas.

## 9. Promoção e rollback

Primeiro mantenha as duas URLs em paralelo. Só depois de validar todos os fluxos altere o ponto de entrada/redirect do seu proxy ou servidor web para a página moderna apropriada.

Nunca apague a página clássica durante esta fase.

Rollback é simplesmente restaurar o ponto de entrada para `default.htm`, `index.html` ou `commander.htm`, conforme o modo de instalação.

## Importante

Esta V1 é deliberadamente não invasiva: o CSS altera apresentação, não os módulos AMT/WSMAN/KVM/SOL/IDER. O wrapper carrega a UI clássica da mesma origem e injeta o tema moderno. A reorganização estrutural em dashboard será feita depois de validarmos compatibilidade funcional no modo real de produção.
