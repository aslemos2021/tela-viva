# Firmware da Tela Viva

Vocabulário com que todo plano é escrito. Um plano recebe `eu` (a peça, com a caneta) e `tela` (a superfície).

Coordenadas: x de 0 a largura−1 (da esquerda para a direita), y de 0 a altura−1 (de cima para baixo). Direções em graus no sentido horário: 0 = norte, 90 = leste, 180 = sul, 270 = oeste.

_Gerado por `ferramentas/montar.mjs` a partir de `motor/caneta.js`. Não edite à mão._

## Mover a peça

A peça anda a partir de onde está, na direção em que olha. Com a caneta baixada, pinta por onde passa.

| Operação | O que faz | Exemplo |
|---|---|---|
| `eu.frente(n)` | Anda n células na direção em que olha. Para na borda ou diante de uma célula cavada. | `eu.frente(20)` |
| `eu.tras(n)` | Anda n células para trás, sem virar. | `eu.tras(5)` |
| `eu.direita(graus)` | Vira para a direita (sentido horário). | `eu.direita(90)` |
| `eu.esquerda(graus)` | Vira para a esquerda. | `eu.esquerda(144)` |
| `eu.olharPara(direcao)` | Vira para uma direção: "norte", "leste"… ou graus (0 = norte, 90 = leste). | `eu.olharPara("sul")` |
| `eu.mirar(x, y)` | Vira para o ponto (x, y). | `eu.mirar(tela.centro().x, tela.centro().y)` |
| `eu.irPara(x, y)` | Salta para a célula (x, y) sem pintar o caminho. | `eu.irPara(10, 10)` |
| `eu.linhaAte(x, y)` | Anda em linha reta até (x, y), pintando se a caneta estiver baixada. | `eu.linhaAte(80, 50)` |

## Caneta

O que a peça deixa na tela ao se mover.

| Operação | O que faz | Exemplo |
|---|---|---|
| `eu.levantar()` | Levanta a caneta: a peça passa a andar sem pintar. | `eu.levantar()` |
| `eu.baixar()` | Baixa a caneta: a peça volta a pintar por onde passa. | `eu.baixar()` |
| `eu.cor(cor)` | Troca a tinta. Nome ("azul", "verde escuro"…) ou código #rrggbb. "fundo" apaga. | `eu.cor("laranja")` |
| `eu.espessura(n)` | Grossura do traço, de 1 a 7 células. | `eu.espessura(3)` |
| `eu.ponto()` | Pinta só a célula onde está (com a espessura atual). | `eu.ponto()` |

## Formas prontas

Atalhos para o que seria longo de desenhar passo a passo.

| Operação | O que faz | Exemplo |
|---|---|---|
| `eu.circulo(raio, cheio?)` | Círculo com centro na peça. Com cheio = true, pinta por dentro. | `eu.circulo(12, true)` |
| `eu.retangulo(largura, altura, cheio?)` | Retângulo com o canto superior esquerdo na peça. | `eu.retangulo(30, 10)` |
| `eu.poligono(lados, tamanho)` | Polígono regular, começando na peça e na direção em que ela olha. A peça termina onde começou. | `eu.poligono(6, 15)` |
| `eu.preencher(cor?)` | Balde de tinta: pinta a região contínua onde a peça está (da mesma cor que a célula dela). | `eu.preencher("ceu")` |

## Superfície

A tela também se altera: células podem ser cavadas (deixam de existir) e aterradas de volta. A peça não entra numa célula cavada.

| Operação | O que faz | Exemplo |
|---|---|---|
| `eu.cavar(n)` | Cava as n células à frente da peça: elas deixam de existir. A peça não se move. | `eu.cavar(10)` |
| `eu.aterrar(n)` | Aterra as n células à frente: voltam a existir, vazias. | `eu.aterrar(10)` |
| `tela.cavar(x, y)` | Cava uma célula qualquer (fora da tela, não faz nada). | `tela.cavar(5, 5)` |
| `tela.aterrar(x, y)` | Aterra uma célula qualquer. | `tela.aterrar(5, 5)` |
| `tela.pintar(x, y, cor)` | Pinta uma célula qualquer, sem mover a peça. | `tela.pintar(0, 0, "vermelho")` |

## Olhar

Perguntas sobre a tela. Não mudam nada.

| Operação | O que faz | Exemplo |
|---|---|---|
| `eu.x, eu.y, eu.angulo` | Onde a peça está e para onde olha (só leitura). | `if (eu.x > 100) eu.olharPara("oeste")` |
| `tela.largura, tela.altura` | Tamanho da tela em células. As coordenadas vão de 0 a largura−1 e de 0 a altura−1; y cresce para baixo. | `eu.irPara(tela.largura - 1, 0)` |
| `tela.centro()` | A célula do meio: { x, y }. | `const c = tela.centro()` |
| `tela.corEm(x, y)` | A cor da célula (null se está no fundo; undefined se está fora da tela). | `tela.corEm(eu.x, eu.y + 1)` |
| `tela.existe(x, y)` | Verdadeiro se a célula existe (está na tela e não foi cavada). | `if (tela.existe(eu.x + 1, eu.y)) eu.frente(1)` |
| `tela.distancia(x1, y1, x2, y2)` | Distância em linha reta entre dois pontos. | `tela.distancia(eu.x, eu.y, 0, 0)` |
| `tela.cores` | A lista de nomes de cor que a tela conhece. | `tela.sortear(tela.cores)` |

## Memória e acaso

Guardar lugares para voltar a eles, e sortear.

| Operação | O que faz | Exemplo |
|---|---|---|
| `eu.marcar(nome)` | Guarda onde a peça está e para onde olha, com um nome. | `eu.marcar("inicio")` |
| `eu.voltar(nome)` | Volta a um lugar marcado, sem pintar o caminho. | `eu.voltar("inicio")` |
| `tela.sortear(lista)` | Um item da lista, ao acaso. | `eu.cor(tela.sortear(["azul", "verde"]))` |
| `tela.aleatorio(min, max)` | Um número inteiro ao acaso, entre min e max. | `eu.frente(tela.aleatorio(3, 9))` |
| `eu.dizer(texto)` | Escreve uma frase ao lado da tela. | `eu.dizer("pronto")` |

## Cores com nome

preto, branco, cinza, cinza claro, cinza escuro, vermelho, laranja, amarelo, verde, verde claro, verde escuro, azul, azul claro, azul escuro, marinho, roxo, lilas, rosa, rosa claro, marrom, bege, areia, dourado, turquesa, ciano, magenta, vinho, oliva, salmao, creme, pele, ceu, mar, terra. Qualquer código `#rrggbb` também vale; "fundo" apaga.
