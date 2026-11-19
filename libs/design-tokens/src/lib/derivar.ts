/**
 * Da semente ao tema: `derivar` transforma `{ fundo, destaque, contraste }` em
 * todos os tokens semânticos, com o contraste garantido.
 *
 * Trabalha em OKLCH (ver `oklch.ts`): "um pouco mais claro" e "mesmo matiz" são
 * operações que o olho reconhece. E nunca recusa uma semente: se a combinação
 * não permite o contraste, ajusta o necessário e devolve um **aviso** em
 * linguagem de gente. Quem decide o que mostrar é o editor.
 *
 * Os critérios são os mesmos do teste dos presets (`semanticos.spec.ts`), e a
 * varredura de `derivar.spec.ts` os confere para fundos e destaques extremos.
 */
import { MINIMO_GRAFICO, MINIMO_TEXTO, contraste } from './contraste';
import { hexParaOklch, oklchParaHex, type Oklch } from './oklch';
import type { TemaSemantico } from './semanticos';
import { modoDe, normalizarHex, type Modo, type Sementes } from './sementes';

export type Derivacao = {
  readonly tokens: TemaSemantico;
  readonly avisos: readonly string[];
  readonly modo: Modo;
};

/** Os alvos de contraste por nível. Só o texto de apoio muda com o nível. */
const ALVOS = {
  normal: { principal: 7, secundario: 5.5, suave: 4.6 },
  alto: { principal: 10, secundario: 7.5, suave: 5.6 },
} as const;

/**
 * Quão longe do centro o fundo pode estar. Um fundo de claridade média não deixa
 * espaço para texto legível dos dois lados; acima destes limites o fundo é
 * puxado para o extremo, e a pessoa é avisada.
 */
const LIMITE_DO_FUNDO = {
  escuro: { normal: 0.3, alto: 0.25 },
  claro: { normal: 0.9, alto: 0.93 },
} as const;

/** Quanto o hover precisa se distinguir do destaque (ver `acentos.ts`). */
const DISTANCIA_DO_HOVER = 1.15;

/** A tinta mínima do fundo de seleção (ver `acentos.ts`). */
const TINTA_DA_SELECAO = 1.25;

/** Matiz e croma dos estados: fixos, para o verde parecer verde em qualquer tema. */
const ESTADOS = {
  sucesso: { c: 0.15, h: 165 },
  aviso: { c: 0.15, h: 75 },
  perigo: { c: 0.17, h: 15 },
} as const;

type Superficies = {
  readonly sunken: string;
  readonly base: string;
  readonly raised: string;
  readonly overlay: string;
};

export function derivar(sementes: Sementes): Derivacao {
  const avisos: string[] = [];
  const modo = modoDe(sementes.fundo);
  const alvos = ALVOS[sementes.contraste];

  const fundo = ajustarFundo(sementes, modo);
  if (fundo.ajustado) {
    avisos.push(
      'Ajustamos o fundo para o texto ficar legível sobre ele: o original estava perto demais do meio entre claro e escuro.',
    );
  }

  const s = superficies(fundo.hex, modo);
  const base = hexParaOklch(s.base);
  const texto = textos(base, s, modo, alvos);

  const destaque = ajustarDestaque(sementes.destaque, modo, [
    s.base,
    s.raised,
    s.sunken,
  ]);
  if (destaque.ajustado) {
    avisos.push('Ajustamos o destaque para ficar legível sobre o fundo.');
  }

  const frente = melhorFrente(destaque.hex);
  const borda = bordas(base, texto.principal, s);

  const tokens: TemaSemantico = {
    surfaceBase: s.base,
    surfaceRaised: s.raised,
    surfaceOverlay: s.overlay,
    surfaceSunken: s.sunken,
    textPrimary: texto.principal,
    textSecondary: texto.secundario,
    textMuted: texto.suave,
    textOnAccent: frente,
    borderSubtle: borda.suave,
    borderDefault: borda.padrao,
    borderFocus: destaque.hex,
    accent: destaque.hex,
    accentHover: hoverDe(destaque.hex, frente),
    accentMuted: fundoDeSelecao(base, destaque.hex, texto.principal),
    ...estados(modo, [s.base, s.raised], alvos.suave),
  };

  return { tokens, avisos, modo };
}

// ── fundo e superfícies ─────────────────────────────────────────────────────

