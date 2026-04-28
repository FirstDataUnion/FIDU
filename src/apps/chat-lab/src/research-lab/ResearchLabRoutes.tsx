import { Routes, Route, Outlet } from 'react-router-dom';
import { FeatureFlagGuard } from '../components/common/FeatureFlagGuard';
import ResearchLabPage from './pages/ResearchLabPage';
import CorpusPage from './pages/CorpusPage';
import SelectConversationPanel from './components/SelectConversationPanel';
import AddSourcePanel from './components/AddSourcePanel';
import CorpusConversationPanel from './components/CorpusConversationPanel';
import SourceContentPanel from './components/SourceContentPanel';
import IngestionErrorPanel from './components/IngestionErrorPanel';

export default function ResearchLabRoutes() {
  return (
    <Routes>
      <Route
        element={
          <FeatureFlagGuard
            featureFlag="research_lab"
            featureName="Research Lab"
          >
            <Outlet />
          </FeatureFlagGuard>
        }
      >
        <Route index element={<ResearchLabPage />} />

        <Route path="corpus/:corpusId" element={<CorpusPage />}>
          <Route index element={<SelectConversationPanel />} />
          <Route path="add-source" element={<AddSourcePanel />} />
          <Route
            path="source/:provider/:providerSpecificId"
            element={<SourceContentPanel />}
          />
          <Route
            path="conversations/:conversationId"
            element={<CorpusConversationPanel />}
          />
          <Route path="ingestion-errors" element={<IngestionErrorPanel />} />
        </Route>
      </Route>
    </Routes>
  );
}
