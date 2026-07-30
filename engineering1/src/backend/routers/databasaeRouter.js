const express = require("express");
const databaseControllers = require("../controllers/databaseControllers");


const routers = express.Router();
const { veryfyToken, checkRole } = require("../middleware/auth");

routers.get("/downtimeAnalysis", databaseControllers.downtimeAnalysis);

routers.get("/get", databaseControllers.getData);
routers.get("/fetch", databaseControllers.fetchEdit);
routers.post("/add", databaseControllers.addData);
routers.patch("/edit/:id", databaseControllers.editData);
routers.delete("/delet/:id", databaseControllers.deletData);

routers.get("/pareto", databaseControllers.fetchDataPareto);
routers.get("/line1", databaseControllers.fetchDataLine1);
routers.get("/line2", databaseControllers.fetchDataLine2);
routers.get("/line3", databaseControllers.fetchDataLine3);
routers.get("/line4", databaseControllers.fetchDataLine4);

routers.post("/register", databaseControllers.register);
routers.post("/login", databaseControllers.login);
routers.get("/user", veryfyToken, checkRole, databaseControllers.fetchAlluser);
routers.get("/alluser", databaseControllers.fetchAlluser);
routers.post("/check-Login", veryfyToken, databaseControllers.checkLogin);
routers.patch("/userupdate/:id", databaseControllers.updateUsers);
routers.delete("/userdelete/:id", databaseControllers.deleteUseers);
routers.patch("/useredit/:id", databaseControllers.editUsers);
routers.patch("/changePassword", databaseControllers.changePassword);

routers.get("/instrument", databaseControllers.fetchDataInstrument);
routers.post("/hardness", databaseControllers.fetchDataHardness);
routers.post("/thickness", databaseControllers.fetchDataTickness);
routers.post("/diameter", databaseControllers.fetchDataDiameter);

routers.get("/oee", databaseControllers.fetchOee);
routers.get("/vibrate", databaseControllers.fetchVibrate);
routers.get("/vibrateChart", databaseControllers.vibrateChart);

routers.get("/variableoee", databaseControllers.fetchVariableOee);

routers.get("/emsN14", databaseControllers.fetchEMSn14);

routers.get("/ope", databaseControllers.fetchOPE);
routers.get("/avaline", databaseControllers.fetchAvaLine);
routers.get("/avamachine", databaseControllers.fetchAvaMachine);

routers.get("/lineData", databaseControllers.lineData);
routers.get("/procesData", databaseControllers.procesData);
routers.get("/machineData", databaseControllers.machineData);
routers.get("/locationData", databaseControllers.locationData);

routers.post("/reportmtc", databaseControllers.reportMTC);
routers.post("/reportprd", databaseControllers.reportPRD);
routers.get("/lastPRD", databaseControllers.lastUpdatePRD);
routers.get("/lastMTC", databaseControllers.lastUpdateMTC);
routers.get("/dataReportMTC", databaseControllers.dataReportMTC);

routers.get("/getpowerdata", databaseControllers.getPowerData);
routers.get("/getpowermonthly", databaseControllers.getPowerMonthly);
routers.get("/getPowerSec", databaseControllers.getPowerSec);
routers.get("/getRangeSet", databaseControllers.getRangeSet);
routers.get("/getavgpower", databaseControllers.getAvgPower);

routers.get("/getChillerData", databaseControllers.getChillerData);
routers.get("/getGraphChiller", databaseControllers.getGraphChiller);

routers.get("/getTabelEMS", databaseControllers.getTableEMS);
routers.get("/getTempChart", databaseControllers.getTempChart);
routers.get("/getAllDataEMS", databaseControllers.getAllDataEMS);

routers.get("/waterSystem", databaseControllers.waterSystem);
routers.get("/waterSankey", databaseControllers.waterSankey);
routers.get(
  "/ExportWaterConsumptionDaily",
  databaseControllers.ExportWaterConsumptionDaily
);
routers.get(
  "/ExportWaterTotalizerDaily",
  databaseControllers.ExportWaterTotalizerDaily
);
routers.get(
  "/ExportWaterConsumptionMonthly",
  databaseControllers.ExportWaterConsumptionMonthly
);
routers.get(
  "/ExportWaterTotalizerMonthly",
  databaseControllers.ExportWaterTotalizerMonthly
);
routers.get(
  "/ExportWaterConsumptionYearly",
  databaseControllers.ExportWaterConsumptionYearly
);
routers.get(
  "/ExportWaterTotalizerYearly",
  databaseControllers.ExportWaterTotalizerYearly
);

