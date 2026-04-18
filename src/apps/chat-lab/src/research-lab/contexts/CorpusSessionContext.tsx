import { createContext } from 'react';
import type {
  Corpus,
  CorpusConversation,
  CorpusMessage,
  CorpusSource,
} from '../types/local';
import { useContext } from 'react';

export interface CorpusSessionContextValue {
  corpus?: Corpus;
  conversationInfo?: {
    conversations: CorpusConversation[];
    reloadConversations: () => Promise<void>;
    addMessages: (
      conversation: CorpusConversation,
      messages: CorpusMessage[]
    ) => Promise<void>;
  };
  sourceInfo?: {
    allSourcesSelected: boolean;
    toggleAllSourcesSelected: () => void;
    sources: CorpusSource[];
    sourceSelection: Record<string, boolean>;
    setSourceSelection: (sourceId: string, selected: boolean) => void;
    sourceStringId: (source: CorpusSource) => string;
  };
  ingestQueueInfo?: {
    remaining: number;
    pollingEnabled: boolean;
    pollIngestQueueStatus: () => void;
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
