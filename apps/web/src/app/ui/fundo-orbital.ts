/**
 * O fundo da aplicação: gradiente profundo, um brilho radial e estrelas.
 *
 * É um dos três lugares onde o `docs/04` concentra a identidade visual. As
 * regras que ele impõe e que este componente respeita:
 *
 * - **Estático.** As estrelas não piscam. Fundo que se move rouba atenção de
 *   uma interface que a pessoa olha o dia inteiro.
 * - **Quase imperceptível.** Opacidade baixa. O teste do documento é "isso
 *   ainda deixa a agenda legível em dois segundos?".
 * - **Órbita, não nave espacial.** Dois anéis levíssimos girando devagar, não
 *   um HUD de ficção científica.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';

type Estrela = {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly opacidade: number;
};

const QUANTIDADE_DE_ESTRELAS = 90;

/**
 * Gerador pseudoaleatório com semente fixa.
 *
 * `Math.random` daria um céu diferente a cada carregamento — e, no servidor,
 * um diferente do cliente, o que o Angular acusaria como divergência de
 * hidratação. Semente fixa dá sempre o mesmo céu.
 */
function semeado(semente: number): () => number {
  let estado = semente;

  return () => {
    // xorshift32: barato e suficiente para espalhar pontos.
    estado ^= estado << 13;
    estado ^= estado >>> 17;
    estado ^= estado << 5;
    return Math.abs(estado) / 2 ** 31;
  };
}

function gerarEstrelas(): Estrela[] {
  const proximo = semeado(0x5eed);

  return Array.from({ length: QUANTIDADE_DE_ESTRELAS }, () => ({
    x: Math.round(proximo() * 1000) / 10,
    y: Math.round(proximo() * 1000) / 10,
    r: Math.round((0.5 + proximo() * 1.1) * 100) / 100,
    // Varia a opacidade para dar profundidade sem precisar de mais camadas.
    opacidade: Math.round((0.18 + proximo() * 0.5) * 100) / 100,
  }));
}

/** Calculado uma vez, ao carregar o módulo: o céu é o mesmo em toda instância. */
const ESTRELAS = gerarEstrelas();

@Component({
  selector: 'nb-fundo-orbital',
  templateUrl: './fundo-orbital.html',
  styleUrl: './fundo-orbital.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FundoOrbital {
  protected readonly estrelas = ESTRELAS;
}
