import React, { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ToastProvider } from "./context/ToastContext";
import { AppLayout } from "./components/layout/AppLayout";

// Auth (eagerly loaded for instantaneous login page render)
import Login from "./pages/auth/Login";

// Manager Pages (Lazy-loaded chunks for optimal performance)
const ManagerOverview = lazy(() => import("./pages/manager/ManagerOverview"));
const ManagerProjects = lazy(() => import("./pages/manager/ManagerProjects"));
const ManagerTeam = lazy(() => import("./pages/manager/ManagerTeam"));
const ManagerAssignments = lazy(() => import("./pages/manager/ManagerAssignments"));
const ManagerBugs = lazy(() => import("./pages/manager/ManagerBugs"));
const ManagerBugList = lazy(() => import("./pages/manager/ManagerBugList"));

// Tester Pages (Lazy-loaded chunks for optimal performance)
const TesterOverview = lazy(() => import("./pages/tester/TesterOverview"));
const TesterProjects = lazy(() => import("./pages/tester/TesterProjects"));
const TesterProgress = lazy(() => import("./pages/tester/TesterProgress"));
const TesterBugs = lazy(() => import("./pages/tester/TesterBugs"));
const TesterBugList = lazy(() => import("./pages/tester/TesterBugList"));

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return true;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    if (!payload.exp) return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function ProtectedRoute({ allowedRole, children }) {
  const token = sessionStorage.getItem("access_token");
  const role = sessionStorage.getItem("role");

  if (!token || isTokenExpired(token)) {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("role");
    return <Navigate to="/" replace />;
  }
  if (role !== allowedRole) return <Navigate to="/" replace />;

  return children;
}

function App() {
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <Routes>
          {/* Public Login Route */}
          <Route path="/" element={<Login />} />

          {/* Manager Workspace Sub-routes */}
          <Route
            path="/manager"
            element={
              <ProtectedRoute allowedRole="manager">
                <AppLayout role="manager" />
              </ProtectedRoute>
            }
          >
            <Route index element={<ManagerOverview />} />
            <Route path="projects" element={<ManagerProjects />} />
            <Route path="team" element={<ManagerTeam />} />
            <Route path="assignments" element={<ManagerAssignments />} />
            <Route path="bugs" element={<ManagerBugs />} />
            <Route path="bug-list" element={<ManagerBugList />} />
            <Route path="reported-bugs" element={<ManagerBugList />} />
          </Route>

          {/* Tester Workspace Sub-routes */}
          <Route
            path="/tester"
            element={
              <ProtectedRoute allowedRole="tester">
                <AppLayout role="tester" />
              </ProtectedRoute>
            }
          >
            <Route index element={<TesterOverview />} />
            <Route path="projects" element={<TesterProjects />} />
            <Route path="progress" element={<TesterProgress />} />
            <Route path="bugs" element={<TesterBugs />} />
            <Route path="bug-list" element={<TesterBugList />} />
            <Route path="reported-bugs" element={<TesterBugList />} />
          </Route>

          {/* Fallback to Login */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ToastProvider>
  );
}

export default App;
