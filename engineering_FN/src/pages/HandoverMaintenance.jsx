import React from "react";
import { useState, useEffect } from "react";
import {
  Select,
  Input,
  Checkbox,
  CheckboxGroup,
  Stack,
} from "@chakra-ui/react";
import { addPartListData } from "../features/part/partSlice";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import axios from "axios";

function HandoverMaintenance() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [fetchLineData, setFetchLineData] = useState([]);
  const [fetchProcesData, setFetchProcesData] = useState([]);
  const [fetchMachineData, setFetchMachineData] = useState([]);
  const [fetchLocationData, setFetchLocationData] = useState([]);

  const [newLine, setNewLine] = useState("");
  const [newProces, setNewProces] = useState("");
  const [newMachine, setNewMachine] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newPIC, setNewPIC] = useState("");
  const [newDate, setNewDate] = useState();
  const [newStartTime, setNewStartTime] = useState();
  const [newFinishTime, setNewFinishTime] = useState();
  const [newTotal, setNewTotal] = useState();
  const [newSparepart, setNewSparepart] = useState("");
  const [newQuantity, setNewQuantity] = useState();
  const [newUnit, setNewUnit] = useState("");
  const [newPMjob, setNewPMjob] = useState("");
  const [newPMactual, setNewPMactual] = useState("");
  const [newSafety, setNewSafety] = useState("");
  const [newQuality, setNewQuality] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newJobDetail, setNewJobDetail] = useState("");
  const [breakdownType, setBreakdownType] = useState("");

  const [cm1Output, setCm1Output] = useState(0);
  const [cm2Output, setCm2Output] = useState(0);
  const [cm3Output, setCm3Output] = useState(0);
  const [cm4Output, setCm4Output] = useState(0);
  const [cm5Output, setCm5Output] = useState(0);
  const [cm1Afkir, setCm1Afkir] = useState(0);
  const [cm2Afkir, setCm2Afkir] = useState(0);
  const [cm3Afkir, setCm3Afkir] = useState(0);
  const [cm4Afkir, setCm4Afkir] = useState(0);
  const [cm5Afkir, setCm5Afkir] = useState(0);
  const [cmInformation, setCmInformation] = useState("");
  const [lastPRD, setLastPRD] = useState();
  const [lastMTC, setLastMTC] = useState();

  //=================================FETCH new=================

  const fetchLastPRD = async () => {
    let response = await axios.get("http://10.126.15.197:8002/part/lastPRD");

    const tanggalObjek = new Date(response.data[0].datetime);
    const tanggalHasil = tanggalObjek
      .toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      })
      .replace(",", "");
    setLastPRD(tanggalHasil);
  };

  const fetchLastMTC = async () => {
    let response = await axios.get("http://10.126.15.197:8002/part/lastMTC");

    const tanggalObjek = new Date(response.data[0].tanggal);
    const tanggalHasil = tanggalObjek
      .toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
      .replace(",", "");
    setLastMTC(tanggalHasil);
  };

  const fetchLine = async () => {
    let response = await axios.get("http://10.126.15.197:8002/part/lineData");
    setFetchLineData(response.data);
  };

  const fetchProces = async (line) => {
    let response = await axios.get(
      "http://10.126.15.197:8002/part/procesData",
      {
        params: {
          line_name: line,
        },
      }
    );

    setFetchProcesData(response.data);
  };

  const fetchMachine = async (line, proces) => {
    let response = await axios.get(
      "http://10.126.15.197:8002/part/machineData",
      {
        params: {
          line_name: line,
          proces_name: proces,
        },
      }
    );
    setFetchMachineData(response.data);
  };

  const fetchLocation = async (line, proces, machine) => {
    let response = await axios.get(
      "http://10.126.15.197:8002/part/locationData",
      {
        params: {
          line_name: line,
          proces_name: proces,
          machine_name: machine,
        },
      }
    );
    setFetchLocationData(response.data);
  };

  const renderLine = () => {
    return fetchLineData.map((lineCategory) => {
      return (
        <option value={lineCategory.line_name}>{lineCategory.line_name}</option>
      );
    });
  };

  const renderProces = () => {
    return fetchProcesData.map((procesCategory) => {
      return (
        <option value={procesCategory.proces_name}>
          {procesCategory.proces_name}
        </option>
      );
    });
  };

  const renderMachine = () => {
    return fetchMachineData.map((machineCategory) => {
      return (
        <option value={machineCategory.machine_name}>
          {machineCategory.machine_name}
        </option>
      );
    });
  };

  const renderLocation = () => {
    return fetchLocationData.map((locationCategory) => {
      return (
        <option value={locationCategory.location_name}>
          {locationCategory.location_name}
        </option>
      );
    });
  };

  useEffect(() => {
    fetchLine();
    fetchLastPRD();
    fetchLastMTC();

    const checkTheme = () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      setIsDarkMode(currentTheme === "dark");
    };

    // Panggil `checkTheme` saat komponen pertama kali dimuat
    checkTheme();

    // Tambahkan event listener untuk memantau perubahan tema jika terjadi
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // Bersihkan observer saat komponen dilepas
    return () => observer.disconnect();
  }, []);

  //=====================================MTC Report Hendeler======================================

  const lineHendeler = (event) => {
    setNewLine(event.target.value);
    fetchProces(event.target.value);
    //console.log(event.target.value);
  };

  const procesHendeler = (event) => {
    setNewProces(event.target.value);
    fetchMachine(newLine, event.target.value);
    //console.log(event.target.value);
  };

  const machineHendeler = (event) => {
    setNewMachine(event.target.value);
    fetchLocation(newLine, newProces, event.target.value);
    //console.log(event.target.value);
  };

  const locationHendeler = (event) => {
    setNewLocation(event.target.value);
    //console.log(event.target.value);
  };

  const PICHendeler = (event) => {
    setNewPIC(event.target.value);
  };

  const dateHendeler = (event) => {
    setNewDate(event.target.value);
  };

  const startTimeHendeler = (even) => {
    setNewStartTime(even.target.value);
  };

  const finishTimeHendeler = (even) => {
    setNewFinishTime(even.target.value);
  };

  if (newStartTime && newFinishTime) {
    var hm = newStartTime;
    var a = hm.split(":");
    var minutes = +a[0] * 60 + +a[1];

    var hm2 = newFinishTime;
    var a2 = hm2.split(":");
    var minutes2 = +a2[0] * 60 + +a2[1];
    var totalMinuites = minutes2 - minutes;
  } else {
    var totalMinuites = 0;
  }

  const sparepartHendeler = (even) => {
    setNewSparepart(even.target.value);
  };

  const quantityHendeler = (even) => {
    setNewQuantity(even.target.value);
  };
  const unitHendeler = (even) => {
    setNewUnit(even.target.value);
  };
  const PMjobHendeler = (even) => {
    setNewPMjob(even.target.value);
  };
  const PMactualHendeler = (even) => {
    setNewPMactual(even.target.value);
  };
  const safetyHendeler = (even) => {
    setNewSafety(even[0]);
  };
  const qualityHendeler = (even) => {
    setNewQuality(even[0]);
  };
  const statusHendeler = (even) => {
    setNewStatus(even.target.value);
  };
  const jobDetailHendeler = (event) => {
    setNewJobDetail(event.target.value);
  };
  const breakdownTypeHendeler = (even) => {
    setBreakdownType(even.target.value);
  };

  const addDataMTC = async () => {
    let tempData = {
      line: newLine,
      proces: newProces,
      machine: newMachine,
      location: newLocation,
      pic: newPIC,
      tanggal: newDate,
      start: newStartTime,
      finish: newFinishTime,
      total: totalMinuites,
      sparepart: newSparepart,
      quantity: newQuantity,
      unit: newUnit,
      PMjob: newPMjob,
      PMactual: newPMactual,
      safety: newSafety,
      quality: newQuality,
      status: newStatus,
      detail: newJobDetail,
      breakdown: breakdownType,
    };
    console.log(tempData);

    let response = await axios.post(
      "http://10.126.15.197:8002/part/reportmtc",
      tempData
    );

    alert(response.data.message);

    // navigate("/maintenance", { replace: true });
  };

  //================================PROD Report Hendeler=============================================

  const cm1OutputHendeler = (e) => {
    setCm1Output(e.target.value);
  };
  const cm2OutputHendeler = (e) => {
    setCm2Output(e.target.value);
  };
  const cm3OutputHendeler = (e) => {
    setCm3Output(e.target.value);
  };
  const cm4OutputHendeler = (e) => {
    setCm4Output(e.target.value);
  };
  const cm5OutputHendeler = (e) => {
    setCm5Output(e.target.value);
  };
  const cm1AfkirHendeler = (e) => {
    setCm1Afkir(e.target.value);
  };
  const cm2AfkirHendeler = (e) => {
    setCm2Afkir(e.target.value);
  };
  const cm3AfkirHendeler = (e) => {
    setCm3Afkir(e.target.value);
  };
  const cm4AfkirHendeler = (e) => {
    setCm4Afkir(e.target.value);
  };
  const cm5AfkirHendeler = (e) => {
    setCm5Afkir(e.target.value);
  };
  const informationHendeler = (e) => {
    setCmInformation(e.target.value);
  };

  var totalOutputCal =
    Number(cm1Output) +
    Number(cm2Output) +
    Number(cm3Output) +
    Number(cm4Output) +
    Number(cm5Output);
  var totalMasterBoxCal = (totalOutputCal / 64).toFixed(0);

  var currentDate = new Date();

  var year = currentDate.getFullYear();
  var month = ("0" + (currentDate.getMonth() + 1)).slice(-2); // Menambahkan 0 di depan bulan jika hanya satu digit
  var day = ("0" + currentDate.getDate()).slice(-2); // Menambahkan 0 di depan tanggal jika hanya satu digit

  var hours = ("0" + currentDate.getHours()).slice(-2); // Menambahkan 0 di depan jam jika hanya satu digit
  var minutes = ("0" + currentDate.getMinutes()).slice(-2); // Menambahkan 0 di depan menit jika hanya satu digit
  var seconds = ("0" + currentDate.getSeconds()).slice(-2); // Menambahkan 0 di depan detik jika hanya satu digit

  var mysqlDateTime =
    year +
    "-" +
    month +
    "-" +
    day +
    " " +
    hours +
    ":" +
    minutes +
    ":" +
    seconds;

  var cm1Percentage = ((cm1Afkir / 25 / cm1Output) * 100).toFixed(2);
  var cm2Percentage = ((cm2Afkir / 25 / cm2Output) * 100).toFixed(2);
  var cm3Percentage = ((cm3Afkir / 25 / cm3Output) * 100).toFixed(2);
  var cm4Percentage = ((cm4Afkir / 25 / cm4Output) * 100).toFixed(2);
  var cm5Percentage = ((cm5Afkir / 25 / cm5Output) * 100).toFixed(2);

  const addDataProd = async () => {
    let tempData = {
      datetime: mysqlDateTime,
      outputCM1: cm1Output,
      outputCM2: cm2Output,
      outputCM3: cm3Output,
      outputCM4: cm4Output,
      outputCM5: cm5Output,
      afkirCM1: cm1Afkir,
      afkirCM2: cm2Afkir,
      afkirCM3: cm3Afkir,
      afkirCM4: cm4Afkir,
      afkirCM5: cm5Afkir,
      percentageCm1: cm1Percentage,
      percentageCm2: cm2Percentage,
      percentageCm3: cm3Percentage,
      percentageCm4: cm4Percentage,
      percentageCm5: cm5Percentage,
      totalBox: totalOutputCal,
      totalMB: totalMasterBoxCal,
      information: cmInformation,
    };

    let response = await axios.post(
      "http://10.126.15.197:8002/part/reportprd",
      tempData
    );
    alert(response.data.message);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Maintenance Report Section */}
        <div className="flex-1 min-w-0">
          <p className="text-text text-lg font-semibold mb-2">Catch Master Report</p>
          <div className="border-4 rounded-lg shadow-sm p-4 bg-white dark:bg-gray-800">
            {/* Form Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div>
                <label htmlFor="line" className="block text-sm font-medium mb-1">
                  Line Area
                </label>
                <Select
                  placeholder="Select Line"
                  id="line"
                  onChange={lineHendeler}
                >
                  {renderLine()}
                </Select>
              </div>
              {/* Process */}
              <div>
                <label htmlFor="process" className="block text-sm font-medium mb-1">
                  Process
                </label>
                <Select
                  placeholder="Select Process"
                  id="process"
                  onChange={procesHendeler}
                >
                  {renderProces()}
                </Select>
              </div>
              {/* Machine */}
              <div>
                <label htmlFor="machine" className="block text-sm font-medium mb-1">
                  Machine
                </label>
                <Select
                  placeholder="Select Machine"
                  id="machine"
                  onChange={machineHendeler}
                >
                  {renderMachine()}
                </Select>
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location" className="block text-sm font-medium mb-1">
                  Location
                </label>
                <Select
                  placeholder="Select Location"
                  id="location"
                  onChange={locationHendeler}
                >
                  {renderLocation()}
                </Select>
              </div>
              {/* PIC */}
              <div>
                <label htmlFor="pic" className="block text-sm font-medium mb-1">
                  PIC
                </label>
                <Select
                  placeholder="Select PIC"
                  id="pic"
                  onChange={PICHendeler}
                >
                  <option value="SGO">Sugino</option>
                  <option value="MKF">Khaerul</option>
                  <option value="RDP">Ricy</option>
                  <option value="ARF">Arief</option>
                  <option value="RMR">Rieco</option>
                  <option value="EGS">Ezra</option>
                </Select>
              </div>
              {/* Breakdown */}
              <div>
                <label htmlFor="breakdown" className="block text-sm font-medium mb-1">
                  Breakdown
                </label>
                <Select
                  placeholder="Type"
                  id="breakdown"
                  onChange={breakdownTypeHendeler}
                >
                  <option value="Pland">Planned</option>
                  <option value="Unplan">Unplanned</option>
                  <option value="Minor">Minor</option>
                </Select>
              </div>

              {/* Date */}
              <div>
                <label htmlFor="date" className="block text-sm font-medium mb-1">
                  Date
                </label>
                <Input
                  id="date"
                  onChange={dateHendeler}
                  placeholder="Select Date"
                  size="md"
                  type="date"
                  className="w-full"
                  css={{
                    "&::-webkit-calendar-picker-indicator": {
                      color: isDarkMode ? "white" : "black",
                      filter: isDarkMode ? "invert(1)" : "none",
                    },
                  }}
                />
              </div>

              {/* Start Time */}
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium mb-1">
                  Start Time
                </label>
                <Input
                  id="startTime"
                  onChange={startTimeHendeler}
                  placeholder="Start Time"
                  size="md"
                  type="time"
                  className="w-full"
                  css={{
                    "&::-webkit-calendar-picker-indicator": {
                      color: isDarkMode ? "white" : "black",
                      filter: isDarkMode ? "invert(1)" : "none",
                    },
                  }}
                />
              </div>

              {/* Finish Time */}
              <div>
                <label htmlFor="finishTime" className="block text-sm font-medium mb-1">
                  Finish Time
                </label>
                <Input
                  id="finishTime"
                  onChange={finishTimeHendeler}
                  placeholder="Finish Time"
                  size="md"
                  type="time"
                  className="w-full"
                  css={{
                    "&::-webkit-calendar-picker-indicator": {
                      color: isDarkMode ? "white" : "black",
                      filter: isDarkMode ? "invert(1)" : "none",
                    },
                  }}
                />
              </div>
               {/* Total Time */}
               <div>
                <label htmlFor="totalTime" className="block text-sm font-medium mb-1">
                  Total Time
                </label>
                <input
                  id="totalTime"
                  value={totalMinuites}
                  type="number"
                  className="text-center w-20 rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                  readOnly
                />
              </div>

              {/* Sparepart Name */}
              <div>
                <label htmlFor="sparepart" className="block text-sm font-medium mb-1">
                  Sparepart Name
                </label>
                <input
                  id="sparepart"
                  onChange={sparepartHendeler}
                  type="text"
                  className="w-full rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>

              {/* Quantity */}
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium mb-1">
                  Quantity
                </label>
                <input
                  id="quantity"
                  onChange={quantityHendeler}
                  type="number"
                  className="text-center w-20 rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>

              {/* Unit */}
              <div>
                <label htmlFor="unit" className="block text-sm font-medium mb-1">
                  Unit
                </label>
                <Select
                  id="unit"
                  onClick={unitHendeler}
                  placeholder="Select"
                >
                  <option value="Pcs">Pcs</option>
                  <option value="Rol">Rol</option>
                  <option value="Meter">Meter</option>
                  <option value="Cm">Cm</option>
                  <option value="Box">Box</option>
                  <option value="Lot">Lot</option>
                  <option value="Pack">Pack</option>
                </Select>
              </div>
               {/* PM Job */}
               <div>
                <label htmlFor="pmJob" className="block text-sm font-medium mb-1">
                  PM Job
                </label>
                <input
                  id="pmJob"
                  onChange={PMjobHendeler}
                  type="text"
                  className="w-full rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>

              {/* PM Actual */}
              <div>
                <label htmlFor="pmActual" className="block text-sm font-medium mb-1">
                  PM Actual
                </label>
                <input
                  id="pmActual"
                  onChange={PMactualHendeler}
                  type="text"
                  className="w-full rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>

              {/* Safety */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Safety
                </label>
                <CheckboxGroup
                  onChange={safetyHendeler}
                  spacing={2}
                  className="flex flex-row gap-4"
                >
                  <Checkbox
                    value="OK"
                    colorScheme="green"
                    defaultChecked
                  >
                    OK
                  </Checkbox>
                  <Checkbox 
                    value="NOK" 
                    colorScheme="red" 
                    defaultChecked
                  >
                    NOK
                  </Checkbox>
                </CheckboxGroup>
              </div>

              {/* Quality */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Quality
                </label>
                <CheckboxGroup
                  onChange={qualityHendeler}
                  spacing={2}
                  className="flex flex-row gap-4"
                >
                  <Checkbox
                    value="OK"
                    colorScheme="green"
                    defaultChecked
                  >
                    OK
                  </Checkbox>
                  <Checkbox 
                    value="NOK" 
                    colorScheme="red" 
                    defaultChecked
                  >
                    NOK
                  </Checkbox>
                </CheckboxGroup>
              </div>

              {/* Status */}
              <div>
                <label htmlFor="status" className="block text-sm font-medium mb-1">
                  Status
                </label>
                <Select
                  id="status"
                  onClick={statusHendeler}
                  placeholder="Select"
                >
                  <option value="OK">OK</option>
                  <option value="Overtime">Overtime</option>
                  <option value="Next">Next Shift</option>
                  <option value="Followup">Need to followup</option>
                </Select>
              </div>
            </div>

            {/* Job Details */}
            <div className="mt-6">
              <label htmlFor="jobDetail" className="block text-sm font-medium mb-1">
                Detail Pekerjaan
              </label>
              <textarea
                id="jobDetail"
                onChange={jobDetailHendeler}
                rows={3}
                className="w-full rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
              />
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={addDataMTC}
                className="rounded-md bg-blue-600 hover:bg-blue-700 py-2 px-4 text-sm font-semibold text-white shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
          <p className="text-xs mt-1 text-gray-500">Data Last Update at ({lastMTC})</p>
        </div>

        {/* Production Report Section */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold mb-2">Production Report</h2>
          <div className="border-4 rounded-lg shadow-sm p-4 bg-white dark:bg-gray-800">
            {/* CM1 */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h3 className="text-xl font-bold">CM1</h3>
              <div>
                <label htmlFor="cm1Afkir" className="block text-sm font-medium mb-1">
                  Afkir
                </label>
                <input
                  id="cm1Afkir"
                  onChange={cm1AfkirHendeler}
                  type="number"
                  className="w-24 text-center rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>
              <div>
                <label htmlFor="cm1Output" className="block text-sm font-medium mb-1">
                  Output
                </label>
                <input
                  id="cm1Output"
                  onChange={cm1OutputHendeler}
                  type="number"
                  className="w-24 text-center rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h3 className="text-xl font-bold">CM2</h3>
              <div>
                <label htmlFor="cm1Afkir" className="block text-sm font-medium mb-1">
                  Afkir
                </label>
                <input
                  id="cm1Afkir"
                  onChange={cm2AfkirHendeler}
                  type="number"
                  className="w-24 text-center rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>
              <div>
                <label htmlFor="cm1Output" className="block text-sm font-medium mb-1">
                  Output
                </label>
                <input
                  id="cm1Output"
                  onChange={cm2OutputHendeler}
                  type="number"
                  className="w-24 text-center rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h3 className="text-xl font-bold">CM3</h3>
              <div>
                <label htmlFor="cm1Afkir" className="block text-sm font-medium mb-1">
                  Afkir
                </label>
                <input
                  id="cm1Afkir"
                  onChange={cm3AfkirHendeler}
                  type="number"
                  className="w-24 text-center rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>
              <div>
                <label htmlFor="cm1Output" className="block text-sm font-medium mb-1">
                  Output
                </label>
                <input
                  id="cm1Output"
                  onChange={cm3OutputHendeler}
                  type="number"
                  className="w-24 text-center rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h3 className="text-xl font-bold">CM4</h3>
              <div>
                <label htmlFor="cm1Afkir" className="block text-sm font-medium mb-1">
                  Afkir
                </label>
                <input
                  id="cm1Afkir"
                  onChange={cm4AfkirHendeler}
                  type="number"
                  className="w-24 text-center rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>
              <div>
                <label htmlFor="cm1Output" className="block text-sm font-medium mb-1">
                  Output
                </label>
                <input
                  id="cm1Output"
                  onChange={cm4OutputHendeler}
                  type="number"
                  className="w-24 text-center rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <h3 className="text-xl font-bold">CM5</h3>
              <div>
                <label htmlFor="cm1Afkir" className="block text-sm font-medium mb-1">
                  Afkir
                </label>
                <input
                  id="cm1Afkir"
                  onChange={cm5AfkirHendeler}
                  type="number"
                  className="w-24 text-center rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>
              <div>
                <label htmlFor="cm1Output" className="block text-sm font-medium mb-1">
                  Output
                </label>
                <input
                  id="cm1Output"
                  onChange={cm5OutputHendeler}
                  type="number"
                  className="w-24 text-center rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                />
              </div>
            </div>
            {/* Totals */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="totalOutput" className="text-sm font-medium">
                  Total Output
                </label>
                <input
                  id="totalOutput"
                  value={totalOutputCal}
                  type="number"
                  className="w-24 text-center rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                  readOnly
                />
              </div>
              
              <div className="flex items-center justify-between">
                <label htmlFor="totalMasterBox" className="text-sm font-medium">
                  Total MasterBOX
                </label>
                <input
                  id="totalMasterBox"
                  value={totalMasterBoxCal}
                  type="number"
                  className="w-24 text-center rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
                  readOnly
                />
              </div>
            </div>

            {/* Information */}
            <div className="mt-6">
              <label htmlFor="information" className="block text-sm font-medium mb-1">
                Information
              </label>
              <textarea
                id="information"
                onChange={informationHendeler}
                rows={3}
                className="w-full rounded-md border bg-white dark:bg-gray-700 border-gray-300 py-1.5 px-2"
              />
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={addDataProd}
                className="rounded-md bg-blue-600 hover:bg-blue-700 py-2 px-4 text-sm font-semibold text-white shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
          <p className="text-xs mt-1 text-gray-500">Data Last Update at ({lastPRD})</p>
        </div>
      </div>
    </div>
  );
}

export default HandoverMaintenance;
