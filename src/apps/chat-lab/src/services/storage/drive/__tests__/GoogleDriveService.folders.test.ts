/**
 * Tests for GoogleDriveService folder support
 */

import { GoogleDriveService } from '../GoogleDriveService';
import type { GoogleDriveAuthService } from '../../../auth/GoogleDriveAuth';

describe('GoogleDriveService - Folder Support', () => {
  let mockAuthService: jest.Mocked<GoogleDriveAuthService>;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    // Mock auth service
    mockAuthService = {
      isAuthenticated: jest.fn().mockReturnValue(true),
      getAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
    } as any;

    // Mock global fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AppData folder (default)', () => {
    it('should list files from AppData folder by default', async () => {
      const service = new GoogleDriveService(mockAuthService);
      await service.initialize();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'file-1',
              name: 'test.db',
              mimeType: 'application/x-sqlite3',
            },
          ],
        }),
      });

      await service.listFiles();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("parents%20in%20'appDataFolder'"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-access-token',
          }),
        })
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('spaces=appDataFolder'),
        expect.any(Object)
      );
    });

    it('should upload files to AppData folder by default', async () => {
      const service = new GoogleDriveService(mockAuthService);
      await service.initialize();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'new-file-id' }),
        });

      const data = new Uint8Array([1, 2, 3]);
      await service.uploadFile('test.db', data);

      // Check the upload request
      const uploadCall = mockFetch.mock.calls.find(call =>
        call[0].includes('/upload/drive/v3/files')
      );
      expect(uploadCall).toBeDefined();

      // Verify metadata includes appDataFolder as parent
      const uploadBody = uploadCall![1].body;
      const bodyText = new TextDecoder().decode(uploadBody);
      expect(bodyText).toContain('"parents":["appDataFolder"]');
    });
  });

  describe('Custom folder', () => {
    it('should list files from custom folder', async () => {
      const service = new GoogleDriveService(
        mockAuthService,
        'custom-folder-123'
      );
      await service.initialize();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [
            {
              id: 'file-1',
              name: 'shared.db',
              mimeType: 'application/x-sqlite3',
            },
          ],
        }),
      });

      await service.listFiles();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("'custom-folder-123'%20in%20parents"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock-access-token',
          }),
        })
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('spaces=drive'),
        expect.any(Object)
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('trashed%3Dfalse'),
        expect.any(Object)
      );
    });

    it('should upload files to custom folder', async () => {
      const service = new GoogleDriveService(
        mockAuthService,
        'custom-folder-123'
      );
      await service.initialize();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ files: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'new-file-id' }),
        });

      const data = new Uint8Array([1, 2, 3]);
      await service.uploadFile('shared.db', data);

      // Check the upload request
      const uploadCall = mockFetch.mock.calls.find(call =>
        call[0].includes('/upload/drive/v3/files')
      );
      expect(uploadCall).toBeDefined();

      // Verify metadata includes custom folder as parent
      const uploadBody = uploadCall![1].body;
      const bodyText = new TextDecoder().decode(uploadBody);
      expect(bodyText).toContain('"parents":["custom-folder-123"]');
    });
  });

  describe('Folder switching', () => {
    it('should support creating services with different folders', async () => {
      const appDataService = new GoogleDriveService(mockAuthService);
      const customFolderService = new GoogleDriveService(
        mockAuthService,
        'folder-123'
      );

      await appDataService.initialize();
      await customFolderService.initialize();

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ files: [] }),
      });

      // List from AppData
      await appDataService.listFiles();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("parents%20in%20'appDataFolder'"),
        expect.any(Object)
      );

      mockFetch.mockClear();

      // List from custom folder
      await customFolderService.listFiles();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("'folder-123'%20in%20parents"),
        expect.any(Object)
      );
    });
  });

  describe('Error handling', () => {
    it('should handle errors when listing files from custom folder', async () => {
      const service = new GoogleDriveService(
        mockAuthService,
        'custom-folder-123'
      );
      await service.initialize();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const files = await service.listFiles();

      // Should return empty array on error (fallback behavior)
      expect(files).toEqual([]);
    });

    it('should handle permission errors for custom folders', async () => {
      const service = new GoogleDriveService(
        mockAuthService,
        'custom-folder-123'
      );
      await service.initialize();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Insufficient permissions',
      });

      // The service returns empty array on error (fallback behavior)
      const files = await service.listFiles();
      expect(files).toEqual([]);
    });
  });
});
