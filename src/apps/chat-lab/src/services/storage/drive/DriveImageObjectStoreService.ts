import type { Attachment, Message } from '../../../types';
import { MetricsService } from '../../metrics/MetricsService';
import { GoogleDriveService } from './GoogleDriveService';

const IMAGES_FOLDER_NAME = 'images';
const INDEX_FILE_NAME = 'index.json';
const MAX_GENERATED_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB safety cap
const MAX_IMAGE_UPLOAD_RETRIES = 5;
const IMAGE_RETRY_BASE_DELAY_MS = 500;

type ImageIndexEntry = {
  imageId: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};

type ImageIndex = {
  version: 1;
  updatedAt: string;
  images: Record<string, ImageIndexEntry>;
};

function createEmptyIndex(): ImageIndex {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    images: {},
  };
}

function normalizeIndex(raw: any): ImageIndex {
  return {
    version: 1,
    updatedAt:
      typeof raw?.updatedAt === 'string'
        ? raw.updatedAt
        : new Date().toISOString(),
    images: raw?.images && typeof raw.images === 'object' ? raw.images : {},
  };
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('gif')) return 'gif';
  return 'bin';
}

function classifyUploadError(error: unknown): {
  retryable: boolean;
  code: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes('invalid data url') || lower.includes('malformed')) {
    return { retryable: false, code: 'invalid_data_url' };
  }
  if (lower.includes('unsupported')) {
    return { retryable: false, code: 'unsupported_payload' };
  }
  if (lower.includes('payload too large')) {
    return { retryable: false, code: 'payload_too_large' };
  }
  if (
    lower.includes('network')
    || lower.includes('timeout')
    || lower.includes('rate')
    || lower.includes('429')
    || lower.includes('500')
    || lower.includes('502')
    || lower.includes('503')
    || lower.includes('504')
    || lower.includes('failed to upload')
    || lower.includes('failed to download')
  ) {
    return { retryable: true, code: 'transient_network' };
  }
  return { retryable: true, code: 'unknown_transient' };
}

function safeRecordImageUploadMetric(status: 'success' | 'error'): void {
  try {
    if (
      typeof MetricsService !== 'undefined'
      && MetricsService?.recordImageUpload
    ) {
      MetricsService.recordImageUpload(status);
    }
  } catch (error) {
    console.debug(
      'Image upload metrics recording failed (non-blocking):',
      error
    );
  }
}

function safeRecordImageUploadFailureMetric(
  failureClass: 'retryable' | 'fatal',
  errorCode: string
): void {
  try {
    if (
      typeof MetricsService !== 'undefined'
      && MetricsService?.recordImageUploadFailure
    ) {
      MetricsService.recordImageUploadFailure(failureClass, errorCode);
    }
  } catch (error) {
    console.debug(
      'Image upload failure metrics recording failed (non-blocking):',
      error
    );
  }
}

export class DriveImageObjectStoreService {
  private readonly driveService: GoogleDriveService;
  private imagesFolderId: string | null = null;
  private index: ImageIndex = createEmptyIndex();
  private indexLoaded = false;
  private readonly displayUrlCache = new Map<string, string>();
  private indexWriteBatchDepth = 0;
  private indexDirty = false;

  constructor(driveService: GoogleDriveService) {
    this.driveService = driveService;
  }

  private async ensureImagesFolderId(): Promise<string> {
    if (this.imagesFolderId) return this.imagesFolderId;
    this.imagesFolderId =
      await this.driveService.ensureFolder(IMAGES_FOLDER_NAME);
    return this.imagesFolderId;
  }

  private async ensureIndexLoaded(): Promise<void> {
    if (this.indexLoaded) return;
    const folderId = await this.ensureImagesFolderId();
    const file = await this.driveService.findFileByNameInFolder(
      folderId,
      INDEX_FILE_NAME
    );
    if (!file) {
      this.index = createEmptyIndex();
      this.indexLoaded = true;
      return;
    }
    const raw = await this.driveService.downloadFile(file.id);
    try {
      const parsed = JSON.parse(new TextDecoder().decode(raw));
      this.index = normalizeIndex(parsed);
    } catch {
      this.index = createEmptyIndex();
    }
    this.indexLoaded = true;
  }

  private async loadIndexFromDrive(): Promise<ImageIndex> {
    const folderId = await this.ensureImagesFolderId();
    const file = await this.driveService.findFileByNameInFolder(
      folderId,
      INDEX_FILE_NAME
    );
    if (!file) {
      return createEmptyIndex();
    }
    const raw = await this.driveService.downloadFile(file.id);
    try {
      const parsed = JSON.parse(new TextDecoder().decode(raw));
      return normalizeIndex(parsed);
    } catch {
      return createEmptyIndex();
    }
  }

