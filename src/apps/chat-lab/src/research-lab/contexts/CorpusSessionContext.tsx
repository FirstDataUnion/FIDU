import { createContext } from 'react';
import type { ModelConfig } from '../../data/models';
import type {
  Corpus,
  CorpusConversation,
  CorpusMessage,
  CorpusSource,
  UrlCollection,
} from '../types/local';
import { useContext } from 'react';
import type { DriveFile } from '../../services/storage/drive/GoogleDriveService';
import type { IngestQueueError } from '../types/ragApi';

export interface CorpusSessionContextValue {
  corpus?: Corpus;
  corpusInfo?: {
    addUrlCollection: (
      collection: UrlCollection
    ) => Promise<Corpus | undefined>;
  };
  conversationInfo?: {
    conversations: CorpusConversation[];
    reloadConversations: () => Promise<void>;
    addMessages: (
      conversation: CorpusConversation,
      messages: CorpusMessage[]
    ) => Promise<CorpusConversation>;
    setConversationName: (
      conversation: CorpusConversation,
      name: string
    ) => Promise<CorpusConversation>;
  };
  sourceFetchError?: string;
  sourceInfo?: {
    allSourcesSelected: boolean;
    toggleAllSourcesSelected: () => void;
    sources: CorpusSource[];
    sourceSelection: Record<string, boolean>;
    reloadingSources: boolean;
    setSourceSelection: (sourceId: string, selected: boolean) => void;
    sourceStringId: (source: CorpusSource) => string;
    urlCollections: (UrlCollection & { fileMetadata: DriveFile })[];
  };
  ingestQueueInfo?: {
    remaining: number;
    pollingEnabled: boolean;
    ingestionErrors: IngestQueueError[];
    pollIngestQueueStatus: () => void;
  };
  modelInfo?: {
    models: ModelConfig[];
    selectedModelId: string;
    selectModel: (modelId: string) => void;
  };
  navigation: {
    showUpButton: (url: string) => void;
    showBackButton: () => void;
    clearActions: () => void;
  };
}

export const CorpusSessionContext =
  createContext<CorpusSessionContextValue | null>(null);

export function useCorpusSessionContext() {
  const context = useContext(CorpusSessionContext);
  if (!context) {
    throw new Error(
      'useCorpusSessionContext must be used within a CorpusSessionContextProvider'
    );
  }
  return context;
}
