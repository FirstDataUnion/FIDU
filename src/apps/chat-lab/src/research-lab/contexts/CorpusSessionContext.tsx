import { createContext } from 'react';
import type { Corpus, CorpusConversation, CorpusSource } from '../types/local';
import { useContext } from 'react';

export interface CorpusSessionContextValue {
  corpus?: Corpus;
  conversationInfo?: {
    conversations: CorpusConversation[];
  };
  sourceInfo?: {
    allSourcesSelected: boolean;
    setAllSourcesSelected: (allSourcesSelected: boolean) => void;
    sources: CorpusSource[];
    sourceSelection: Record<string, boolean>;
    setSourceSelection: (sourceId: string, selected: boolean) => void;
    clearSourceSelection: () => void;
    sourceStringId: (source: CorpusSource) => string;
    pollIngestQueueStatus: () => void;
    ingestQueueSourcesRemaining: number;
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
