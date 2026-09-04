import { GymMuscle } from "../types";

/**
 * O boneco, desenhado à mão em SVG.
 *
 * Sem biblioteca e sem imagem: são ~30 formas, e um SVG inline é a única forma de cada músculo ser
 * um elemento clicável, pintável e legível por leitor de tela. Uma imagem exigiria mapa de área
 * (que não escala) e um pacote de anatomia traria megabytes pra desenhar doze regiões.
 *
 * O corpo NÃO tem silhueta por baixo: ele é a soma das próprias formas. É isso que faz "não
 * treinou" poder ser vazio de verdade — com uma silhueta atrás, o músculo apagado viraria um buraco
 * na figura em vez de uma região em repouso.
 *
 * Coordenadas num viewBox 0 0 200 420, com o corpo espelhado em x=100.
 */
export type BodyView = "FRONT" | "BACK";

export interface MuscleShape {
  muscle: GymMuscle;
  /** Cada região pode ter mais de uma forma (esquerda e direita, por exemplo). */
  paths: string[];
  /**
   * A área de toque, invisível, por cima do desenho.
   *
   * Sem ela o alvo é o desenho, e o desenho tem buracos: o centro do peito cai no vão entre os dois
   * peitorais e o toque acerta o tronco em vez do músculo — que é justamente onde o dedo pousa. Ela
   * também é o que torna alcançável no celular o antebraço e a panturrilha, que são finos.
   *
   * As áreas não se sobrepõem de propósito: duas caixas dividindo o mesmo ponto fariam o toque
   * responder por sorteio de ordem.
   */
  hit: string[];
}

/**
 * O que não é grupo muscular: cabeça, pescoço, tronco, membros, juntas, mãos e pés.
 *
 * Esta é a base do corpo, e ela existe por um motivo de leitura: sem ela os músculos ficam boiando
 * soltos no ar e a figura deixa de parecer uma pessoa. Ela é pintada com a MESMA cor do músculo não
 * treinado, então o que não foi treinado continua sumindo dentro do corpo em vez de virar um buraco
 * — que é exatamente o efeito pedido.
 */
export const NEUTRAL_SHAPES: Record<BodyView, string[]> = {
  FRONT: [
    "M100,8 a21,24 0 1,1 -0.1,0 Z",
    "M90,50 h20 v14 a10,10 0 0,1 -20,0 Z",
    "M72,90 Q100,76 128,90 L125,152 Q119,178 118,192 L82,192 Q81,178 75,152 Z",
    "M48,100 Q60,96 68,102 L66,158 Q54,162 46,156 Z",
    "M152,100 Q140,96 132,102 L134,158 Q146,162 154,156 Z",
    "M78,196 Q100,190 122,196 L120,214 L80,214 Z",
    "M78,210 Q90,206 99,212 L98,292 L80,292 Z",
    "M122,210 Q110,206 101,212 L102,292 L120,292 Z",
    "M80,290 Q90,286 98,290 L96,356 L82,356 Z",
    "M120,290 Q110,286 102,290 L104,356 L118,356 Z",
    "M82,188 h36 v18 h-36 Z",
    "M44,206 a9,11 0 1,0 0.1,0 Z",
    "M156,206 a9,11 0 1,1 -0.1,0 Z",
    "M80,286 h18 v12 h-18 Z",
    "M102,286 h18 v12 h-18 Z",
    "M78,360 h20 v14 a10,7 0 0,1 -20,0 Z",
    "M102,360 h20 v14 a10,7 0 0,1 -20,0 Z",
  ],
  BACK: [
    "M100,8 a21,24 0 1,1 -0.1,0 Z",
    "M90,50 h20 v14 a10,10 0 0,1 -20,0 Z",
    "M72,88 Q100,74 128,88 L125,150 Q119,176 118,190 L82,190 Q81,176 75,150 Z",
    "M48,100 Q60,96 68,102 L66,158 Q54,162 46,156 Z",
    "M152,100 Q140,96 132,102 L134,158 Q146,162 154,156 Z",
    "M78,210 Q90,206 99,214 L98,294 L80,294 Z",
    "M122,210 Q110,206 101,214 L102,294 L120,294 Z",
    "M80,292 Q90,288 98,292 L96,354 L82,354 Z",
    "M120,292 Q110,288 102,292 L104,354 L118,354 Z",
    "M44,206 a9,11 0 1,0 0.1,0 Z",
    "M156,206 a9,11 0 1,1 -0.1,0 Z",
    "M80,290 h18 v10 h-18 Z",
    "M102,290 h18 v10 h-18 Z",
    "M78,358 h20 v14 a10,7 0 0,1 -20,0 Z",
    "M102,358 h20 v14 a10,7 0 0,1 -20,0 Z",
  ],
};

