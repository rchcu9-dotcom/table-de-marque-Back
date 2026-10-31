import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { google } from 'googleapis';

// Retrait des SDK Firebase, critère 13 de la spec
// Vraie pile googleapis > gaxios > qs, dont `qs` est forcé par override, contre un faux serveur
// local. Ne remplace pas la vérification sur staging : ni Google ni l'authentification ne sont joués.
// `fetch` natif : Jest refuse l'import() dynamique par lequel gaxios charge node-fetch.

describe('Transport googleapis avec les versions forcées', () => {
  let serveur: Server;
  let racine: string;
  const requetes: { methode?: string; url: string; corps: string }[] = [];
  let statut = 200;

  const sheets = () =>
    google.sheets({
      version: 'v4',
      auth: 'cle-de-test',
      rootUrl: racine,
      fetchImplementation: fetch,
    });

  beforeAll(async () => {
    serveur = createServer((req, res) => {
      let corps = '';
      req.on('data', (morceau: Buffer) => (corps += morceau.toString()));
      req.on('end', () => {
        requetes.push({ methode: req.method, url: req.url ?? '', corps });
        res.writeHead(statut, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ values: [['A1', 'é']] }));
      });
    });
    await new Promise<void>((pret) => serveur.listen(0, '127.0.0.1', pret));
    racine = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}/`;
  });

  afterAll(async () => {
    await new Promise((fin) => serveur.close(fin));
  });

  beforeEach(() => {
    requetes.length = 0;
    statut = 200;
  });

  it('lit une plage et décode la réponse JSON', async () => {
    const { data } = await sheets().spreadsheets.values.get({
      spreadsheetId: 'feuille',
      range: 'Matchs!B2:L32',
    });

    expect(data.values).toEqual([['A1', 'é']]);
    expect(requetes[0].methode).toBe('GET');
  });

  it('sérialise les paramètres de requête, clé d’API comprise', async () => {
    await sheets().spreadsheets.values.get({
      spreadsheetId: 'feuille',
      range: 'Matchs!B2:L32',
      majorDimension: 'ROWS',
    });

    const url = new URL(requetes[0].url, racine);
    expect(decodeURIComponent(url.pathname)).toBe(
      '/v4/spreadsheets/feuille/values/Matchs!B2:L32',
    );
    expect(url.searchParams.get('majorDimension')).toBe('ROWS');
    expect(url.searchParams.get('key')).toBe('cle-de-test');
  });

  it('répète un paramètre tableau, sans crochets ni virgule', async () => {
    await sheets().spreadsheets.values.batchGet({
      spreadsheetId: 'feuille',
      ranges: ['Matchs!A1', 'Équipes!B2'],
    });

    const url = new URL(requetes[0].url, racine);
    expect(url.searchParams.getAll('ranges')).toEqual([
      'Matchs!A1',
      'Équipes!B2',
    ]);
    expect(requetes[0].url).not.toContain('%5B');
  });

  it('envoie le corps d’une écriture en JSON', async () => {
    await sheets().spreadsheets.values.append({
      spreadsheetId: 'feuille',
      range: 'Matchs!B2:L32',
      valueInputOption: 'RAW',
      requestBody: { values: [['Rennes', 'Rouen']] },
    });

    expect(requetes[0].methode).toBe('POST');
    expect(JSON.parse(requetes[0].corps)).toEqual({
      values: [['Rennes', 'Rouen']],
    });
    expect(
      new URL(requetes[0].url, racine).searchParams.get('valueInputOption'),
    ).toBe('RAW');
  });

  it('remonte une erreur de l’API', async () => {
    statut = 403;

    await expect(
      sheets().spreadsheets.values.get({
        spreadsheetId: 'feuille',
        range: 'Matchs!B2:L32',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