routers.get("/PowerDaily", databaseControllers.PowerDaily);
routers.get("/PowerCostDaily", databaseControllers.PowerCostDaily);
routers.get("/PowerMonthly", databaseControllers.PowerMonthly);
routers.get("/PowerSankey", databaseControllers.PowerSankey);

routers.get("/PurifiedWater", databaseControllers.PurifiedWater);

routers.get("/ChillerGraph", databaseControllers.ChillerGraph);
routers.get("/ChillerStatus", databaseControllers.ChillerStatus);
routers.get("/ChillerKondisi", databaseControllers.ChillerKondisi);
routers.get("/ChillerNama", databaseControllers.ChillerNama);
routers.get("/ChillerData1", databaseControllers.ChillerData1);
routers.get("/ChillerData2", databaseControllers.ChillerData2);
routers.get("/ChillerData3", databaseControllers.ChillerData3);
routers.get("/ChillerData4", databaseControllers.ChillerData4);
routers.get("/ChillerData5", databaseControllers.ChillerData5);
routers.get("/ChillerData6", databaseControllers.ChillerData6);
routers.get("/ChillerData7", databaseControllers.ChillerData7);
routers.get("/ChillerData8", databaseControllers.ChillerData8);
routers.get("/ChillerData9", databaseControllers.ChillerData9);
routers.get("/trialChiller", databaseControllers.trialChiller);

routers.get("/BuildingRNDSuhu", databaseControllers.BuildingRNDSuhu);
routers.get("/BuildingRNDRH", databaseControllers.BuildingRNDRH);
routers.get("/BuildingRNDDP", databaseControllers.BuildingRNDDP);
routers.get("/BuildingRNDAll", databaseControllers.BuildingRNDAll);

routers.get("/Loopo", databaseControllers.Loopo);
routers.get("/Osmotron", databaseControllers.Osmotron);

routers.get("/BuildingWH1Suhu", databaseControllers.BuildingWH1Suhu);
routers.get("/BuildingWH1RH", databaseControllers.BuildingWH1RH);
routers.get("/BuildingWH1All", databaseControllers.BuildingWH1All);

routers.get("/AlarmList", databaseControllers.AlarmList);
routers.get("/138", databaseControllers.fetch138);

//=====================EBR==========================================================
routers.get("/PmaGetData", databaseControllers.GetDataEBR_PMA);

//==============INSTRUMENT IPC========================================INSTRUMENT IPC==========================================
routers.get("/getMoistureData", databaseControllers.getMoistureData);
routers.get("/getMoistureGraph", databaseControllers.getMoistureGraph);
routers.get("/getSartoriusData", databaseControllers.getSartoriusData);
routers.get("/getSartoriusGraph", databaseControllers.getSartoriusGraph);
routers.get("/getMettlerData", databaseControllers.getMettlerData);

//==============INSTRUMENT HARDNESS 141 ========================================INSTRUMENT HARDNESS 141 ==========================================
routers.get("/getHardnessData", databaseControllers.getHardnessData);
routers.get("/getHardnessGraph", databaseControllers.getHardnessGraph);
routers.get("/getThicknessGraph", databaseControllers.getThicknessGraph);
routers.get("/getDiameterGraph", databaseControllers.getDiameterGraph);

//==============POWER METER MEZANINE ========================================POWER METER MEZANINE ==========================================
routers.get("/fetchPower", databaseControllers.fetchPower);
routers.get("/PowerMeterGraph", databaseControllers.PowerMeterGraph);

