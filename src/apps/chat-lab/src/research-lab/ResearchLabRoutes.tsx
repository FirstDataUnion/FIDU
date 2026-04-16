import { Routes, Route, Outlet, useParams } from 'react-router-dom';
import { FeatureFlagGuard } from '../components/common/FeatureFlagGuard';
import ResearchLabPage from './pages/ResearchLabPage';
import CorpusPage from './pages/CorpusPage';

function CorpusIndexPanel() {
  return <div>Select a conversation</div>;
}

function CorpusConversationPanel() {
  const { conversationId } = useParams();
  return <div>Conversation view {conversationId}</div>;
}

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

        <Route path="corpora/:corpusId" element={<CorpusPage />}>
          <Route index element={<CorpusIndexPanel />} />
          <Route
            path="conversations/:conversationId"
            element={<CorpusConversationPanel />}
          />
        </Route>
      </Route>
    </Routes>
  );
}
