import { Injectable, Logger } from '@nestjs/common';

type CachedImage = { buffer: Buffer; contentType: string; fetchedAt: number };

// Les images restent des fichiers Google Drive (l'admin colle un lien de partage, rien
// n'est ré-uploadé ailleurs) — mais le navigateur du visiteur ne peut pas les charger en
// direct : Chrome bloque `drive.google.com/thumbnail` / `lh3.googleusercontent.com` en
// tant que ressource intégrée cross-origin (ERR_BLOCKED_BY_ORB, reproduit et confirmé
// pour les deux formats d'URL, même hors rafale — Google traite différemment une requête
// "no-cors" venant d'un domaine tiers qu'une navigation directe ou un appel serveur→serveur).
// Ce service fait donc l'appel à Drive côté serveur (aucune restriction de ce type ici) et
// sert les octets depuis notre propre origine, avec un cache mémoire pour ne pas
// re-solliciter Drive à chaque visite (et éviter le 429 de throttling déjà documenté dans
// docs/specs/decoupler-presentation-du-google-sheet-gerer-en-admin.track.md).
const SUCCESS_TTL_MS = 60 * 60 * 1000; // 1h — les photos d'un tournoi ne changent pas en cours de route
const FAILURE_TTL_MS = 30 * 1000; // 30s — laisse un throttling transitoire de Drive se dissiper sans le marteler

@Injectable()
export class DriveImageProxyService {
  private readonly logger = new Logger(DriveImageProxyService.name);
  private readonly cache = new Map<string, CachedImage>();
  private readonly failedAt = new Map<string, number>();
  private readonly inFlight = new Map<string, Promise<CachedImage | null>>();

  async fetch(fileId: string, width: number): Promise<CachedImage | null> {
    const key = `${fileId}:${width}`;

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < SUCCESS_TTL_MS) return cached;

    const failedRecently = this.failedAt.get(key);
    if (failedRecently && Date.now() - failedRecently < FAILURE_TTL_MS)
      return null;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = this.fetchFromDrive(fileId, width, key);
    this.inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  private async fetchFromDrive(
    fileId: string,
    width: number,
    key: string,
  ): Promise<CachedImage | null> {
    try {
      const res = await fetch(
        `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`,
        { redirect: 'follow' },
      );
      const contentType = res.headers.get('content-type') ?? '';
      if (!res.ok || !contentType.startsWith('image/')) {
        this.logger.warn(
          `Drive image fetch failed for ${fileId}: status=${res.status} contentType=${contentType}`,
        );
        this.failedAt.set(key, Date.now());
        return null;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const entry: CachedImage = { buffer, contentType, fetchedAt: Date.now() };
      this.cache.set(key, entry);
      this.failedAt.delete(key);
      return entry;
    } catch (err) {
      this.logger.warn(`Drive image fetch threw for ${fileId}: ${String(err)}`);
      this.failedAt.set(key, Date.now());
      return null;
    }
  }
}
