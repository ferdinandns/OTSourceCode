import { useState } from "react";
import { Select, Input } from "@chakra-ui/react";
import { addPartListData } from "../features/part/partSlice";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import { useEffect } from "react";
import axios from "axios";
import { event } from "jquery";

function CreateNew() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );

  const [dataList, setDataList] = useState({});
  const [newLine, setNewLine] = useState("");
  const [newProces, setNewProces] = useState("");
  const [newMachine, setNewMachine] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newJob, setNewJob] = useState("");
  const [newJobDetail, setNewJobDetail] = useState("");
  const [newDate, setNewDate] = useState();
  const [newQuantity, setNewQuantity] = useState();
  const [newUnit, setNewUnit] = useState("");
  const [newPIC, setNewPIC] = useState("");
  const [newStartTime, setNewStartTime] = useState();
  const [newFinishTime, setNewFinishTime] = useState();

  const [fetchLineData, setFetchLineData] = useState([]);
  const [fetchProcesData, setFetchProcesData] = useState([]);
  const [fetchMachineData, setFetchMachineData] = useState([]);
  const [fetchLocationData, setFetchLocationData] = useState([]);

  //=================================FETCH new=================

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
  }, []);

  useEffect(() => {
    const handleThemeChange = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(currentTheme === 'dark');
    };
    // Observe attribute changes
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);
  

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

  const addData = () => {
    let tempData = {
      Mesin: newProces,
      Line: newLine,
      Pekerjaan: newJob,
      Detail: newJobDetail,
      Tanggal: newDate,
      Quantity: newQuantity,
      Unit: newUnit,
      Pic: newPIC,
      Tawal: newStartTime,
      Tahir: newFinishTime,
      Total: totalMinuites,
    };
    setDataList((dataList, { ...tempData }));
    dispatch(addPartListData(tempData));
    alert("Data berhasil ditambahkan");
    navigate("/Maintenance");
  };

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
    //(event.target.value);
  };

  const jobHendeler = (event) => {
    setNewJob(event.target.value);
  };
  const jobDetailHendeler = (event) => {
    setNewJobDetail(event.target.value);
  };
  const dateHendeler = (event) => {
    setNewDate(event.target.value);
  };
  const quantityHendeler = (event) => {
    setNewQuantity(event.target.value);
  };
  const unitHendeler = (event) => {
    setNewUnit(event.target.value);
  };
  const PICHendeler = (event) => {
    setNewPIC(event.target.value);
  };
  const startTimeHendeler = (even) => {
    setNewStartTime(even.target.value);
  };
  const finishTimeHendeler = (even) => {
    setNewFinishTime(even.target.value);
  };

  return (
    <div className="px-4 md:px-8 lg:px-14 w-full">
      <div className="space-y-10 md:space-y-20">
        <div className="border-border pb-6 md:pb-12 border-solid border-4 md:border-8 mt-4 md:mt-8 rounded-lg overflow-hidden">
          <h2 className="text-base md:text-lg text-center font-bold leading-7 text-text mt-6 md:mt-10">
            INPUT DATA MAINTENANCE
          </h2>

          {/* Form Fields - Bagian Pertama */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
            <div className="w-full">
              <label
                htmlFor="line"
                className="block text-sm font-medium leading-6 text-text"
              >
                Line Area
              </label>
              <div className="mt-2 w-full">
                <Select
                  placeholder="Select Line"
                  id="line"
                  onChange={lineHendeler}
                >
                  {renderLine()}
                </Select>
              </div>
            </div>
            <div className="w-full">
              <label
                htmlFor="process"
                className="block text-sm font-medium leading-6 text-text"
              >
                Proces
              </label>
              <div className="mt-2 w-full">
                <Select placeholder="Select Machine" onChange={procesHendeler}>
                  {renderProces()}
                </Select>
              </div>
            </div>

            <div className="w-full">
              <label
                htmlFor="machine"
                className="block text-sm font-medium leading-6 text-text"
              >
                Machine
              </label>
              <div className="mt-2 w-full">
                <Select placeholder="Select Machine" onChange={machineHendeler}>
                  {renderMachine()}
                </Select>
              </div>
            </div>

            <div className="w-full">
              <label
                htmlFor="location"
                className="block text-sm font-medium leading-6 text-text"
              >
                Location
              </label>
              <div className="mt-2 w-full">
                <Select
                  placeholder="Select Machine"
                  onChange={locationHendeler}
                >
                  {renderLocation()}
                </Select>
              </div>
            </div>
          </div>
          {/* Form Fields - Bagian Kedua */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
            {/* <div className="sm:col-span-4 ">
              <label
                htmlFor="Pekerjaan"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Sparepart Name
              </label>
              <div className="mt-2">
                <input
                  id="Pekerjaan"
                  name="Pekerjaan"
                  type="Pekerjaan"
                  autoComplete="Pekerjaan"
                  className="block w-48 rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
              </div>
            </div>

            <div className="sm:col-span-4">
              <label
                htmlFor="Pekerjaan"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Quantity
              </label>
              <div className="mt-2 w-48">
                <Input onChange={quantityHendeler} size="md" type="number" />
              </div>
            </div>

            <div className="sm:col-span-4">
              <label
                htmlFor="username"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Unit
              </label>
              <div className="mt-2 w-48">
                <Select onChange={unitHendeler} placeholder="Select Unit">
                  <option value="Pcs">Pcs</option>
                  <option value="Rol">Rol</option>
                  <option value="Meter">Meter</option>
                  <option value="Cm">Cm</option>
                  <option value="Box">Box</option>
                  <option value="Lot">Lot</option>
                  <option value="Pack">Pack</option>
                </Select>
              </div>
            </div> */}

            <div className="w-full">
              <label
                htmlFor="pic"
                className="block text-sm font-medium leading-6 text-text"
              >
                PIC
              </label>
              <div className="mt-2 w-full">
                <Select onChange={PICHendeler} placeholder="Select PIC">
                  <option value="SGO">Sugino</option>
                  <option value="MKF">Khaerul</option>
                  <option value="RAO">Renaldo</option>
                  <option value="CKA">Chandra</option>
                  <option value="RDP">Ricy</option>
                  <option value="ARF">Arief</option>
                </Select>
              </div>
            </div>

            <div className="w-full">
            <label
              htmlFor="date"
              className="block text-sm font-medium leading-6 text-text"
            >
              Tanggal
            </label>
            <div className="mt-2 w-full">
              <Input
                onChange={dateHendeler}
                placeholder="Select Date and Time"
                size="md"
                type="date"
                css={{
                  "&::-webkit-calendar-picker-indicator": {
                    color: isDarkMode ? "white" : "black",
                    filter: isDarkMode ? "invert(1)" : "none",
                  },
                }}
              />
            </div>
          </div>

          <div className="w-full">
            <label
              htmlFor="startTime"
              className="block text-sm font-medium leading-6 text-text"
            >
              Start Time
            </label>
            <div className="mt-2 w-full">
              <Input
                onChange={startTimeHendeler}
                placeholder="Select Date and Time"
                size="md"
                type="time"
                css={{
                  "&::-webkit-calendar-picker-indicator": {
                    color: isDarkMode ? "white" : "black",
                    filter: isDarkMode ? "invert(1)" : "none",
                  },
                }}
              />
            </div>
          </div>
          
          <div className="w-full">
            <label
              htmlFor="finishTime"
              className="block text-sm font-medium leading-6 text-text"
            >
              Finish Time
            </label>
            <div className="mt-2 w-full">
              <Input
                onChange={finishTimeHendeler}
                placeholder="Select Date and Time"
                size="md"
                type="time"
                css={{
                  "&::-webkit-calendar-picker-indicator": {
                    color: isDarkMode ? "white" : "black",
                    filter: isDarkMode ? "invert(1)" : "none",
                  },
                }}
              />
            </div>
          </div>
        </div>
        
        {/* Pekerjaan & Detail Pekerjaan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          <div className="w-full">
            <label
              htmlFor="Pekerjaan"
              className="block text-sm font-medium leading-6 text-text"
            >
              Pekerjaan
            </label>
            <div className="mt-2 w-full">
              <input
                onChange={jobHendeler}
                id="Pekerjaan"
                name="Pekerjaan"
                type="Pekerjaan"
                autoComplete="Pekerjaan"
                className="w-full block rounded-md pl-1 bg-background border border-border hover:border-border2 text-text py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-400 sm:text-sm sm:leading-6 cursor-pointer"
              />
            </div>
          </div>
        
          <div className="w-full md:col-span-2">
            <label
              htmlFor="about"
              className="block text-sm font-medium leading-6 text-text"
            >
              Detail Pekerjaan
            </label>
            <div className="mt-2 w-full">
              <textarea
                onChange={jobDetailHendeler}
                id="about"
                name="about"
                rows={3}
                className="block w-full rounded-md pl-1 bg-background border border-border hover:border-border2 text-text py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-gray-400 sm:text-sm sm:leading-6 cursor-pointer"
                defaultValue={""}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div className="mt-6 flex items-center justify-end gap-x-6 pb-8 mr-8">
      <button
        type="button"
        className="text-sm font-semibold leading-6 text-text hover:text-gray-300"
        onClick={() => navigate("/Maintenance")}
      >
        Cancel
      </button>
      <button
        onClick={() => addData()}
        className="rounded-md bg-cta hover:bg-ctactive py-2 px-3 text-sm font-semibold text-white shadow-sm"
      >
        Save
      </button>
    </div>
  </div>
  );
}

export default CreateNew;
