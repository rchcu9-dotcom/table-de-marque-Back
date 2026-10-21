import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PRESENTATION_IMAGE_URL_MAX_LENGTH,
  UpdatePresentationGroupeDto,
} from '@/application/presentation/dto/update-presentation-groupe.dto';

/**
 * Contrôle de l'URL d'image de chapitre au niveau où NestJS l'applique réellement
 * (ValidationPipe global → class-validator) : c'est ce qui transforme une URL trop
 * longue pour la colonne VARCHAR(500) en 400 au lieu d'une 500 Prisma.
 */
async function imageUrlErrors(imageUrl: unknown): Promise<string[]> {
  const dto = plainToInstance(UpdatePresentationGroupeDto, { imageUrl });
  const errors = await validate(dto);
  return errors
    .filter((e) => e.property === 'imageUrl')
    .flatMap((e) => Object.values(e.constraints ?? {}));
}

const urlOfLength = (length: number) => {
  const prefix = 'https://cdn.example.com/';
  return prefix + 'a'.repeat(length - prefix.length);
};

describe('UpdatePresentationGroupeDto.imageUrl', () => {
  it('aligns the max length on the groupe_image_url column (VARCHAR(500))', () => {
    expect(PRESENTATION_IMAGE_URL_MAX_LENGTH).toBe(500);
  });

  it.each([
    ['null (champ vidé : retire l image)', null],
    ['absent', undefined],
    ['https', 'https://cdn.example.com/glace.jpg'],
    ['http', 'http://www.leblizz.com/photo.png'],
    ['schéma en majuscules', 'HTTPS://CDN.EXAMPLE.COM/A.JPG'],
    ['Http mixte (saisie réelle en base)', 'Http://www.leblizz.com'],
    ['lien de partage Drive', 'https://drive.google.com/file/d/1fBgBRaLnMiagMthr6ibghOFLeyf03ZUa/view?usp=sharing'],
    ['vignette Drive', 'https://drive.google.com/thumbnail?id=ABC123&sz=w600'],
    ['exactement 500 caractères', urlOfLength(500)],
  ])('accepts %s', async (_label, imageUrl) => {
    expect(await imageUrlErrors(imageUrl)).toEqual([]);
  });

  it('rejects an URL longer than 500 characters with the French length message', async () => {
    const errors = await imageUrlErrors(urlOfLength(501));
    expect(errors).toContain("L'URL de l'image ne doit pas dépasser 500 caractères.");
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:image/png;base64,iVBORw0KGgo='],
    ['ftp:', 'ftp://example.com/a.jpg'],
    ['chemin relatif', '/presentation/image/abc'],
    ['URL sans schéma', 'www.leblizz.com'],
    ['chaîne vide', ''],
    ['espace dans l URL', 'https://cdn.example.com/ma photo.jpg'],
    ['schéma seul', 'https://'],
  ])('rejects %s with the French scheme message', async (_label, imageUrl) => {
    const errors = await imageUrlErrors(imageUrl);
    expect(errors).toContain("L'URL de l'image doit commencer par http:// ou https://.");
  });

  it('rejects a non-string value', async () => {
    expect(await imageUrlErrors(42)).not.toEqual([]);
  });

  it('keeps validating the other fields as before', async () => {
    const dto = plainToInstance(UpdatePresentationGroupeDto, {
      nom: 'Règlement',
      nomEn: 'Rules',
      dureeMs: 5000,
      imageUrl: 'https://cdn.example.com/a.jpg',
    });
    expect(await validate(dto)).toEqual([]);

    const invalid = plainToInstance(UpdatePresentationGroupeDto, { nom: '', dureeMs: -1 });
    const props = (await validate(invalid)).map((e) => e.property).sort();
    expect(props).toEqual(['dureeMs', 'nom']);
  });
});
