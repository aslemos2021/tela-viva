// Tela Viva — planos de exemplo, no formato que a IA devolve.
// Servem para a aula de demonstração e para testar o motor.
var TELA = globalThis.TELA = globalThis.TELA || {};
TELA.EXEMPLOS = [
  {
    titulo: 'Pentagrama colorido',
    pedido: 'Faça um pentagrama em que cada ponta seja preenchida com uma cor diferente',
    entendi: 'Desenho uma estrela de cinco pontas com lado 40, traçando as cinco retas, e depois preencho cada ponta com uma cor diferente usando o balde de tinta.',
    escolhas: ['O tamanho (lado 40) e as cinco cores foram escolhas minhas.', 'O centro do pentagrama (o pentágono do meio) ficou sem pintar.', 'Para achar o interior de cada ponta, a peça entra 6 células pela bissetriz do vértice (18 graus para dentro).'],
    codigo: `// a estrela: cinco retas, virando 144 graus a cada uma
eu.cor("preto");
eu.olharPara("leste");
eu.marcar("inicio");
for (let i = 0; i < 5; i++) {
  eu.frente(40);
  eu.direita(144);
}
// as pontas: em cada vértice, entro um pouco na ponta e uso o balde
const cores = ["vermelho", "laranja", "amarelo", "verde", "azul"];
eu.voltar("inicio");
eu.levantar();
for (let i = 0; i < 5; i++) {
  eu.direita(18);
  eu.frente(6);
  eu.preencher(cores[i]);
  eu.tras(6);
  eu.esquerda(18);
  eu.frente(40);
  eu.direita(144);
}
eu.baixar();`
  },
  {
    titulo: 'Pôr do sol estilizado',
    pedido: 'Um pôr do sol na praia',
    entendi: 'Não consigo pintar uma fotografia; faço uma versão estilizada: faixas de céu em degradê, um sol meio escondido no horizonte, uma faixa de mar e uma de areia.',
    escolhas: ['"Praia" virou três faixas: céu, mar e areia.', 'O sol fica metade acima da linha do mar.', 'As cores do degradê foram escolhidas por mim.'],
    codigo: `const L = tela.largura, A = tela.altura;
const horizonte = Math.floor(A * 0.55);
// céu em faixas, do alto até o horizonte
const ceu = ["#2b3a7a", "#6a4c93", "#c0527a", "#e57a5a", "#f2b04f"];
for (let f = 0; f < ceu.length; f++) {
  eu.cor(ceu[f]);
  eu.irPara(0, Math.floor(horizonte * f / ceu.length));
  eu.retangulo(L, Math.ceil(horizonte / ceu.length) + 1, true);
}
// o sol
eu.cor("amarelo");
eu.irPara(Math.floor(L / 2), horizonte);
eu.circulo(Math.floor(A / 7), true);
// mar e areia
eu.cor("mar");
eu.irPara(0, horizonte);
eu.retangulo(L, Math.floor(A * 0.25), true);
eu.cor("areia");
eu.irPara(0, horizonte + Math.floor(A * 0.25));
eu.retangulo(L, A, true);
// reflexo do sol no mar
eu.cor("#f2b04f");
for (let k = 1; k < 6; k++) {
  eu.irPara(Math.floor(L / 2) - k, horizonte + k * 3);
  eu.retangulo(2 * k, 1, true);
}`
  },
  {
    titulo: 'Espiral quadrada',
    pedido: 'uma espiral quadrada que vai crescendo até sair da tela',
    entendi: 'A peça anda e vira 90 graus, aumentando um pouco o passo a cada vez, até que a borda a faça parar.',
    escolhas: ['O passo cresce 2 células por vez.', 'Quando a peça encosta na borda, o plano para.'],
    codigo: `eu.cor("azul escuro");
eu.espessura(1);
let passo = 2;
while (eu.frente(passo)) {
  eu.direita(90);
  passo += 2;
}`
  },
  {
    titulo: 'Um fosso em volta',
    pedido: 'cave um fosso em volta de onde eu estou, pra ninguém chegar perto',
    entendi: 'Cavo um quadrado de células a 8 de distância da peça, em volta dela. A peça não sai do lugar.',
    escolhas: ['"Perto" virou 8 células.', 'O fosso é um quadrado, não um círculo.', 'Cavo célula a célula com tela.cavar, em vez de mover a peça cavando: ao contornar o quadrado, ela esbarraria no próprio fosso.'],
    codigo: `const d = 8;
const cx = eu.x, cy = eu.y;
for (let k = -d; k <= d; k++) {
  tela.cavar(cx + k, cy - d);   // lado de cima
  tela.cavar(cx + k, cy + d);   // lado de baixo
  tela.cavar(cx - d, cy + k);   // lado esquerdo
  tela.cavar(cx + d, cy + k);   // lado direito
}
eu.dizer("fosso pronto");`
  }
];
