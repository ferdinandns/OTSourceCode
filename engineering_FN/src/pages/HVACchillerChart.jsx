import React, { useEffect, Component, useState } from "react";
import CanvasJSReact from "../canvasjs.react";
import { Button, ButtonGroup, Stack, Input, Select, Tbody, Tr, Th, Td, Table, Box, TableContainer, Thead, Spinner, SimpleGrid, Flex } from "@chakra-ui/react";
import axios from "axios";
import { ExportToExcel } from "../ExportToExcel";
import { useColorMode, useColorModeValue } from "@chakra-ui/react";

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;


export default function HVACchillerChart() {
  const [data, setData] = useState([])
  const [data1, setData1] = useState([])
  const [data2, setData2] = useState([])
  const [data3, setData3] = useState([])
  const [area, setArea] = useState();
  const [label1, setlabel1] = useState([]);
  const [label2, setlabel2] = useState([]);
  const [label3, setlabel3] = useState([]);
  const [label4, setlabel4] = useState([]);
  const [ChillerTable, setChillerTable] = useState();
  const [KompTable, setKomTable] = useState();
  const [DataTable1, setDataTable1] = useState([]);
  const [DataTable2, setDataTable2] = useState([]);
  const [DataTable3, setDataTable3] = useState([]);
  const [DataTable4, setDataTable4] = useState([]);
  const [DataTable5, setDataTable5] = useState([]);
  const [DataTable6, setDataTable6] = useState([]);
  const [DataTable7, setDataTable7] = useState([]);
  const [DataTable8, setDataTable8] = useState([]);
  const [DataTable9, setDataTable9] = useState([]);
  const [DataTable10, setDataTable10] = useState([]);
  const [DataTable11, setDataTable11] = useState([]);
  const [DataTable12, setDataTable12] = useState([]);
  const [ChooseData, setChooseData] = useState();
  const [startDate, setStartDate] = useState();
  const [oliatas, setoliatas] = useState();
  const [finishDate, setFinishDate] = useState();
  const [list, setList] = useState([{ area: "", chiller: "",komp: "", start: "", finish: "" }]);
  const [state, setState] = useState();
  const [deletestate, setdelete] = useState();
  const [fileName, setfilename] = useState();
  const [fanoutdoor, setfanoutdoor] = useState();

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [loadingTable, setLoadingTable] = useState(false);
  const [errorTable, setErrorTable] = useState(null);
  const [isTableVisible, setIsTableVisible] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);  

  const { colorMode } = useColorMode();
  const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
  const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");
  const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");
  const kartuColor = useColorModeValue("rgba(var(--color-card))", "rgba(var(--color-card))");

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );

  const fetchDataChiller = async () => {
  setLoading(true); 
  setError(null);

  try {
    if (!list || list.some(item => !item.area || !item.chiller))  {
      throw new Error("List tidak valid. Pastikan memiliki setidaknya 4 elemen dengan 'area' dan 'chiller'.");
    }
    
    let arr = list.map((item) => ({ params: item }));
    console.log("Request Params:", arr);

    const requests = list.map((item) =>
      axios.get("http://10.126.15.197:8002/part/ChillerGraph", { params: item })
    );

    const responses = await Promise.all(requests);

    const mappedDataArray = responses.map((response, index) =>
      mapData(response.data, list[index]?.area)
    );

    setData(mappedDataArray);
    console.log("All data fetched successfully", mappedDataArray);
  } catch (err) {
    console.error("Error fetching data:", err);
    setError("Failed to fetch data");
  } finally {
    const delay = 2000;
    setTimeout(() => {
      setLoading(false);
      console.log("Finished fetching data, stopping spinner...");
    }, delay);
  }             
};

const mapData = (data, area) => {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn("Data kosong atau tidak valid:", data);
    return [];
  }

  return data.map(item => {
    if (item.x === undefined || item.y === undefined) {
      console.error("Data tidak valid:", item);
      return null;
    }

    let mappedItem = {
      // Use UTC formatting for consistent display
      label: new Date(item.x).toISOString().slice(0, 19).replace('T', ' '),
      y: item.y,
      x: item.x,
    };

    if (area === "R-EvapPress") {
      mappedItem.y = item.y * 2;
    } else if (["R-UnitCap", "R-Status", "R-Alarm"].includes(area)) {
      mappedItem.x = item.x + 10;
    }

    return mappedItem;
  }).filter(Boolean);
};

