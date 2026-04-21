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
  SseEvent,
  DeleteCorpusRequest,
  SourceContentRequest,
  SourceContentResponse,
  SourceFileLocation,
} from '../types/ragApi';
import type { OpenRouterChatRequest } from '../../types/openRouter';
import { handleSSEStream } from '../../utils/sseStreamHandling';
import type { Corpus } from '../types/local';

export function corpusToLocation(
  corpus: Corpus | undefined
): CorpusLocation | undefined {
  if (corpus === undefined) {
    return undefined;
  }
  return {
    provider: 'fidu_rag',
    engine: 'cortexdb',
    database_file_location: {
      provider: 'google_drive',
      file_id: corpus.databaseLocation.fileId,
    },
  };
}

class RagApiClient {
  private baseUrl: string;
  private client: AxiosInstance;
  private authService: ReturnType<typeof getFiduAuthService>;

  constructor() {
    this.baseUrl = getGatewayUrl() + '/api/rag/v1';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.authService = getFiduAuthService();
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    const authInterceptor = this.authService.createAuthInterceptor();
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
    if (response.data.location.provider !== 'google_drive') {
      throw new Error(
        `Initialise corpus response is not a google_drive file: ${JSON.stringify(response.data.location)}`
      );
    }
    return {
      provider: 'google_drive',
      fileId: response.data.location.file_id,
    };
  }

  async deleteCorpus(corpus: CorpusLocation): Promise<void> {
    const request = {
      provider_credentials: await this.getProviderCredentials(),
      corpus_location: corpus,
    };
    await this.client.put<void>(
      '/corpus/delete',
      request satisfies DeleteCorpusRequest
    );
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

  async deleteFiles(
    corpus: CorpusLocation,
    files: FileLocation[]
  ): Promise<void> {
    const request = {
      provider_credentials: await this.getProviderCredentials(),
      corpus_location: corpus,
      files: files.map(file => ({
        action: 'delete' as const,
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

  async getSourceContent(
    corpus: CorpusLocation,
    sourceFileLocation: SourceFileLocation
  ): Promise<SourceContentResponse> {
    const request = {
      provider_credentials: await this.getProviderCredentials(),
      corpus_location: corpus,
      source_file_location: sourceFileLocation,
    };
    const response = await this.client.post<SourceContentResponse>(
      '/corpus/source/content/query',
      request satisfies SourceContentRequest
    );
    return response.data;
  }

  async *callChatCompletion(
    corpus: CorpusLocation,
    request: OpenRouterChatRequest,
    searchQuery: string,
    files: FileLocation[],
    abortSignal?: AbortSignal
  ): AsyncGenerator<SseEvent, void, unknown> {
    const url = `${this.baseUrl}/corpus/completion`;
    const requestBody = {
      provider_credentials: await this.getProviderCredentials(),
      corpus_location: corpus,
      files,
      search_query: searchQuery,
      open_router_request_body: { ...request, stream: true },
    };
    const response = await this.authService.authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal || AbortSignal.timeout(20 * 60 * 1000),
    });
    if (!response.ok) {
      console.error('Failed to call chat completion:', response.statusText);
      return;
    }
    if (!response.body) {
      console.error('Response body is null');
      return;
    }
    yield* handleSSEStream<SseEvent>(response.body);
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
