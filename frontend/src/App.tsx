import { BrowserRouter, Routes, Route } from "react-router-dom"
import Layout from "./components/layout/Layout"
import Login from "./pages/Login"
import ProtectedRoute from "./routes/ProtectedRoute"
import RoleRoute from "./routes/RoleRoute"
import UserManagement from "./pages/UserManagement"
import DiversifikasiRM from "./pages/DiversifikasiRM"
import DiversifikasiPM from "./pages/DiversifikasiPM"
import ActivityLog from "./pages/ActivityLog"
import Dashboard from "./pages/Dashboard"
import RecycleBin from "./pages/RecycleBin"
  
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/diversifikasirm"
          element={
            <ProtectedRoute>
              <RoleRoute allowedDivisions={["TS", "Admin", "CPro", "QC", "Andev"]}>
                <Layout>
                  <DiversifikasiRM />
                </Layout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/diversifikasipm"
          element={
            <ProtectedRoute>
              <RoleRoute allowedDivisions={["TS", "Admin", "CPro", "QC", "Andev"]}>
                <Layout>
                  <DiversifikasiPM />
                </Layout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/activity-log"
          element={
            <ProtectedRoute>
              <RoleRoute allowedDivisions={["Admin"]}>
                <Layout>
                  <ActivityLog />
                </Layout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/user-management"
          element={
            <ProtectedRoute>
              <RoleRoute allowedDivisions={["Admin"]}>
                <Layout>
                  <UserManagement />
                </Layout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/recycle-bin"
          element={
            <ProtectedRoute>
              <RoleRoute allowedDivisions={["Admin"]}>
                <Layout>
                  <RecycleBin />
                </Layout>
              </RoleRoute>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App