//==============BATCH RECORD ========================================BATCH RECORD ==========================================
routers.get("/PMARecord1", databaseControllers.PMARecord1);
routers.get("/BinderRecord1", databaseControllers.BinderRecord1);
routers.get("/WetmillRecord1", databaseControllers.WetmillRecord1);
routers.get("/FBDRecord1", databaseControllers.FBDRecord1);
routers.get("/EPHRecord1", databaseControllers.EPHRecord1);
routers.get("/TumblerRecord1", databaseControllers.TumblerRecord1);
routers.get("/FetteRecord1", databaseControllers.FetteRecord1);
// routers.get("/DedusterRecord1", databaseControllers.DedusterRecord1);
// routers.get("/LifterRecord1", databaseControllers.DedusterRecord1);
// routers.get("/MetalDetectorRecord1", databaseControllers.DedusterRecord1);
// routers.get("/HMRecord1", databaseControllers.HMRecord1);
// routers.get("/IJPRecord1", databaseControllers.IJPRecord1);
// routers.get("/CM1Record1", databaseControllers.CM1Record1);

routers.get("/PMARecord3", databaseControllers.PMARecord3);
// routers.get("/BinderRecord3", databaseControllers.BinderRecord3);
routers.get("/WetmillRecord3", databaseControllers.WetmillRecord3);
routers.get("/FBDRecord3", databaseControllers.FBDRecord3);
routers.get("/EPHRecord3", databaseControllers.EPHRecord3);
// routers.get("/TumblerRecord3", databaseControllers.TumblerRecord3);
// routers.get("/FetteRecord3", databaseControllers.FetteRecord3);
// routers.get("/DedusterRecord3", databaseControllers.DedusterRecord3);
// routers.get("/LifterRecord3", databaseControllers.DedusterRecord3);
// routers.get("/MetalDetectorRecord3", databaseControllers.DedusterRecord3);
routers.get("/HMRecord3", databaseControllers.HMRecord3);
// routers.get("/IJPRecord3", databaseControllers.IJPRecord3);
// routers.get("/CM1Record3", databaseControllers.CM1Record3);

routers.get("/SearchPMARecord1", databaseControllers.SearchPMARecord1);
routers.get("/SearchBinderRecord1", databaseControllers.SearchBinderRecord1);
//routers.get("/SearchWetMillRecord1", databaseControllers.SearchWetMillRecord1);
routers.get("/SearchFBDRecord1", databaseControllers.SearchFBDRecord1);
routers.get("/SearchEPHRecord1", databaseControllers.SearchEPHRecord1);
routers.get("/SearchTumblerRecord1", databaseControllers.SearchTumblerRecord1);
routers.get("/SearchFetteRecord1", databaseControllers.SearchFetteRecord1);
routers.get("/SearchWetMillRecord1", databaseControllers.SearchWetMillRecord1);

routers.get("/SearchPMARecord3", databaseControllers.SearchPMARecord3);
//routers.get("/SearchWetmillRecord3", databaseControllers.SearchWetmillRecord3);
routers.get("/SearchFBDRecord3", databaseControllers.SearchFBDRecord3);
routers.get("/SearchEPHRecord3", databaseControllers.SearchEPHRecord3);
routers.get("/SearchHMRecord3", databaseControllers.SearchHMRecord3);
routers.get("/SearchWetmillRecord3", databaseControllers.SearchWetmillRecord3);


routers.post("/CreateParameter", databaseControllers.CreateParameter);
routers.get("/GetParameter", databaseControllers.GetParameter);
routers.post("/CreateJam", databaseControllers.CreateJam);
routers.get("/GetJam", databaseControllers.GetJam);
routers.post("/CreateLimit", databaseControllers.CreateLimit);
routers.get("/GetLimit", databaseControllers.GetLimit);

//==============SHOW LAST DATA ========================================SHOW LAST DATA==========================================
routers.get("/GetDailyVibrasi138", databaseControllers.GetDailyVibrasi138);
routers.get("/GetDailyGedung138", databaseControllers.GetDailyGedung138);
routers.get("/GetDailyChiller138", databaseControllers.GetDailyChiller138);
routers.get("/GetDailyBoiler138", databaseControllers.GetDailyBoiler138);
routers.get("/GetDailyInstrumentIPC",databaseControllers.GetDailyInstrumentIPC);
routers.get("/GetDailyPower55", databaseControllers.GetDailyPower55);
routers.get("/GetDailyHVAC55", databaseControllers.GetDailyHVAC55);
routers.get("/GetDailyEMSUTY", databaseControllers.GetDailyEMSUTY);
routers.get("/GetDailyDehum", databaseControllers.GetDailyDehum);
routers.get("/GetDailyWATER", databaseControllers.GetDailyWATER);
// routers.get("/GetDailyINV_HVAC", databaseControllers.GetDailyINV_HVAC);

