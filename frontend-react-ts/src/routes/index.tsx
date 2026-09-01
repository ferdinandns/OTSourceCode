import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Routes, Route, Navigate, Outlet } from "react-router-dom";

import Register from "../views/auth/register.tsx";
import Login from "../views/auth/login.tsx";
import Dashboard from '../views/admin/dashboard/index.tsx';
import UsersIndex from '../views/admin/users/index.tsx';
import UsersCreate from '../views/admin/users/create.tsx';
import UsersEdit from '../views/admin/users/edit.tsx';
import InstrumentList from '../views/instruments/InstrumentList.tsx';
import InstrumentCreate from '../views/instruments/InstrumentCreate.tsx';
import InstrumentEdit from '../views/instruments/InstrumentEdit.tsx';
import ReadInstrumentPage from '../components/ReadInstrumentPage.tsx';
import InstrumentView from '../views/instruments/InstrumentView.tsx';
import InstrumentConfig from '../views/instruments/InstrumentConfig.tsx';
import VerificationList from '../views/verification/VerificationList.tsx';
import ProductList from '../views/products/ProductList.tsx';
import ProductCreate from '../views/products/ProductCreate.tsx';
import ProductEdit from '../views/products/ProductEdit.tsx';
import PendingApprovalPage from "../views/instruments/PendingApprovalPage";
import DynamicVerificationStart from '../views/verification/DynamicVerificationStart';
import ReadInstrumentNameList from '../views/read-instrument/ReadInstrumentNameList.tsx';
import ReadInstrumentCodeList from '../views/read-instrument/ReadInstrumentCodeList.tsx';
import AdminChecklistWrapper from '../views/admin/checklist/AdminChecklistWrapper.tsx';
import BridgePCList from '../views/admin/bridge/BridgePCList.tsx';
import BridgePCCreate from '../views/admin/bridge/BridgePCCreate.tsx';
import BridgePCDetail from '../views/admin/bridge/BridgePCDetail.tsx';
import AfterReadingPage from '../views/instruments/AfterReadingPage.tsx';
import AuditLogPage from '../views/admin/audit/AuditLogPage.tsx';
import EditVerificationSteps from '../views/verification/EditVerificationSteps.tsx';
import ProfileEdit from '../views/auth/profile.tsx';
import { RequirePasswordChange } from '../components/RequirePasswordChange.tsx';
import { ChangePasswordPage } from '../components/ChangePasswordPage.tsx';
import ForgotPassword from '../views/auth/forgotpassword.tsx';
import ResetPassword from '../views/auth/resetpassword.tsx';
// ─────────────────────────────────────────────────────────────────────────────
// Route Guards
// ─────────────────────────────────────────────────────────────────────────────

/** Any authenticated user */
function ProtectedRoute() {
  const auth = useContext(AuthContext);
  return (auth?.isAuthenticated ?? false) ? <Outlet /> : <Navigate to="/" replace />;
}

/** Only users whose group number <= maxGroup can enter.
 *  Others are redirected to /admin/dashboard with an unauthorised state. */
