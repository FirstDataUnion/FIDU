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
  | CorpusMessageRagInfo;

export interface CorpusMessageUser {
  type: 'user';
  content: string;
  sentAt: string;
}

export interface CorpusMessageModel {
  type: 'model';
  content: string;
  finishedAt: string;
}

export interface CorpusMessageRagInfo {
  type: 'rag-info';
}

export interface CorpusSource {
  id : CorpusSourceId;
  name: string;
  description: string;
  addedAt: string;
  lastIngestedAt: string;
}

export interface CorpusSourceId {
  provider: 'google_drive';
  fileId: string;
}
