import { useEffect, useState } from "react";
import CanvasJSReact from "../canvasjs.react";
import axios from "axios";
import moment from "moment-timezone";

import {
  CircularProgress,
  CircularProgressLabel,
  Progress,
} from "@chakra-ui/react";

import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableCaption,
  TableContainer,
  Button,
  Stack,
  Input,
  Select,
  Card,
  CardBody,
  Heading,
  Text,
  Spinner
} from "@chakra-ui/react";
import { useColorMode, useColorModeValue } from "@chakra-ui/react";

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

function ProductionSummary() {
  const [oeeCm1, setOeeCm1] = useState([]);
  const [oeeVar, setVarOee] = useState([{ Ava: 0, Per: 0, Qua: 0, oee: 0 }]);
  const [avaLine, setAvaLine] = useState([]);
  const [perLine, setPerLine] = useState([]);
  const [quaLine, setQuaLine] = useState([]);

  const [totalOut, setTotalOut] = useState();
  const [totalRun, setTotalRun] = useState();
  const [totalStop, setTotalStop] = useState();
  const [totalIdle, setTotalIdle] = useState();
  const [totalSpeed, setTotalSpeed] = useState();
  const [oeeChart, setOeeChart] = useState();
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [machineData, setMachine] = useState();
  const [startDate, setStartDate] = useState();
  const [finishDate, setFinishDate] = useState();

const [isFiltered, setIsFiltered] = useState(false);


  const [showAlert, setShowAlert] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { colorMode } = useColorMode();
  const [isTableVisible, setIsTableVisible] = useState(true);
  const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
  const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");
  const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");
  const kartuColor = useColorModeValue("rgba(var(--color-card))", "rgba(var(--color-card))");

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  
  const handleNextPage = () => {
    if (currentPage < Math.ceil(oeeCm1.length / rowsPerPage)) {
      setCurrentPage(currentPage + 1);
    }
  };

  var visitorsChartDrilldownHandler = (e) => {
    //console.log(e.dataPoint.name);
  };

  // mezanine.tengah_Cm1_data
const fetchData = async (data, start, finish) => {
  try {
    let response = await axios.get("http://10.126.15.197:8002/part/oee", {
      params: {
        machine: data,
        start: start,
        finish: finish,
      },
    });

    if (!response.data || response.data.length === 0) {
      alert("No data available for the selected range.");
      return; // Exit early if no data
    }

    // kode dari MAX VALID sampai isValidPerformance ini buat filter tabel yang paling bawah, kan ada nilai yg kocag tuh 
    // nilai yg kocag akan di filter ilang
    const MAX_VALID_PERFORMANCE = 200;

    // Function untuk ngecek apakah ada nilai yg valid
    const isValidPerformance = (value) => {
      return (
        typeof value === 'number' &&
        isFinite(value) &&
        value <= MAX_VALID_PERFORMANCE &&
        value >= 0 &&
        // Tambahan cek khusus untuk nilai yang sangat besar
        value !== Number.MAX_VALUE &&
        value < 1.8e+308  // Menangkap nilai yang mendekati MAX_VALUE
      );
    };

    let response1 = await axios.get(
      "http://10.126.15.197:8002/part/variableoee",
      {
        params: {
          machine: data,
          start: start,
          finish: finish,
        },
      }
    );
    
    console.log(response.data);
    console.log(response1.data);

    setOeeCm1(response.data);
    setVarOee(response1.data);

    // console.log(oeeChart);


// This function needs to be used BEFORE generating avaLine, perLine, etc.

const filterHistoricalData = (data, isFiltered) => {
    if (!isFiltered) {
        return data;
    }

    return data.filter(row => {
        // Assume row structure has properties like 'avability' and 'time' (Unix timestamp)
        const isAvailable = Number(row.avability) > 0;
        
        // Weekend Check: 0=Sunday, 6=Saturday
        const dayOfWeek = moment.unix(row.time).utc().day(); 
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; 
        
        // Only keep the data point if it was active and occurred on a weekday
        return isAvailable && isWeekday;
    });
};

// Availability
var resultAva = [];
for (var i = 0; i < response.data.length; i++) {
  if (response.data[i].avability != null && response.data[i].time != null) {
    var objAva = {
      // Use moment.unix() to create a UTC-based moment object
    x: new Date(response.data[i].time * 1000), 
      y: Number(response.data[i].avability.toFixed(2)),
    };
    resultAva.push(objAva);
  }
}
setAvaLine(resultAva);

// Filter dan proses data performance
const resultPer = Array.isArray(response.data)
  ? response.data.filter(item => item.performance != null && item.time != null)
  : [];

const filteredData = resultPer.map(item => ({
  // Convert the Unix timestamp to a WIB Date object
  x: new Date(item.time * 1000), 
  y: Number(item.performance.toFixed(2)),
}));
setPerLine(filteredData);


// setPerLine(resultPer);

console.log(perLine);
console.log(resultPer);

// Quality
var resultQua = [];
for (i = 0; i < response.data.length; i++) {
  if (response.data[i].quality != null) { // Check for null data
    var objQua = {
      x: new Date(response.data[i].time * 1000),
      y: Number(response.data[i].quality.toFixed(2)),
    };
    resultQua.push(objQua);
  }
}
setQuaLine(resultQua);


    //Output==================================
    let objOut = 0;
    for (i = 0; i < response.data.length; i++) {
      objOut += Number(response.data[i].output);
    }
    setTotalOut(objOut);

    //Runtime====================================
    let objRun = 0;
    for (i = 0; i < response.data.length; i++) {
      objRun += Number(response.data[i].runTime);
    }
    setTotalRun(objRun);

    //Stop==================================
    let objStop = 0;
    for (i = 0; i < response.data.length; i++) {
      objStop += Number(response.data[i].stopTime);
    }
    setTotalStop(objStop);

    //Idle====================================
    let objIdle = 0;
    for (i = 0; i < response.data.length; i++) {
      objIdle += Number(response.data[i].idleTime);
    }
    setTotalIdle(objIdle);

    //Speed========================================
    // Add a check to prevent division by zero and a null check for objRun
    let objSpeed = (objOut != null && objRun > 0) ? ((objOut * 25) / 4 / objRun).toFixed(1) : "0";

    setTotalSpeed(objSpeed);

    // OEE CHART========================================
    var OeeChart = [];
    for (let i = 0; i < response.data.length; i++) {
      // Check if 'oee' is a valid number before using toFixed()
      let oeeValue = response.data[i].oee != null ? Number(response.data[i].oee.toFixed(2)) : 0;
      
      var objOeeChart = {
        label: moment
            .unix(response.data[i].time) // Correctly handles the Unix timestamp
            .tz("UTC") // Applies the target timezone directly
            .format("YYYY-MM-DD HH:mm"),
         y: oeeValue,
      };
      OeeChart.push(objOeeChart);
    }
    setOeeChart(OeeChart);
    
  } catch (error) {
    console.error("Error fetching data:", error);
    alert("Failed to fetch data. Please check your network connection or try again.");
    // You might also want to clear states on error
    setOeeCm1([]);
    setVarOee([]);
    // Clear other states as well
    setAvaLine([]);
    setPerLine([]);
    setQuaLine([]);
    setTotalOut(0);
    setTotalRun(0);
    setTotalStop(0);
    setTotalIdle(0);
    setTotalSpeed(0);
    setOeeChart([]);
  }
};
// ...existing code...

  let changeMachine = (e) => {
    var dataInput = e.target.value;
    setMachine(dataInput);
  };

let dateStart = (e) => {
  var dataInput = e.target.value;
  let unixInput = Math.floor(new Date(dataInput).getTime() / 1000);
  let unixNow = Math.floor(new Date().getTime() / 1000);

  // Check if the selected date is not in the future
  if (unixInput <= unixNow) {
    setStartDate(unixInput);
  } else {
    alert("The start date cannot be in the future.");
    // Optionally, clear the input field after an invalid selection
    e.target.value = '';
  }
};

let dateFinish = (e) => {
  var dataInput = e.target.value;
  let unixInput = Math.floor(new Date(dataInput).getTime() / 1000);
  let unixNow = Math.floor(new Date().getTime() / 1000);

  // Check if the selected date is not in the future
  if (unixInput <= unixNow) {
    setFinishDate(unixInput);
  } else {
    alert("The end date cannot be in the future.");
    // Optionally, clear the input field after an invalid selection
    e.target.value = '';
  }
};


let submitData = () => {
    // Check if a machine has been selected
    if (!machineData) {
        alert("Please select a machine.");
        return; // Stop the function if no machine is selected
    }

    // Existing date validation
    if (startDate && finishDate && startDate <= finishDate) {
        fetchData(machineData, startDate, finishDate);
    } else {
        alert("The start date cannot be later than the end date.");
    }
};

  

// Add a check before performing the calculation
let oeeCalculation = 0; // Default to 0
if (oeeVar && oeeVar[0] && oeeVar[0].Ava != null && oeeVar[0].Per != null && oeeVar[0].Qua != null) {
  oeeCalculation =
    (oeeVar[0].Ava / 100) * (oeeVar[0].Per / 100) * (oeeVar[0].Qua / 100) * 100;
}

// Add these variables and functions at the top of your component function
const toggleFilter = () => {
    setIsFiltered(prev => !prev);
};

// 💡 FIX: The primary filtering function that uses your moment.js date structure
const filterData = (data) => {
    if (!isFiltered) {
        return data; // Show all data if the filter is off
    }

    return data.filter(row => {
        // 1. Availability Check: Only keep rows where AVAILABILITY is greater than 0
        const isAvailable = Number(row.avability) > 0;

        // 2. Weekend Check: Use moment.unix() to get the day of the week
        // We check the UNIX timestamp in the 'time' property of the row object.
        const dayOfWeek = moment.unix(row.time).utc().day(); // 0=Sunday, 6=Saturday
        
        // true if it's a weekday (Monday=1 through Friday=5)
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5; 
        
        // 3. Combined Condition: Only show rows that were available AND occurred on a weekday
        return isAvailable && isWeekday;
    });
};

const renderCm1 = (isFiltered) => {
    // Initial check for no data (remains the same)
    if (!oeeCm1 || !Array.isArray(oeeCm1)) {
        return (
            <Tr>
                <Td colSpan={10} textAlign="center" display="table-cell" className="text-red-500">
                    No data available
                </Td>
            </Tr>
        );
    }
    
    // 1. Filter data anomalies and assign to a MUTABLE variable
    let processedData = oeeCm1.filter(cm1 => {
        // Cek apakah performance adalah nilai yang wajar
        return (
            isFinite(cm1.performance) &&
            cm1.performance <= 200 &&
            cm1.performance >= 0
        );
    });

    // 2. 💡 CRITICAL FIX: Apply Availability and Weekend Filters if requested
    if (isFiltered) {
        // Re-assign processedData by filtering it further.
        processedData = processedData.filter(cm1 => { // 💡 FIX 2: Changed 'row' to 'cm1'
            
            // Availability Check: Only keep rows where AVAILABILITY is > 0
            const isAvailable = Number(cm1.avability) > 0;
            
            // Weekend Check: Use moment.unix() to get the day of the week
            const dayOfWeek = moment.unix(cm1.time).utc().day(); // 0=Sunday, 6=Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; 
        
             // Rule: A row is filtered OUT (returns false) ONLY IF BOTH conditions are met.
             const shouldBeFilteredOut = (cm1.avability === 0) && isWeekend;

             // We return the inverse: If it SHOULD be filtered out, return false; otherwise, return true.
             return !shouldBeFilteredOut;
        });
    }

    // 3. Handle data availability after all filters have run
    if (processedData.length === 0) { // 💡 FIX 3: Check processedData, not filteredOeeCm1
        return (
            <Tr>
                <Td colSpan={10} textAlign="center" display="table-cell" className="text-red-500">
                    No data available
                </Td>
            </Tr>
        );
    }
 
    // 4. Pagination (Uses the final processedData)
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentData = processedData.slice(indexOfFirstRow, indexOfLastRow);

    // 5. Render final rows (remains the same)
    return currentData.map((cm1, index) => (
        <Tr key={cm1.id}>
            <Td>{indexOfFirstRow + index + 1}</Td>
            <Td>
                {moment.unix(cm1.time).utc().format("YYYY-MM-DD HH:mm")}
            </Td>
            <Td className="bg-blue-400"> {cm1.avability != null ? cm1.avability.toFixed(2) : 'N/A'} </Td>
            <Td className="bg-green-400"> {cm1.performance != null ? cm1.performance.toFixed(2) : 'N/A'} </Td>
            <Td className="bg-red-400"> {cm1.quality != null ? cm1.quality.toFixed(2) : 'N/A'} </Td>
            <Td> {cm1.oee != null ? cm1.oee.toFixed(2) : 'N/A'} </Td>
            <Td>{cm1.output}</Td>
            <Td>{cm1.runTime}</Td>
            <Td>{cm1.stopTime}</Td>
            <Td>{cm1.idleTime}</Td>
        </Tr>
    ));
};

const oeeData = oeeVar && oeeVar[0];
const ava = Number(oeeData?.Ava) || 0;
const per = Number(oeeData?.Per) || 0;
const qua = Number(oeeData?.Qua) || 0;


const [showRawPerformance, setShowRawPerformance] = useState(false);

// Function to toggle the state when the button is clicked
const togglePerformanceView = () => {
    setShowRawPerformance(prev => !prev);
};


// PERFORMANCE LOGIC
const rawPerformance = per;
const cappedPerformance = Math.min(per, 100);

// Variables for the bottom Performance chart
const rawPerformanceDisplay = rawPerformance.toFixed(2); // "117.03"
const cappedPerformanceDisplay = cappedPerformance.toFixed(2); // "100.00"
const currentPerformanceValue = showRawPerformance ? rawPerformanceDisplay : cappedPerformanceDisplay;

const oeePerformanceYValue = showRawPerformance ? rawPerformance : cappedPerformance;
const cappedOeeScore = (ava / 100) * (cappedPerformance / 100) * (qua / 100) * 100;
const rawOeeScore = (ava / 100) * (rawPerformance / 100) * (qua / 100) * 100;
const currentOeeScore = showRawPerformance ? rawOeeScore : cappedOeeScore;
const currentOeeDisplay = currentOeeScore != null && !isNaN(currentOeeScore) ? currentOeeScore.toFixed(2) : 'N/A';

// Access the current time variables
const totalRuntime = Number(totalRun) || 0;
const totalIdletime = Number(totalIdle) || 0;
const totalStoptime = Number(totalStop) || 0;

// Calculate the consistent baseline (Planned Production Time)
const plannedProductionTime = totalRun + totalIdle + totalStop;

//  Calculate the correct percentage for each bar
let runtimePercent = 0;
let idletimePercent = 0;
let stoptimePercent = 0;

if (plannedProductionTime > 0) {
    runtimePercent = (totalRuntime / plannedProductionTime) * 100;
    idletimePercent = (totalIdletime / plannedProductionTime) * 100;
    stoptimePercent = (totalStoptime / plannedProductionTime) * 100;
}

const totalGood = Number(totalOut) || 0;
const totalAfkir = 0;
const totalProduct = totalGood + totalAfkir;

let goodProductPercent = 0;
let afkirProductPercent = 0;

if (totalProduct > 0) {
    goodProductPercent = (totalGood / totalProduct) * 100;
    afkirProductPercent = (totalAfkir / totalProduct) * 100;
}

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

    const options = {
      responsive: true,
      theme: isDarkMode ? "dark2" : "light2",
      animationEnabled: true,
      title: {
        text: "Overall Equipment Effectiveness",
        fontColor: isDarkMode ? "white" : "black"
      },
      subtitles: [
        {
          //text: `${oeeCalculation.oee.toFixed(2)}% OEE`,
          text: `${currentOeeDisplay}% OEE`,
          verticalAlign: "center",
          fontSize: 26,
          dockInsidePlotArea: true,
          fontColor: isDarkMode ? "white" : "black",
        },
      ],
      backgroundColor: isDarkMode ? "#171717" : "#ffffff",
      // height: 410, //buat naikin tinggi 


      data: [
        {
          click: visitorsChartDrilldownHandler,
          type: "doughnut",
          showInLegend: true,
          indexLabel: "{name}: {y}",
          yValueFormatString: "#,###'%'",

        dataPoints: oeeVar && oeeVar[0] ? [
          { name: "Availability", y: oeeVar[0].Ava },
          { name: "Performance", y: currentPerformanceValue },
          { name: "Quality", y: oeeVar[0].Qua },
        ] : [
          // Default data points to prevent error
          { name: "Availability", y: 0 },
          { name: "Performance", y: 0 },
          { name: "Quality", y: 0 },
          ],
        },
      ],
    };

    const options1 = {
      responsive: true,
      zoomEnabled: true,
      theme: isDarkMode ? "dark2" : "light2",
      title: {
        text: "OEE",
        fontColor: isDarkMode ? "white" : "black",
      },
      subtitles: [
        {
          text: "instrument production",
          fontColor: isDarkMode ? "white" : "black",
        },
      ],
 axisX: {
    valueFormatString: "DD-MMM-YY HH:mm", 
    valueType: "dateTime",
    timeZone: "UTC",
    title: "Date",
    labelAutoFit: true, // Automatically adjusts labels to prevent overlap
  },
      axisY: {
        prefix: "",
        maximum: 160,
      },
      toolTip: {
        shared: true,
      },
      backgroundColor: isDarkMode ? "#171717" : "#ffffff",
      borderRadius: 12, // Membuat sudut melengkung (mirip rounded-lg)
      margin: {
        top: 10,
        left: 10,
        right: 10,
        bottom: 10,
      },
      data: [
        {
          type: "spline",
          name: "Avability",
          showInLegend: true,
          xValueFormatString: "",
          yValueFormatString: "",
          dataPoints: avaLine,
        },
        {
          type: "spline",
          name: "Performance",
          showInLegend: true,
          xValueFormatString: "",
          yValueFormatString: "",
          dataPoints: perLine,
        },
        {
          type: "spline",
          name: "Quality",
          showInLegend: true,
          xValueFormatString: "",
          yValueFormatString: "",
          dataPoints: quaLine,
        },
      ],
    };

    const options3 = {
      theme: isDarkMode ? "dark2" : "light2",
      animationEnabled: true,
      responsive: true,
      title: {
        text: "OEE Shift",
        fontColor: isDarkMode ? "white" : "black",
      },
      backgroundColor: isDarkMode ? "#171717" : "#ffffff",
      data: [
        {
          // Change type to "doughnut", "line", "splineArea", etc.
          type: "column",
          dataPoints: oeeChart,
        },
      ],
    };

  return (
    <>
      <div onDoubleClick={togglePerformanceView} 
    style={{ cursor: 'pointer' }} className="flex flex-col bg-background justify-center mx-12 gap-2 my-4 rounded-md shadow-md md:flex-row">
        <div className="w-full md:w-1/2">
          <CanvasJSChart options={options} />
        </div>
        <div className="w-full md:w-1/2">
          <CanvasJSChart options={options3} />
        </div>
      </div>
      <br />
      <div className="flex flex-col md:flex-row bg-background justify-center mx-1 pb-10 pr-0 gap-4">
        <Card
          direction={{ base: "column", sm: "row" }}
          overflow="hidden"
          variant="outline"
          sx={{
            borderRadius: "0.395rem",
            background: kartuColor,
          }}
        >

<div>
  
  {oeeVar && oeeVar[0] ? (
    <>
      <CircularProgress
        value={oeeVar[0].Ava != null ? Number(oeeVar[0].Ava.toFixed(2)) : 0}
        color="purple.400"
        size="225px"
        fontSize="150px"
        paddingLeft="10px"
        paddingTop="25px"
      >
        <CircularProgressLabel
          paddingLeft="10px"
          paddingTop="25px"
        >
          {oeeVar[0].Ava != null ? `${oeeVar[0].Ava.toFixed(2)}%` : 'N/A'}
        </CircularProgressLabel>
      </CircularProgress>
    </>
  ) : (
    // Render a placeholder or nothing if the data is not available
    <CircularProgress
      value={0}
      color="purple.400"
      size="200px"
      fontSize="150px"
    >
      <CircularProgressLabel>N/A</CircularProgressLabel>
    </CircularProgress>
  )}
</div>
          
          <Stack>
            <CardBody>
              <Heading size="md" mb={1}>Availability</Heading>

              <Text py="2">
                <Text mb={1} mt={1}>Runtime ({totalRun} Min)</Text>
                <Progress hasStripe value={runtimePercent} colorScheme="purple" />
                <Text mb={1} mt={1}>Idletime ({totalIdle} Min)</Text>
                <Progress hasStripe value={idletimePercent} colorScheme="purple" />
                <Text mb={1} mt={1}>Stoptime ({totalStop} Min)</Text>
                <Progress hasStripe value={stoptimePercent} colorScheme="purple" />
                <br />
                Availability is the ratio of Run Time to Planned Production
                Time.
              </Text>
            </CardBody>
          </Stack>
        </Card>

        <Card
          direction={{ base: "column", sm: "row" }}
          overflow="hidden"
          variant="outline"
          width=""
          sx={{
            borderRadius: "0.395rem",
            background: kartuColor,
          }}
        >
          <div>

  {oeeVar && oeeVar[0] ? (
    <>
      <CircularProgress
        value={oeeVar[0].Per != null ? Number(oeeVar[0].Qua.toFixed(2)) : 0}
        color="green.400"
        size="225px"
        fontSize="150px"
        paddingLeft="10px"
        paddingTop="25px"
      >
      <CircularProgressLabel
      paddingLeft="10px" 
      paddingTop="25px">
        {`${currentPerformanceValue}%`}
      </CircularProgressLabel>
      </CircularProgress>
    </>
  ) : (
    // Render a placeholder or nothing if the data is not available
    <CircularProgress
      value={0}
      color="green.400"
      size="200px"
      fontSize="150px"
    >
      <CircularProgressLabel>N/A</CircularProgressLabel>
    </CircularProgress>
  )}
</div>

          <Stack>
            <CardBody p={4}>
              <Heading size="md" mb={3}>Performance </Heading>
              <Text py="2">
                <Text mb={1}> Actual Speed: {totalSpeed} slave/min </Text>
                <Progress hasStripe value={totalSpeed} colorScheme="green" />
                <Text mb={1} mt={2}> Setpoint Speed: {totalSpeed} slave/min </Text>
                <Progress hasStripe value={totalSpeed} colorScheme="green" />
                <br />
                <Text> Performance is the second of the three OEE factors to be calculated. </Text>
                {/* <button onClick={togglePerformanceView} style={{ marginLeft: '10px', padding: '5px 10px', cursor: 'pointer' }}>
                    {buttonText}
                </button> */}
                
              </Text>
            </CardBody>
          </Stack>
        </Card>
        <Card
          direction={{ base: "column", sm: "row" }}
          overflow="hidden"
          variant="outline"
          className="basis-1/3 flex-shrink-0 flex-grow-0"
          sx={{
            borderRadius: "0.395rem",
            background: kartuColor,
          }}
        >
<div>
  {oeeVar && oeeVar[0] ? (
    <>
      <CircularProgress
        value={oeeVar[0].Qua != null ? Number(oeeVar[0].Qua.toFixed(2)) : 0}
        color="red.400"
        size="225px"
        fontSize="150px"
        paddingLeft="10px"
        paddingTop="25px"
      >
        <CircularProgressLabel
          paddingLeft="10px"
          paddingTop="25px"
        >
          {oeeVar[0].Per != null ? `${oeeVar[0].Qua.toFixed(2)}%` : 'N/A'}
        </CircularProgressLabel>
      </CircularProgress>
    </>
  ) : (
    // Render a placeholder or nothing if the data is not available
    <CircularProgress
      value={0}
      color="red.400"
      size="200px"
      fontSize="150px"
    >
      <CircularProgressLabel>N/A</CircularProgressLabel>
    </CircularProgress>
  )}
</div>
          <Stack>
    <CardBody p={4}>
      <Heading size="md" mb={4}> Quality </Heading>
        <Text mb={1}> Good Product: ({totalGood} Box) </Text>
            <Progress hasStripe value={goodProductPercent} colorScheme="red" mb={3} />
              <Text mb={1}> Afkir Product: ({totalAfkir} Box) </Text>
                 <Progress hasStripe value={afkirProductPercent} colorScheme="red" mb={3} />      
                <br />
         <Text> Quality takes into account manufactured parts that do not meet quality standards.</Text>
    </CardBody>
  </Stack>
        </Card>
      </div>
      <br />
      <div className="block bg-card rounded-lg shadow-lg p-4 mx-2 overflow-x-auto">
        <CanvasJSChart options={options1} />
      </div>
      <br />
    
      <div className="flex flex-col gap-4 p-4">
        {/* Input Fields and Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:flex xl:flex-row xl:justify-center gap-4 w-full">
          <div className="col-span-1 xl:flex-1">
            <label className="block text-sm font-medium leading-4 text-text">
              Machine
            </label>
            <Select
              onChange={changeMachine}
              sx={{
                border: "1px solid",
                borderColor: borderColor,
                borderRadius: "0.395rem",
                background: "var(--color-background)",
                _hover: {
                  borderColor: hoverBorderColor,
                },
              }}
            >
              <option disabled selected hidden value=""> Select Machine </option>
              <option value="mezanine.tengah_Cm1_data">Cm1</option>
              <option value="mezanine.tengah_Cm2_data">Cm2</option>
              <option value="mezanine.tengah_Cm3_data">Cm3</option>
              <option value="mezanine.tengah_Cm4_data">Cm4</option>
              <option value="mezanine.tengah_Cm5_data">Cm5</option>
              <option value="mezanine.tengah_Hm1_data">Hm1</option>
            </Select>
          </div>
          <div className="col-span-1 xl:flex-1">
            <label className="block text-sm font-medium leading-4 text-text">
              Start Time
            </label>
            <Input
              onChange={dateStart}
              placeholder="Select Date"
              size="md"
              type="date"
              css={{
                "&::-webkit-calendar-picker-indicator": {
                  color: isDarkMode ? "white" : "black",
                  filter: isDarkMode ? "invert(1)" : "none",
                },
              }}
              sx={{
                border: "1px solid",
                borderColor: borderColor,
                borderRadius: "0.395rem",
                background: "var(--color-background)",
                _hover: {
                  borderColor: hoverBorderColor,
                },
              }}
            />
          </div>
          <div className="col-span-1 xl:flex-1">
            <label className="block text-sm font-medium leading-4 text-text">
              Finish Time
            </label>
            <Input
              onChange={dateFinish}
              placeholder="Select Date and Time"
              size="md"
              type="date"
              css={{
                "&::-webkit-calendar-picker-indicator": {
                  color: isDarkMode ? "white" : "black",
                  filter: isDarkMode ? "invert(1)" : "none",
                },
              }}
              sx={{
                border: "1px solid",
                borderColor: borderColor,
                borderRadius: "0.395rem",
                background: "var(--color-background)",
                _hover: {
                  borderColor: hoverBorderColor,
                },
              }}
            />
          </div>
          <div className="col-span-1 xl:flex xl:flex-none xl:w-20 flex-col ">
            <label className="block text-sm font-medium leading-4 text-text">
              Rows
            </label>
            <Select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              width="80px"
              sx={{
                border: "1px solid",
                borderColor: borderColor,
                borderRadius: "0.395rem",
                background: "var(--color-background)",
                _hover: {
                  borderColor: hoverBorderColor,
                },
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
              <option value={60}>60</option>
              <option value={100}>100</option>
            </Select>
          </div>
          <div className="col-span-1 xl:flex-1 xl:flex xl:flex-grow flex items-end">
<button
    onClick={toggleFilter}
    style={{
        padding: '8px 16px',
        // 💡 FIX 1: Use the blue color from the "Submit" button as the base (OFF state)
        // We'll use a slightly darker blue/gray when filtered (ON state) for contrast.
        backgroundColor: isFiltered ? '#48bb78' : '#f56565',
        color: 'white',
        border: 'none',
        // 💡 FIX 2: Match the border radius of the other buttons
        borderRadius: '0.25rem', // Common radius value
        cursor: 'pointer',
        // 💡 FIX 3: Match the bold/uppercase font style
        fontWeight: 'bold',
        textTransform: 'uppercase', // Ensures text looks consistent with 'Submit'
        
        // Ensure margin is consistent with surrounding elements if needed
        marginRight: '0.5rem', 
        height: '40px', // Match the height of other buttons/inputs if necessary
        // Add a smooth transition for button hover/active states
        transition: 'background-color 0.2s ease-in-out',
        
    }}
    onMouseOver={(e) => { 
        e.currentTarget.style.backgroundColor = isFiltered ? '#38a169' : '#e53e3e'; // Darker shade on hover
    }}
    onMouseOut={(e) => { 
        e.currentTarget.style.backgroundColor = isFiltered ? '#48bb78' :  '#f56565'; // Return to base color
    }}
>
    {/* 💡 FIX 4: Use a concise label that reflects the toggle status */}
    {isFiltered 
        ? 'On' 
        : 'Off'}
</button>
            <Button
              className="w-full"
              colorScheme="blue"
              onClick={() => submitData()}
            >
              Submit
            </Button>
          </div>
          <div className="col-span-1 xl:flex-1 flex items-end xl:grow">
            <Button
              className="w-full"
              colorScheme="red"
              onClick={() => setIsTableVisible(!isTableVisible)}
            >
              {isTableVisible ? "Hide All Data" : "Show All Data"}
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center">
        {isTableVisible && (
          <TableContainer className="bg-card rounded-md mt-4 mx-4" sx={{ overflowX: "auto", maxWidth: "96%" }}>
            <Table key={colorMode} variant="simple">
              <TableCaption sx={{
              color: tulisanColor,
              }}>Machine Performance</TableCaption>
              <Thead>
                <Tr>
                  <Th sx={{
              color: tulisanColor,
              }}>id</Th>
                  <Th sx={{
              color: tulisanColor,
              }}>Date Time</Th>
                  <Th sx={{
              color: tulisanColor,
              }}>Availability</Th>
                  <Th sx={{
              color: tulisanColor,
              }}>Performance</Th>
                  <Th sx={{
              color: tulisanColor,
              }}>Quality</Th>
                  <Th sx={{
              color: tulisanColor,
              }}>OEE</Th>
                  <Th sx={{
              color: tulisanColor,
              }}>Output</Th>
                  <Th sx={{
              color: tulisanColor,
              }}>RunTime</Th>
                  <Th sx={{
              color: tulisanColor,
              }}>StopTime</Th>
                  <Th sx={{
              color: tulisanColor,
              }}>Idle Time</Th>
                </Tr>
              </Thead>
              <Tbody>{renderCm1(isFiltered)}</Tbody>
            </Table>
          </TableContainer>
        )}
      </div>
      <br />
      <div className="flex justify-center items-center mt-2 gap-4 mb-2">
        <Button 
          onClick={handlePrevPage} 
          isDisabled={currentPage === 1} 
          colorScheme="blue"
        >
          Previous
        </Button>
        <span className="text-text">
          Page {currentPage} of {Math.ceil(oeeCm1.length / rowsPerPage)}
        </span>
        <Button 
          onClick={handleNextPage} 
          isDisabled={currentPage === Math.ceil(oeeCm1.length / rowsPerPage)} 
          colorScheme="blue"
        >
          Next
        </Button>
      </div>
    </>
  );
}

export default ProductionSummary;
