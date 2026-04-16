import { createContext } from 'react';
import type { Corpus, CorpusSource } from '../types/local';
import { useContext } from 'react';

export interface CorpusSessionContextValue {
  corpus: Corpus;
  loading: boolean;
  sourceInfo: {
    allSourcesSelected: boolean;
    setAllSourcesSelected: (allSourcesSelected: boolean) => void;
    sources: CorpusSource[];
    sourceSelection: Record<string, boolean>;
    setSourceSelection: (sourceId: string, selected: boolean) => void;
    clearSourceSelection: () => void;
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