// Fixed version - ensures UTC display
const mapDataResponse2 = (data, area) => {
  return data.map((item) => {
    let mappedItem = {
      // Use UTC formatting instead of Jakarta timezone
      label: new Date(item.x).toISOString().slice(0, 16).replace('T', ' '),
      y: item.y,
      x: item.x,
    };

    if (area === "R-EvapPress") {
      mappedItem.y = item.y * 2;
    } else if (area === "R-UnitCap" || area === "R-Status" || area === "R-Alarm") {
      mappedItem.x = item.x + 10;
    } else {
      mappedItem.y = item.y;
      mappedItem.x = item.x; 
    }

    return mappedItem;
  });
};  

const handleAddlist = () => {  
  setList ([...list, {area: "", chiller: "",komp: "", start: "", finish: ""}])
};

const handleDeleteList = (i) => {
  const newList = [...list];
  newList.splice(i, 1);
  setList(newList);
  if (i === 1){
    setData1()}
  else if (i === 0){
    setData()
  }
  else if (i === 2){
    setData2()
  }
  else if (i === 3){
    setData3()
  }
};

const handleListChange = (e, i) => {
  const field = e.target.name;
  const newList = [...list];
  newList[i][field] = e.target.value;
  setList(newList); 
};

useEffect(() => {
  if (list.length >= 4 && list.every(item => item.area && item.chiller)) {
    fetchDataChiller();
  }
}, [list]);

useEffect(() => {
  const handleThemeChange = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    setIsDarkMode(currentTheme === 'dark');
  };
  const observer = new MutationObserver(handleThemeChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return () => observer.disconnect();
}, []);

// Fixed locale options - explicitly use UTC and English locale to avoid confusion
var localeOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit", 
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false
};

const options = {
  zoomEnabled: true,
  theme: isDarkMode ? "dark2" : "light2",
  backgroundColor: "transparent",
  title: {
    text: "HVAC Chiller (UTC)",  // Added UTC indicator
    fontColor: isDarkMode ? "white" : "black"
  },
  axisY: {
    prefix: "",
  },
  axisX: {
    valueFormatString: "DD MMM YYYY HH:mm",
    labelFormatter: function (e) {
      // Use English locale to ensure consistent UTC formatting
      let date = new Date(e.value);
      return date.toLocaleString("en-US", localeOptions);
    },
  },
  toolTip: {
    shared: true,
    // Custom content formatter to ensure UTC display
    contentFormatter: function (e) {
      var content = "";
      var utcDate = new Date(e.entries[0].dataPoint.x).toLocaleString("en-US", localeOptions);
      content += "<strong>" + utcDate + " UTC</strong><br/>";
      
      for (var i = 0; i < e.entries.length; i++) {
        content += "<span style='color:" + e.entries[i].dataSeries.color + "'>" + 
                   e.entries[i].dataSeries.name + "</span>: " + 
                   e.entries[i].dataPoint.y + "<br/>";
      }
      return content;
    }
  },
  data: data.map((dataPoints, index) => ({
    type: "spline",
    name: `${index + 1}.${list[index]?.area || "Area"}`,
    showInLegend: true,
    markerType: "circle",
    yValueFormatString: "",
    xValueType: "dateTime",
    dataPoints: dataPoints,
    color: ["red", "blue", "green", "magenta"][index % 4],
  })),
};

useEffect(()=>{
  if (list.length >=4){
      setState(true);
  } else {
      setState(false);
  }
}); 