function ajustarFundo(
  sementes: Sementes,
  modo: Modo,
): { hex: string; ajustado: boolean } {
  const original = normalizarHex(sementes.fundo);
  const cor = hexParaOklch(original);
  const limite =
    LIMITE_DO_FUNDO[modo === 'escuro' ? 'escuro' : 'claro'][sementes.contraste];
  const passou = modo === 'escuro' ? cor.l > limite : cor.l < limite;

  return passou
    ? { hex: oklchParaHex({ ...cor, l: limite }), ajustado: true }
    : { hex: original, ajustado: false };
}

/**
 * Os degraus: a elevação **clareia** no escuro e se aproxima do branco no claro.
 * Matiz e croma do fundo se mantêm, para as superfícies terem a mesma cor dele.
 */
function superficies(fundo: string, modo: Modo): Superficies {
  const cor = hexParaOklch(fundo);
  const degraus =
    modo === 'escuro'
      ? { sunken: -0.025, raised: 0.035, overlay: 0.07 }
      : { sunken: -0.035, raised: 0.02, overlay: 0.04 };

  const em = (passo: number): string =>
    oklchParaHex({ ...cor, l: Math.min(1, Math.max(0, cor.l + passo)) });

  return {
    sunken: em(degraus.sunken),
    base: fundo,
    raised: em(degraus.raised),
    overlay: em(degraus.overlay),
  };
}

// ── texto ───────────────────────────────────────────────────────────────────

type Alvos = (typeof ALVOS)[keyof typeof ALVOS];

function textos(
  base: Oklch,
  s: Superficies,
  modo: Modo,
  alvos: Alvos,
): { principal: string; secundario: string; suave: string } {
  const matiz = { c: Math.min(base.c, 0.015), h: base.h };
  const sentido = modo === 'escuro' ? 1 : -1;
  const ponta = modo === 'escuro' ? 0.98 : 0.18;
  const todas = [s.sunken, s.base, s.raised, s.overlay];

  const principal = oklchParaHex({ l: ponta, ...matiz });
  // O mais discreto que ainda passa: parte da base e se afasta até o alvo.
  const apoio = (alvo: number): string =>
    buscar({
      inicio: base.l,
      passo: 0.005 * sentido,
      gerar: (l) => oklchParaHex({ l, ...matiz }),
      serve: (hex) => pior(hex, [s.base, s.raised]) >= alvo,
      reserva: principal,
    });

  return {
    principal:
      pior(principal, todas) >= alvos.principal ? principal : extremo(modo),
    secundario: apoio(alvos.secundario),
    suave: apoio(alvos.suave),
  };
}

function extremo(modo: Modo): string {
  return modo === 'escuro' ? '#ffffff' : '#000000';
}

// ── destaque ────────────────────────────────────────────────────────────────

function ajustarDestaque(
  destaque: string,
  modo: Modo,
  fundos: readonly string[],
): { hex: string; ajustado: boolean } {
  const original = normalizarHex(destaque);
  if (serveDeDestaque(original, fundos)) {
    return { hex: original, ajustado: false };
  }

  const cor = hexParaOklch(original);
  const hex = buscar({
    inicio: cor.l,
    passo: modo === 'escuro' ? 0.01 : -0.01,
    gerar: (l) => oklchParaHex({ ...cor, l }),
    serve: (candidato) => serveDeDestaque(candidato, fundos),
    reserva: extremo(modo),
  });

  return { hex, ajustado: true };
}

/**
 * O destaque serve quando se lê sobre as superfícies **e** o texto de cima dele
 * (o botão) também se lê: nos tons médios as duas coisas brigam.
 */
function serveDeDestaque(cor: string, fundos: readonly string[]): boolean {
  return (
    pior(cor, fundos) >= MINIMO_TEXTO &&
    contraste(melhorFrente(cor), cor) >= MINIMO_TEXTO
  );
}

/** A frente (quase preta ou quase branca) com mais contraste sobre o destaque. */
function melhorFrente(destaque: string): string {
  const cor = hexParaOklch(destaque);
  const escura = oklchParaHex({ l: 0.12, c: Math.min(cor.c, 0.02), h: cor.h });
  const clara = oklchParaHex({ l: 0.985, c: Math.min(cor.c, 0.02), h: cor.h });

  return contraste(escura, destaque) >= contraste(clara, destaque)
    ? escura
    : clara;
}