//==============GRAFANA NIH BOS ========================================GRAFANA NIH BOS==========================================
routers.get("/GrafanaWater", databaseControllers.GrafanaWater);
routers.get("/GrafanaPower", databaseControllers.GrafanaPower);
routers.get("/GrafanaMVMDPyear", databaseControllers.GrafanaMVMDPyear);
routers.get("/GrafanaPDAMyear", databaseControllers.GrafanaPDAMyear);
routers.get("/waterCostSystem", databaseControllers.waterCostSystem);

//==============ReportMesin ========================================ReportMesin======================================================
routers.get("/HM1Report", databaseControllers.HM1Report);
routers.post("/HM1Report", databaseControllers.HM1Report);
routers.get("/LogData", databaseControllers.LogData);
routers.get("/alldowntime", databaseControllers.alldowntime);
routers.post("/HM1InsertDowntime", databaseControllers.HM1InsertDowntime);
routers.post("/HM1InsertDowntimeWithSubRows", databaseControllers.HM1InsertDowntimeWithSubRows);
routers.post("/LoginData", veryfyToken, databaseControllers.loginData);
routers.post("/LogoutData", veryfyToken, databaseControllers.logoutData);

routers.get('/GetPlannedDowntime', databaseControllers.GetPlannedDowntime);

routers.get('/bulkImportPMPData', databaseControllers.bulkImportPMPData);

// --- ADD YOUR NEW CRUD ROUTES HERE ---
routers.post('/pmp-data', databaseControllers.createPMPData);
routers.get('/pmp-data', databaseControllers.readPMPData);
routers.put('/pmp-data/:id', databaseControllers.updatePMPData);
routers.delete('/pmp-data/:id', databaseControllers.deletePMPData);

routers.get("/machines-list", databaseControllers.getMachinesList);
// --- END OF NEW ROUTES ---

// --- PMP DEFAULT OPERATIONS (TEMPLATE) ROUTES ---
routers.get("/default-operations/:machine_id", databaseControllers.getDefaultOperations);
routers.post("/default-operations", databaseControllers.createDefaultOperation);
routers.delete("/default-operations/:op_id", databaseControllers.deleteDefaultOperation)
routers.get("/all-operations-list", databaseControllers.getAllOperationsList);

// We removed the 'upload.single' middleware because we are sending JSON
routers.post('/bulk-import-pmp', databaseControllers.bulkImportPMPData);

// --- ADD THESE NEW ROUTES ---
routers.post("/pending-job", databaseControllers.createPendingJob); // Create one
routers.put("/pending-job/:id", databaseControllers.updatePendingJob); // Update one
routers.delete("/pending-job/:id", databaseControllers.deletePendingJob); // Delete one

// --- PMP DAILY ASSIGNMENT ROUTES ---
routers.get("/pending-jobs", databaseControllers.readPendingJobs);
routers.post("/assign-jobs", databaseControllers.assignJobs);

// --- ADD THE NEW TECHNICIAN PAGE ROUTE ---
routers.get("/live-work-orders", databaseControllers.getLiveWorkOrders);
routers.put('/pmp-data-tech/:id', databaseControllers.updatePMPTechnician);

// --- ADD THE NEW UNASSIGN ROUTE ---
routers.put("/unassign-job/:id", databaseControllers.unassignWorkOrder);

// In databaseRouter.js, this must exactly match the frontend:

// --- PMP MACHINES (Master List) CRUD ROUTES ---
routers.post("/machines", databaseControllers.createMachine);
routers.get("/machines", databaseControllers.readMachines); // Note: This replaces '/machines-list'
routers.put("/machines/:id", databaseControllers.updateMachine);
routers.delete("/machines/:id", databaseControllers.deleteMachine);

// --- TECHNICIAN'S OPERATIONS CHECKLIST ROUTES ---
routers.get("/work-order-operations/:work_order_id", databaseControllers.getOperationsForWorkOrder);
routers.put("/work-order-operation/:operation_id", databaseControllers.updateWorkOrderOperation);

