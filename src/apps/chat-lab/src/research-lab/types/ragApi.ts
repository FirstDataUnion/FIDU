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

export type FileLocation = {
  provider: 'google_drive';
  file_id: string;
};
