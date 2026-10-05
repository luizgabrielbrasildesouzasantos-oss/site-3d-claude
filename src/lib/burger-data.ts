// Dados compartilhados entre a página e a cena 3D.
// Este arquivo NÃO importa three.js para não pesar o carregamento inicial.

export type BurgerState = {
  scroll: number; // 0..1 página inteira
  assemble: number; // 0..1 montagem do burger
  finale: number; // 0..1 cena final (câmera baixa, close)
  shift: number; // -1..1 lado para onde o burger sai da frente do texto
  mouseX: number; // -1..1
  mouseY: number; // -1..1
};

export type Ingredient = {
  id: string;
  name: string;
  height: number; // espessura somada na pilha
};

// Ordem de baixo para cima.
export const INGREDIENTS: Ingredient[] = [
  { id: "bun-bottom", name: "Pão brioche", height: 0.5 },
  { id: "patty-1", name: "Carne na brasa", height: 0.33 },
  { id: "cheese-1", name: "Cheddar", height: 0.04 },
  { id: "bacon", name: "Bacon crocante", height: 0.12 },
  { id: "lettuce", name: "Alface crespa", height: 0.2 },
  { id: "tomato", name: "Tomate", height: 0.13 },
  { id: "onion", name: "Cebola roxa", height: 0.1 },
  { id: "pickles", name: "Picles", height: 0.07 },
  { id: "sauce", name: "Molho da casa", height: 0.08 },
  { id: "patty-2", name: "Carne na brasa", height: 0.33 },
  { id: "cheese-2", name: "Cheddar", height: 0.04 },
  { id: "bun-top", name: "Pão com gergelim", height: 1.13 },
];

export const STACK_TOP = INGREDIENTS.reduce((sum, i) => sum + i.height, 0);

// Cada camada começa a cair em um ponto do progresso (0..1) e leva LAYER_DUR para assentar.
export const LAYER_DUR = 0.14;
export const layerStart = (i: number): number => (i * (1 - LAYER_DUR)) / (INGREDIENTS.length - 1);
