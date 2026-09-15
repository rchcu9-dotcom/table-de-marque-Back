import { MySqlPresentationRepository } from '@/infrastructure/persistence/mysql/mysql-presentation.repository';
import { MySqlPresentationArticleRepository } from '@/infrastructure/persistence/mysql/mysql-presentation-article.repository';
import { PresentationArticleRecord } from '@/domain/presentation/repositories/presentation-article.repository';

const record = (overrides: Partial<{
  id: number;
  groupe: string;
  groupeEn: string;
  titre: string;
  titreEn: string;
  description: string;
  descriptionEn: string;
  imageUrl: string | null;
  lienUrl: string | null;
  lieu: string | null;
  mapsQuery: string | null;
  ordre: number;
  groupeOrdre: number;
  groupeDureeMs: number;
  groupeImageUrl: string | null;
  titreAccroche: string;
  titreAccrocheEn: string;
  descriptionCourte: string;
  descriptionCourteEn: string;
}> = {}) =>
  new PresentationArticleRecord(
    overrides.id ?? 1,
    overrides.groupe ?? 'Présentation',
    overrides.groupeEn ?? 'Presentation',
    overrides.titre ?? 'Résumé',
    overrides.titreEn ?? 'Summary',
    overrides.description ?? 'desc',
    overrides.descriptionEn ?? 'desc en',
    overrides.imageUrl ?? null,
    overrides.lienUrl ?? null,
    overrides.lieu ?? null,
    overrides.mapsQuery ?? null,
    overrides.ordre ?? 0,
    overrides.groupeOrdre ?? 0,
    overrides.groupeDureeMs ?? 5000,
    overrides.groupeImageUrl ?? null,
    '',
    '',
    '',
    '',
    overrides.titreAccroche ?? '',
    overrides.titreAccrocheEn ?? '',
    overrides.descriptionCourte ?? '',
    overrides.descriptionCourteEn ?? '',
  );

function buildRepo(findAllOrdered: jest.Mock) {
  const articles = { findAllOrdered } as unknown as MySqlPresentationArticleRepository;
  return new MySqlPresentationRepository(articles);
}

