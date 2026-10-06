export interface IcloudPhoto {
  photoGuid: string;
  caption: string;
  dateCreated: string | null;
  mediaAssetType?: 'video';
  thumbUrl: string | null;
  fullUrl: string | null;
}

interface RawDerivative {
  checksum: string;
}

interface RawPhoto {
  photoGuid: string;
  caption?: string;
  dateCreated?: string | null;
  mediaAssetType?: 'video';
  derivatives?: Record<string, RawDerivative>;
}

interface PostJsonResponse {
  status: number;
  json: any;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function postJson(url: string, body: unknown, fetchImpl: typeof fetch): Promise<PostJsonResponse> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    json: await response.json(),
  };
}

function buildAssetUrl(asset: { url_location?: string; url_path?: string } | undefined): string | null {
  if (!asset?.url_location || !asset.url_path) {
    return null;
  }

  return `https://${asset.url_location}${asset.url_path}`;
}

const BASE_62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function base62ToInt(value: string): number {
  let result = 0;
  for (const char of value) {
    result = result * 62 + BASE_62_CHARS.indexOf(char);
  }
  return result;
}

// iCloud shared-album tokens encode which `pNN-sharedstreams.icloud.com` partition
// serves them: the digit right after the leading letter (2 chars, or 1 if it's "A").
function partitionHostFromToken(token: string): string {
  const digits = token[0] === 'A' ? token.substring(1, 2) : token.substring(1, 3);
  const partition = base62ToInt(digits);
  const padded = partition < 10 ? `0${partition}` : `${partition}`;
  return `p${padded}-sharedstreams.icloud.com`;
}

export async function fetchSharedAlbum(
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<IcloudPhoto[]> {
  let host = partitionHostFromToken(token);

  try {
    let streamResponse = await postJson(`https://${host}/${token}/sharedstreams/webstream`, { streamCtag: null }, fetchImpl);

    if (streamResponse.status === 330) {
      const redirectedHost = streamResponse.json?.['X-Apple-MMe-Host'];
      if (typeof redirectedHost !== 'string' || redirectedHost.length === 0) {
        throw new Error('icloud_album_unreachable');
      }

      host = redirectedHost;
      streamResponse = await postJson(`https://${host}/${token}/sharedstreams/webstream`, { streamCtag: null }, fetchImpl);
    }

    if (streamResponse.status !== 200) {
      throw new Error('icloud_album_unreachable');
    }

    const rawPhotos: RawPhoto[] = Array.isArray(streamResponse.json?.photos) ? streamResponse.json.photos : [];
    const photoGuidBatches = chunk(
      rawPhotos.map((photo) => photo.photoGuid),
      25
    );
    const urlByChecksum: Record<string, string> = {};

    for (const photoGuids of photoGuidBatches) {
      if (photoGuids.length === 0) {
        continue;
      }

      const assetResponse = await postJson(
        `https://${host}/${token}/sharedstreams/webasseturls`,
        { photoGuids },
        fetchImpl
      );

      if (assetResponse.status !== 200) {
        throw new Error('icloud_album_unreachable');
      }

      const items = assetResponse.json?.items ?? {};
      for (const [checksum, asset] of Object.entries(items) as Array<[string, { url_location?: string; url_path?: string }]>) {
        const assetUrl = buildAssetUrl(asset);
        if (assetUrl) {
          urlByChecksum[checksum] = assetUrl;
        }
      }
    }

    return rawPhotos.map((photo) => {
      const derivatives = Object.values(photo.derivatives ?? {});
      const firstUrl = derivatives
        .map((derivative) => urlByChecksum[derivative.checksum] ?? null)
        .find((value): value is string => value !== null) ?? null;

      return {
        photoGuid: photo.photoGuid,
        caption: photo.caption ?? '',
        dateCreated: photo.dateCreated ?? null,
        mediaAssetType: photo.mediaAssetType,
        thumbUrl: firstUrl,
        fullUrl: firstUrl,
      };
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('icloud_')) {
      throw error;
    }

    throw new Error('icloud_album_unreachable');
  }
}
