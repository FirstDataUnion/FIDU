import type { OpenRouterStreamChunk } from '../../types/openRouter';

export type ProviderCredentials = {
  google_drive?: {
    oauth_token: string;
  };
};

export type InitialiseCorpusRequest = {
  provider_credentials: ProviderCredentials;
  corpus_location: InitialiseCorpusLocation;
};

export type InitialiseCorpusLocation = {
  provider: 'fidu_rag';
  engine: 'cortexdb';
  name: string;
  parent: FileLocation;
};

export type InitialiseCorpusResponse = {
  message: string;
  location: FileLocation;
};

export type DeleteCorpusRequest = {
  provider_credentials: ProviderCredentials;
  corpus_location: CorpusLocation;
};

export type AppendToIngestQueueRequest = {
  provider_credentials: ProviderCredentials;
  corpus_location: CorpusLocation;
  files: { action: 'add_or_replace'; location: FileLocation }[];
};

export type CorpusIdentifyingRequest = {
  provider_credentials: ProviderCredentials;
  corpus_location: CorpusLocation;
};

export type CorpusLocation = {
  provider: 'fidu_rag';
  engine: 'cortexdb';
  database_file_location: FileLocation;
};

export type FileLocation =
  | {
      provider: 'google_drive';
      file_id: string;
    }
  | {
      provider: 'fidu_context';
      provider_id: string;
      title?: string;
      body?: string;
    }
  | {
      provider: 'url';
      url: string;
    };

export type Source = {
  id: SourceFileLocation;
  name: string;
  mime_type: string;
  added_at: string;
  last_ingested_at: string;
};

export type SourceFileLocation =
  | {
      provider: 'google_drive';
      file_id: string;
    }
  | {
      provider: 'url';
      url: string;
    }
  | {
      provider: 'fidu_context';
      provider_id: string;
    };

export type IngestQueueStatus = {
  queue_status: 'empty' | 'running' | 'completed';
  total_queue_size: number;
  remaining_queue_size: number;
};

// SSE events
export type SseEvent =
  | StartingProcessEvent
  | SearchResultsEvent
  | FiduError
  | OpenRouterStreamChunk;

export type StartingProcessEvent = {
  source: 'fidu_rag';
  type: 'starting_process';
  step_uuid: string;
  description: string;
};

export type SearchResultsEvent = {
  source: 'fidu_rag';
  type: 'search_results';
  step_uuid: string;
  search_results: CortexSearchResult[];
};

export type CortexSearchResult = {
  doc_id: string;
  score: number;
  content: string;
  chunk_metadata: Record<string, string>;
  document_metadata: Record<string, any>;
};

export type FiduError = {
  source: 'fidu_rag';
  type: 'error';
  error: string;
};
