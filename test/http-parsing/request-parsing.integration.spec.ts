import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Post,
  Query,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

// Retrait des SDK Firebase, risque 4 de la spec
// `body-parser` et `qs` sont forcés par override : tout corps et toute query string en dépendent.

@Controller('analyse')
class AnalyseController {
  @Get()
  query(@Query() query: unknown) {
    return { query };
  }

  @Post()
  corps(@Body() corps: unknown) {
    return { corps };
  }
}

describe('Analyse des requêtes HTTP', () => {
  let app: INestApplication;

  const envoyerJson = (corps: unknown) =>
    request(app.getHttpServer())
      .post('/analyse')
      .send(corps as object);
  const lire = (url: string) => request(app.getHttpServer()).get(url);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AnalyseController],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('query string', () => {
    it('lit les filtres utilisés par les routes publiques', async () => {
      const res = await lire('/analyse?competition=3v3&surface=PG&jour=J1');

      expect(res.body.query).toEqual({
        competition: '3v3',
        surface: 'PG',
        jour: 'J1',
      });
    });

    it('décode les caractères encodés', async () => {
      const res = await lire('/analyse?equipe=Saint%20%C3%89tienne%26Co');

      expect(res.body.query).toEqual({ equipe: 'Saint Étienne&Co' });
    });

    it('accepte une valeur vide et un paramètre répété', async () => {
      const res = await lire('/analyse?teamId=&phase=a&phase=b');

      expect(res.body.query).toEqual({ teamId: '', phase: ['a', 'b'] });
    });
  });

  describe('corps JSON', () => {
    it('lit un objet imbriqué et les accents', async () => {
      const corps = { joueurId: 'é1', metrics: { temps: 12.5, ok: true } };

      expect((await envoyerJson(corps)).body.corps).toEqual(corps);
    });

    it('lit un tableau à la racine', async () => {
      expect((await envoyerJson([1, 2])).body.corps).toEqual([1, 2]);
    });

    it('refuse un JSON mal formé par un 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/analyse')
        .set('Content-Type', 'application/json')
        .send('{"joueurId":');

      expect(res.status).toBe(400);
    });

    it('refuse un corps au-delà de la limite par un 413', async () => {
      const res = await envoyerJson({ texte: 'x'.repeat(200 * 1024) });

      expect(res.status).toBe(413);
    });

    it('n’analyse pas un corps d’un autre type comme du JSON', async () => {
      const res = await request(app.getHttpServer())
        .post('/analyse')
        .set('Content-Type', 'text/plain')
        .send('{"a":1}');

      expect(res.body.corps ?? {}).toEqual({});
    });
  });

  describe('corps de formulaire', () => {
    const envoyerFormulaire = (corps: string) =>
      request(app.getHttpServer())
        .post('/analyse')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(corps);

    it('lit les champs simples et encodés', async () => {
      const res = await envoyerFormulaire('nom=Saint+%C3%89tienne&age=11');

      expect(res.body.corps).toEqual({ nom: 'Saint Étienne', age: '11' });
    });

    it('lit la notation imbriquée, servie par qs', async () => {
      const res = await envoyerFormulaire(
        'equipe[nom]=Rennes&liste[]=a&liste[]=b',
      );

      expect(res.body.corps).toEqual({
        equipe: { nom: 'Rennes' },
        liste: ['a', 'b'],
      });
    });

    it('ne laisse pas polluer le prototype', async () => {
      await envoyerFormulaire('__proto__[pollue]=oui');

      expect(({} as Record<string, unknown>).pollue).toBeUndefined();
    });
  });
});
