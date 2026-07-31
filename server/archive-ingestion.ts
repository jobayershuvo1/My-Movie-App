import crypto from 'crypto';
import { db } from './sqlite.js';

type ArchiveDocument = {
  identifier?: string;
  title?: string | string[];
  description?: string | string[];
  date?: string;
  year?: string | number;
  language?: string | string[];
  licenseurl?: string | string[];
};

type ArchiveFile = {
  name?: string;
  format?: string;
  size?: string;
  source?: string;
  height?: string;
};

type CommonsMetadataValue = { value?: string };
type CommonsImageInfo = {
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  extmetadata?: Record<string, CommonsMetadataValue>;
};
type CommonsPage = {
  pageid?: number;
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

type ImportResult = {
  imported: Array<{ movieId: string; title: string; downloadUrl: string }>;
  skipped: Array<{ identifier: string; reason: string }>;
};

const ARCHIVE_ORIGIN = 'https://archive.org';
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function firstString(value: unknown): string {
  if (Array.isArray(value)) return firstString(value[0]);
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function stripHtml(value: unknown): string {
  return firstString(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

export function isAllowedArchiveLicense(value: unknown): boolean {
  const raw = firstString(value);
  if (!raw) return false;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const urlPath = url.pathname.toLowerCase();
    return (host === 'creativecommons.org' || host === 'www.creativecommons.org')
      && (urlPath.startsWith('/licenses/') || urlPath.startsWith('/publicdomain/'));
  } catch {
    return false;
  }
}

function archiveDownloadUrl(identifier: string, filename: string): string {
  const encodedName = filename.split('/').map(encodeURIComponent).join('/');
  return `${ARCHIVE_ORIGIN}/download/${encodeURIComponent(identifier)}/${encodedName}`;
}

function formatBytes(raw: string | undefined): string | null {
  const bytes = Number(raw);
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** unit)).toFixed(unit > 2 ? 1 : 0)} ${units[unit]}`;
}

function chooseMp4(files: ArchiveFile[]): ArchiveFile | null {
  const candidates = files.filter((file) => {
    const name = firstString(file.name).toLowerCase();
    const format = firstString(file.format).toLowerCase();
    return name.endsWith('.mp4') && (format.includes('mpeg4') || format.includes('h.264') || format.includes('mp4'));
  });
  candidates.sort((a, b) => {
    const originalDelta = Number(firstString(b.source) === 'original') - Number(firstString(a.source) === 'original');
    return originalDelta || Number(b.size || 0) - Number(a.size || 0);
  });
  return candidates[0] || null;
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CineVault licensed-media-ingester/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Archive request failed (${response.status})`);
  return response.json();
}

async function verifyDownload(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-0', 'User-Agent': 'CineVault link-checker/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
    });
    const ok = response.ok || response.status === 206;
    await response.body?.cancel();
    return ok;
  } catch {
    return false;
  }
}

function saveMovie(doc: ArchiveDocument, file: ArchiveFile, downloadUrl: string) {
  const identifier = firstString(doc.identifier);
  const title = firstString(doc.title) || identifier;
  const timestamp = now();
  const movieId = uuid();
  const year = Number.parseInt(firstString(doc.year) || firstString(doc.date).slice(0, 4), 10);
  const language = firstString(doc.language) || 'Unknown';
  const height = Number.parseInt(firstString(file.height), 10);
  const quality = Number.isFinite(height) && height > 0 ? `${height}p` : 'MP4';
  const license = firstString(doc.licenseurl);

  db.transaction(() => {
    db.prepare(`INSERT INTO movies (
      id, title, description, poster_url, cover_url, trailer_url, release_year,
      imdb_rating, runtime, language, country, download_enabled, featured,
      trending, published, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?, NULL, 1, 0, 0, 1, ?, ?)`)
      .run(
        movieId,
        title,
        stripHtml(doc.description) || `Licensed movie imported from Internet Archive (${identifier}).`,
        `${ARCHIVE_ORIGIN}/services/img/${encodeURIComponent(identifier)}`,
        `${ARCHIVE_ORIGIN}/services/img/${encodeURIComponent(identifier)}`,
        Number.isFinite(year) ? year : null,
        language,
        timestamp,
        timestamp,
      );

    db.prepare(`INSERT INTO download_links (
      id, movie_id, server_name, url, quality, file_size, status, clicks, created_at
    ) VALUES (?, ?, 'Internet Archive', ?, ?, ?, 'active', 0, ?)`)
      .run(uuid(), movieId, downloadUrl, quality, formatBytes(file.size), timestamp);

    db.prepare(`INSERT INTO activity_logs (
      id, user_id, action, details, ip_address, metadata, created_at
    ) VALUES (?, NULL, 'movie_created', ?, NULL, ?, ?)`)
      .run(uuid(), `Auto-imported licensed movie: ${title}`, JSON.stringify({ source: 'internet_archive', identifier, license }), timestamp);
  })();

  return { movieId, title, downloadUrl };
}

