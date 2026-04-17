import { getFiduAuthService } from '../../services/auth/FiduAuthService';
import axios, { type AxiosInstance } from 'axios';
import { getGatewayUrl } from '../../utils/environment';
import { getGoogleDriveAuthService } from '../../services/auth/GoogleDriveAuth';
import type {
  ProviderCredentials,
  InitialiseCorpusLocation,
  InitialiseCorpusResponse,
  InitialiseCorpusRequest,
  Source,
  CorpusLocation,
  CorpusIdentifyingRequest,
  IngestQueueStatus,
  FileLocation,
  AppendToIngestQueueRequest,
} from '../types/ragApi';

class RagApiClient {
  private baseUrl: string;
  private client: AxiosInstance;

  constructor() {
    this.baseUrl = getGatewayUrl() + '/api/rag/v1';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    const authService = getFiduAuthService();
    const authInterceptor = authService.createAuthInterceptor();
    this.client.interceptors.request.use(authInterceptor.request, error =>
      Promise.reject(error)
    );
    this.client.interceptors.response.use(
      authInterceptor.response,
      authInterceptor.error
    );
  }

  async initialiseCorpus(
    location: InitialiseCorpusLocation
  ): Promise<{ provider: 'google_drive'; fileId: string }> {
    const request = {
      provider_credentials: await this.getProviderCredentials(),
      corpus_location: location,
    };
    const response = await this.client.put<InitialiseCorpusResponse>(
      '/corpus/initialise',
      request satisfies InitialiseCorpusRequest
    );
    return {
      provider: 'google_drive',
      fileId: response.data.location.file_id,
    };
  }

  async ingestFiles(
    corpus: CorpusLocation,
    files: FileLocation[]
  ): Promise<void> {
    const request = {
      provider_credentials: await this.getProviderCredentials(),
      corpus_location: corpus,
      files: files.map(file => ({
        action: 'add_or_replace' as const,
        location: file,
      })),
    };
    await this.client.put<void>(
      '/corpus/ingest-queue',
      request satisfies AppendToIngestQueueRequest
    );
  }

  async getIngestQueueStatus(
    corpus: CorpusLocation
  ): Promise<IngestQueueStatus> {
    const request = {
      provider_credentials: await this.getProviderCredentials(),
      corpus_location: corpus,
    };
    const response = await this.client.post<{ status: IngestQueueStatus }>(
      '/corpus/ingest-queue/query',
      request satisfies CorpusIdentifyingRequest
    );
    return response.data.status;
  }

  async getSources(corpus: CorpusLocation): Promise<Source[]> {
    const request = {
      provider_credentials: await this.getProviderCredentials(),
      corpus_location: corpus,
    };
    const response = await this.client.post<{ sources: Source[] }>(
      '/corpus/sources/query',
      request satisfies CorpusIdentifyingRequest
    );
    return response.data.sources;
  }

  private async getProviderCredentials(): Promise<ProviderCredentials> {
    const googleDriveAuthService = await getGoogleDriveAuthService();
    const oauthToken = await googleDriveAuthService.getAccessToken();
    return {
      google_drive: {
        oauth_token: oauthToken,
      },
    };
  }
}

export const createRagApiClient = () => new RagApiClient();
