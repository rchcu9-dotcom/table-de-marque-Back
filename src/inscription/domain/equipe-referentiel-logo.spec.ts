import {
  estLogoUrlValide,
  normaliserLogoUrl,
  resoudreLogoEquipe,
} from './equipe-referentiel-logo';

describe('equipe-referentiel-logo', () => {
  const baseAvant = process.env.TEAM_LOGO_BASE_URL;

  afterEach(() => {
    if (baseAvant === undefined) delete process.env.TEAM_LOGO_BASE_URL;
    else process.env.TEAM_LOGO_BASE_URL = baseAvant;
  });

  describe('estLogoUrlValide', () => {
    it.each(['https://exemple.test/a.png', 'http://localhost:5173/a.png'])(
      'accepte %s',
      (valeur) => {
        expect(estLogoUrlValide(valeur)).toBe(true);
      },
    );

    it.each([
      'blob:https://table-de-marque-72e86.web.app/3f2c',
      'blob:http://localhost:5173/f438bbf9',
      'data:image/png;base64,AAAA',
      '',
      '   ',
      null,
      undefined,
    ])('refuse %p', (valeur) => {
      expect(estLogoUrlValide(valeur)).toBe(false);
    });
  });

  it('normaliserLogoUrl remplace une adresse blob: par null', () => {
    expect(normaliserLogoUrl('blob:https://x/1')).toBeNull();
    expect(normaliserLogoUrl(' https://x/a.png ')).toBe('https://x/a.png');
  });

  describe('resoudreLogoEquipe', () => {
    beforeEach(() => {
      process.env.TEAM_LOGO_BASE_URL =
        'https://table-de-marque-72e86.web.app/assets/logos';
    });

    it("garde l'adresse enregistrée quand elle est exploitable", () => {
      expect(resoudreLogoEquipe('https://exemple.test/a.png', 'Dammarie')).toBe(
        'https://exemple.test/a.png',
      );
    });

    it("reprend le PNG d'après le nom quand l'adresse est une blob:", () => {
      expect(
        resoudreLogoEquipe(
          'blob:https://table-de-marque-72e86.web.app/3f2c',
          'Dammarie',
        ),
      ).toBe('https://table-de-marque-72e86.web.app/assets/logos/dammarie.png');
    });

    it("reprend le PNG d'après le nom quand aucune adresse n'est enregistrée", () => {
      expect(resoudreLogoEquipe(null, 'Dammarie/Cergy')).toBe(
        'https://table-de-marque-72e86.web.app/assets/logos/dammarie-cergy.png',
      );
    });

    it('renvoie null sans TEAM_LOGO_BASE_URL', () => {
      delete process.env.TEAM_LOGO_BASE_URL;
      expect(resoudreLogoEquipe('blob:x', 'Dammarie')).toBeNull();
    });
  });
});