describe('MySqlPresentationRepository.findAll', () => {
  it('sorts groups by groupeOrdre rather than order of appearance in the row list', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([
      record({ id: 1, groupe: 'Règlement', groupeOrdre: 1 }),
      record({ id: 2, groupe: 'Présentation', groupeOrdre: 0 }),
    ]);
    const repo = buildRepo(findAllOrdered);

    const groupes = await repo.findAll();

    expect(groupes.map((g) => g.nom)).toEqual(['Présentation', 'Règlement']);
  });

  it('propagates groupeDureeMs onto the group entity', async () => {
    const findAllOrdered = jest
      .fn()
      .mockResolvedValue([record({ groupe: 'Présentation', groupeDureeMs: 9000 })]);
    const repo = buildRepo(findAllOrdered);

    const [groupe] = await repo.findAll();

    expect(groupe.dureeMs).toBe(9000);
  });

  it('uses groupeImageUrl as the chapter background when present', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([
      record({ groupe: 'Présentation', groupeImageUrl: 'https://x/group.png', imageUrl: 'https://x/article.png' }),
    ]);
    const repo = buildRepo(findAllOrdered);

    const [groupe] = await repo.findAll();

    expect(groupe.imageUrl).toBe('https://x/group.png');
  });

  it('falls back to the first article image when groupeImageUrl is absent', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([
      record({ id: 1, groupe: 'Présentation', groupeImageUrl: null, imageUrl: 'https://x/article.png' }),
      record({ id: 2, groupe: 'Présentation', groupeImageUrl: null, imageUrl: null }),
    ]);
    const repo = buildRepo(findAllOrdered);

    const [groupe] = await repo.findAll();

    expect(groupe.imageUrl).toBe('https://x/article.png');
  });

  it('resolves to null when neither groupeImageUrl nor any article image is set', async () => {
    const findAllOrdered = jest
      .fn()
      .mockResolvedValue([record({ groupe: 'Présentation', groupeImageUrl: null, imageUrl: null })]);
    const repo = buildRepo(findAllOrdered);

    const [groupe] = await repo.findAll();

    expect(groupe.imageUrl).toBeNull();
  });

  it('groups articles sharing the same groupe under a single PresentationGroupe', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([
      record({ id: 1, groupe: 'Présentation', titre: 'Résumé' }),
      record({ id: 2, groupe: 'Présentation', titre: 'Inscription' }),
    ]);
    const repo = buildRepo(findAllOrdered);

    const groupes = await repo.findAll();

    expect(groupes).toHaveLength(1);
    expect(groupes[0].articles.map((a) => a.titre)).toEqual(['Résumé', 'Inscription']);
  });

  it('returns an empty array when there are no articles', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([]);
    const repo = buildRepo(findAllOrdered);

    expect(await repo.findAll()).toEqual([]);
  });

  // Les images sont saisies en admin comme de simples URL Drive (lien de partage ou déjà
  // en format thumbnail) : le navigateur ne peut pas les charger en direct (ERR_BLOCKED_BY_ORB,
  // cf. DriveImageProxyService), donc on renvoie toujours notre propre relais plutôt que l'URL
  // Drive elle-même, quel que soit le format d'entrée.
  it('turns a Google Drive share link into our own image-proxy path, on the article and on the group', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([
      record({
        imageUrl: 'https://drive.google.com/file/d/ARTICLE_ID/view?usp=sharing',
        groupeImageUrl: 'https://drive.google.com/file/d/GROUPE_ID/view?usp=sharing',
      }),
    ]);
    const repo = buildRepo(findAllOrdered);

    const [groupe] = await repo.findAll();

    expect(groupe.imageUrl).toBe('/presentation/image/GROUPE_ID?w=1600');
    expect(groupe.articles[0].imageUrl).toBe('/presentation/image/ARTICLE_ID?w=1600');
  });

  it('also proxies an already-converted thumbnail-format Drive URL (existing rows are stored this way)', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([
      record({ imageUrl: 'https://drive.google.com/thumbnail?id=ARTICLE_ID&sz=w600' }),
    ]);
    const repo = buildRepo(findAllOrdered);

    const [groupe] = await repo.findAll();

    expect(groupe.articles[0].imageUrl).toBe('/presentation/image/ARTICLE_ID?w=1600');
  });

  it('leaves a plain, non-Drive image URL untouched', async () => {
    const findAllOrdered = jest
      .fn()
      .mockResolvedValue([record({ imageUrl: 'https://cdn.example.com/glace.jpg' })]);
    const repo = buildRepo(findAllOrdered);

    const [groupe] = await repo.findAll();

    expect(groupe.articles[0].imageUrl).toBe('https://cdn.example.com/glace.jpg');
  });

  it('forwards titreAccroche/descriptionCourte onto the public article', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([
      record({
        titreAccroche: 'Le tournoi arrive.',
        titreAccrocheEn: 'The tournament is here.',
        descriptionCourte: 'Deux jours de glace.',
        descriptionCourteEn: 'Two days on ice.',
      }),
    ]);
    const repo = buildRepo(findAllOrdered);

    const [groupe] = await repo.findAll();

    expect(groupe.articles[0].titreAccroche).toBe('Le tournoi arrive.');
    expect(groupe.articles[0].titreAccrocheEn).toBe('The tournament is here.');
    expect(groupe.articles[0].descriptionCourte).toBe('Deux jours de glace.');
    expect(groupe.articles[0].descriptionCourteEn).toBe('Two days on ice.');
  });

  it('falls back the EN titreAccroche/descriptionCourte to their FR value when blank', async () => {
    const findAllOrdered = jest.fn().mockResolvedValue([
      record({
        titreAccroche: 'Le tournoi arrive.',
        titreAccrocheEn: '',
        descriptionCourte: 'Deux jours de glace.',
        descriptionCourteEn: '',
      }),
    ]);
    const repo = buildRepo(findAllOrdered);

    const [groupe] = await repo.findAll();

    expect(groupe.articles[0].titreAccrocheEn).toBe('Le tournoi arrive.');
    expect(groupe.articles[0].descriptionCourteEn).toBe('Deux jours de glace.');
  });
});
