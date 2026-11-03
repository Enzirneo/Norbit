import { destinoSeguro } from './destino';

describe('destinoSeguro', () => {
  it('aceita um caminho da própria aplicação', () => {
    expect(destinoSeguro('/convite?token=abc')).toBe('/convite?token=abc');
  });

  it('cai na raiz quando não há destino', () => {
    expect(destinoSeguro(null)).toBe('/');
    expect(destinoSeguro('')).toBe('/');
  });

  it('recusa endereço absoluto: viraria redirect aberto', () => {
    expect(destinoSeguro('https://outro-site.com')).toBe('/');
  });

  it('recusa endereço sem protocolo, que o navegador trata como outro host', () => {
    expect(destinoSeguro('//outro-site.com')).toBe('/');
    expect(destinoSeguro('/\\outro-site.com')).toBe('/');
  });

  it('recusa caminho relativo sem a barra inicial', () => {
    expect(destinoSeguro('convite')).toBe('/');
  });
});