  private async saveIndex(): Promise<void> {
    const folderId = await this.ensureImagesFolderId();
    // Shared-workspace conflict tolerance:
    // treat index.json as an advisory cache and merge latest remote snapshot
    // before write so concurrent writers are less likely to drop entries.
    const remoteIndex = await this.loadIndexFromDrive();
    this.index = {
      version: 1,
      updatedAt: new Date().toISOString(),
      images: {
        ...(remoteIndex.images || {}),
        ...(this.index.images || {}),
      },
    };
    const bytes = new TextEncoder().encode(JSON.stringify(this.index, null, 2));
    await this.driveService.uploadFileToFolder(
      folderId,
      INDEX_FILE_NAME,
      bytes,
      'application/json'
    );
  }

  private async scheduleIndexSave(): Promise<void> {
    this.indexDirty = true;
    if (this.indexWriteBatchDepth > 0) {
      return;
    }
    await this.flushIndexIfDirty();
  }

  private async flushIndexIfDirty(): Promise<void> {
    if (!this.indexDirty) {
      return;
    }
    this.indexDirty = false;
    await this.saveIndex();
  }

  private async runWithIndexBatch<T>(fn: () => Promise<T>): Promise<T> {
    this.indexWriteBatchDepth += 1;
    try {
      return await fn();
    } finally {
      this.indexWriteBatchDepth -= 1;
      if (this.indexWriteBatchDepth === 0) {
        await this.flushIndexIfDirty();
      }
    }
  }

  private parseDataUrl(dataUrl: string): {
    mimeType: string;
    bytes: Uint8Array;
  } {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
    if (!match) {
      throw new Error('Invalid data URL for generated image');
    }
    const mimeType = match[1];
    const base64 = match[2];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { mimeType, bytes };
  }

