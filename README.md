# Tela Viva

Uma tela quadriculada grande, uma peça por dupla, e planos escritos em português que uma IA traduz em código inspecionável. A peça executa o plano a partir de onde está: anda, vira, pinta, cava a superfície. Cada plano aceito vira uma camada; a tela é sempre o replay das camadas, por isso qualquer uma pode ser removida.

Há dois modos. No **individual**, cada computador tem a sua tela. No **coletivo**, há uma tela só, guardada no computador do professor e exibida no projetor; cada dupla tem a sua peça nela. Nos dois, a IA fica no computador do professor, que serve a página para o laboratório.

## Como rodar na aula

1. No notebook do professor, ponha a chave da API em `servidor/chave.txt` (só a chave, nada mais). Há um `chave.txt.exemplo` ao lado.
2. Dois cliques em `servidor/iniciar.bat`. O Windows pede permissão de administrador para abrir a porta no firewall; a regra é removida ao sair.
3. A janela mostra os endereços:
   - `http://10.x.x.x:8000` — tela individual;
   - `http://10.x.x.x:8000/?modo=coletivo` — tela coletiva (a equipe dá um nome ao entrar; o mesmo nome recupera a mesma peça);
   - `http://localhost:8000/?modo=projetor` — o projetor, que abre sozinho no computador do professor.
4. Para encerrar: Ctrl+C na janela.

## O modo coletivo

- A tela coletiva fica em `servidor/coletivo.json` e sobrevive a reinícios do servidor. Tamanho em `config.json` (`largura`, `altura`; padrão 200 × 120).
- Cada equipe faz o pedido e vê a prévia na sua máquina, sobre a tela coletiva como ela está naquele momento. "Enviar à tela coletiva" acrescenta a camada; o projetor e todas as equipes recebem a tela nova em poucos segundos. No projetor, a última camada chega com o contorno em vermelho por alguns segundos, com o pedido, o "entendi" e o código ao lado. O botão **Tela inteira** (ou a tecla F) mostra só a imagem, ocupando o projetor inteiro, com uma legenda discreta da última camada; Esc volta. A tecla G liga e desliga a grade.
- As peças começam espalhadas numa malha e cada uma só obedece aos planos da própria equipe. A superfície é comum: tinta e buracos de uma equipe valem para todas.
- **Tirar uma equipe da tela.** A própria equipe pode clicar em "Sair da tela", no cartão da peça. No projetor, ao lado de cada equipe, o professor tem duas opções: **Retirar** (a peça some e não recebe mais planos, mas as camadas dela ficam na tela) e **Remover** (a peça e todas as camadas dela somem). Os dois pedem um segundo clique para confirmar. Uma equipe retirada que entra de novo com o mesmo nome recupera a peça, a cor e as camadas.
- Uma equipe só pode remover as próprias camadas. Do computador do professor (projetor, ou qualquer aba aberta em `localhost`) dá para remover qualquer camada e zerar a tela (as peças ficam).
- Se duas equipes enviam quase ao mesmo tempo, a ordem de chegada ao servidor decide quem fica por cima. A prévia de cada uma foi feita sem a camada da outra; é o momento de composição que vale discutir.

Sem a chave, o servidor funciona do mesmo jeito, mas a página avisa que a IA está desligada e o código tem de ser escrito ou colado à mão.

`servidor/config.json` define a porta, o modelo e o limite de tokens (16 000; abaixo de 8 000 o servidor sobe sozinho para 16 000, porque respostas cortadas não trazem o plano). `servidor/INSTRUCAO-IA.md` é a instrução que a IA recebe: pode ser editada entre uma aula e outra. `servidor/registro.jsonl` guarda todos os pedidos, traduções, aceites e remoções, uma linha por evento, para a discussão em aula.

## Como abrir sem servidor

`index.html` abre com dois cliques (ou `dist/tela-viva.html`, que tem tudo num arquivo). Sem servidor não há IA, mas os exemplos e o código à mão funcionam. Serve para o aluno continuar em casa.

## Estrutura

```
index.html, estilo.css      a página
motor/tela.js               a tela, as peças, as camadas e o replay
motor/caneta.js             o firmware: tudo o que um plano pode fazer
motor/exemplos.js           planos de exemplo, no formato que a IA devolve
interface/desenho.js        o canvas com zoom, deslocamento e minimapa
interface/app.js            pedido, prévia, aceite, camadas, firmware
servidor/                   o servidor do professor (PowerShell, sem instalar nada)
testes/                     node --test testes/tela.test.mjs
ferramentas/montar.mjs      gera dist/ e FIRMWARE.md
FIRMWARE.md                 a documentação do firmware (gerada; é o que a IA lê)
```

## Trabalhar no WSL e rodar no Windows

Se o clone do repositório fica no WSL e a pasta usada na aula fica no Windows (no Dropbox, por exemplo), rode no WSL:

```bash
ferramentas/espelhar-no-windows.sh        # copia para a pasta do Windows
ferramentas/espelhar-no-windows.sh -n     # só mostra o que faria
```

O script copia o que mudou e apaga, no Windows, o que foi apagado no WSL. Ele nunca copia o `.git` e nunca mexe na chave, na tela coletiva nem no registro do servidor. O destino padrão está no começo do script; para outro lugar, passe o caminho: `ferramentas/espelhar-no-windows.sh 'C:\outra\pasta'`. Precisa do `rsync` (`sudo apt install rsync`).

## O ciclo de um plano

1. A dupla escreve o pedido e clica em **Pedir à IA** (Ctrl+Enter também serve).
2. Volta um plano com três camadas: o que a IA **entendeu**, as **escolhas** que fez onde o pedido não dizia, e o **código**. A prévia aparece na hora, com a moldura tracejada e o caminho da peça.
3. A dupla lê, compara com o que pediu, e decide: **Aceitar e pintar**, **Ajustar o pedido** (um novo pedido sobre o mesmo código) ou editar o código à mão e refazer a prévia.
4. Na aba **Camadas**, qualquer camada pode ser removida; as seguintes são refeitas por cima.

## Para mudar o firmware

As operações estão em `motor/caneta.js`, cada uma com a sua linha de documentação (`doc(...)`). Depois de mudar, rode `node ferramentas/montar.mjs` para atualizar o `FIRMWARE.md`, que é o que a IA lê, e os testes.