export const BODY: Record<BodyView, MuscleShape[]> = {
  FRONT: [
    { muscle: "TRAPEZIO", paths: ["M72,86 Q100,60 128,86 L120,96 Q100,76 80,96 Z"], hit: ["M74,82 H126 V100 H74 Z"] },
    {
      muscle: "OMBROS",
      paths: [
        "M62,86 a17,19 0 0,0 -14,26 q10,8 20,2 q4,-16 -6,-28 Z",
        "M138,86 a17,19 0 0,1 14,26 q-10,8 -20,2 q-4,-16 6,-28 Z",
      ],
      hit: ["M44,82 H72 V110 H44 Z", "M128,82 H156 V110 H128 Z"],
    },
    {
      muscle: "PEITO",
      paths: [
        "M80,96 Q96,90 98,100 L98,126 Q84,132 77,118 Q75,104 80,96 Z",
        "M120,96 Q104,90 102,100 L102,126 Q116,132 123,118 Q125,104 120,96 Z",
      ],
      hit: ["M74,100 H126 V128 H74 Z"],
    },
    { muscle: "ABDOMEN", paths: ["M85,130 h30 q2,30 -1,56 Q100,194 86,186 Q83,160 85,130 Z"], hit: ["M80,128 H120 V196 H80 Z"] },
    {
      muscle: "BICEPS",
      paths: [
        "M50,116 Q62,113 66,122 L64,152 Q53,157 47,148 Q46,130 50,116 Z",
        "M150,116 Q138,113 134,122 L136,152 Q147,157 153,148 Q154,130 150,116 Z",
      ],
      hit: ["M44,112 H70 V152 H44 Z", "M130,112 H156 V152 H130 Z"],
    },
    {
      muscle: "ANTEBRACO",
      paths: [
        "M47,156 Q58,153 63,160 L60,198 Q50,202 44,194 Q43,172 47,156 Z",
        "M153,156 Q142,153 137,160 L140,198 Q150,202 156,194 Q157,172 153,156 Z",
      ],
      hit: ["M42,154 H66 V206 H42 Z", "M134,154 H158 V206 H134 Z"],
    },
    {
      muscle: "QUADRICEPS",
      paths: [
        "M82,208 Q95,204 98,214 L97,278 Q86,284 79,276 Q78,238 82,208 Z",
        "M118,208 Q105,204 102,214 L103,278 Q114,284 121,276 Q122,238 118,208 Z",
      ],
      hit: ["M76,198 H124 V288 H76 Z"],
    },
    {
      muscle: "PANTURRILHAS",
      paths: [
        "M82,302 Q94,299 96,310 L94,352 Q85,357 80,348 Q79,320 82,302 Z",
        "M118,302 Q106,299 104,310 L106,352 Q115,357 120,348 Q121,320 118,302 Z",
      ],
      hit: ["M76,296 H124 V358 H76 Z"],
    },
  ],
  BACK: [
    { muscle: "TRAPEZIO", paths: ["M72,84 Q100,62 128,84 L120,124 Q100,112 80,124 Z"], hit: ["M74,78 H126 V110 H74 Z"] },
    {
      muscle: "OMBROS",
      paths: [
        "M62,86 a17,19 0 0,0 -14,26 q10,8 20,2 q4,-16 -6,-28 Z",
        "M138,86 a17,19 0 0,1 14,26 q-10,8 -20,2 q-4,-16 6,-28 Z",
      ],
      hit: ["M44,82 H72 V110 H44 Z", "M128,82 H156 V110 H128 Z"],
    },
    {
      muscle: "COSTAS",
      paths: [
        "M78,112 Q94,116 97,128 L96,172 Q80,168 73,142 Q73,122 78,112 Z",
        "M122,112 Q106,116 103,128 L104,172 Q120,168 127,142 Q127,122 122,112 Z",
      ],
      hit: ["M74,110 H126 V178 H74 Z"],
    },
    {
      muscle: "TRICEPS",
      paths: [
        "M49,116 Q61,113 65,122 L63,152 Q52,157 46,148 Q45,130 49,116 Z",
        "M151,116 Q139,113 135,122 L137,152 Q148,157 154,148 Q155,130 151,116 Z",
      ],
      hit: ["M44,112 H70 V152 H44 Z", "M130,112 H156 V152 H130 Z"],
    },
    {
      muscle: "ANTEBRACO",
      paths: [
        "M47,156 Q58,153 63,160 L60,198 Q50,202 44,194 Q43,172 47,156 Z",
        "M153,156 Q142,153 137,160 L140,198 Q150,202 156,194 Q157,172 153,156 Z",
      ],
      hit: ["M42,154 H66 V206 H42 Z", "M134,154 H158 V206 H134 Z"],
    },
    { muscle: "GLUTEOS", paths: ["M80,192 Q100,184 120,192 Q124,214 118,228 Q100,238 82,228 Q76,214 80,192 Z"], hit: ["M76,186 H124 V232 H76 Z"] },
    {
      muscle: "POSTERIORES",
      paths: [
        "M82,234 Q95,231 98,241 L97,284 Q86,290 79,282 Q78,254 82,234 Z",
        "M118,234 Q105,231 102,241 L103,284 Q114,290 121,282 Q122,254 118,234 Z",
      ],
      hit: ["M76,232 H124 V290 H76 Z"],
    },
    {
      muscle: "PANTURRILHAS",
      paths: [
        "M81,302 Q94,298 97,310 L95,350 Q85,356 79,347 Q78,320 81,302 Z",
        "M119,302 Q106,298 103,310 L105,350 Q115,356 121,347 Q122,320 119,302 Z",
      ],
      hit: ["M76,296 H124 V356 H76 Z"],
    },
  ],
};

/** Em qual vista cada músculo aparece — usado pra levar a tela pra vista certa quando alguém abre
 *  um músculo pela lista em vez de clicar no boneco. */
export const MUSCLE_VIEW: Record<GymMuscle, BodyView> = {
  PEITO: "FRONT",
  ABDOMEN: "FRONT",
  BICEPS: "FRONT",
  QUADRICEPS: "FRONT",
  OMBROS: "FRONT",
  TRAPEZIO: "FRONT",
  ANTEBRACO: "FRONT",
  PANTURRILHAS: "FRONT",
  COSTAS: "BACK",
  TRICEPS: "BACK",
  GLUTEOS: "BACK",
  POSTERIORES: "BACK",
};
