import { resolveGroupeMeta } from '@/application/presentation/use-cases/resolve-groupe-meta.util';
import { PresentationArticleRecord } from '@/domain/presentation/repositories/presentation-article.repository';

const makeRecord = (
  groupe: string,
  groupeOrdre: number,
  groupeDureeMs: number,
  groupeImageUrl: string | null,
) =>
  new PresentationArticleRecord(
    1,
    groupe,
    groupe,
    'Titre',
    'Titre',
    'desc',
    'desc',
    null,
    null,
    null,
    null,
    0,
    groupeOrdre,
    groupeDureeMs,
    groupeImageUrl,
  );

describe('resolveGroupeMeta', () => {
  it('inherits the meta of an already-existing group instead of resetting it to defaults', () => {
    const existing = [makeRecord('Présentation', 2, 8000, 'https://x/img.png')];

    const meta = resolveGroupeMeta(existing, 'Présentation');

    expect(meta).toEqual({
      groupeOrdre: 2,
      groupeDureeMs: 8000,
      groupeImageUrl: 'https://x/img.png',
    });
  });

  it('computes defaults for a brand new group: next groupeOrdre, 5000ms, no image', () => {
    const existing = [makeRecord('Présentation', 0, 5000, null), makeRecord('Règlement', 1, 6000, null)];

    const meta = resolveGroupeMeta(existing, 'Médias');

    expect(meta).toEqual({
      groupeOrdre: 2,
      groupeDureeMs: 5000,
      groupeImageUrl: null,
    });
  });

  it('starts groupeOrdre at 0 for the very first group when the article list is empty', () => {
    const meta = resolveGroupeMeta([], 'Présentation');

    expect(meta).toEqual({
      groupeOrdre: 0,
      groupeDureeMs: 5000,
      groupeImageUrl: null,
    });
  });
});