function commonsMetadata(info: CommonsImageInfo, key: string): string {
  return firstString(info.extmetadata?.[key]?.value);
}

function isAllowedCommonsLicense(info: CommonsImageInfo): boolean {
  const licenseUrl = commonsMetadata(info, 'LicenseUrl');
  const licenseName = commonsMetadata(info, 'LicenseShortName').toLowerCase();
  const copyrighted = commonsMetadata(info, 'Copyrighted').toLowerCase();
  return isAllowedArchiveLicense(licenseUrl)
    || (licenseName === 'public domain' && copyrighted === 'false');
}

function saveCommonsMovie(page: CommonsPage, info: CommonsImageInfo) {
  const downloadUrl = firstString(info.url);
  const sourceUrl = firstString(info.descriptionurl);
  const title = (commonsMetadata(info, 'ObjectName') || firstString(page.title))
    .replace(/^File:/i, '')
    .replace(/\.(webm|ogv|ogg)$/i, '')
    .trim();
  const timestamp = now();
  const movieId = uuid();
  const date = commonsMetadata(info, 'DateTimeOriginal') || commonsMetadata(info, 'DateTime');
  const yearMatch = date.match(/(?:18|19|20)\d{2}/);
  const license = commonsMetadata(info, 'LicenseShortName') || commonsMetadata(info, 'UsageTerms');
  const description = stripHtml(commonsMetadata(info, 'ImageDescription'));
  const attribution = [
    license ? `License: ${license}.` : '',
    sourceUrl ? `Source and attribution: ${sourceUrl}` : '',
  ].filter(Boolean).join(' ');
  const height = Number(info.height);
  const quality = Number.isFinite(height) && height > 0 ? `${height}p` : 'Video';
  const posterUrl = firstString(info.thumburl) || sourceUrl;

  db.transaction(() => {
    db.prepare(`INSERT INTO movies (
      id, title, description, poster_url, cover_url, trailer_url, release_year,
      imdb_rating, runtime, language, country, download_enabled, featured,
      trending, published, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, ?, NULL, NULL, 1, 0, 0, 1, ?, ?)`)
      .run(
        movieId,
        title,
        `${description || 'Licensed film imported from Wikimedia Commons.'} ${attribution}`.trim(),
        posterUrl,
        posterUrl,
        yearMatch ? Number(yearMatch[0]) : null,
        Number.isFinite(Number(info.duration)) ? Math.round(Number(info.duration) / 60) : null,
        timestamp,
        timestamp,
      );

    db.prepare(`INSERT INTO download_links (
      id, movie_id, server_name, url, quality, file_size, status, clicks, created_at
    ) VALUES (?, ?, 'Wikimedia Commons', ?, ?, ?, 'active', 0, ?)`)
      .run(uuid(), movieId, downloadUrl, quality, formatBytes(String(info.size || '')), timestamp);

    db.prepare(`INSERT INTO activity_logs (
      id, user_id, action, details, ip_address, metadata, created_at
    ) VALUES (?, NULL, 'movie_created', ?, NULL, ?, ?)`)
      .run(uuid(), `Auto-imported licensed movie: ${title}`, JSON.stringify({ source: 'wikimedia_commons', pageId: page.pageid, license, sourceUrl }), timestamp);
  })();

  return { movieId, title, downloadUrl };
}

