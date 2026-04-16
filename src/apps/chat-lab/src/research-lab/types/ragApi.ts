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

export type CorpusIdentifyingRequest = {
  provider_credentials: ProviderCredentials;
  corpus_location: CorpusLocation;
};

export type CorpusLocation = {
  provider: 'fidu_rag';
  engine: 'cortexdb';
  database_file_location: FileLocation;
};

export type FileLocation = {
  provider: 'google_drive';
  file_id: string;
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
    };