// --- ADD THIS ROUTE FOR THE NOTIFICATION BADGE ---
routers.get("/open-jobs-count", databaseControllers.getOpenJobCount);

// --- ADD THIS ROUTE FOR THE COMPLETED JOBS PAGE ---
routers.get("/completed-jobs", databaseControllers.getCompletedJobs);

// --- ADD THIS ROUTE FOR THE EBR EXPORT PAGE ---
routers.get("/ebr-data-export", databaseControllers.getEBRData);

routers.get("/work-order/details/:wo_number", databaseControllers.getWorkOrderDetailsByNumber);

// Add this line with your other routes
routers.put('/work-order/approve/:wo_number', databaseControllers.approveWorkOrder);

// Submit for approval route
routers.put('/work-order/submit/:wo_number', databaseControllers.submitForApproval);

routers.get('/users', databaseControllers.getUsers);



routers.get('/work-orders/pending', databaseControllers.getPendingApprovals);
routers.put(
    '/work-orders/bulk-approve', 
    veryfyToken,                 // <--- THIS DOES THE SECURITY CHECK
    databaseControllers.bulkApproveWorkOrders
);

routers.get("/live-work-orders", veryfyToken, databaseControllers.liveWorkOrders);

routers.get(
  "/live-work-orders-assigned",
  veryfyToken,
  databaseControllers.liveWorkOrdersAssigned
);

routers.get("/technicians", veryfyToken, databaseControllers.getTechnicians);

routers.get("/vortexdata", databaseControllers.getVortexData);

routers.get("/getOEEAvailability1", databaseControllers.getOEEAvailability1);

routers.get("/getOEEPerformance1", databaseControllers.getOEEPerformance1);

routers.get("/getOEEQuality1", databaseControllers.getOEEQuality1);

routers.get("/getDummyData24", databaseControllers.generateDummyData24H);

routers.get("/generateDummyDataWeekly", databaseControllers.generateDummyDataWeekly);

routers.get("/getUniversalOEE", databaseControllers.getUniversalOEE);

routers.get("/getUnifiedOEE", databaseControllers.getUnifiedOEE);


routers.get("/getDailyOEE", databaseControllers.getDailyOEE);

routers.get("/archiveCombinedOEE", databaseControllers.archiveCombinedOEE);
routers.get('/archiveAll', databaseControllers.archiveAll);

routers.get("/getWeeklyTrend", databaseControllers.getWeeklyTrend);

routers.get("/getHistoryLog", databaseControllers.getHistoryLog);

routers.get("/getAssignedJobs", databaseControllers.getAssignedJobs);

routers.put("/updateAssignedJob", databaseControllers.updateAssignedJob);

routers.post("/importMaintenanceData", databaseControllers.importMaintenanceData);

routers.get("/getAssignedJobs", databaseControllers.getAssignedJobs);

routers.get("/getFetteLogs", databaseControllers.getFetteLogs);

routers.get("/getDowntimeDetails", databaseControllers.getDowntimeEvents);
routers.get("/getDowntimeByUnix", databaseControllers.getDowntimeByUnix);
routers.post("/storeDowntimeEvents", databaseControllers.storeDowntimeEvents);

routers.get("/getStoredDowntime", databaseControllers.getStoredDowntime);

routers.post("/splitDowntime", databaseControllers.splitDowntime);

routers.put("/updateDowntime", databaseControllers.updateDowntime);

routers.get("/getDowntimeReasons", databaseControllers.getDowntimeReasons);

routers.post("/runEtlProcess", databaseControllers.runEtlProcess);

routers.get("/getShiftEvents", databaseControllers.getShiftEvents);

routers.get("/getStoredShiftEvents", databaseControllers.getStoredShiftEvents);

routers.get("/getShiftId", databaseControllers.getShiftId);

routers.get("/getAllSmartEvents", databaseControllers.getAllSmartEvents);

routers.put("/updateMasterLogs", databaseControllers.updateMasterLogs);

routers.get("/getAllMasterLogs", databaseControllers.getAllMasterLogs);

routers.get("/getOverrideData", databaseControllers.getOverrideData);

routers.get("/getOverrideDataBySearch", databaseControllers.getOverrideDataBySearch);

routers.post("/saveOverrideData", databaseControllers.saveOverrideData);