async function importCommonsMovies(limit: number): Promise<ImportResult> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: 'filetype:video incategory:Silent_films',
    gsrnamespace: '6',
    gsrlimit: '50',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '600',
    format: 'json',
    origin: '*',
  });
  const payload = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`);
  const pages: CommonsPage[] = Object.values(payload?.query?.pages || {});
  const result: ImportResult = { imported: [], skipped: [] };

  pages.sort((a, b) => Number(a.pageid || 0) - Number(b.pageid || 0));
  for (const page of pages) {
    if (result.imported.length >= limit) break;
    const info = page.imageinfo?.[0];
    const identifier = String(page.pageid || page.title || 'unknown');
    if (!info?.url || Number(info.duration || 0) < 20 * 60) {
      result.skipped.push({ identifier, reason: 'not a full-length video' });
      continue;
    }
    if (!isAllowedCommonsLicense(info)) {
      result.skipped.push({ identifier, reason: 'license could not be verified' });
      continue;
    }
    const exists = db.prepare('SELECT id FROM download_links WHERE url = ?').get(info.url);
    if (exists) {
      result.skipped.push({ identifier, reason: 'already imported' });
      continue;
    }
    if (!(await verifyDownload(info.url))) {
      result.skipped.push({ identifier, reason: 'download link failed verification' });
      continue;
    }
    result.imported.push(saveCommonsMovie(page, info));
  }
  return result;
}

export async function importLicensedArchiveMovies(limit = 3): Promise<ImportResult> {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 3, 10));
  const commons = await importCommonsMovies(safeLimit);
  if (commons.imported.length >= safeLimit) return commons;

  const params = new URLSearchParams({
    q: 'mediatype:movies AND licenseurl:creativecommons.org* AND format:MPEG4',
    'fl[]': 'identifier,title,description,date,year,language,licenseurl',
    'sort[]': 'publicdate desc',
    rows: String(Math.max(25, safeLimit * 8)),
    page: '1',
    output: 'json',
  });
  const search = await fetchJson(`${ARCHIVE_ORIGIN}/advancedsearch.php?${params}`);
  const docs: ArchiveDocument[] = Array.isArray(search?.response?.docs) ? search.response.docs : [];
  const result: ImportResult = commons;

  for (const doc of docs) {
    if (result.imported.length >= safeLimit) break;
    const identifier = firstString(doc.identifier);
    if (!identifier) continue;
    if (!isAllowedArchiveLicense(doc.licenseurl)) {
      result.skipped.push({ identifier, reason: 'missing or unsupported license' });
      continue;
    }

    try {
      const metadata = await fetchJson(`${ARCHIVE_ORIGIN}/metadata/${encodeURIComponent(identifier)}`);
      const license = metadata?.metadata?.licenseurl ?? doc.licenseurl;
      if (!isAllowedArchiveLicense(license)) {
        result.skipped.push({ identifier, reason: 'license could not be verified' });
        continue;
      }
      doc.licenseurl = license;
      const file = chooseMp4(Array.isArray(metadata?.files) ? metadata.files : []);
      if (!file?.name) {
        result.skipped.push({ identifier, reason: 'no MP4 file' });
        continue;
      }
      const downloadUrl = archiveDownloadUrl(identifier, file.name);
      const exists = db.prepare('SELECT id FROM download_links WHERE url = ?').get(downloadUrl);
      if (exists) {
        result.skipped.push({ identifier, reason: 'already imported' });
        continue;
      }
      if (!(await verifyDownload(downloadUrl))) {
        result.skipped.push({ identifier, reason: 'download link failed verification' });
        continue;
      }
      result.imported.push(saveMovie(doc, file, downloadUrl));
    } catch (error: any) {
      result.skipped.push({ identifier, reason: error?.message || 'import failed' });
    }
  }

  return result;
}
