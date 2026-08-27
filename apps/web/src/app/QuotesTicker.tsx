import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { QuoteTickerItem, useQuotesTicker } from "@/features/useQuotes";
import { HIDDEN_AMOUNT } from "@/lib/format";
import { valuesHidden } from "@/store/privacy";

/**
 * Velocidade da faixa, em pixels por segundo. **É a única constante pra mexer se ficar rápida ou
 * lenta demais** — menor é mais devagar.
 *
 * Em px/s e não em "segundos por item" porque item não tem largura fixa: "🪙 BTC R$ 300.000,00"
 * ocupa quase o triplo de "🇺🇸 USD R$ 5,09", então a conta por item passa voando numa carteira com
 * cripto e arrastada numa sem.
 */
const PIXELS_POR_SEGUNDO = 20;

/**
 * Quanto tempo a faixa fica parada depois que a pessoa solta.
 *
 * Não é só respeitar a inércia do toque (que continua rolando sozinha por um tempo depois do dedo
 * sair): é dar chance de recomeçar o gesto. Voltar a andar no instante em que solta faz o ativo que
 * a pessoa estava lendo escapar bem na hora de ler.
 */
const RETOMAR_APOS_MS = 1200;

/**
 * Moeda leva uma casa a mais que o resto do app: com 2 dígitos o movimento minuto a minuto de um
 * par some (5,09 / 5,10 / 5,11 viram todos a mesma vizinhança), que é o que fazia o ticker parecer
 * travado.
 *
 * Ativo, não: preço de ação se escreve com 2 casas, e um bitcoin a "R$ 320.000,000" é ruído de
 * três dígitos que ninguém lê.
 */
function formatRate(value: number, kind: QuoteTickerItem["kind"]) {
  // O ticker tem formatador próprio (casas decimais por tipo), então não herda a máscara do
  // `formatCurrency` de graça — e ele fica no topo da Home, que é a primeira coisa que alguém vê.
  if (valuesHidden()) return HIDDEN_AMOUNT;
  const casas = kind === "CURRENCY" ? 3 : 2;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(value);
}

/**
 * Ticker rolante estilo jornal: dólar mais os ativos em carteira, na ordem que o backend mandar.
 *
 * A rolagem é **de verdade** (`overflow-x`), não uma animação de CSS. A animação era mais simples,
 * mas não dá pra pegar no meio: pra deixar arrastar seria preciso ler o transform corrente, trocar
 * pra manual e depois retomar de onde parou com `animation-delay` negativo. Com rolagem nativa o
 * dedo no celular e o trackpad no desktop já funcionam de graça, o teclado também, e o passo
 * automático vira um `requestAnimationFrame` somando pixels.
 *
 * O conteúdo é duplicado e a posição volta meia largura ao cruzar a emenda — como as duas cópias
 * são idênticas, o salto é invisível e a faixa não tem começo nem fim nos dois sentidos.
 */
