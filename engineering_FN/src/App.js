import { useSelector } from "react-redux";
import { Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { Link } from 'react-router-dom';
import './index.css'
import Navbar from "./components/Navbar";
import Maintenance from "./pages/Maintenance";
import Pareto from "./pages/ParetoData";
import Instrument from "./pages/Instrument";
import CreateNew from "./pages/CreateNew";
import CreateEdit from "./pages/CreateEdit";
import AppPareto from "./pages/building";
import Login from "./pages/Login";
import Loginasli from "./pages/Loginasli"
import Register from "./pages/Register";
import { CheckLogin } from "./features/part/userSlice";
import { useDispatch } from "react-redux";
import { useEffect, useState } from "react";
import CheckMail from "./pages/CheckMail";
import EditProfile from "./pages/EditProfile";
import Production from "./pages/Production";
import App1 from "./pages/LandingProduction";
import AvabilityOPE from "./pages/AvabilityOPE";
import AvabilityMachine from "./pages/AvabilityMachine";
import Admin from "./pages/Admin";
import Sidebar from "./components/Sidebar";
import OEEline from "./pages/OEEline";
import Utility from "./pages/Utility";
import Stopwatch from "./pages/Stopwatch";
import MachineHistorical from "./pages/MachineHistorical";
import BatchRecord from "./pages/BatchRecord";
import HistoryTabel from "./pages/HistoryTabel";
import LandingPage from "./pages/LandingPage";
import ResetPass from "./pages/ResetPass";
import Dashboard from "./pages/Dashboard";
import Chat from "./components/Chat";
import Header from "./components/header";

import UploadComponent from './pages/CMMS/InputPWO';
import CheckPWO from './pages/CMMS/TechnicianPage';
import TechnicianPage from "./pages/CMMS/TechnicianPage";
import OperationsManager from "./pages/CMMS/OperationsManager";
import PMPUploader from "./pages/CMMS/PMPUploader";
import DailyAssignmentPage from './pages/CMMS/DailyAssignmentPage';
import MachineManager from "./pages/CMMS/MachineManager";
import CompletedJobsPage from "./pages/CMMS/CompletedJobs";
import EBRDataExporter from "./pages/CMMS/EBRDataExporter";
import ServiceRequestForm from "./pages/CMMS/WorkOrderPages";
import SupervisorApproval from "./pages/CMMS/ApprovalPage";
import TechnicianDashboard from "./pages/CMMS/TechnicianDashboard";
import ProfileManager from "./pages/CMMS/ProfileManager";
import VortexChart from "./pages/SteamControl";
// import Dashboard2 from "./pages/Dashboard2";
// import Dashboard3 from "./pages/Dashboard3";
import OeeDashboard from "./pages/OEE/OEETest";
import TestImport from "./pages/CMMS/testimport";
import FetteLogs from "./pages/OEE/FetteLogs";
import DowntimeDashboard from "./pages/OEE/DowntimeEvents";
import ETLManager from "./pages/OEE/ETLManager";
// import ShiftStatsDisplay from "./pages/OEE/DowntimeDisplay";
import EventDrillDownModal from "./pages/OEE/DowntimeDrillDown";
import HybridDowntimeManager from "./pages/OEE/HybridDowntime";
import ParetoChartFette from "./pages/OEE/ParetoChartFette";
import AuditNavigator from "./pages/OEE/AuditNavigator";
import OverrideAuditView from "./pages/OEE/FetteAuditView";
import DayOverrideManager from "./pages/OEE/FetteOverride2";
import FetteOeeDashboard from "./pages/OEE/OEETest2";
import MachineDashboard from "./pages/DataMonitor";
import DataIntegrityDashboard from "./pages/DataIntegrity";
import WH2Dashboard from "./pages/Warehouse2/buildingWH2";
import BatchReportPreview from "./pages/DataExtractor/BatchReportPreview";
import BatchPage from "./pages/DataExtractor/ParentPage";
import VibrationDashboard from "./pages/CMVibration";
import WorkOrderUploader from "./pages/CMMS/WorkOrderUploader";
import WorkOrderDashboard from "./pages/CMMS/NewTechnicianPage";
import InventoryTable from "./pages/Sparepart/SparepartInventory";
import SparepartLogForm from "./pages/Sparepart/SparepartForm";
import SparepartLogs from "./pages/Sparepart/SparepartInventoryLogs";
import GranulationReport from "./pages/BatchRecNEW/BatchRecNew"; 
import WH2AuditLogs from "./pages/Warehouse2/WH2AuditLogs";
import WH2UserManagement from "./pages/Warehouse2/WH2UserManagement";

import SparepartNonInventory from "./pages/Sparepart/SparepartNonInventory";
import SparepartNonInventoryLogs from "./pages/Sparepart/SparepartNonInventoryLogs";
import SparepartDashboardWrapper from "./pages/Sparepart/SparepartDashboard";

import PmaDashboard from "./pages/PMAVibrationQCC/PMADashboard";


function App() {
  const dispatch = useDispatch();
  const location = useLocation();
  
  // 1. Grab data synchronously from storage (READING)
  const userToken = localStorage.getItem("user_token");
  const storedLevel = localStorage.getItem("user_level"); 
  
  // 2. Initialize state IMMEDIATELY
  const [levelData, setLevelData] = useState(storedLevel ? Number(storedLevel) : null);

  // KEEP LOGIN CHECKER
  const keepLogin = () => {
    if (userToken) {
      dispatch(CheckLogin(userToken));
    }
  };

  useEffect(() => {
    // Keep state updated if storage changes on future renders
    if (storedLevel) {
      setLevelData(Number(storedLevel));
    }
    keepLogin();
  }, [storedLevel, userToken]);

  if (location.pathname === "/") {
    // Separate layout for landing page, without grid
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />

      </Routes>
    );
  }

  if (location.pathname === "/login") {
    // Separate layout for landing page, without grid
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }
  if (location.pathname === "/register") {
    // Separate layout for landing page, without grid
    return (
      <Routes>
        <Route path="/register" element={<Register />} />
      </Routes>
    );
  }
  if (location.pathname === "/resetpass") {
    // Separate layout for landing page, without grid
    return (
      <Routes>
        <Route path="/resetpass" element={<ResetPass />} />
      </Routes>
    );
  }

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-[80vh] w-full text-center">
      <h1 className="text-6xl font-bold text-red-500 mb-4">403</h1>
      <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
      <p className="text-gray-500 mb-8 max-w-md text-lg">
        You do not have the required permissions to view this page. If you believe this is a mistake, please contact your administrator.
      </p>
      
      {/* The dynamic "Go Back" button */}
      <button 
        onClick={() => navigate(-1)}
        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium shadow-sm"
      >
        Go Back
      </button>
    </div>
  );
};

  if (levelData === 5) {
    return (
      <div className="bg-background min-h-screen min-w-full grid grid-cols-[auto_1fr] ">
        <>
          <Sidebar /> 
        </>

        {/* Wrapper untuk Header + Konten */}
        <div className="grid grid-rows-[auto_1fr] min-h-screen">
          
          {/* Header */}
          <>
            <Header />
          </>

          {/* Konten Utama */}
          {/* Routes to change the URL Path */}
          <div className="overflow-x-auto">
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/Instrument" element={<Instrument />} />
              <Route path="/pareto" element={<Pareto />} />
              <Route path="/createnew" element={<CreateNew />} />
              <Route path="/createedite/:id" element={<CreateEdit />} />
              <Route path="/building" element={<AppPareto />} />
              <Route path="/WH2Dashboard" element={<WH2Dashboard />} />
              <Route path="/mail" element={<CheckMail />} />
              <Route path="/editprofile" element={<EditProfile />} />
              <Route path="/production" element={<Production />} />
              <Route path="/OPE" element={<App1 />} />
              <Route path="/avabilityope" element={<AvabilityOPE />} />
              <Route path="/avabilitmachine" element={<AvabilityMachine />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/oeeLine" element={<OEEline />} />
              <Route path="/utility" element={<Utility />} />
              <Route path="/Stopwatch" element={<Stopwatch />} />
              <Route path="/HistoricalMachine" element={<MachineHistorical />} />
              <Route path="/BatchRecord" element={<BatchRecord />} />
              <Route path="/HistoryTabel" element={<HistoryTabel />} />
              <Route path="/PWOInput" element={<UploadComponent />} />
              <Route path="/TechnicianPage" element={<TechnicianPage />} />
              <Route path="/MasterPMP" element={<OperationsManager />} />
              <Route path="/PMPUploader" element={<PMPUploader />} />
              <Route path="/assign-jobs" element={<DailyAssignmentPage />} />
              <Route path="/MachineManager" element={<MachineManager />} />
              <Route path="/CompletedJobs" element={<CompletedJobsPage />} />
              <Route path="/ebr-data-exporter" element={<EBRDataExporter />} />
              <Route path="/work-orders" element={<ServiceRequestForm />} />
              <Route path="/supervisor-approval" element={<SupervisorApproval />} />
              <Route path="/TechnicianDashboard" element={<TechnicianDashboard />} />
              <Route path="/ProfileManager" element={<ProfileManager />} />
              <Route path="/SteamControl" element={<VortexChart />} />
              <Route path="/OeeDashboard" element={<OeeDashboard />} />
              <Route path="/TestImport" element={<TestImport />} />
              <Route path="/FetteLogs" element={<FetteLogs />} />
              <Route path="/DowntimeDashboard" element={<DowntimeDashboard />} />
              <Route path="/ETLManager" element={<ETLManager />} />
              <Route path="/HybridDowntime" element={<HybridDowntimeManager />} />
              <Route path="/OverrideAuditView" element={<OverrideAuditView />} />
              <Route path="/DayOverrideManager" element={<DayOverrideManager />} />

              <Route path="/FetteOeeDashboard" element={<FetteOeeDashboard />} />
              <Route path="/DataMonitor" element={<MachineDashboard />} />
              <Route path="/DataIntegrity" element={<DataIntegrityDashboard />} />
              <Route path="/BatchReportPreview" element={<BatchReportPreview />} />
              <Route path="/BatchPage" element={<BatchPage />} />
              <Route path="/CMVibration" element={<VibrationDashboard />} />
              <Route path="/WorkOrderUploader" element={<WorkOrderUploader />} />
              <Route path="/workorderdashboard" element={<WorkOrderDashboard />} />
              <Route path="/SparepartInventory" element={<InventoryTable />} />
              <Route path="/sparepartform" element={<SparepartLogForm />} />
              <Route path="/sparepartlogs" element={<SparepartLogs />} />
              <Route path="/granulation-batch-record" element={<GranulationReport />} />
              
              <Route path="/WH2AuditLogs" element={<WH2AuditLogs />} />
              <Route path="/WH2UserManagement" element={<WH2UserManagement />} />

              <Route path="/SparepartInventory" element={<InventoryTable />} />
              <Route path="/sparepartform" element={<SparepartLogForm />} />
              <Route path="/sparepartlogs" element={<SparepartLogs />} />
              <Route path="/SparepartNonInventory" element={<SparepartNonInventory />} />
              <Route path="/SparepartNonInventoryLogs" element={<SparepartNonInventoryLogs />} />
              <Route path="/SparepartDashboard" element={<SparepartDashboardWrapper />} />

              <Route path="/PMADashboard" element={<PmaDashboard />} />


              
            </Routes>
          </div>
        </div>
        <>
         {/* Disabled Chatbot Button, delete comment to enable
          <Chat />
          */}
        </>
      </div>
    );
  } else if (levelData === 4) {
    return (
      <div className="bg-background min-h-screen min-w-full grid grid-cols-[auto_1fr] ">
        <>
          <Sidebar /> 
        </>

        {/* Wrapper untuk Header + Konten */}
        <div className="grid grid-rows-[auto_1fr] min-h-screen">
          
          {/* Header */}
          <>
            <Header />
          </>
          <div className="overflow-x-auto">
            {/* <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/Instrument" element={<Instrument />} />
              <Route path="/pareto" element={<Pareto />} />
              <Route path="/createnew" element={<CreateNew />} />
              <Route path="/createedite/:id" element={<CreateEdit />} />
              <Route path="/building" element={<AppPareto />} />
              <Route path="/mail" element={<CheckMail />} />
              <Route path="/editprofile" element={<EditProfile />} />
              <Route path="/production" element={<Production />} />
              <Route path="/HistoricalMachine" element={<MachineHistorical />} />
              <Route path="/avabilityope" element={<AvabilityOPE />} />
              <Route path="/avabilitmachine" element={<AvabilityMachine />} />
              <Route path="/oeeLine" element={<OEEline />} />
              <Route path="/utility" element={<Utility />} />
              <Route path="/Stopwatch" element={<Stopwatch />} />
              
              <Route path="/TechnicianPage" element={<TechnicianPage />} />
              <Route path="/CompletedJobs" element={<CompletedJobsPage />} />
              <Route path="/TechnicianDashboard" element={<TechnicianDashboard />} />
              <Route path="/workorderdashboard" element={<WorkOrderDashboard />} />
              <Route path="/granulation-batch-record" element={<GranulationReport />} />
              */}
              

              <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/Instrument" element={<Instrument />} />
              <Route path="/pareto" element={<Pareto />} />
              <Route path="/createnew" element={<CreateNew />} />
              <Route path="/createedite/:id" element={<CreateEdit />} />
              <Route path="/building" element={<AppPareto />} />
              {/* <Route path="/WH2Dashboard" element={<WH2Dashboard />} /> */}
              <Route path="/mail" element={<CheckMail />} />
              <Route path="/editprofile" element={<EditProfile />} />
              <Route path="/production" element={<Production />} />
              <Route path="/OPE" element={<App1 />} />
              <Route path="/avabilityope" element={<AvabilityOPE />} />
              <Route path="/avabilitmachine" element={<AvabilityMachine />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/oeeLine" element={<OEEline />} />
              <Route path="/utility" element={<Utility />} />
              <Route path="/Stopwatch" element={<Stopwatch />} />
              <Route path="/HistoricalMachine" element={<MachineHistorical />} />
              <Route path="/BatchRecord" element={<BatchRecord />} />
              <Route path="/HistoryTabel" element={<HistoryTabel />} />
              <Route path="/PWOInput" element={<UploadComponent />} />
              <Route path="/TechnicianPage" element={<TechnicianPage />} />
              <Route path="/MasterPMP" element={<OperationsManager />} />
              <Route path="/PMPUploader" element={<PMPUploader />} />
              <Route path="/assign-jobs" element={<DailyAssignmentPage />} />
              <Route path="/MachineManager" element={<MachineManager />} />
              <Route path="/CompletedJobs" element={<CompletedJobsPage />} />
              <Route path="/ebr-data-exporter" element={<EBRDataExporter />} />
              <Route path="/work-orders" element={<ServiceRequestForm />} />
              <Route path="/supervisor-approval" element={<SupervisorApproval />} />
              <Route path="/TechnicianDashboard" element={<TechnicianDashboard />} />
              <Route path="/ProfileManager" element={<ProfileManager />} />
              <Route path="/SteamControl" element={<VortexChart />} />
              <Route path="/OeeDashboard" element={<OeeDashboard />} />
              <Route path="/TestImport" element={<TestImport />} />
              <Route path="/FetteLogs" element={<FetteLogs />} />
              <Route path="/DowntimeDashboard" element={<DowntimeDashboard />} />
              <Route path="/ETLManager" element={<ETLManager />} />
              <Route path="/HybridDowntime" element={<HybridDowntimeManager />} />
              <Route path="/OverrideAuditView" element={<OverrideAuditView />} />
              <Route path="/DayOverrideManager" element={<DayOverrideManager />} />

              <Route path="/FetteOeeDashboard" element={<FetteOeeDashboard />} />
              <Route path="/DataMonitor" element={<MachineDashboard />} />
              <Route path="/DataIntegrity" element={<DataIntegrityDashboard />} />
              <Route path="/BatchReportPreview" element={<BatchReportPreview />} />
              <Route path="/BatchPage" element={<BatchPage />} />
              <Route path="/CMVibration" element={<VibrationDashboard />} />
              <Route path="/WorkOrderUploader" element={<WorkOrderUploader />} />
              <Route path="/workorderdashboard" element={<WorkOrderDashboard />} />
              <Route path="/SparepartInventory" element={<InventoryTable />} />
              <Route path="/sparepartform" element={<SparepartLogForm />} />
              <Route path="/sparepartlogs" element={<SparepartLogs />} />
              <Route path="/granulation-batch-record" element={<GranulationReport />} />
              
              {/* <Route path="/WH2AuditLogs" element={<WH2AuditLogs />} /> */} 
              {/* <Route path="/WH2UserManagement" element={<WH2UserManagement />} /> */}

              <Route path="/SparepartInventory" element={<InventoryTable />} />
              <Route path="/sparepartform" element={<SparepartLogForm />} />
              <Route path="/sparepartlogs" element={<SparepartLogs />} />
              <Route path="/SparepartNonInventory" element={<SparepartNonInventory />} />
              <Route path="/SparepartNonInventoryLogs" element={<SparepartNonInventoryLogs />} />
              <Route path="/SparepartDashboard" element={<SparepartDashboardWrapper />} />
              <Route path="*" element={<Unauthorized />} />
            </Routes>
          </div>
        </div>
        <>
          <Chat />
        </>
      </div>
    );
  } if (levelData == 3) {
    return (
      <div className="bg-background min-h-screen min-w-full grid grid-cols-[auto_1fr] ">
        <>
          <Sidebar /> 
        </>
        <div className="grid grid-rows-[auto_1fr] min-h-screen">
          <>
            <Header />
          </>
          <div className="overflow-x-auto">
            <Routes>
              {/* <Route path="/" element={<Login />} /> */}
              <Route path="/createnew" element={<CreateNew />} />
              <Route path="/createedite/:id" element={<CreateEdit />} />
              <Route path="/editprofile" element={<EditProfile />} />
              <Route path="/granulation-batch-record" element={<GranulationReport />} />
              <Route path="*" element={<Unauthorized />} />
            </Routes>
          </div>
        </div>
        <>
         {/* Disabled Chatbot Button, delete comment to enable
          <Chat />
          */}
        </> 
      </div>
    );
  } else if (levelData === 2) {
    return (
      <div className="bg-background min-h-screen min-w-full grid grid-cols-[auto_1fr] ">
        <>
          <Sidebar /> 
        </>
        <div className="grid grid-rows-[auto_1fr] min-h-screen">
          <>
            <Header />
          </>
          <div className="overflow-x-auto">
            <Routes>
              {/* <Route path="/" element={<Login />} /> */}
              <Route path="/ETLManager" element={<ETLManager />} />
              <Route path="/HybridDowntime" element={<HybridDowntimeManager />} />
              <Route path="/FetteOeeDashboard" element={<FetteOeeDashboard />} />
              {/* <Route path="/WH2Dashboard" element={<WH2Dashboard />} /> */}

              
            </Routes>
          </div>
        </div>
        <>
          <Chat />
        </> 
      </div>
    );
  } else if (levelData === 1) {
    return (
      <div className="bg-background min-h-screen min-w-full grid grid-cols-[auto_1fr] ">
        <>
          <Sidebar /> 
        </>
        <div className="grid grid-rows-[auto_1fr] min-h-screen">
          <>
            <Header />
          </>
          <div className="overflow-x-auto">
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/maintenance" element={<Maintenance />} />
            </Routes>
          </div>
        </div>
        <>
          <Chat />
        </> 
      </div>
    );
  } else {
    return (
      <div className="bg-background min-h-screen min-w-full grid grid-cols-[auto_1fr] ">
        <>
          <Sidebar /> 
        </>
        <div className="grid grid-rows-[auto_1fr] min-h-screen">
          <>
            <Header />
          </>
          <div className="overflow-x-auto">
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/mail" element={<CheckMail />} />
              <Route path="/Stopwatch" element={<Stopwatch />} />            
            </Routes>
          </div>
        </div>
        <>
          <Chat />
        </>      
      </div>
    );
  }
  
}

export default App;
