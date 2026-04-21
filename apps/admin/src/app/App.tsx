import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { PresetsPage } from "../routes/PresetsPage";
import { RunDetailPage } from "../routes/RunDetailPage";
import { RunsPage } from "../routes/RunsPage";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/runs" replace />} />
            <Route path="runs" element={<RunsPage />} />
            <Route path="runs/:runId" element={<RunDetailPage />} />
            <Route path="presets" element={<PresetsPage />} />
            <Route path="*" element={<Navigate to="/runs" replace />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
