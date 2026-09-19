import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AnalysisPage } from './features/analysis/AnalysisPage';
import { ChecklistPage } from './features/checklist/ChecklistPage';
import { FormLayout } from './features/workspace/FormLayout';
import { WorkspacePage } from './features/workspace/WorkspacePage';
import { ReviewPage } from './features/review/ReviewPage';
import { RetentionPage } from './features/upload/RetentionPage';
import { UploadPage } from './features/upload/UploadPage';
import { AppProvider } from './state/app';

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/retention" element={<RetentionPage />} />
          <Route path="/analysis/:jobId" element={<AnalysisPage />} />
          <Route path="/form/:formId" element={<FormLayout />}>
            <Route index element={<WorkspacePage />} />
            <Route path="checklist" element={<ChecklistPage />} />
            <Route path="review" element={<ReviewPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