/**
 * O hover: o destaque afastado **da frente**, para o texto ganhar contraste em
 * vez de perder. Se não houver espaço para esse lado, tenta o outro.
 */
function hoverDe(destaque: string, frente: string): string {
  const cor = hexParaOklch(destaque);
  const afastando = hexParaOklch(frente).l < cor.l ? 1 : -1;

  for (const sentido of [afastando, -afastando]) {
    const candidato = buscar({
      inicio: cor.l,
      passo: 0.005 * sentido,
      gerar: (l) => oklchParaHex({ ...cor, l }),
      serve: (hex) =>
        contraste(hex, destaque) >= DISTANCIA_DO_HOVER &&
        contraste(frente, hex) >= MINIMO_TEXTO,
      reserva: null,
    });
    if (candidato !== null) {
      return candidato;
    }
  }

  return destaque;
}

/**
 * O fundo de estado selecionado: o destaque diluído na base, no ponto mais
 * sutil em que ainda se nota (`TINTA_DA_SELECAO`) e o texto continua legível.
 */
function fundoDeSelecao(base: Oklch, destaque: string, texto: string): string {
  const alvo = hexParaOklch(destaque);
  const baseHex = oklchParaHex(base);
  const mistura = (t: number): string =>
    oklchParaHex({
      l: base.l + (alvo.l - base.l) * t,
      c: base.c + (alvo.c - base.c) * t,
      h: alvo.h,
    });

  for (let t = 0.04; t <= 0.6; t += 0.02) {
    const candidato = mistura(t);
    if (
      contraste(candidato, baseHex) >= TINTA_DA_SELECAO &&
      contraste(texto, candidato) >= MINIMO_TEXTO
    ) {
      return candidato;
    }
  }

  return baseHex;
}

// ── bordas e estados ────────────────────────────────────────────────────────

/** Bordas: misturas do texto com a base; a de componente tem de passar de 3:1. */
function bordas(
  base: Oklch,
  principal: string,
  s: Superficies,
): { suave: string; padrao: string } {
  const texto = hexParaOklch(principal);
  const mistura = (t: number): string =>
    oklchParaHex({ l: base.l + (texto.l - base.l) * t, c: base.c, h: base.h });
  const padrao = buscar({
    inicio: 0,
    passo: 0.02,
    gerar: mistura,
    serve: (hex) => pior(hex, [s.base, s.raised, s.overlay]) >= MINIMO_GRAFICO,
    reserva: principal,
    limite: 50,
  });

  return { suave: mistura(0.12), padrao };
}

function estados(
  modo: Modo,
  fundos: readonly string[],
  alvo: number,
): Pick<TemaSemantico, 'stateSuccess' | 'stateWarning' | 'stateDanger'> {
  const de = (e: { c: number; h: number }): string =>
    buscar({
      inicio: modo === 'escuro' ? 0.75 : 0.5,
      passo: modo === 'escuro' ? 0.01 : -0.01,
      gerar: (l) => oklchParaHex({ l, ...e }),
      serve: (hex) => pior(hex, fundos) >= alvo,
      reserva: extremo(modo),
    });

  return {
    stateSuccess: de(ESTADOS.sucesso),
    stateWarning: de(ESTADOS.aviso),
    stateDanger: de(ESTADOS.perigo),
  };
}

// ── apoio ───────────────────────────────────────────────────────────────────

/** O pior contraste de `cor` entre vários fundos. */
function pior(cor: string, fundos: readonly string[]): number {
  return Math.min(...fundos.map((fundo) => contraste(cor, fundo)));
}

type Busca<R> = {
  readonly inicio: number;
  readonly passo: number;
  readonly gerar: (valor: number) => string;
  readonly serve: (candidato: string) => boolean;
  /** O que devolver se nenhum candidato servir. */
  readonly reserva: R;
  readonly limite?: number;
};

/** Anda de `inicio` em `passo`, devolvendo o primeiro candidato que serve. */
function buscar<R extends string | null>(busca: Busca<R>): string | R {
  const { inicio, passo, gerar, serve, reserva, limite = 200 } = busca;

  for (let i = 0; i <= limite; i++) {
    const valor = inicio + passo * i;
    if (valor < 0 || valor > 1) {
      break;
    }
    const candidato = gerar(valor);
    if (serve(candidato)) {
      return candidato;
    }
  }

  return reserva;
}
