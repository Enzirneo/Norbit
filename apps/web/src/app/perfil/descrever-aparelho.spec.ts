import { descreverAparelho } from './descrever-aparelho';

describe('descreverAparelho', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
      'Firefox · Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Chrome · Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
      'Edge · Windows',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      'Safari · macOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Safari · iOS',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
      'Chrome · Android',
    ],
  ])('reconhece %#', (userAgent, esperado) => {
    expect(descreverAparelho(userAgent)).toBe(esperado);
  });

  it('o Chrome do Android não vira Linux', () => {
    expect(
      descreverAparelho(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome · Android');
  });

  it('só o navegador, quando o sistema não é reconhecido', () => {
    expect(descreverAparelho('Mozilla/5.0 (Plan9) Firefox/130.0')).toBe(
      'Firefox',
    );
  });

  it('cai em "Aparelho desconhecido" sem userAgent ou com um irreconhecível', () => {
    expect(descreverAparelho(null)).toBe('Aparelho desconhecido');
    expect(descreverAparelho('')).toBe('Aparelho desconhecido');
    expect(descreverAparelho('curl/8.0')).toBe('Aparelho desconhecido');
  });
});
