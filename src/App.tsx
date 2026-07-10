import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import ObjektePage from '@/pages/ObjektePage';
import ObjekteDetailPage from '@/pages/ObjekteDetailPage';
import MaengelPage from '@/pages/MaengelPage';
import MaengelDetailPage from '@/pages/MaengelDetailPage';
import PublicFormObjekte from '@/pages/public/PublicForm_Objekte';
import PublicFormMaengel from '@/pages/public/PublicForm_Maengel';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a4e5573dde6bff982c5f8a6" element={<PublicFormObjekte />} />
              <Route path="public/6a4e55767e157cea183ea30a" element={<PublicFormMaengel />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="objekte" element={<ObjektePage />} />
                <Route path="objekte/:id" element={<ObjekteDetailPage />} />
                <Route path="maengel" element={<MaengelPage />} />
                <Route path="maengel/:id" element={<MaengelDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