function GroupRoute({ maxGroup }: { maxGroup: number }) {
  const auth = useContext(AuthContext);
  if (!(auth?.isAuthenticated ?? false)) return <Navigate to="/" replace />;
  const group = auth?.user?.user_group ?? 99;
  return group <= maxGroup ? <Outlet /> : <Navigate to="/admin/dashboard" replace state={{ unauthorised: true }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route tree
// ─────────────────────────────────────────────────────────────────────────────

export default function AppRoutes() {
  const auth = useContext(AuthContext);
  const isAuthenticated = auth?.isAuthenticated ?? false;

  return (
    <Routes>
      {/* ── Public ─────────────────────────────────────────────────────── */}
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/admin/dashboard" replace /> : <Login />}
      />
      <Route
        path="/register"
        element={isAuthenticated ? <Navigate to="/admin/dashboard" replace /> : <Register />}
      />

      {/* ── Req 2: force password change before accessing any protected page */}
      {/* /change-password sits OUTSIDE RequirePasswordChange so it stays reachable */}
      <Route path="/change-password" element={<ProtectedRoute />}>
        <Route index element={<ChangePasswordPage />} />
      </Route>

      <Route
  path="/forgot-password"
  element={isAuthenticated ? <Navigate to="/admin/dashboard" replace /> : <ForgotPassword />}
/>
<Route
  path="/reset-password"
  element={isAuthenticated ? <Navigate to="/admin/dashboard" replace /> : <ResetPassword />}
/>

      {/* ── All protected routes wrapped by RequirePasswordChange ─────── */}
      {/* If must_change_password === true, every route below redirects to  */}
      {/* /change-password until the user sets a new password.             */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RequirePasswordChange />}>

          {/* ── Admin (group <= 3: superadmin + managers + supervisors) ── */}
          <Route path="/admin" element={<GroupRoute maxGroup={5} />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="users" element={<UsersIndex />} />
            <Route path="users/create" element={<UsersCreate />} />
            <Route path="users/edit/:id" element={<UsersEdit />} />
            <Route path="checklist" element={<AdminChecklistWrapper />} />
          </Route>

          {/* Dashboard also accessible to supervisors (group <= 3) */}
          <Route path="/admin/dashboard" element={<Dashboard />} />

          {/* ── Bridge management ────────────────────────────────────── */}
          <Route path="/bridge" element={<GroupRoute maxGroup={4} />}>
            <Route path="pcs" element={<BridgePCList />} />
            <Route path="register" element={<BridgePCCreate />} />
            <Route path="pcs/:pcId" element={<BridgePCDetail />} />
          </Route>

          {/* ── Instruments ──────────────────────────────────────────── */}
          <Route path="/instruments">
            <Route index element={<InstrumentList />} />
            <Route path=":id" element={<InstrumentView />} />
            <Route path="read/:id" element={<ReadInstrumentPage />} />
            <Route path="after-reading/:usageId" element={<AfterReadingPage />} />
            <Route path="pending-approvals" element={<GroupRoute maxGroup={3} />}>
              <Route index element={<PendingApprovalPage />} />
            </Route>
            <Route element={<GroupRoute maxGroup={4} />}>
              <Route path="create" element={<InstrumentCreate />} />
              <Route path="edit/:id" element={<InstrumentEdit />} />
              <Route path="config/:id" element={<InstrumentConfig />} />
            </Route>
          </Route>

          {/* ── Read Instrument ──────────────────────────────────────── */}
          <Route path="/read-instrument">
            <Route path=":category" element={<ReadInstrumentNameList />} />
            <Route path=":category/:nama" element={<ReadInstrumentCodeList />} />
          </Route>

          {/* ── Verifications ────────────────────────────────────────── */}
          <Route path="/verifications">
            <Route index element={<VerificationList />} />
            <Route path="start/:id" element={<DynamicVerificationStart />} />
            <Route path="edit-steps/:instrumentType" element={<EditVerificationSteps />} />
          </Route>

          {/* ── Products ─────────────────────────────────────────────── */}
          <Route path="/products">
            <Route index element={<ProductList />} />
            <Route path=":id" element={<ProductEdit />} />
            <Route element={<GroupRoute maxGroup={4} />}>
              <Route path="create" element={<ProductCreate />} />
              <Route path="edit/:id" element={<ProductEdit />} />
            </Route>
          </Route>

          {/* ── Audit Trail ──────────────────────────────────────────── */}
          <Route path="/audit">
            <Route index element={<AuditLogPage />} />
          </Route>

          {/* ── Profile ──────────────────────────────────────────────── */}
          <Route path="/profile">
            <Route index element={<ProfileEdit />} />
          </Route>

        </Route>{/* end RequirePasswordChange */}
      </Route>{/* end ProtectedRoute */}

      {/* ── 404 ──────────────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}