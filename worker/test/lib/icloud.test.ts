import { describe, expect, it, vi } from 'vitest';
import { fetchSharedAlbum } from '../../src/lib/icloud';

function mockFetchSequence(responses: Array<{ status: number; body: any }>) {
  let call = 0;

  return vi.fn(async () => {
    const response = responses[Math.min(call, responses.length - 1)];
    call += 1;

    return {
      status: response.status,
      json: async () => response.body,
    } as any;
  });
}

describe('fetchSharedAlbum', () => {
  it('parses photos from a direct non-redirected webstream response', async () => {
    const fetchImpl = mockFetchSequence([
      {
        status: 200,
        body: {
          photos: [
            {
              photoGuid: 'guid-1',
              caption: 'Sunset',
              dateCreated: '2024-07-12T18:00:00Z',
              derivatives: { '720': { checksum: 'abc' } },
            },
          ],
        },
      },
      {
        status: 200,
        body: { items: { abc: { url_location: 'cdn.example.com', url_path: '/abc.jpg' } } },
      },
    ]);

    await expect(fetchSharedAlbum('TOKEN1', fetchImpl)).resolves.toEqual([
      {
        photoGuid: 'guid-1',
        caption: 'Sunset',
        dateCreated: '2024-07-12T18:00:00Z',
        mediaAssetType: undefined,
        thumbUrl: 'https://cdn.example.com/abc.jpg',
        fullUrl: 'https://cdn.example.com/abc.jpg',
      },
    ]);
  });

  it('follows a 330 redirect to the host given in the response body', async () => {
    const fetchImpl = mockFetchSequence([
      { status: 330, body: { 'X-Apple-MMe-Host': 'p95-sharedstreams.icloud.com' } },
      { status: 200, body: { photos: [] } },
    ]);

    await expect(fetchSharedAlbum('TOKEN2', fetchImpl)).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toContain('p95-sharedstreams.icloud.com');
  });

  it('marks video items and tolerates photos with no derivatives', async () => {
    const fetchImpl = mockFetchSequence([
      {
        status: 200,
        body: {
          photos: [
            { photoGuid: 'guid-video', caption: '', dateCreated: null, mediaAssetType: 'video', derivatives: {} },
            { photoGuid: 'guid-empty', caption: '', dateCreated: null, derivatives: {} },
          ],
        },
      },
      { status: 200, body: { items: {} } },
    ]);

    const photos = await fetchSharedAlbum('TOKEN3', fetchImpl);

    expect(photos[0]).toMatchObject({
      photoGuid: 'guid-video',
      mediaAssetType: 'video',
      thumbUrl: null,
      fullUrl: null,
    });
    expect(photos[1]).toMatchObject({
      photoGuid: 'guid-empty',
      thumbUrl: null,
      fullUrl: null,
    });
  });

  it('throws a clear error for an invalid or unreachable album token', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network error');
    });

    await expect(fetchSharedAlbum('BADTOKEN', fetchImpl)).rejects.toThrow('icloud_album_unreachable');
  });
});