  private async sha256Hex(bytes: Uint8Array): Promise<string> {
    // Normalize to a plain ArrayBuffer (not ArrayBufferLike) for WebCrypto typing.
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(arrayBuffer).set(bytes);
    const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const arr = new Uint8Array(digest);
    return Array.from(arr)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async persistGeneratedImageDataUrl(
    dataUrl: string
  ): Promise<ImageIndexEntry> {
    await this.ensureIndexLoaded();
    const { mimeType, bytes } = this.parseDataUrl(dataUrl);
    if (bytes.byteLength > MAX_GENERATED_IMAGE_BYTES) {
      throw new Error(
        `Generated image payload too large: ${bytes.byteLength} bytes (max ${MAX_GENERATED_IMAGE_BYTES})`
      );
    }
    const imageId = await this.sha256Hex(bytes);
    const indexed = this.index.images[imageId];
    if (indexed) {
      return indexed;
    }

    const folderId = await this.ensureImagesFolderId();
    const fileName = `img_${imageId}.${extensionForMime(mimeType)}`;
    const existing = await this.driveService.findFileByNameInFolder(
      folderId,
      fileName
    );
    const driveFileId = existing
      ? existing.id
      : await this.driveService.uploadFileToFolder(
          folderId,
          fileName,
          bytes,
          mimeType
        );
    if (!existing) {
      safeRecordImageUploadMetric('success');
    }

    const entry: ImageIndexEntry = {
      imageId,
      driveFileId,
      fileName,
      mimeType,
      byteSize: bytes.length,
      createdAt: new Date().toISOString(),
    };
    this.index.images[imageId] = entry;
    await this.scheduleIndexSave();
    return entry;
  }

  private computeNextRetryAt(retryCount: number): string {
    const jitterMs = Math.floor(Math.random() * 250);
    const delayMs =
      IMAGE_RETRY_BASE_DELAY_MS * Math.pow(2, Math.max(0, retryCount - 1))
      + jitterMs;
    return new Date(Date.now() + delayMs).toISOString();
  }

  private shouldRetryNow(att: Attachment): boolean {
    if (att.status !== 'pending_upload' && att.status !== 'missing') {
      return true;
    }
    const retries = att.uploadRetryCount || 0;
    if (retries >= MAX_IMAGE_UPLOAD_RETRIES) {
      return false;
    }
    if (!att.nextRetryAt) {
      return true;
    }
    const nextRetry = new Date(att.nextRetryAt).getTime();
    return Number.isFinite(nextRetry) ? Date.now() >= nextRetry : true;
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }

  private async resolveDisplayUrlForDriveRef(
    att: Attachment
  ): Promise<string | undefined> {
    const cacheKey = att.imageId || att.driveFileId || att.id;
    const cached = this.displayUrlCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const driveFileId =
      typeof att.driveFileId === 'string' ? att.driveFileId : undefined;
    let resolvedDriveFileId = driveFileId;
    let mimeType = att.mimeType || 'image/png';

    if (!resolvedDriveFileId && att.imageId) {
      await this.ensureIndexLoaded();
      const indexed = this.index.images[att.imageId];
      if (indexed) {
        resolvedDriveFileId = indexed.driveFileId;
        mimeType = indexed.mimeType || mimeType;
      }
    }

    if (!resolvedDriveFileId) {
      return undefined;
    }

    const bytes = await this.driveService.downloadFile(resolvedDriveFileId);
    const base64 = this.bytesToBase64(bytes);
    const url = `data:${mimeType};base64,${base64}`;
    this.displayUrlCache.set(cacheKey, url);
    return url;
  }

  /**
   * Convert inlined generated-image attachments to immutable Drive references.
   * If upload/index fails, preserves the original attachment as fail-safe.
   */
  async prepareMessagesForPersistence(messages: Message[]): Promise<Message[]> {
    return this.runWithIndexBatch(async () => {
      const out: Message[] = [];
      for (const message of messages) {
        const attachments = message.attachments ?? [];
        if (attachments.length === 0) {
          out.push(message);
          continue;
        }
        const mapped: Attachment[] = [];
        for (const att of attachments) {
          const maybeDataUrl =
            att.type === 'image' && typeof att.url === 'string'
              ? att.url.trim()
              : '';
          const isGeneratedDataUrl = maybeDataUrl.startsWith('data:image/');
          if (!isGeneratedDataUrl) {
            mapped.push(att);
            continue;
          }
          try {
            const persisted =
              await this.persistGeneratedImageDataUrl(maybeDataUrl);
            mapped.push({
              id: att.id,
              name: att.name,
              type: 'image',
              storage: 'drive_ref',
              imageId: persisted.imageId,
              driveFileId: persisted.driveFileId,
              status: 'ready',
              mimeType: persisted.mimeType,
              size: persisted.byteSize,
              uploadRetryCount: 0,
              lastUploadErrorCode: undefined,
              lastUploadErrorAt: undefined,
              nextRetryAt: undefined,
            });
          } catch (error) {
            const classified = classifyUploadError(error);
            safeRecordImageUploadMetric('error');
            safeRecordImageUploadFailureMetric(
              classified.retryable ? 'retryable' : 'fatal',
              classified.code
            );
            const retries = (att.uploadRetryCount || 0) + 1;
            const canRetry =
              classified.retryable && retries < MAX_IMAGE_UPLOAD_RETRIES;
            const keepInlineUrl = canRetry;
            console.warn(
              '[DriveImageObjectStoreService] Failed to persist generated image; keeping inline attachment',
              error
            );
            mapped.push({
              ...att,
              type: 'image',
              storage: 'drive_ref',
              status: canRetry ? 'pending_upload' : 'missing',
              uploadRetryCount: retries,
              lastUploadErrorCode: classified.code,
              lastUploadErrorAt: new Date().toISOString(),
              nextRetryAt: canRetry
                ? this.computeNextRetryAt(retries)
                : undefined,
              url: keepInlineUrl ? maybeDataUrl : undefined,
            });
          }
        }
        out.push({
          ...message,
          attachments: mapped,
        });
      }
      return out;
    });
  }

  /**
   * Resolve `drive_ref` image attachments to runtime display URLs for rendering.
   * Persistence remains reference-only; this only hydrates in-memory message objects.
   */
  async hydrateMessagesForDisplay(messages: Message[]): Promise<Message[]> {
    const out: Message[] = [];
    for (const message of messages) {
      const attachments = message.attachments ?? [];
      if (attachments.length === 0) {
        out.push(message);
        continue;
      }
      const mapped: Attachment[] = [];
      for (const att of attachments) {
        if (!(att.type === 'image' && att.storage === 'drive_ref')) {
          mapped.push(att);
          continue;
        }
        const canAttemptDisplayFetch = !!(att.driveFileId || att.imageId);

        if (att.url) {
          // Self-heal stale pending uploads that retained inline data but were
          // never reconciled (e.g. older state marked synced too early).
          const hasInlineDataUrl =
            typeof att.url === 'string' && att.url.startsWith('data:image/');
          if (
            att.status === 'pending_upload'
            && hasInlineDataUrl
            && !att.driveFileId
            && !att.imageId
          ) {
            try {
              const persisted = await this.persistGeneratedImageDataUrl(
                att.url
              );
              mapped.push({
                ...att,
                imageId: persisted.imageId,
                driveFileId: persisted.driveFileId,
                mimeType: persisted.mimeType,
                size: persisted.byteSize,
                status: 'ready',
                uploadRetryCount: 0,
                lastUploadErrorCode: undefined,
                lastUploadErrorAt: undefined,
                nextRetryAt: undefined,
                lastHydrationErrorCode: undefined,
              });
              continue;
            } catch {
              // Leave as-is; normal retry/sync flows continue to handle it.
            }
          }
          // Normalize stale pending/missing states when we already have a
          // displayable URL and a Drive reference.
          if (
            (att.status === 'pending_upload' || att.status === 'missing')
            && canAttemptDisplayFetch
          ) {
            mapped.push({
              ...att,
              status: 'ready',
              uploadRetryCount: 0,
              lastUploadErrorCode: undefined,
              lastUploadErrorAt: undefined,
              nextRetryAt: undefined,
              lastHydrationErrorCode: undefined,
            });
          } else {
            mapped.push(att);
          }
          continue;
        }

        try {
          const displayUrl = await this.resolveDisplayUrlForDriveRef(att);
          if (!displayUrl) {
            if (!canAttemptDisplayFetch) {
              mapped.push({
                ...att,
                status: att.status || 'pending_upload',
                lastHydrationErrorCode: undefined,
              });
              continue;
            }
            mapped.push({
              ...att,
              status: 'missing',
              lastHydrationErrorCode: 'display_fetch_failed',
            });
            continue;
          }
          mapped.push({
            ...att,
            url: displayUrl,
            status: 'ready',
            lastHydrationErrorCode: undefined,
          });
        } catch (error) {
          console.warn(
            '[DriveImageObjectStoreService] Failed to resolve drive_ref image for display',
            error
          );
          if (!canAttemptDisplayFetch) {
            mapped.push({
              ...att,
              status: att.status || 'pending_upload',
              lastHydrationErrorCode: undefined,
            });
            continue;
          }
          mapped.push({
            ...att,
            status: 'missing',
            lastHydrationErrorCode: 'display_fetch_failed',
          });
        }
      }

      out.push({
        ...message,
        attachments: mapped,
      });
    }

    return out;
  }

  /**
   * Reconcile pending drive_ref image attachments inside interaction payloads.
   * Returns updated interactions plus a flag indicating whether any retryable
   * pending images remain (conversation should stay unsynced).
   */
  async reconcileInteractionAttachments(interactions: any[]): Promise<{
    interactions: any[];
    changed: boolean;
    hasRetryablePending: boolean;
  }> {
    return this.runWithIndexBatch(async () => {
      let changed = false;
      let hasRetryablePending = false;
      const nextInteractions = interactions.map((interaction: any) => ({
        ...interaction,
      }));

      for (let i = 0; i < nextInteractions.length; i += 1) {
        const interaction = nextInteractions[i];
        const attachments = Array.isArray(interaction.attachments)
          ? interaction.attachments
          : [];
        const mappedAttachments: any[] = [];

        for (const attachment of attachments) {
          if (
            !attachment
            || typeof attachment !== 'object'
            || attachment.type !== 'image'
            || attachment.storage !== 'drive_ref'
          ) {
            mappedAttachments.push(attachment);
            continue;
          }

          const hasInlineDataUrl =
            typeof attachment.url === 'string'
            && attachment.url.startsWith('data:image/');
          const needsUpload =
            (!attachment.driveFileId || attachment.status === 'pending_upload')
            && hasInlineDataUrl;

          if (!needsUpload || !this.shouldRetryNow(attachment)) {
            mappedAttachments.push(attachment);
            if (attachment.status === 'pending_upload') {
              hasRetryablePending = true;
            }
            continue;
          }

          try {
            const persisted = await this.persistGeneratedImageDataUrl(
              attachment.url
            );
            mappedAttachments.push({
              ...attachment,
              storage: 'drive_ref',
              imageId: persisted.imageId,
              driveFileId: persisted.driveFileId,
              mimeType: persisted.mimeType,
              size: persisted.byteSize,
              status: 'ready',
              uploadRetryCount: 0,
              lastUploadErrorCode: undefined,
              lastUploadErrorAt: undefined,
              nextRetryAt: undefined,
              url: undefined,
            });
            changed = true;
          } catch (error) {
            const classified = classifyUploadError(error);
            safeRecordImageUploadMetric('error');
            safeRecordImageUploadFailureMetric(
              classified.retryable ? 'retryable' : 'fatal',
              classified.code
            );
            const retries = (attachment.uploadRetryCount || 0) + 1;
            const canRetry =
              classified.retryable && retries < MAX_IMAGE_UPLOAD_RETRIES;
            const updated = {
              ...attachment,
              status: canRetry ? 'pending_upload' : 'missing',
              uploadRetryCount: retries,
              lastUploadErrorCode: classified.code,
              lastUploadErrorAt: new Date().toISOString(),
              nextRetryAt: canRetry
                ? this.computeNextRetryAt(retries)
                : undefined,
            };
            mappedAttachments.push(updated);
            changed = true;
            if (canRetry) {
              hasRetryablePending = true;
            }
          }
        }

        interaction.attachments = mappedAttachments;
      }

      return {
        interactions: nextInteractions,
        changed,
        hasRetryablePending,
      };
    });
  }
}
