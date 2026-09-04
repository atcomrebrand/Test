/**
 * Gera `apps/web/src/gym/components/bodyPaths.ts` a partir do desenho anatômico do pacote
 * `react-body-highlighter` (MIT, Copyright (c) 2020 GV79).
 *
 * O desenho é VENDORIZADO em vez de importado porque o pacote não exporta os polígonos — só o
 * componente `<Model>` dele, cuja API pinta por frequência de exercício. Usar o componente custaria
 * os dois modos (Carga/Atenção), o contorno do músculo selecionado e o rótulo acessível por região,
 * que é justamente o que a tela precisa. Vendorizando o dado, fica o desenho deles e o
 * comportamento nosso, sem dependência em tempo de execução.
 *
 * Rodar com o pacote instalado:  node scripts/gen-body-paths.js
 */
const fs = require("fs");
const path = require("path");

const PKG = require.resolve("react-body-highlighter/package.json", { paths: [path.join(__dirname, "../apps/web")] });
const SRC = path.join(path.dirname(PKG), "src/assets/index.ts");

let ts = fs.readFileSync(SRC, "utf8").replace(/\r/g, "");
ts = ts.replace(/^import[^;]+;\n/m, "").replace(/^interface[\s\S]*?^}\n/m, "");
ts = ts.replace(/: ISVGModelData\[\]/g, "").replace(/export const/g, "const");
ts = ts.replace(/MuscleType\.(\w+)/g, (_, k) => JSON.stringify(k.toLowerCase().replace(/_/g, "-")));
const tmp = path.join(require("os").tmpdir(), `rbh-assets-${Date.now()}.js`);
fs.writeFileSync(tmp, ts + "\nmodule.exports={anteriorData,posteriorData};");
const { anteriorData, posteriorData } = require(tmp);
fs.unlinkSync(tmp);

/** O desenho tem mais regiões que os 12 grupos do app; o que não é grupo vira base neutra. */
const MAPA = {
  chest: "PEITO",
  abs: "ABDOMEN",
  obliques: "ABDOMEN",
  biceps: "BICEPS",
  triceps: "TRICEPS",
  forearm: "ANTEBRACO",
  "front-deltoids": "OMBROS",
  "back-deltoids": "OMBROS",
  trapezius: "TRAPEZIO",
  "upper-back": "COSTAS",
  "lower-back": "COSTAS",
  gluteal: "GLUTEOS",
  hamstring: "POSTERIORES",
  quadriceps: "QUADRICEPS",
  calves: "PANTURRILHAS",
  "left-soleus": "PANTURRILHAS",
  "right-soleus": "PANTURRILHAS",
  // Cabeça, pescoço, joelhos e abdutores não são grupos treináveis no app: viram base.
  head: null,
  neck: null,
  knees: null,
  abductor: null,
  abductors: null,
};

function compilar(dados) {
  const neutros = [];
  const grupos = new Map();
  for (const { muscle, svgPoints } of dados) {
    const alvo = MAPA[muscle];
    if (alvo === undefined) throw new Error(`região sem mapeamento: ${muscle}`);
    if (alvo === null) neutros.push(...svgPoints);
    else grupos.set(alvo, [...(grupos.get(alvo) ?? []), ...svgPoints]);
  }
  return { neutros, grupos };
}

const frente = compilar(anteriorData);
const costas = compilar(posteriorData);

const lista = (itens, ind) => itens.map((p) => `${ind}"${p.trim().replace(/\s+/g, " ")}",`).join("\n");
const bloco = ({ grupos }) =>
  [...grupos.entries()]
    .map(([m, pts]) => `    {\n      muscle: "${m}",\n      points: [\n${lista(pts, "        ")}\n      ],\n    },`)
    .join("\n");

const saida = `import { GymMuscle } from "../types";

/**
 * O boneco: desenho anatômico em polígonos, frente e costas.
 *
 * **O desenho não é meu — é do pacote \`react-body-highlighter\` (MIT, Copyright (c) 2020 GV79),
 * que por sua vez o herdou do \`react-native-body-highlighter\`.** A primeira versão desta tela usava
 * formas desenhadas à mão, e elas nunca passaram de blocos arredondados: proporção humana e
 * separação muscular de verdade (peitoral, oblíquos, gomos do abdômen, dorsal, sóleo) é trabalho de
 * ilustração, não de ajuste de coordenada.
 *
 * O dado é **vendorizado**, e não importado, porque o pacote não exporta os polígonos — só o
 * componente \`<Model>\` dele, que pinta por frequência de exercício. Usar o componente custaria os
 * dois modos (Carga/Atenção), o contorno do selecionado e o rótulo acessível por região. Assim fica
 * o desenho deles com o comportamento nosso, e sem dependência em tempo de execução.
 *
 * Regenerar com \`node scripts/gen-body-paths.js\` (precisa do pacote instalado).
 *
 * viewBox 0 0 100 200.
 */
export type BodyView = "FRONT" | "BACK";

export interface MuscleShape {
  muscle: GymMuscle;
  /** Polígonos da região. São eles próprios a área de toque: seguem o contorno do músculo, então o
   *  alvo é anatomicamente o que a pessoa está vendo. */
  points: string[];
}

export const VIEWBOX = "0 0 100 200";

/** Cabeça, pescoço, joelhos e abdutores: não são grupos treináveis aqui, então nunca recebem cor.
 *  Pintados com a MESMA cor do músculo não treinado, é o que faz o corpo continuar inteiro quando
 *  nada foi treinado, em vez de virar um monte de buracos. */
export const NEUTRAL_SHAPES: Record<BodyView, string[]> = {
  FRONT: [
${lista(frente.neutros, "    ")}
  ],
  BACK: [
${lista(costas.neutros, "    ")}
  ],
};

export const BODY: Record<BodyView, MuscleShape[]> = {
  FRONT: [
${bloco(frente)}
  ],
  BACK: [
${bloco(costas)}
  ],
};

/** Em qual vista cada músculo aparece — usado pra levar a tela pra vista certa quando alguém abre
 *  um músculo pela lista em vez de tocar no boneco. O trapézio só existe nas costas neste desenho. */
export const MUSCLE_VIEW: Record<GymMuscle, BodyView> = {
  PEITO: "FRONT",
  ABDOMEN: "FRONT",
  BICEPS: "FRONT",
  QUADRICEPS: "FRONT",
  OMBROS: "FRONT",
  ANTEBRACO: "FRONT",
  PANTURRILHAS: "FRONT",
  TRAPEZIO: "BACK",
  COSTAS: "BACK",
  TRICEPS: "BACK",
  GLUTEOS: "BACK",
  POSTERIORES: "BACK",
};
`;

fs.writeFileSync(path.join(__dirname, "../apps/web/src/gym/components/bodyPaths.ts"), saida);
console.log(
  "frente:", [...frente.grupos.keys()].join(", "),
  "\ncostas:", [...costas.grupos.keys()].join(", "),
);
