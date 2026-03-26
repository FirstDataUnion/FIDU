import { createSelector } from '@reduxjs/toolkit';
import type {
  Context,
  ContextCorpusDocument,
  ContextCorpusUrl,
  RootState,
} from '../../types';
import { selectorForFlagKey } from './featureFlagsSelectors';

const selectContextsState = (state: RootState) => state.contexts;

const selectContextsInternal = createSelector(
  [selectContextsState, selectorForFlagKey('rag')],
  (contextsState, isRagEnabled) =>
    isRagEnabled
      ? [
          ...contextsState.fiduContexts,
          ...contextsState.corpusDocuments.map(corpusDocToContext),
          ...contextsState.corpusUrls.map(corpusUrlToContext),
        ]
      : contextsState.fiduContexts
);

const selectContextBodies = createSelector(
  [selectContextsState],
  contextsState => contextsState.bodies
);

const selectContextsLoading = createSelector(
  [selectContextsState],
  contextsState => contextsState.loading
);

const selectContextsError = createSelector(
  [selectContextsState],
  contextsState => contextsState.error
);

export const selectContexts = createSelector(
  [
    selectContextsInternal,
    selectContextBodies,
    selectContextsLoading,
    selectContextsError,
  ],
  (contexts, bodies, loading, error) => ({
    contexts: contexts.map(context => ({
      ...context,
      body: context.body || bodies[context.id]?.body,
    })),
    loading,
    error,
  })
);

export const selectContextBodyLoadingById = createSelector(
  [selectContextsState, (_: RootState, contextId: string) => contextId],
  (contextsState, contextId) =>
    contextsState.bodies[contextId]?.loading ?? false
);

export const selectContextBodyErrorById = createSelector(
  [selectContextsState, (_: RootState, contextId: string) => contextId],
  (contextsState, contextId) => contextsState.bodies[contextId]?.error ?? null
);

function corpusDocToContext(corpusDoc: ContextCorpusDocument): Context {
  return {
    id: corpusDoc.id,
    title: corpusDoc.name,
    tokenCount: -1, // TODO: calculate token count?
    createdAt: corpusDoc.addedAt,
    updatedAt: corpusDoc.addedAt, // TODO: overwrite with ingestion timestamp
    tags: corpusDoc.tags,
    isBuiltIn: false,
  };
}

function corpusUrlToContext(corpusUrl: ContextCorpusUrl): Context {
  return {
    id: corpusUrl.id,
    title: corpusUrl.name,
    tokenCount: -1,
    createdAt: corpusUrl.addedAt,
    updatedAt: corpusUrl.addedAt, // TODO: overwrite with ingestion timestamp
    tags: corpusUrl.tags,
    isBuiltIn: false,
  };
}
