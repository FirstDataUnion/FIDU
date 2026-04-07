import axios, { type AxiosInstance } from 'axios';
import { getGatewayUrl } from '../../utils/environment';
import { getFiduAuthService } from '../auth/FiduAuthService';
import { getGoogleDriveAuthService } from '../auth/GoogleDriveAuth';
import type { ExternalLocationType } from '../../types';

type CorpusInfo = {
  provider: 'fidu_rag';
  engine: 'cortexdb';
  location: {
    provider: 'google_drive';
    fileId: string;
  };
};

class RagApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: getGatewayUrl() + '/api/rag/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    const authInterceptor = getFiduAuthService().createAuthInterceptor();
    this.client.interceptors.request.use(
      authInterceptor.request,
      authInterceptor.error
    );
    this.client.interceptors.response.use(
      authInterceptor.response,
      authInterceptor.error
    );
  }

  async initialiseCorpus(corpus: CorpusInfo): Promise<void> {
    const googleDriveAuthService = await getGoogleDriveAuthService();
    const googleDriveOauthToken = await googleDriveAuthService.getAccessToken();
    await this.client.put('/corpus/initialise', {
      provider_credentials: {
        google_drive: {
          oauth_token: googleDriveOauthToken,
        },
      },
      corpus_location: {
        provider: corpus.provider,
        engine: corpus.engine,
        database_file_location: {
          provider: corpus.location.provider,
          file_id: corpus.location.fileId,
        },
      },
    });
  }

  async addToIngestQueue(
    corpus: CorpusInfo,
    fileActions: { action: 'add_or_replace'; location: ExternalLocationType }[]
  ): Promise<void> {
    const googleDriveAuthService = await getGoogleDriveAuthService();
    const googleDriveOauthToken = await googleDriveAuthService.getAccessToken();
    await this.client.put('/corpus/ingest_queue', {
      provider_credentials: {
        google_drive: {
          oauth_token: googleDriveOauthToken,
        },
      },
      corpus_location: {
        provider: corpus.provider,
        engine: corpus.engine,
        database_file_location: {
          provider: corpus.location.provider,
          file_id: corpus.location.fileId,
        },
      },
      fileActions,
    });
  }

  async deleteCorpus(corpus: CorpusInfo): Promise<void> {
    const googleDriveAuthService = await getGoogleDriveAuthService();
    const googleDriveOauthToken = await googleDriveAuthService.getAccessToken();
    await this.client.put('/corpus/delete', {
      provider_credentials: {
        google_drive: {
          oauth_token: googleDriveOauthToken,
        },
      },
      corpus_location: {
        provider: corpus.provider,
        engine: corpus.engine,
        database_file_location: {
          provider: corpus.location.provider,
          file_id: corpus.location.fileId,
        },
      },
    });
  }
}

export const createRagApiClient = () => new RagApiClient();
