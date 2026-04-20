// These are the types as they exist in React memory
// They may or may not require conversion for storage/API use

export interface Corpus {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  lastOpenedAt: string;
  tags: string[];
  databaseLocation: {
    provider: 'google_drive';
    fileId: string;
    parentFolderId: string;
  };
}

export interface CorpusConversation {
  id: string;
  name: string;
  createdAt: string;
  lastOpenedAt: string;
  messages: CorpusMessage[];
}

export type CorpusMessage =
  | CorpusMessageUser
  | CorpusMessageModel
  | CorpusMessageRagInfo
  | CorpusMessageError;

export interface CorpusMessageUser {
  type: 'user';
  content: string;
  sentAt: string;
}

export interface CorpusMessageModel {
  type: 'model';
  model: string;
  content: string;
  finishedAt: string;
}

export interface CorpusMessageError {
  type: 'error';
  error: string;
}

export interface CorpusMessageRagInfo {
  type: 'rag-info';
  processes: string[];
  searchResults?: CortexSearchResult[];
}

export interface CortexSearchResult {
  documentId: string;
  score: number;
  content: string;
  chunkMetadata: Record<string, string>;
  documentMetadata: Record<string, any>;
}

export interface CorpusSource {
  id: CorpusSourceId;
  name: string;
  mimeType: string;
  addedAt: string;
  lastIngestedAt: string;
}

export type CorpusSourceId =
  | {
      provider: 'google_drive';
      fileId: string;
    }
  | {
      provider: 'url';
      url: string;
    }
  | {
      provider: 'fidu_context';
      providerId: string;
    };
