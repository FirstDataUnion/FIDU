import type { Message } from '../../../../types';
import { DriveImageObjectStoreService } from '../DriveImageObjectStoreService';
import { webcrypto } from 'crypto';

describe('DriveImageObjectStoreService', () => {
  const dataUrlPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const dataUrlPngAlt =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAGgwJ/lB7x+QAAAABJRU5ErkJggg==';

  const buildService = () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true,
    });

    const mockDriveService = {
      ensureFolder: jest.fn().mockResolvedValue('images-folder-id'),
      findFileByNameInFolder: jest.fn().mockResolvedValue(null),
      uploadFileToFolder: jest.fn().mockResolvedValue('drive-file-id-1'),
      downloadFile: jest.fn(),
    } as any;
    return {
      mockDriveService,
      service: new DriveImageObjectStoreService(mockDriveService),
    };
  };

  it('converts inline generated image attachment to drive_ref', async () => {
    const { service } = buildService();
    const messages: Message[] = [
      {
        id: 'm1',
        conversationId: 'c1',
        content: 'image',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'google/gemini-2.5-flash-image',
        isEdited: false,
        attachments: [
          {
            id: 'a1',
            name: 'Generated image 1',
            type: 'image',
            url: dataUrlPng,
          },
        ],
      },
    ];

    const out = await service.prepareMessagesForPersistence(messages);
    const att = out[0].attachments?.[0];
    expect(att?.type).toBe('image');
    expect(att?.storage).toBe('drive_ref');
    expect(att?.driveFileId).toBe('drive-file-id-1');
    expect(att?.status).toBe('ready');
    expect(att?.url).toBeUndefined();
  });

  it('dedupes identical image bytes using content hash', async () => {
    const { service, mockDriveService } = buildService();
    const messages: Message[] = [
      {
        id: 'm1',
        conversationId: 'c1',
        content: 'img1',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'model',
        isEdited: false,
        attachments: [{ id: 'a1', name: 'i1', type: 'image', url: dataUrlPng }],
      },
      {
        id: 'm2',
        conversationId: 'c1',
        content: 'img2',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'model',
        isEdited: false,
        attachments: [{ id: 'a2', name: 'i2', type: 'image', url: dataUrlPng }],
      },
    ];

    const out = await service.prepareMessagesForPersistence(messages);
    expect(mockDriveService.uploadFileToFolder).toHaveBeenCalledTimes(2); // image + index.json

    const att1 = out[0].attachments?.[0];
    const att2 = out[1].attachments?.[0];
    expect(att1?.imageId).toBe(att2?.imageId);
    expect(att1?.driveFileId).toBe(att2?.driveFileId);
  });

  it('batches index writes across a single persistence pass', async () => {
    const { service, mockDriveService } = buildService();
    const messages: Message[] = [
      {
        id: 'm1',
        conversationId: 'c1',
        content: 'img1',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'model',
        isEdited: false,
        attachments: [{ id: 'a1', name: 'i1', type: 'image', url: dataUrlPng }],
      },
      {
        id: 'm2',
        conversationId: 'c1',
        content: 'img2',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'model',
        isEdited: false,
        attachments: [{ id: 'a2', name: 'i2', type: 'image', url: dataUrlPng }],
      },
      {
        id: 'm3',
        conversationId: 'c1',
        content: 'img3-different',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'model',
        isEdited: false,
        attachments: [
          {
            id: 'a3',
            name: 'i3',
            type: 'image',
            url: dataUrlPngAlt,
          },
        ],
      },
    ];

    await service.prepareMessagesForPersistence(messages);
    // 2 image uploads (first + third), 1 batched index write
    expect(mockDriveService.uploadFileToFolder).toHaveBeenCalledTimes(3);
  });

  it('hydrates drive_ref attachments with display urls and caches repeated ids', async () => {
    const { service, mockDriveService } = buildService();
    mockDriveService.downloadFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const messages: Message[] = [
      {
        id: 'm1',
        conversationId: 'c1',
        content: '',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'model',
        isEdited: false,
        attachments: [
          {
            id: 'a1',
            name: 'Generated image 1',
            type: 'image',
            storage: 'drive_ref',
            imageId: 'img-hash-1',
            driveFileId: 'drive-file-id-1',
            mimeType: 'image/png',
          },
        ],
      },
      {
        id: 'm2',
        conversationId: 'c1',
        content: '',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'model',
        isEdited: false,
        attachments: [
          {
            id: 'a2',
            name: 'Generated image 1',
            type: 'image',
            storage: 'drive_ref',
            imageId: 'img-hash-1',
            driveFileId: 'drive-file-id-1',
            mimeType: 'image/png',
          },
        ],
      },
    ];

    const hydrated = await service.hydrateMessagesForDisplay(messages);
    expect(hydrated[0].attachments?.[0].url).toMatch(
      /^data:image\/png;base64,/
    );
    expect(hydrated[1].attachments?.[0].url).toMatch(
      /^data:image\/png;base64,/
    );
    expect(mockDriveService.downloadFile).toHaveBeenCalledTimes(1);
  });

  it('marks unresolved drive_ref hydration failures as missing and retryable fetch-failed', async () => {
    const { service, mockDriveService } = buildService();
    mockDriveService.downloadFile.mockRejectedValue(
      new Error('network timeout')
    );

    const messages: Message[] = [
      {
        id: 'm1',
        conversationId: 'c1',
        content: '',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'model',
        isEdited: false,
        attachments: [
          {
            id: 'a1',
            name: 'Generated image 1',
            type: 'image',
            storage: 'drive_ref',
            imageId: 'img-hash-1',
            driveFileId: 'drive-file-id-1',
            mimeType: 'image/png',
            status: 'ready',
          },
        ],
      },
    ];

    const hydrated = await service.hydrateMessagesForDisplay(messages);
    const att = hydrated[0].attachments?.[0];
    expect(att?.url).toBeUndefined();
    expect(att?.status).toBe('missing');
    expect(att?.lastHydrationErrorCode).toBe('display_fetch_failed');
  });

  it('keeps pending_upload state when drive reference is not yet available', async () => {
    const { service } = buildService();
    const messages: Message[] = [
      {
        id: 'm1',
        conversationId: 'c1',
        content: '',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'model',
        isEdited: false,
        attachments: [
          {
            id: 'a1',
            name: 'Generated image 1',
            type: 'image',
            storage: 'drive_ref',
            status: 'pending_upload',
            uploadRetryCount: 1,
            lastUploadErrorCode: 'transient_network',
          },
        ],
      },
    ];

    const hydrated = await service.hydrateMessagesForDisplay(messages);
    const att = hydrated[0].attachments?.[0];
    expect(att?.url).toBeUndefined();
    expect(att?.status).toBe('pending_upload');
    expect(att?.lastHydrationErrorCode).toBeUndefined();
  });

  it('normalizes stale pending status to ready when url and drive ref exist', async () => {
    const { service } = buildService();
    const messages: Message[] = [
      {
        id: 'm1',
        conversationId: 'c1',
        content: '',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'model',
        isEdited: false,
        attachments: [
          {
            id: 'a1',
            name: 'Generated image 1',
            type: 'image',
            storage: 'drive_ref',
            url: dataUrlPng,
            imageId: 'img-hash-1',
            driveFileId: 'drive-file-id-1',
            status: 'pending_upload',
            uploadRetryCount: 2,
            lastUploadErrorCode: 'transient_network',
          },
        ],
      },
    ];

    const hydrated = await service.hydrateMessagesForDisplay(messages);
    const att = hydrated[0].attachments?.[0];
    expect(att?.status).toBe('ready');
    expect(att?.uploadRetryCount).toBe(0);
    expect(att?.lastUploadErrorCode).toBeUndefined();
  });

  it('self-heals pending inline drive_ref images by persisting and clearing warning state', async () => {
    const { service } = buildService();
    const messages: Message[] = [
      {
        id: 'm1',
        conversationId: 'c1',
        content: '',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'model',
        isEdited: false,
        attachments: [
          {
            id: 'a1',
            name: 'Generated image 1',
            type: 'image',
            storage: 'drive_ref',
            url: dataUrlPng,
            status: 'pending_upload',
            uploadRetryCount: 2,
            lastUploadErrorCode: 'transient_network',
          },
        ],
      },
    ];

    const hydrated = await service.hydrateMessagesForDisplay(messages);
    const att = hydrated[0].attachments?.[0];
    expect(att?.status).toBe('ready');
    expect(att?.imageId).toBeDefined();
    expect(att?.driveFileId).toBe('drive-file-id-1');
    expect(att?.uploadRetryCount).toBe(0);
    expect(att?.lastUploadErrorCode).toBeUndefined();
  });

  it('marks oversized generated image payloads as missing and does not retain inline url', async () => {
    const { service, mockDriveService } = buildService();
    const oversizedPayload = Buffer.alloc(8 * 1024 * 1024 + 1, 1).toString(
      'base64'
    );
    const hugeDataUrl = `data:image/png;base64,${oversizedPayload}`;

    const messages: Message[] = [
      {
        id: 'm3',
        conversationId: 'c1',
        content: 'huge image',
        role: 'assistant',
        timestamp: new Date().toISOString(),
        platform: 'model',
        isEdited: false,
        attachments: [
          {
            id: 'a3',
            name: 'Huge generated image',
            type: 'image',
            url: hugeDataUrl,
          },
        ],
      },
    ];

    const out = await service.prepareMessagesForPersistence(messages);
    const att = out[0].attachments?.[0];
    expect(att?.storage).toBe('drive_ref');
    expect(att?.status).toBe('missing');
    expect(att?.lastUploadErrorCode).toBe('payload_too_large');
    expect(att?.url).toBeUndefined();
    expect(mockDriveService.uploadFileToFolder).not.toHaveBeenCalled();
  });
});