routers.get("/getAuditLogs", databaseControllers.getAuditLogs);

routers.get("/getShiftMetadata", databaseControllers.getShiftMetadata);

routers.get("/getOverrideDayData", databaseControllers.getOverrideDayData);

routers.get("/getOverrideAuditLogs", databaseControllers.getOverrideAuditLogs);

routers.get("/syncFetteETL", databaseControllers.syncFetteETL);
routers.get("/backfillFetteETL", databaseControllers.backfillFetteETL);
routers.get("/getFetteOEE", databaseControllers.getFetteOEE);

routers.get("/getUnifiedOEE2", databaseControllers.getUnifiedOEE2);
routers.post("/overrideShiftData", databaseControllers.overrideShiftData);

routers.get("/getAllLatestTimestamps", databaseControllers.getAllLatestTimestamps);
routers.get("/getDataIntegritySummary", databaseControllers.getTableIntegrityLogs);
routers.get("/getHourlyHeatmap", databaseControllers.getHourlyHeatmap);

routers.get("/getWH2DashboardData", databaseControllers.getWH2DashboardData);

routers.post("/createWH2DashboardData",veryfyToken, databaseControllers.createWH2DashboardData);
routers.put('/updateWH2DashboardData',veryfyToken, databaseControllers.updateWH2DashboardData);
routers.delete("/deleteWH2DashboardData",veryfyToken, databaseControllers.deleteWH2DashboardData);
routers.get("/getWH2AuditLogs", databaseControllers.getWH2AuditLogs);

routers.get("/getWarehouseUsers",veryfyToken, databaseControllers.getWarehouseUsers);
routers.put("/updateUserLevel", veryfyToken, databaseControllers.updateUserLevel);

routers.post("/GetSuhuMonitoringData", databaseControllers.GetSuhuMonitoringData);
routers.post("/generateBatchPDF", databaseControllers.generateBatchPDF);
routers.post("/getAvailableBatches", databaseControllers.getAvailableBatches);
routers.post("/getLoadingData", databaseControllers.getLoadingData);
routers.post("/getBatchMonitoring", databaseControllers.getBatchMonitoring);


routers.get("/getToday20SecAverages", databaseControllers.getToday20SecAverages);
routers.get("/getShiftAverages", databaseControllers.getShiftAverages);
routers.get("/getDailyAverages", databaseControllers.getDailyAverages);

routers.post("/uploadWorkOrders", databaseControllers.uploadWorkOrders);

routers.get('/getInventoryParts', databaseControllers.getInventoryParts);

routers.post('/createSparepartLog', databaseControllers.createSparepartLog);

routers.get('/getSparepartLogs', databaseControllers.getSparepartLogs);

routers.put('/updateSparepartLog/:id', databaseControllers.updateSparepartLog);

routers.put('/InventoryupdatePart/:partNumber', veryfyToken, databaseControllers.InventoryupdatePart);

routers.post('/updateInventoryBatch', databaseControllers.updateInventoryBatch);

routers.get("/granulation-batch-record", databaseControllers.getGranulationData);
routers.get('/export-pdf', databaseControllers.getExportData);

routers.get('/SparepartgetAllParts', databaseControllers.SparepartgetAllParts);
routers.post('/SparepartcreatePart', veryfyToken, databaseControllers.SparepartcreatePart);
routers.put('/SparepartupdatePart/:id', veryfyToken, databaseControllers.SparepartupdatePart);
routers.delete('/SparepartdeletePart/:id', veryfyToken, databaseControllers.SparepartdeletePart);
routers.get('/SparepartgetInventoryLogs', databaseControllers.SparepartgetInventoryLogs);

routers.post('/uploadAndExtractPDF', databaseControllers.uploadAndExtractPDF);
routers.post('/preview-pdf', databaseControllers.previewPDF);
routers.post('/confirm-sync', databaseControllers.confirmSync);

routers.get('/getVibrationData', databaseControllers.VibrationData);

routers.get('/getWorkOrders', databaseControllers.getWorkOrders);
routers.get('/:pwo_number', databaseControllers.getWorkOrderById);
routers.put('/:pwo_number', databaseControllers.updateWorkOrder);
routers.put('/:pwo_number/close', databaseControllers.closeWorkOrder);


module.exports = routers;

