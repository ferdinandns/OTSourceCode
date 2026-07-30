import React, { useState, useEffect } from "react";
import axios from "axios";
import CanvasJSReact from "../canvasjs.react";
import {
  Table,
  TableContainer,
  TableCaption,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  Button,
  Input,
  Select,
  Stack,
  Spinner,
} from "@chakra-ui/react";
import { useColorMode, useColorModeValue } from "@chakra-ui/react";
import moment from "moment-timezone";
import { Margin } from "@mui/icons-material";

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

function Motor() {
  const [datePickerStart, setDatePickerStart] = useState(""); // Start Date
  const [datePickerFinish, setDatePickerFinish] = useState(""); // Finish Date
  const [machinePicker, setMachinePicker] = useState(""); // Selected Machine
  const [mainData, setMainData] = useState([]); // Table Data
  const [chartData, setChartData] = useState([]);
  const [isTableVisible, setIsTableVisible] = useState(false); // Table Visibility
  const [maxVib, setMaxVib]= useState ([null]);
  const [minVib, setMinVib]= useState ([null]);
  const [avgVib, setAvgVib]= useState ([null]);
  const [q1Vib, setQ1Vib] = useState(null);
  const [q2Vib, setQ2Vib] = useState(null);

  
  const [currentPage, setCurrentPage] = useState(1); // Current page number
  const [rowsPerPage, setRowsPerPage] = useState(10); // Default to 10 rows per page

  const [loading, setLoading] = useState(false); // Loading state
  const [error, setError] = useState(false);   // Error state for "no data available"

  const { colorMode } = useColorMode();
  const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
  const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");
  const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");
  const kartuColor = useColorModeValue("rgba(var(--color-card))", "rgba(var(--color-card))");

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );
  const formatTimestamp = (uniqueTimestamp) => {
    const [seconds, fractional] = uniqueTimestamp.toString().split(".");
    const date = new Date(seconds * 1000); // Convert seconds to milliseconds
    const formattedDate = date.toLocaleString("en-US", {
      timeZone: "Asia/Jakarta",
    });
    return `${formattedDate}`; // Add fractional seconds
    // return `${formattedDate}.${fractional || "00"}`; // Add fractional seconds (ini kalau mau pake fractional tinggal uncomment aja)
  };
  // Fetch data from the backend
  const submitHandler = async () => {
    setLoading(true); // Start loading spinner for chart
    setError(false); // Reset error state
    try {
      let response = await axios.get(
        "http://10.126.15.197:8002/part/vibrate",
        {
          params: {
            machine: machinePicker,
            start: datePickerStart,
            finish: datePickerFinish,
          },
        }
      );
      // console.log("response = ",response)
      setMainData(response.data); // Store fetched data in state
      setIsTableVisible(true); // Show the table
     // Fetching data for chart (vibrate chart)
     let chartResponse = await axios.get("http://10.126.15.197:8002/part/vibrateChart", {
      params: {
          machine: machinePicker,
          start: datePickerStart,
          finish: datePickerFinish,
      },
    });

    let chartData = chartResponse.data.map((row) => ({
      label: formatTimestamp(row.label), // Convert 'label' to a Date object for the x-axis
      // label: moment
      //     .tz(
      //       new Date(row.label * 1000).toLocaleString(),
      //       "Asia/Jakarta"
      //     )
      //     .format("YYYY-MM-DD HH:mm"),
      y: Number(row.y), // Convert 'y' to a number for the y-axis
    }));

    if (chartData.length === 0) {
      // Handle no data scenario
      setError(true);
    } else {
      setChartData(chartData); // Set chart data
    }
  } catch (error) {
    console.error("Error fetching chart data:", error);
    setError(true); // Show error message
  } finally {
    setLoading(false); // Stop loading spinner
  }


    let chartResponse2 = await axios.get("http://10.126.15.197:8002/part/vibrateChart", {
      params: {
        machine: machinePicker,
        start: datePickerStart,
        finish: datePickerFinish,
      },
    });

    const velocities = chartResponse2.data.map((row) => Number(row.y));

    // Calculate Min, Max, and Avg
    const min = Math.min(...velocities).toFixed(2);
    const max = Math.max(...velocities).toFixed(2);
    const avg = (velocities.reduce((sum, v) => sum + v, 0) / velocities.length).toFixed(2);

    // Update state with the calculated values
    setMinVib(min);
    setMaxVib(max);
    setAvgVib(avg);

    // Calculate Q1 and Q2
    const q1 = ((Number(min) + Number(avg)) / 2).toFixed(2);
    const q2 = ((Number(avg) + Number(max)) / 2).toFixed(2);

    setQ1Vib(q1);
    setQ2Vib(q2);

  };

  // Render data in the table
  const renderData = () => {
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentData = mainData.slice(indexOfFirstRow, indexOfLastRow);

    if (mainData.length === 0) {
      return (
        <Tr>
          <Td colSpan={3} className="text-center text-text">
            No data available
          </Td>
        </Tr>
      );
    }

    return currentData.map((row, index) => (
      <Tr key={index}>
        <Td className="text-center">{indexOfFirstRow + index + 1}</Td> {/* Row Number */}
        <Td className="text-center">{formatTimestamp(row.time)}</Td> {/* Formatted Timestamp */}
        <Td className="text-center">{row.data_format_0}</Td> {/* Velocity */}
      </Tr>
    ));
  };
  const pickerDataStartHendeler = (e) => {
    const selectedDate = new Date(e.target.value);
    const uniqueTimestamp = (selectedDate.getTime() / 1000).toFixed(2); // Convert to seconds with fractional part
    setDatePickerStart(uniqueTimestamp);
    console.log("Start Date Unique Timestamp:", uniqueTimestamp);
  };
  
  const pickerDataFinishHendeler = (e) => {
    const selectedDate = new Date(e.target.value);
    const uniqueTimestamp = (selectedDate.getTime() / 1000).toFixed(2); // Convert to seconds with fractional part
    setDatePickerFinish(uniqueTimestamp);
    console.log("Finish Date Unique Timestamp:", uniqueTimestamp);
  };

  const handleNextPage = () => {
    if (currentPage < Math.ceil(mainData.length / rowsPerPage)) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

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
// ============================================================ CHART ===============================================================================
  const chartOptions = {
    zoomEnabled: true,
    responsive: true,
    theme: isDarkMode ? "dark2" : "light2",
    backgroundColor: isDarkMode ? "#171717" : "#ffffff",
    Margin: 8,
    title: {
      text: "MOTOR VIBRATION",
      fontColor: isDarkMode ? "white" : "black"
    },
    axisY: {
      prefix: "",
    },
    toolTip: {
      shared: true,
    },
    data: [
      {
        type: "spline",
        name: "Vibration Data",
        showInLegend: true,
        markerType: "circle",
        xValueFormatString: "YYYY-MM-DD HH:mm:ss", // Format for X-axis (timestamps)
        yValueFormatString: "##0.00", // Format for Y-axis (the vibration data)
        dataPoints: chartData,
      },
    ],
  };

  return (
    <div>
      {/* Input Form */}
      <div className="flex flex-row justify-center items-center mt-6 mx-2">
        <div className="grid grid-cols-3 justify-items-center gap-6 xl:grid-cols-6 xl:flex xl:flex-row">
          {/* Start Date */}
          <div className="col-span-3 xl:col-span-2 w-full">
            <label
              htmlFor="start-date"
              className="block text-md font-medium leading-4 mb-1 text-text"
            >
              Start Date
            </label>
            <Input
              id="start-date"
              onChange={pickerDataStartHendeler}
              placeholder="Select Date and Time"
              size="md"
              type="datetime-local"
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
                background: "var(--color-background)", // background color from Tailwind config
      
                _hover: {
                  borderColor: hoverBorderColor,
                },
              }}
            />
          </div>

          {/* Finish Date */}
          <div className="col-span-3 xl:col-span-2 w-full">
            <label
              htmlFor="finish-date"
              className="block text-md font-medium leading-4 mb-1 text-text"
            >
              Finish Date
            </label>
            <Input
              id="finish-date"
              onChange={pickerDataFinishHendeler}
              placeholder="Select Date and Time"
              size="md"
              type="datetime-local"
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
                background: "var(--color-background)", // background color from Tailwind config
      
                _hover: {
                  borderColor: hoverBorderColor,
                },
              }}
            />
          </div>

          {/* Machine Picker */}
          <div className="col-span-3 xl:col-span-2 w-full">
            <label
              htmlFor="machine"
              className="block text-md font-medium leading-4 mb-1 text-text"
            >
              Machine
            </label>
            <Select
              placeholder="All Machine"
              onChange={(e) => setMachinePicker(e.target.value)}
            >
              <option value="cMT-DB-EMS-UTY_Area_N33_New_data">Area N33</option>
              <option value="cMT-DB-EMS-UTY_Area_P10_New_data">Area P10</option>
              <option value="cMT-DB-EMS-UTY_Area_W25toN33_Nw_data">Area W25toN33</option>
              <option value="cMT-DB-EMS-UTY_Area_W25toP10_Nw_data">Area W25toP10</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_E1.01_data">CMH AHU E 1.01</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_F1.01_data">CMH AHU F 1.01</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_F1.02_data">CMH AHU F 1.02</option>

              <option value="cMT-VibrasiHVAC_Data_AHU_FT1.01_data">CMH AHU FT 1.01</option>

              <option value="cMT-VibrasiHVAC_Data_AHU_FT1.02_data">CMH AHU FT 1.02</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_G1.01_data">CMH AHU G 1.01</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_G1.02_data">CMH AHU G 1.02</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_LA2.01_data">AHU LA 2.01</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_MG1.01_data">AHU MG 1.01</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_MG1.02_data">AHU MG 1.02</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_MG1.03_data">AHU MG 1.03</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_RND3.01_data">AHU RnD 3.01</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_RND3.02_data">AHU RnD 3.02</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_WG1.01_data">AHU WG 1.01</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_WG1.02_data">AHU WG 1.02</option>
              <option value="cMT-VibrasiHVAC_Data_AHU_WH1_data">AHU WH1</option>
              <option value="cMT-VibrasiHVAC_Data_DCU_FT1.02_data">DCU FT 1.02</option>
              <option value="cMT-VibrasiHVAC_Data_DCU_WG1.02_data">DCU WG 1.02</option>
              <option value="cMT-VibrasiHVAC_Data_DCU_MG1.02_data">DCU MG 1.02</option>
              <option value="cMT-VibrasiHVAC_Data_DHU_MG1.03_data">DHU MG 1.03</option>
              <option value="cMT-VibrasiHVAC_Data_DHU_RND3.01_data">DHU RnD 1.03</option>

              <option value="cMT-VibrasiHVAC_Data_RFU_E1.01_data">RFU E 1.01</option>
              <option value="cMT-VibrasiHVAC_Data_RFU_FT1.01_data">RFU FT 1.01</option>
              <option value="cMT-VibrasiHVAC_Data_RFU_FT1.02_data">RFU FT 1.02</option>
              <option value="cMT-VibrasiHVAC_Data_RFU_MG1.01_data">RFU MG 1.01</option>
              <option value="cMT-VibrasiHVAC_Data_RFU_MG1.02_data">RFU MG 1.02</option>
              <option value="cMT-VibrasiHVAC_Data_RFU_WG1.01_data">RFU WG 1.01</option>
              <option value="cMT-VibrasiHVAC_Data_RFU_WG1.02_data">RFU WG 1.02</option>
              <option value="cMT-VibrasiHVAC_Data_TFU_F1.01_data">TFU F 1.01</option>
              <option value="cMT-VibrasiHVAC_Data_TFU_WG1.01_data">TFU WG 1.01</option>
              <option value="cMT-VibrasiHVAC_GAC_WH2_data">GAC WH2</option>
              <option value="cMT-VibrasiHVAC_GBAC1_WH1_data">GBAC1 WH1</option>
              <option value="cMT-VibrasiHVAC_GBAC2_WH1_data">GBAC2 WH1</option>

              <option value="cMT-VibrasiHVAC_2_Current_FT1.01_data">M Current FT 1.01</option>
              <option value="cMT-VibrasiHVAC_M_Temp_FT1.01_data">M Temp FT 1.01</option>
              <option value="cMT-VibrasiHVAC_PackagingF_Line1_data">Packaging F Line 1</option>
              <option value="cMT-VibrasiHVAC_PackagingF_Line2_data">Packaging F Line 2</option>
              <option value="cMT-VibrasiHVAC_PackagingF_Line3_data">Packaging F Line 3</option>

              <option value="cMT-VibrasiHVAC_X_ACC_G_FT1.01_data">X ACC G FT 1.01</option>
              <option value="cMT-VibrasiHVAC_X_AXISVCF_FT1.01_data">X AXISVCF FT 1.01</option>
              <option value="cMT-VibrasiHVAC_X_Axis_Ve_FT1.01_data">X Axis Ve FT 1.01</option>
              <option value="cMT-VibrasiHVAC_XaxisRMS-S1_data">XaxisRMS-S1</option>
              <option value="cMT-VibrasiHVAC_Z_ACC_G_FT1.01_data">Z ACC G FT 1.01</option>
              <option value="cMT-VibrasiHVAC_Z_AXISVCF_FT1.01_data">Z AXISVCF FT 1.01</option>
              <option value="cMT-VibrasiHVAC_Z_AXIS_RM_FT1.01_data">Z AXIS RM FT 1.01</option>
              <option value="cMT-VibrasiHVAC_ZaxisRMS-S1_data">ZaxisRMS-S1</option>      
            </Select>
          </div>

          <div className="mt-5">
            <Select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              width="80px"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
              <option value={60}>60</option>
              <option value={100}>100</option>
            </Select>
          </div>

          {/* Submit Button */}
          <div>
            <Button
              className="w-full md:w-36 mt-5"
              colorScheme="blue"
              onClick={submitHandler}
            >
              Submit
            </Button>
          </div>

          {/* Toggle Table Visibility */}
          <div>
            <Button
              className="w-full md:w-40 mt-5"
              colorScheme="red"
              onClick={() => setIsTableVisible(!isTableVisible)}
            >
              {isTableVisible ? "Hide All Data" : "Show All Data"}
            </Button>
          </div>
        </div>
      </div>
      <br />
      <div className="flex flex-row justify-center mx-8 p-1 rounded-md shadow-lg overflow-x-auto">
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
        <CanvasJSChart options={chartOptions} />
      )}
      </div>
      <br />
      <Stack
       className="flex flex-row justify-center mb-4  "
       direction="row"
       spacing={4}
       align="center">
      <div className="mt-3">
        <div className="ml-16 text-text">Avg Velocity = {avgVib ? avgVib : 'Loading...'} RPM</div>
        <div className="ml-16 text-text">Max Velocity = {maxVib ? maxVib : 'Loading...'} RPM</div>
        <div className="ml-16 text-text">Min Velocity = {minVib ? minVib : 'Loading...'} RPM</div>
      </div>
      <div className="mt-3">
        <div className="ml-16 text-text">Kuartal 1 = {q1Vib ? q1Vib : 'Loading...'} RPM</div>
        <div className="ml-16 text-text">Kuartal 2 = {q2Vib ? q2Vib : 'Loading...'} RPM</div>
      </div>
      </Stack>
      <br />
      {/* Data Table */}
      {isTableVisible && (
        <div className="table-fixed mt-6">
          <TableContainer className="bg-card rounded-md">
            <Table key={colorMode} variant="simple">
              <TableCaption>Motor Vibration Data</TableCaption>
              <Thead>
                <Tr>
                  <Th className="w-3/12 text-center px-6" 
                  sx={{color: tulisanColor,}}>No</Th>
                  <Th className="w-6/12 text-center px-6"
                  sx={{color: tulisanColor,}}>Date</Th>
                  <Th className="w-3/12 text-center px-6"
                  sx={{color: tulisanColor,}}>Velocity</Th>
                </Tr>
              </Thead>
              <Tbody>{renderData()}</Tbody>
            </Table>
          </TableContainer>

          {/* Pagination Controls */}
          <div className="flex justify-center items-center mt-4 gap-4">
            <Button 
              onClick={handlePrevPage} 
              isDisabled={currentPage === 1} 
              colorScheme="blue"
            >
              Previous
            </Button>
            <span className="text-text">Page {currentPage} of {Math.ceil(mainData.length / rowsPerPage)}</span>
            <Button 
              onClick={handleNextPage} 
              isDisabled={currentPage === Math.ceil(mainData.length / rowsPerPage)} 
              colorScheme="blue"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Motor;
