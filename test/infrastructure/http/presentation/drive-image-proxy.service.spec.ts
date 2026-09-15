import { DriveImageProxyService } from '@/infrastructure/http/presentation/drive-image-proxy.service';

function imageResponse(bytes: Uint8Array = new Uint8Array([1, 2, 3])): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'image/jpeg' },
    arrayBuffer: async () => bytes.buffer,
  } as unknown as Response;
}

function errorResponse(status: number, contentType = 'text/html'): Response {
  return {
    ok: false,
    status,
    headers: { get: () => contentType },
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as Response;
}

describe('DriveImageProxyService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('fetches the Drive thumbnail URL server-side and returns the image bytes + content type', async () => {
    const fetchMock = jest.fn().mockResolvedValue(imageResponse());
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new DriveImageProxyService();

    const result = await service.fetch('FILE_ID', 1600);

    expect(result).not.toBeNull();
    expect(result?.contentType).toBe('image/jpeg');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://drive.google.com/thumbnail?id=FILE_ID&sz=w1600',
      { redirect: 'follow' },
    );
  });

  it('caches a successful fetch: a second call for the same file+width does not hit Drive again', async () => {
    const fetchMock = jest.fn().mockResolvedValue(imageResponse());
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new DriveImageProxyService();

    await service.fetch('FILE_ID', 1600);
    await service.fetch('FILE_ID', 1600);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a different width as a different cache entry', async () => {
    const fetchMock = jest.fn().mockResolvedValue(imageResponse());
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new DriveImageProxyService();

    await service.fetch('FILE_ID', 600);
    await service.fetch('FILE_ID', 1600);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('de-duplicates concurrent requests for the same file+width into a single upstream fetch', async () => {
    let resolveFetch!: (r: Response) => void;
    const fetchMock = jest.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new DriveImageProxyService();

    const p1 = service.fetch('FILE_ID', 1600);
    const p2 = service.fetch('FILE_ID', 1600);
    resolveFetch(imageResponse());
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1).toEqual(r2);
  });

  it('returns null (does not throw) when Drive responds with a non-image body, e.g. a 429 error page', async () => {
    const fetchMock = jest.fn().mockResolvedValue(errorResponse(429));
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new DriveImageProxyService();

    const result = await service.fetch('FILE_ID', 1600);

    expect(result).toBeNull();
  });

  it('returns null (does not throw) when the fetch itself rejects (network error)', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new DriveImageProxyService();

    const result = await service.fetch('FILE_ID', 1600);

    expect(result).toBeNull();
  });

  it('does not retry Drive again immediately after a failure (short negative cache)', async () => {
    const fetchMock = jest.fn().mockResolvedValue(errorResponse(429));
    global.fetch = fetchMock as unknown as typeof fetch;
    const service = new DriveImageProxyService();

    await service.fetch('FILE_ID', 1600);
    await service.fetch('FILE_ID', 1600);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
