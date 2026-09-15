import {
  normalizeDriveUrl,
  extractDriveFileId,
} from '@/infrastructure/persistence/google-sheets/drive-url.util';

describe('normalizeDriveUrl', () => {
  it('converts a Drive share link into a displayable thumbnail URL', () => {
    const shareUrl = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing';

    const result = normalizeDriveUrl(shareUrl);

    expect(result).toBe(
      'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOp&sz=w600',
    );
  });

  it('honours a custom size parameter', () => {
    const shareUrl = 'https://drive.google.com/file/d/abc123/view';

    const result = normalizeDriveUrl(shareUrl, 1200);

    expect(result).toBe('https://drive.google.com/thumbnail?id=abc123&sz=w1200');
  });

  it('returns the original URL unchanged when it does not match the Drive share pattern', () => {
    const otherUrl = 'https://example.com/logo.png';

    expect(normalizeDriveUrl(otherUrl)).toBe(otherUrl);
  });

  it('returns the original URL unchanged for an empty string', () => {
    expect(normalizeDriveUrl('')).toBe('');
  });
});

describe('extractDriveFileId', () => {
  it('extracts the id from a Drive share link', () => {
    expect(
      extractDriveFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing'),
    ).toBe('1AbCdEfGhIjKlMnOp');
  });

  it('extracts the id from an already-converted thumbnail link (id as the first query param)', () => {
    expect(
      extractDriveFileId('https://drive.google.com/thumbnail?id=abc123&sz=w600'),
    ).toBe('abc123');
  });

  it('extracts the id from a thumbnail link where id is not the first query param', () => {
    expect(
      extractDriveFileId('https://drive.google.com/thumbnail?sz=w600&id=abc123'),
    ).toBe('abc123');
  });

  it('returns null for a URL hosted outside Google Drive', () => {
    expect(extractDriveFileId('https://example.com/logo.png')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractDriveFileId('')).toBeNull();
  });
});
