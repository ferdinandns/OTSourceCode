const express = require("express");
const databaseControllers = require("../controllers/databaseControllers");

const routers = express.Router();
const { veryfyToken, checkRole } = require("../middleware/auth");

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
routers.post("/LoginData", veryfyToken, databaseControllers.loginData);
routers.post("/LogoutData", veryfyToken, databaseControllers.logoutData);
// CMMS PWO endpoints
routers.get("/live-work-orders", veryfyToken, databaseControllers.liveWorkOrders);
routers.get(
  "/live-work-orders-assigned",
  veryfyToken,
  databaseControllers.liveWorkOrdersAssigned
);
routers.get("/user", veryfyToken, checkRole, databaseControllers.fetchAlluser);
routers.get("/alluser", databaseControllers.fetchAlluser);
routers.post("/check-Login", veryfyToken, databaseControllers.checkLogin);
routers.get("/technicians", veryfyToken, databaseControllers.getTechnicians);
routers.patch("/userupdate/:id", databaseControllers.updateUsers);
routers.delete("/userdelete/:id", databaseControllers.deleteUseers);
routers.patch("/useredit/:id", databaseControllers.editUsers);

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
routers.get("/PMARecord3", databaseControllers.PMARecord3);
routers.get("/WetmillRecord3", databaseControllers.WetmillRecord3);
routers.get("/WetmillRecord1", databaseControllers.WetmillRecord1);
routers.get("/FBDRecord3", databaseControllers.FBDRecord3);
routers.get("/EPHRecord3", databaseControllers.EPHRecord3);
// Line 1 search endpoints (separated)
routers.get("/SearchPMARecord1", databaseControllers.SearchPMARecord1);
routers.get("/SearchWetMillRecord1", databaseControllers.SearchWetMillRecord1);
// Line 3 search endpoints (separated)
routers.get("/SearchPMARecord3", databaseControllers.SearchPMARecord3);
routers.get("/SearchWetmillRecord3", databaseControllers.SearchWetmillRecord3);
routers.get("/SearchFBDRecord3", databaseControllers.SearchFBDRecord3);
routers.get("/SearchEPHRecord3", databaseControllers.SearchEPHRecord3);

// PMP Pending Jobs - Bulk Import from JSON
routers.post("/bulk-import-pending", databaseControllers.bulkImportJsonPending);

// PMP Assigned Jobs - Fetch and Update
routers.get("/assigned-jobs", databaseControllers.getAssignedJobs);
routers.put("/update-assigned-job", databaseControllers.updateAssignedJob);

module.exports = routers;

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
routers.get("/BatchRecord1", databaseControllers.BatchRecord1);
routers.get("/BatchRecord3", databaseControllers.BatchRecord3);