// ========================================================= Ini dibawah Chart =======================================================================
      let dateStart = (e) =>{
        var dataInput = e.target.value;
        setStartDate(dataInput);
        
      };
      let dateFinish = (e) =>{
        var dataInput = e.target.value;
         setFinishDate(dataInput);
      };
      let DataType = (e) =>{
        var dataInput = e.target.value;
         setChooseData(dataInput);
      };
      let chillerData = (e) =>{
        var dataInput = e.target.value;
         setChillerTable(dataInput);
      };
      let KompData = (e) =>{
        var dataInput = e.target.value;
         setKomTable(dataInput);
      };
      useEffect(() =>{
        if (KompTable ==="K2CH"){
          setoliatas("OlGlas");
        } else if (KompTable ==="K1CH"){
          setoliatas("OliGls")
        } 
      });
      useEffect(() =>{
        if (KompTable ==="K2CH"){
          setfanoutdoor("dr");
        } else if (KompTable ==="K1CH"){
          setfanoutdoor("dor")
        } 
      });

      const fetchChillerTable = async () => {
        try {
          setLoadingTable(true); // Start spinner
          setErrorTable(null);   // Clear previous errors
          let response4 = await axios.get(
            "http://10.126.15.197:8002/part/ChillerStatus", 
            {
              params: {
                start: startDate,
                finish: finishDate,
                chiller: ChillerTable,
                komp: KompTable,
              }
            }
          );
          let response5 = await axios.get(
            "http://10.126.15.197:8002/part/ChillerKondisi", 
            {
              params: {
                start: startDate,
                finish: finishDate,
                chiller: ChillerTable,
                komp: KompTable,
                oliats: oliatas,
              }
            }
          );
          let response6 = await axios.get(
            "http://10.126.15.197:8002/part/ChillerNama", 
            {
              params: {
                start: startDate,
                finish: finishDate,
                chiller: ChillerTable,
                komp: KompTable,
              }
            }
          ); 
          let response7 = await axios.get(
            "http://10.126.15.197:8002/part/ChillerData1", 
            {
              params: {
                start: startDate,
                finish: finishDate,
                chiller: ChillerTable,
                komp: KompTable,
              }
            }
          ); 
          let response8 = await axios.get(
            "http://10.126.15.197:8002/part/ChillerData2", 
            {
              params: {
                start: startDate,
                finish: finishDate,
                chiller: ChillerTable,
                komp: KompTable,
              }
            }
          ); 
          let response9 = await axios.get(
            "http://10.126.15.197:8002/part/ChillerData3", 
            {
              params: {
                start: startDate,
                finish: finishDate,
                chiller: ChillerTable,
                komp: KompTable,
              }
            }
          ); 
          let response10 = await axios.get(
            "http://10.126.15.197:8002/part/ChillerData4", 
            {
              params: {
                start: startDate,
                finish: finishDate,
                chiller: ChillerTable,
                komp: KompTable,
              }
            }
          );
          let response11 = await axios.get(
            "http://10.126.15.197:8002/part/ChillerData5", 
            {
              params: {
                start: startDate,
                finish: finishDate,
                chiller: ChillerTable,
                komp: KompTable,
                fan: fanoutdoor,
              }
            }
          ); 
          let response12 = await axios.get(
            "http://10.126.15.197:8002/part/ChillerData6", 
            {
              params: {
                start: startDate,
                finish: finishDate,
                chiller: ChillerTable,
                komp: KompTable,
              }
            }
          ); 
          let response13 = await axios.get(
            "http://10.126.15.197:8002/part/ChillerData7", 
            {
              params: {
                start: startDate,
                finish: finishDate,
                chiller: ChillerTable,
                komp: KompTable,
              }
            }
          ); 
          let response14 = await axios.get(
            "http://10.126.15.197:8002/part/ChillerData8", 
            {
              params: {
                start: startDate,
                finish: finishDate,
                chiller: ChillerTable,
                komp: KompTable,
              }
            }
          ); 
          let response15 = await axios.get(
            "http://10.126.15.197:8002/part/ChillerData9", 
            {
              params: {
                start: startDate,
                finish: finishDate,
                chiller: ChillerTable,
                komp: KompTable,
              }
            }
          ); 
          setfilename("Data HVAC "+ KompTable +ChillerTable)
          
          setDataTable1(response4.data);
          setDataTable2(response5.data);
          setDataTable3(response6.data);
          setDataTable4(response7.data);
          setDataTable5(response8.data);
          setDataTable6(response9.data);
          setDataTable7(response10.data);
          setDataTable8(response11.data);
          setDataTable9(response12.data);
          setDataTable10(response13.data);
          setDataTable11(response14.data);
          setDataTable12(response15.data);
          setIsTableVisible(true); // Show the table
        } catch (err) {
          console.error("Error fetching table data:", err);
          setErrorTable("No available data"); // Handle error
        } finally {
          setLoadingTable(false); // Stop spinner
        }
        };
        const TableDataFull = DataTable1.concat(DataTable2,
          DataTable3,
          DataTable4,
          DataTable5,
          DataTable6,
          DataTable7,
          DataTable8,
          DataTable9,
          DataTable10,
          DataTable11,
          DataTable12
        );
        var obj = {};
        for (var i = 0; i <TableDataFull.length; i++){
          var time = TableDataFull[i].time;
          var p_time = obj[time] || {};
          obj[time] = Object.assign(p_time, TableDataFull[i]);
        }
        const result = Object.values(obj); 

      const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
      };  
      const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(result.length / rowsPerPage)));
      };

    const TableFull = () => {
      const startIndex = (currentPage - 1) * rowsPerPage;
      const visibleData = result.slice(startIndex, startIndex + rowsPerPage);

      if (result.length === 0) {
        return (
          <Tr>
            <Td colSpan={10} className="text-center">
              No data available
            </Td>
          </Tr>
        );
      }
      return visibleData.map((data, index) => (
        <Tr key={index}>
          <Td>{data.time}</Td>
          <Td>{data.Alarm_Chiller}</Td>
          <Td>{data.Status_Chiller}</Td>
          <Td>{data.Fan_Kondensor}</Td>
          <Td>{data.Status_Kompresor}</Td>
          <Td>{data.Bodi_Chiller}</Td>
          <Td>{data.KisiKisi_Kondensor}</Td>
          <Td>{data.Lvl_Oil_Sight_Glass_Atas}</Td>
          <Td>{data.Lvl_Oil_Sight_Glass_Bawah}</Td>
          <Td>{data.Jalur_Sight_Glass_EXP_Valve}</Td>
          <Td>{data.Operator}</Td>
          <Td>{data.Engineer}</Td>
          <Td>{data.Utility_SPV}</Td>
          <Td>{data.Active_Setpoint}</Td>
          <Td>{data.Evap_LWT}</Td>
          <Td>{data.Evap_EWT}</Td>
          <Td>{data.Unit_Capacity_Full}</Td>
          <Td>{data.Outdoor_Temperature}</Td>
          <Td>{data.Unit_Capacity_Kompresor}</Td>
          <Td>{data.Evap_Pressure_Kompresor}</Td>
          <Td>{data.Cond_Pressure_Kompresor}</Td>
          <Td>{data.Evap_Sat_Temperature_Kompresor}</Td>
          <Td>{data.Cond_Sat_Temperature_Kompresor}</Td>
          <Td>{data.Suction_Temperature_Kompresor}</Td>
          <Td>{data.Discharge_Temperature_Kompresor}</Td>
          <Td>{data.Suction_SH_Kompresor}</Td>
          <Td>{data.Discharge_SH_Kompresor}</Td>
          <Td>{data.Evap_Approach_Kompresor}</Td>
          <Td>{data.Evap_Design_Approach_Kompresor}</Td>
          <Td>{data.Cond_Approach_Kompresor}</Td>
          <Td>{data.Oil_Pressure_Kompresor}</Td>
          <Td>{data.Oil_Pressure_Differential_Kompresor}</Td>
          <Td>{data.EXV_Position_Kompresor}</Td>
          <Td>{data.Run_Hour_Kompressor}</Td>
          <Td>{data.Ampere_Kompressor}</Td>
          <Td>{data.No_Of_Start_Kompresor}</Td>
          <Td>{data.Total_Fan_ON_Kompresor}</Td>
          <Td>{data.Tekanan_Return_Chiller}</Td>
          <Td>{data.Tekanan_Supply_Chiller}</Td>
          <Td>{data.Inlet_Softwater}</Td>
          <Td>{data.Pompa_CHWS_1}</Td>
          <Td>{data.Suhu_sebelum_Pompa_Supply}</Td>
          <Td>{data.Suhu_sesudah_Pompa_Supply}</Td>
          <Td>{data.Tekanan_Sebelum_Pompa_Supply}</Td>
          <Td>{data.Tekanan_Sesudah_Pompa_Supply}</Td>
          <Td>{data.Pompa_CHWR_1}</Td>
          <Td>{data.Suhu_sebelum_Pompa_Return}</Td>
          <Td>{data.Suhu_sesudah_Pompa_Return}</Td>
          <Td>{data.Tekanan_Sebelum_Pompa_Return}</Td>
          <Td>{data.Tekanan_Sesudah_Pompa_Return}</Td>
          <Td>{data.Tegangan_RS}</Td>
          <Td>{data.Tegangan_ST}</Td>
          <Td>{data.Tegangan_TR}</Td>
          <Td>{data.Ampere_RS}</Td>
          <Td>{data.Ampere_ST}</Td>
          <Td>{data.Ampere_TR}</Td>
          <Td>{data.Grounding_Ampere}</Td>
        </Tr>
      ));
    };

  return (
    <div>
      <br />
      <form>
        {list.map((list, index) => (   
        <div key={index}>
          <div className=" grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 justify-center mb-4">
            <div>
              <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Area</h5>
              <Select value = {list.area} name="area" placeholder="Select Area" sx={{border: "1px solid", borderColor: borderColor, borderRadius: "0.332rem", background: "var(--color-background)", _hover: {borderColor: hoverBorderColor},}}
                onChange={(e) => handleListChange(e, index)}>
                <option value="R-ActiSetpoiCH">Active Setpoint</option>
                <option value="R-EvapLWTCH">Evap LWT</option>
                <option value="R-EvapEWTCH">Evap EWT</option>
                <option value="R-UnitCapCH">Unit Capacity Full</option>
                <option value="R-OutTempCH">Outdoor Temperature</option>

                <option value="R-Capacity">Unit Capacity Kompresor</option>
                <option value="R-EvapPress">Evap Pressure Kompresor</option>
                <option value="R-CondPress">Cond Pressure Kompresor</option>
                <option value="R-EvapSatTe">Evap Sat Temperature Kompresor</option>
                <option value="R-ConSatTem">Cond Sat Temperature Kompresor</option>
                <option value="R-SuctiTemp">Suction Temperature Kompresor</option>
                <option value="R-DischTemp">Discharge Temperature Kompresor</option>
                <option value="R-SuctionSH">Suction SH Kompresor</option>
                <option value="R-DischarSH">Discharge SH Kompresor</option>
                <option value="R-EvapAppro">Evap Approach Kompresor</option>
                <option value="R-EvaDsgApp">Evap Design Approach Kompresor</option>
                <option value="R-CondAppro">Cond Approach Kompresor</option>
                <option value="R-OilPress">Oil Pressure Kompresor</option>
                <option value="R-OilPresDf">Oil Pressure Differential Kompresor</option>
                <option value="R-EXVPositi">EXV Position Kompresor</option>
                <option value="R-RunHour">Run Hour Kompressor </option>
                <option value="R-Ampere">Ampere Kompressor </option>
                <option value="R-No.Start">No. Of Start Kompresor</option>
                <option value="H-FanOutdor">Total Fan ON Kompresor</option>

                <option value="H-TknReturnCH">Tekanan Return Chiller</option>
                <option value="H-TknSupplyCH">Tekanan Supply Chiller</option>
                <option value="H-InletSoftCH">Inlet Softwater</option>
                <option value="O-StatONPS">Pompa CHWS 1</option>
                <option value="H-ShuSebPmSupCH">Suhu sebelum Pompa Supply</option>
                <option value="H-ShuSesPmSupCH">Suhu sesudah Pompa Supply</option>
                <option value="H-PreSebPmSupCH">Tekanan Sebelum Pompa Supply</option>
                <option value="H-PreSesPomSpCH">Tekanan Sesudah Pompa Supply</option>
                <option value="O-StatONPR">Pompa CHWR 1</option>
                <option value="H-SuhSbPomRetCH">Suhu sebelum Pompa Return</option>
                <option value="H-SuhSesPmRetCH">Suhu sesudah Pompa Return</option>
                <option value="H-PreSebPomRtCH">Tekanan Sebelum Pompa Return</option>
                <option value="H-PrSesPomRetCH">Tekanan Sesudah Pompa Return</option>
                <option value="RP-TegR-SCH">Tegangan R-S</option>
                <option value="RP-TegS-TCH">Tegangan S-T</option>
                <option value="RP-TegT-RCH">Tegangan T-R</option>
                <option value="RP-AmpR-SCH">Ampere R-S</option>
                <option value="RP-AmpS-TCH">Ampere S-T</option>
                <option value="RP-AmpT-RCH">Ampere T-R</option>
                <option value="H-GroundAmperCH">Grounding Ampere</option>
              </Select>
            </div>
            <div>
              <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Chiller</h5>
              <Select value = {list.chiller} name="chiller" placeholder="Select Chiller" sx={{border: "1px solid", borderColor: borderColor, borderRadius: "0.332rem", background: "var(--color-background)", _hover: {borderColor: hoverBorderColor},}}
                onChange={(e) => handleListChange(e, index)}>
                <option value="1">Chiller 1</option>
                <option value="2">Chiller 2</option>
                <option value="3">Chiller 3</option>
              </Select>
            </div>
            <div>
              <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Kompresor</h5>
              <Select value = {list.komp} name="komp" placeholder="Full Chiller" sx={{border: "1px solid", borderColor: borderColor, borderRadius: "0.332rem", background: "var(--color-background)", _hover: {borderColor: hoverBorderColor},}}
                onChange={(e) => handleListChange(e, index)}>
                <option value="K1CH">Kompresor 1</option>
                <option value="K2CH">Kompresor 2</option>
              </Select>
            </div>
            <div>
              <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Start Time</h5>
              <Input
                onChange={(e) => handleListChange(e, index)}
                placeholder="Select Date and Time"
                size="md"
                type="date"
                value = {list.start} name="start"
                css={{
                  "&::-webkit-calendar-picker-indicator": {
                    color: isDarkMode ? "white" : "black",
                    filter: isDarkMode ? "invert(1)" : "none",
                  },
                }}
                sx={{
                  border: "1px solid",
                  borderColor: borderColor,
                  borderRadius: "0.332rem",
                  background: "var(--color-background)", // background color from Tailwind config
        
                  _hover: {
                    borderColor: hoverBorderColor,
                  },
                }}/> 
            </div>
            <div>
              <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Finish Time</h5>
              <Input
                onChange={(e) => handleListChange(e, index)}
                placeholder="Select Date and Time"
                size="md"
                type="date"
                value = {list.finish} name="finish"
                css={{
                  "&::-webkit-calendar-picker-indicator": {
                    color: isDarkMode ? "white" : "black",
                    filter: isDarkMode ? "invert(1)" : "none",
                  },
                }}
                sx={{
                  border: "1px solid",
                  borderColor: borderColor,
                  borderRadius: "0.332rem",
                  background: "var(--color-background)", // background color from Tailwind config
        
                  _hover: {
                    borderColor: hoverBorderColor,
                  },
                }}/>
            </div>
            <div className="flex justify-center md:justify-center xl:justify-start items-center">
              <Button
                className="mt-7 w-full md:w-32 xl:w-20"
                colorScheme="red"
                onClick={() => handleDeleteList(index)}>
                Delete
              </Button>
            </div>
          </div>
        </div> 
        ))}
      </form>
      <Stack
        className="flex flex-row justify-center mb-4  "
        direction="row"
        spacing={4}
        align="center">
        <div>
          <Button
            isDisabled={state}
            colorScheme="cyan"
            onClick={handleAddlist}>
            Compare
          </Button>
        </div>
        <div>
          <Button
            colorScheme="blue"
            onClick={() => {fetchDataChiller();}}>
            Submit
          </Button>
        </div>
      </Stack>
      <div className="flex flex-row justify-center mx-8 bg-transparent rounded-md p-1" style={{ backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff' }}> 
      {loading ? (
      <div className="flex flex-col items-center">
        <Spinner
          thickness="4px"
          speed="0.65s"
          emptyColor="gray.200"
          color="blue.500"
          size="xl"
        />
      </div>
      ) : error ? (
        <div className="text-red-500 flex flex-col items-center">No available data</div>
      ) : (
        <CanvasJSChart className="" options={options} />
      )}
      </div>
      <br />
      <Box className="w-full mb-4">
        {/* ini buat tampilan yg xl atau yg lagi fullscreen*/}
        <Flex 
          display={{ base: 'none', xl: 'flex' }} 
          flexDirection="row" 
          gap="3" 
          alignItems="flex-end"
          flexWrap="nowrap">
          <Box flex="1">
            <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Chiller</h5>
            <Select placeholder="Select Chiller" onChange={chillerData} width="100%">
              <option value="1">Chiller 1</option>
              <option value="2">Chiller 2</option>
              <option value="3">Chiller 3</option>
            </Select>
          </Box>
          <Box flex="1">
            <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Kompresor</h5>
            <Select placeholder="Select Kompresor" onChange={KompData} width="100%">
              <option value="K1CH">Kompresor 1</option>
              <option value="K2CH">Kompresor 2</option>
            </Select>
          </Box>
          <Box flex="1">
            <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Start Time</h5>
            <Input
              onChange={dateStart}
              placeholder="Select Date and Time"
              size="md"
              type="date"
              width="100%"
              css={{
                "&::-webkit-calendar-picker-indicator": {
                  color: isDarkMode ? "white" : "black",
                  filter: isDarkMode ? "invert(1)" : "none",
                },
              }}
              sx={{border: "1px solid", borderColor: borderColor, borderRadius: "0.332rem", background: "var(--color-background)", _hover: {borderColor: hoverBorderColor},}}/> 
          </Box>
          <Box flex="1">
            <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Finish Time</h5>
            <Input
              onChange={dateFinish}
              placeholder="Select Date and Time"
              size="md"
              type="date"
              width="100%"
              css={{
                "&::-webkit-calendar-picker-indicator": {
                  color: isDarkMode ? "white" : "black",
                  filter: isDarkMode ? "invert(1)" : "none",
                },
              }}
              sx={{border: "1px solid", borderColor: borderColor, borderRadius: "0.332rem", background: "var(--color-background)", _hover: {borderColor: hoverBorderColor},}}/>
          </Box>
          <Button
            colorScheme="blue"
            onClick={() => fetchChillerTable()}
            disabled={loadingTable}
          >
            {loadingTable ? "Loading..." : "Submit"}
          </Button>
          <Button
            colorScheme="red"
            onClick={() => setIsTableVisible(!isTableVisible)}
          >
            {isTableVisible ? "Hide All Data" : "Show All Data"}
          </Button>
        </Flex>
        
      {/* Ini buat tampilan layar ketika md: inputs in first row, buttons in second row */}
      <Box display={{ base: 'none', md: 'block', xl: 'none' }}>
        <SimpleGrid columns={4} spacing="3" mb="3">
          <Box>
            <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Chiller</h5>
            <Select placeholder="Select Chiller" onChange={chillerData} width="100%" sx={{border: "1px solid", borderColor: borderColor, borderRadius: "0.332rem", background: "var(--color-background)", _hover: {borderColor: hoverBorderColor},}}>
              <option value="1">Chiller 1</option>
              <option value="2">Chiller 2</option>
              <option value="3">Chiller 3</option>
            </Select>
          </Box>
          <Box>
            <h5 className="mb-1 truncate" style={{ color: isDarkMode ? 'white' : 'black' }}>Kompresor</h5>
            <Select placeholder="Select Kompresor" onChange={KompData} width="100%" sx={{border: "1px solid", borderColor: borderColor, borderRadius: "0.332rem", background: "var(--color-background)", _hover: {borderColor: hoverBorderColor},}}>
              <option value="K1CH">Kompresor 1</option>
              <option value="K2CH">Kompresor 2</option>
            </Select>
          </Box>
          <Box>
            <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Start Time</h5>
            <Input
              onChange={dateStart}
              placeholder="Select Date and Time"
              size="md"
              type="date"
              width="100%"
              css={{
                "&::-webkit-calendar-picker-indicator": {
                  color: isDarkMode ? "white" : "black",
                  filter: isDarkMode ? "invert(1)" : "none",
                },
              }}
              sx={{border: "1px solid", borderColor: borderColor, borderRadius: "0.332rem", background: "var(--color-background)", _hover: {borderColor: hoverBorderColor},}}/> 
          </Box>
          <Box>
            <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Finish Time</h5>
            <Input
              onChange={dateFinish}
              placeholder="Select Date and Time"
              size="md"
              type="date"
              width="100%"
              css={{
                "&::-webkit-calendar-picker-indicator": {
                  color: isDarkMode ? "white" : "black",
                  filter: isDarkMode ? "invert(1)" : "none",
                },
              }}
              sx={{border: "1px solid", borderColor: borderColor, borderRadius: "0.332rem", background: "var(--color-background)", _hover: {borderColor: hoverBorderColor},}}/>
          </Box>
        </SimpleGrid>
        <Flex justifyContent="center" gap="3">
          <Button
            colorScheme="blue"
            onClick={() => fetchChillerTable()}
            disabled={loadingTable}
          >
            {loadingTable ? "Loading..." : "Submit"}
          </Button>
          <Button
            colorScheme="red"
            onClick={() => setIsTableVisible(!isTableVisible)}
          >
            {isTableVisible ? "Hide All Data" : "Show All Data"}
          </Button>
        </Flex>
      </Box>

      {/* For mobile/small screens: default grid layout w-full semua kecuali 2 button yg sejajar */}
      <Box display={{ base: 'block', md: 'none' }}>
        <SimpleGrid columns={[1, 2]} spacing="3" mb="3">
          <Box>
            <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Chiller</h5>
            <Select placeholder="Select Chiller" onChange={chillerData} width="100%">
              <option value="1">Chiller 1</option>
              <option value="2">Chiller 2</option>
              <option value="3">Chiller 3</option>
            </Select>
          </Box>
          <Box>
            <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Kompresor</h5>
            <Select placeholder="Select Kompresor" onChange={KompData} width="100%">
              <option value="K1CH">Kompresor 1</option>
              <option value="K2CH">Kompresor 2</option>
            </Select>
          </Box>
          <Box>
            <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Start Time</h5>
            <Input
              onChange={dateStart}
              placeholder="Select Date and Time"
              size="md"
              type="date"
              width="100%"
              css={{
                "&::-webkit-calendar-picker-indicator": {
                  color: isDarkMode ? "white" : "black",
                  filter: isDarkMode ? "invert(1)" : "none",
                },
              }}
            /> 
          </Box>
          <Box>
            <h5 className="mb-1" style={{ color: isDarkMode ? 'white' : 'black' }}>Finish Time</h5>
            <Input
              onChange={dateFinish}
              placeholder="Select Date and Time"
              size="md"
              type="date"
              width="100%"
              css={{
                "&::-webkit-calendar-picker-indicator": {
                  color: isDarkMode ? "white" : "black",
                  filter: isDarkMode ? "invert(1)" : "none",
                },
              }}
            />
          </Box>
        </SimpleGrid>
        <Flex justifyContent="center" gap="3">
          <Button
            colorScheme="blue"
            onClick={() => fetchChillerTable()}
            disabled={loadingTable}
          >
            {loadingTable ? "Loading..." : "Submit"}
          </Button>
          <Button
            colorScheme="red"
            onClick={() => setIsTableVisible(!isTableVisible)}
          >
            {isTableVisible ? "Hide All Data" : "Show All Data"}
          </Button>
        </Flex>
      </Box>
    </Box>
      <Stack className="flex flex-row justify-center gap-2"
        direction="row"
        spacing={2}
        align="center">
        <div>
          <Select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
            width="80px">
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={40}>40</option>
            <option value={60}>60</option>
            <option value={100}>100</option>
          </Select>
        </div>
        <div>
          <ExportToExcel apiData={result} fileName={fileName} />
        </div>
      </Stack>
      <br />
      <div className="flex flex-col items-center bg-card shadow-lg">
        {loadingTable && <Spinner
        thickness="4px"
        speed="0.65s"
        emptyColor="gray.200"
        color="blue.500"
        size="xl" />}
        {errorTable && <p className="text-red-500">{errorTable}</p>}
      </div>
      {isTableVisible && !loadingTable && !errorTable && (
      <TableContainer sx={{
        background: kartuColor,
        borderRadius: "0.395rem",
        }}>
        <Table key={colorMode} variant="simple">
          <Thead>
            <Tr>
              <Th sx={{
                color: tulisanColor,
                }}>Date Time</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Alarm Chiller</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Status Chiller</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Fan Kondensor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Status Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Body Chiller</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Kisi-Kisi Kondensor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Lvl Oil Sight Glass Atas</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Lvl Oil Sight Glass Bawah</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Jalur Sight Glass EXP Valve</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Operator</Th>
              <Th sx={{
                color: tulisanColor,
                }}>OEngineer</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Utility SPV</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Active Setpoint</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Evap LWT</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Evap EWT</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Unit Capacity Full</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Outdoor Temperature</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Unit Capacity Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Evap Pressure Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Cond Pressure Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Evap Sat Temperature Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Cond Sat Temperature Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Suction Temperature Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Discharge Temperature Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Suction SH Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Discharge SH Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Evap Approach Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Evap Design Approach Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Cond Approach Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Oil Pressure Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Oil Pressure Differential Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>EXV Position Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Run Hour Kompressor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Ampere Kompressor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>No. Of Start Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Total Fan ON Kompresor</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Tekanan Return Chiller</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Tekanan Supply Chiller</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Inlet Softwater</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Pompa CHWS 1</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Suhu sebelum Pompa Supply</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Suhu sesudah Pompa Supply</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Tekanan Sebelum Pompa Supply</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Tekanan Sesudah Pompa Supply</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Pompa CHWR 1</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Suhu sebelum Pompa Return</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Suhu sesudah Pompa Return</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Tekanan Sebelum Pompa Return</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Tekanan Sesudah Pompa Return</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Tegangan R-S</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Tegangan S-T</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Tegangan T-R</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Ampere R-S</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Ampere S-T</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Ampere T-R</Th>
              <Th sx={{
                color: tulisanColor,
                }}>Grounding Ampere</Th>
            </Tr>
          </Thead>
          <Tbody>{TableFull()}</Tbody>
        </Table>
      </TableContainer>
      )}
      {/* Pagination Controls */}
      <div className="flex justify-center items-center mt-4 gap-4">
        <Button
          onClick={handlePrevPage}
          isDisabled={currentPage === 1}
          colorScheme="blue"
        >
          Previous
        </Button>
        <span className="text-text">
          Page {currentPage} of {Math.ceil(result.length / rowsPerPage)}
        </span>
        <Button
          onClick={handleNextPage}
          isDisabled={currentPage === Math.ceil(result.length / rowsPerPage)}
          colorScheme="blue"
        >
          Next
        </Button>
      </div>
    </div>
  );
}