export function QuotesTicker() {
  const { data } = useQuotesTicker();
  const faixa = useRef<HTMLDivElement>(null);
  /** Enquanto > 0, o passo automático está segurado (mouse em cima, arrasto, inércia). */
  const pausas = useRef(0);
  const retomarEm = useRef(0);
  const arrasto = useRef<{ x: number } | null>(null);
  /**
   * Posição em ponto flutuante.
   *
   * O `scrollLeft` do navegador é arredondado, e a 20 px/s cada quadro soma 0,33px — jogando isso
   * direto no elemento, a fração é descartada toda vez e a faixa fica parada pra sempre. O
   * acumulador vive aqui e o elemento só recebe o valor já somado.
   */
  const posicao = useRef(0);
  /**
   * Quantas vezes o conjunto de itens é repetido lado a lado.
   *
   * Duas cópias bastariam se a faixa fosse um `transform` (foi o que a animação de CSS fazia), mas
   * rolagem de verdade tem teto: o navegador limita o `scrollLeft` a `scrollWidth - clientWidth`.
   * Se uma cópia é mais estreita que a tela — carteira pequena, monitor largo —, o ponto pra onde a
   * emenda precisaria pular fica além do teto, o valor é cortado e a faixa trava na ponta. Daí a
   * conta ser pela largura medida, e não um "2" fixo.
   */
  const [copias, setCopias] = useState(3);

  useLayoutEffect(() => {
    const el = faixa.current;
    const conteudo = el?.firstElementChild as HTMLElement | null;
    if (!el || !conteudo) return;

    const umaCopia = conteudo.scrollWidth / copias;
    if (umaCopia <= 0) return;

    // +2 (e nunca menos de 3): uma cópia de folga de cada lado da tela. É essa folga que permite
    // manter a posição sempre no miolo da faixa — sem ela, a emenda precisaria pular pra um ponto
    // além do teto de rolagem e o navegador cortaria o valor.
    const necessarias = Math.max(3, Math.ceil(el.clientWidth / umaCopia) + 2);
    if (necessarias !== copias) {
      setCopias(necessarias);
      return;
    }

    // Começa na segunda cópia, não em zero.
    //
    // Isso não é estética: com a faixa parada em zero, "está no começo" e "arrastaram pra trás
    // além do começo" viram o mesmo valor, porque o navegador corta scrollLeft negativo. Era o que
    // fazia a faixa dar um salto de uma cópia inteira no primeiro quadro. Partindo do miolo, zero
    // deixa de ser uma posição de repouso e volta a significar só uma coisa.
    if (el.scrollLeft === 0) {
      el.scrollLeft = umaCopia;
      posicao.current = umaCopia;
    }
  }, [data, copias]);

  const segurar = useCallback(() => {
    pausas.current += 1;
  }, []);

  const soltar = useCallback(() => {
    pausas.current = Math.max(0, pausas.current - 1);
    retomarEm.current = performance.now() + RETOMAR_APOS_MS;
  }, []);

  useEffect(() => {
    const el = faixa.current;
    if (!el) return;

    // Quem pediu menos movimento não quer uma faixa andando sozinha no topo da Home. A rolagem
    // manual continua valendo — o que sai é só o passo automático.
    const menosMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let anterior = 0;
    /** Último valor que NÓS escrevemos: o que sair disso veio de fora (dedo, trackpad, teclado). */
    let ultimoEscrito = -1;

    const passo = (agora: number) => {
      raf = requestAnimationFrame(passo);

      const dt = anterior ? (agora - anterior) / 1000 : 0;
      anterior = agora;

      const umaCopia = el.scrollWidth / copias;
      if (umaCopia <= 0) return;

      // Rolagem que não foi nossa: adota a posição real e segura o passo automático. É isto que
      // cobre o dedo no celular e o trackpad no desktop sem precisar de um handler pra cada um —
      // enquanto a inércia do toque estiver correndo, ela renova o adiamento a cada quadro.
      if (ultimoEscrito >= 0 && Math.abs(el.scrollLeft - ultimoEscrito) > 2) {
        posicao.current = el.scrollLeft;
        retomarEm.current = agora + RETOMAR_APOS_MS;
      }

      const parado = menosMovimento || pausas.current > 0 || agora < retomarEm.current;
      // Aba em segundo plano acumula um dt gigante no primeiro quadro ao voltar; sem o teto a
      // faixa daria um salto de vários itens na cara de quem acabou de voltar pra ela.
      if (!parado) posicao.current += PIXELS_POR_SEGUNDO * Math.min(dt, 0.1);

      // A emenda: as cópias são idênticas, então andar uma cópia pra frente ou pra trás cai num
      // ponto de aparência igual e o salto é invisível. A posição fica sempre normalizada em
      // [umaCopia, 2×umaCopia) — o miolo da faixa —, o que deixa uma cópia inteira de sobra pros
      // dois lados e faz a volta funcionar tanto pra frente quanto pra trás.
      const precisaEmendar = posicao.current >= umaCopia * 2 || posicao.current < umaCopia;
      if (precisaEmendar) {
        posicao.current += posicao.current >= umaCopia * 2 ? -umaCopia : umaCopia;
      }

      // Escrever durante a inércia do toque a mataria, então só escreve quando há o que aplicar.
      if (!parado || precisaEmendar) el.scrollLeft = posicao.current;
      ultimoEscrito = el.scrollLeft;
    };

    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [data, copias]);

  /** Arrasto com o mouse. No toque não entra: `touch-action: pan-x` já dá a rolagem nativa, com
   *  inércia, e tratar os dois faria a faixa andar o dobro a cada gesto. */
  const aoApertar = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = faixa.current;
      if (!el || e.pointerType !== "mouse") return;
      el.setPointerCapture(e.pointerId);
      arrasto.current = { x: e.clientX };
      segurar();
    },
    [segurar],
  );

  /**
   * Move pelo deslocamento desde o evento anterior, e não pela distância até onde o arrasto
   * começou. A diferença aparece na emenda: com a âncora fixa, a volta que o laço dá ao cruzar o
   * começo da faixa era desfeita no `pointermove` seguinte (que recalculava tudo a partir do ponto
   * inicial), e arrastar pra trás batia numa parede no zero em vez de continuar.
   */
  const aoMover = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = faixa.current;
      if (!el || !arrasto.current) return;

      const dx = e.clientX - arrasto.current.x;
      arrasto.current.x = e.clientX;

      // A emenda também aqui, e não só no laço: um gesto rápido dispara vários `pointermove` entre
      // dois quadros, e nesse intervalo o valor negativo já teria sido cortado pelo navegador — a
      // faixa encostaria na ponta antes de alguém ter a chance de emendar.
      const umaCopia = el.scrollWidth / copias;
      let alvo = el.scrollLeft - dx;
      if (umaCopia > 0) {
        if (alvo >= umaCopia * 2) alvo -= umaCopia;
        else if (alvo < umaCopia) alvo += umaCopia;
      }

      el.scrollLeft = alvo;
      posicao.current = alvo;
    },
    [copias],
  );

  const aoLargar = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = faixa.current;
      if (!el || !arrasto.current) return;
      arrasto.current = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      soltar();
    },
    [soltar],
  );

  if (!data || data.length === 0) return null;

  const renderItems = (keyPrefix: string) =>
    data.map((item, i) => {
      const isUp = item.rate !== null && item.previousClose !== null && item.rate > item.previousClose;
      const isDown = item.rate !== null && item.previousClose !== null && item.rate < item.previousClose;

      return (
        <span key={`${keyPrefix}-${item.symbol}-${i}`} className="flex items-center gap-2 whitespace-nowrap px-6 text-sm">
          <span aria-hidden>{item.flag}</span>
          <span className="font-medium text-muted">{item.label}</span>
          <span className="font-semibold">{item.rate !== null ? formatRate(item.rate, item.kind) : "cotação indisponível"}</span>
          {isUp && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" aria-label="Em alta desde o fechamento anterior" />}
          {isDown && <TrendingDown className="h-3.5 w-3.5 text-red-500" aria-label="Em queda desde o fechamento anterior" />}
        </span>
      );
    });

  return (
    <div
      ref={faixa}
      onPointerDown={aoApertar}
      onPointerMove={aoMover}
      onPointerUp={aoLargar}
      onPointerCancel={aoLargar}
      onMouseEnter={segurar}
      onMouseLeave={soltar}
      // `overscroll-x-contain` impede que arrastar a faixa até a ponta vire "voltar página" no
      // gesto do navegador. A barra de rolagem some porque isto é uma faixa decorativa: quem
      // arrasta descobre no gesto, e uma barra atravessada no topo da Home seria feia.
      className="cursor-grab select-none overflow-x-auto overscroll-x-contain border-b border-[rgb(var(--border))] surface-2 py-2 [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
      style={{ touchAction: "pan-x" }}
    >
      <div className="flex w-max">
        {Array.from({ length: copias }, (_, i) => renderItems(`c${i}`))}
      </div>
    </div>
  );
}
