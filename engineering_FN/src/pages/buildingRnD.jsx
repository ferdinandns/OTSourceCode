import { useEffect, useState, useRef } from "react";
import CanvasJSReact from "../canvasjs.react";
import { Button, Stack, Input, Select, Table, Thead, Tbody, Tr, Th, Td, TableContainer, Spinner } from "@chakra-ui/react";
import axios from "axios";
import { useReactToPrint } from "react-to-print";
import { useColorMode, useColorModeValue } from "@chakra-ui/react";

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

export default function BuildingRnD() {
  const [startDate, setStartDate] = useState();
  const [finishDate, setFinishDate] = useState();
  const [Area, setArea] = useState();
  const [SuhuData, setSuhuData] = useState([]);
  const [RHData, setRHData] = useState([]);
  const [DPData, setDPData] = useState([]);
  const [AllDataRND, setAllDataRND] = useState([]);
  const [maxSuhu, setmaxSuhu]= useState ([]);
  const [minSuhu, setminSuhu]= useState ([]);
  const [avgSuhu, setavgSuhu]= useState ([]);
  const [maxRH, setmaxRH]= useState ([]);
  const [minRH, setminRH]= useState ([]);
  const [avgRH, setavgRH]= useState ([]);
  const [maxDP, setmaxDP]= useState ([]);
  const [minDP, setminDP]= useState ([]);
  const [avgDP, setavgDP]= useState ([]);
  const [Name, setName] = useState();
  const ComponentPDF= useRef();
  const [state, setState] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isTableVisible, setIsTableVisible] = useState(true);

  const { colorMode } = useColorMode();
  const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
  const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");
  const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );


  const fetchRNDSuhu = async () => {
    setLoading(true); // Start spinner
    setError(null);   // Clear previous errors

    try {
      let response = await axios.get(
        "http://10.126.15.197:8002/part/BuildingRNDSuhu", 
        {
          params: {
            area: Area,
            start: startDate,
            finish: finishDate,
          },
        }
      );            
        setSuhuData(response.data);

      let response1 = await axios.get(
        "http://10.126.15.197:8002/part/BuildingRNDRH",
        {
          params: {
            area: Area,
            start: startDate,
            finish: finishDate,
          },
        }
      );            
        setRHData(response1.data);

      let response2 = await axios.get(
        "http://10.126.15.197:8002/part/BuildingRNDDP",
        {
          params: {
            area: Area,
            start: startDate,
            finish: finishDate,
          },
        }
      );            
        setDPData(response2.data);
          
      let response3 = await axios.get(
        "http://10.126.15.197:8002/part/BuildingRNDAll",
        {
          params: {
            area: Area,
            start: startDate,
            finish: finishDate,
          },
        }
      );     
        setAllDataRND(response3.data);
        setIsTableVisible(true); // Show the table

      if (response.data.length !== 0 && response1.data.length !== 0 && response2.data.length !== 0){
        setState(false);
      } else {
        setState(true);
      }

    const maxSuhu = response.data.reduce ((acc, data) => Math.max (acc, data.y), Number.NEGATIVE_INFINITY);
    var max = Number(maxSuhu.toFixed(2))
    setmaxSuhu(max)

    const minSuhu = Math.min(...response.data.map((data) => data.y));
    var min = Number(minSuhu.toFixed(2))
    setminSuhu(min)

    const totalSuhu = response.data.reduce ((sum, data) => sum + data.y, 0);
    var total = 0
    total = Number(totalSuhu.toFixed(2))
    const averageSuhu = totalSuhu / response.data.length;
    var avgSuhu = Number(averageSuhu.toFixed(2))
    setavgSuhu(avgSuhu);

    const maxRH = response1.data.reduce ((acc, data) => Math.max (acc, data.y), Number.NEGATIVE_INFINITY);
    var max = Number(maxRH.toFixed(2))
    setmaxRH(max)

    const minRH = Math.min(...response1.data.map((data) => data.y));
    var min = Number(minRH.toFixed(2))
    setminRH(min)

    const totalRH = response1.data.reduce ((sum, data) => sum + data.y, 0);
    var total = 0
    total = Number(totalRH.toFixed(2))
    const averageRH = totalRH / response1.data.length;
    var avgRH = Number(averageRH.toFixed(2))
    setavgRH(avgRH);

    const maxDP = response2.data.reduce ((acc, data) => Math.max (acc, data.y), Number.NEGATIVE_INFINITY);
    var max = Number(maxDP.toFixed(2))
    setmaxDP(max)

    const minDP = Math.min(...response2.data.map((data) => data.y));
    var min = Number(minDP.toFixed(2))
    setminDP(min)

    const totalDP = response2.data.reduce ((sum, data) => sum + data.y, 0);
    var total = 0
    total = Number(totalDP.toFixed(2))
    const averageDP = totalDP / response2.data.length;
    var avgDP = Number(averageDP.toFixed(2))
    setavgDP(avgDP);

    if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-01_data") {
      setName("R. ACCEDE")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-02_data") {
      setName("R. JMCO RND Lt.3")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-03_data") {
      setName("R. Primary Packaging RND Lt. 3")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-04_data") {
      setName("R. Coating RND Lt.3")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-05_data") {
      setName("R. Aging Gummy RND Lt.3")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-06_data") {
      setName("Koridor 1 RND Lt.3")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-07_data") {
      setName("Koridor 2 RND Lt.3")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-08_data") {
      setName("R. Tool RND Lt.3")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-09_data") {
      setName("R. Tumbler RND Lt.3")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-10_data") {
      setName("R. WIP RND Lt.3")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-11_data") {
      setName("R. Proses Gummy RND Lt.3")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-12_data") {
      setName("R. Granulation & FBD RND Lt.3")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-13_data") {
      setName("R. Washing RND Lt.3")
    } else if (Area === "cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-14_data") {
      setName("Locker RND Lt.3")
    }

    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to fetch data. Please try again.");
    } finally {
      const delay = 2000; // 2 seconds in milliseconds
        setTimeout(() => {
          setLoading(false); // Stop spinner
          console.log("Finished fetching data, stopping spinner...");
        }, delay);
    }
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };
  
  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(AllDataRND.length / rowsPerPage)));
  };

  const table = () => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const visibleData = AllDataRND.slice(startIndex, startIndex + rowsPerPage);

    if (AllDataRND.length === 0) {
      return (
        <Tr>
          <Td colSpan={5} textAlign="center" display="table-cell">
            No data available
          </Td>
        </Tr>
      );
    }

    return visibleData.map((data, index) => (
      <Tr key={startIndex + index}>
        <Td>{startIndex + index + 1}</Td> {/* No column */}
        <Td>{data.tgl}</Td>
        <Td>{data.temp}</Td>
        <Td>{data.RH}</Td>
        <Td>{data.DP}</Td>
      </Tr>
    ));
  };

  let dateStart = (e) => {
    var dataInput = e.target.value;
    setStartDate(dataInput);
  };
  let dateFinish = (e) => {
    var dataInput = e.target.value;
    setFinishDate(dataInput);
  };
  let getArea = (e) => {
    var dataInput = e.target.value;
    setArea(dataInput);
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

  var localeOptions = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZone: "UTC",
    hour12: false
  };
  const options = {
    zoomEnabled: true,
    theme: isDarkMode ? "dark2" : "light2",
    backgroundColor: isDarkMode ? "#171717" : "#ffffff",
    margin: 8,
    title: {
      text: "RND LABORATORIUM GRAPH",
      fontColor: isDarkMode ? "white" : "black"
    },
    axisY: {
      prefix: "",
    },
    axisX: {
      valueFormatString: "YYYY-MMM-DD HH:mm K",
      labelFormatter: function(e) {
        let date = new Date(e.value);
        let content = date.toLocaleDateString("en-US", localeOptions);
        return content;
      }
    },
    toolTip: {
      shared: true,
    }, 
    data: [
        {
        type: "spline",
        name: "Temperature (°C)",
        showInLegend: true,
        xValueFormatString: "",
        yValueFormatString: "",
        dataPoints: SuhuData,
        // markerType: "none",
      },
      {
        type: "spline",
        name: "RH (%)",
        showInLegend: true,
        xValueFormatString: "",
        yValueFormatString: "",
        dataPoints: RHData,
        // markerType: "none",
      },
      {
        type: "spline",
        name: "DP (Pa)",
        showInLegend: true,
        xValueFormatString: "",
        yValueFormatString: "",
        dataPoints: DPData,
        // markerType: "none",
        color: "magenta"
      }
    ],
  };

  const generatePDF =  useReactToPrint({
    content: ()=> ComponentPDF.current,
    documentTitle: Name+" Data"
  });

  return(
    <div>
      <div className="flex flex-row justify-center space-x-4 my-6 flex-wrap xl:flex-nowrap ">
        <div>
          <h5 className="mb-1">Area</h5>
          <Select onChange={getArea}>
            <option disabled selected hidden value=""> Select Area </option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-01_data">R. ACCEDE</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-02_data">R. JMCO RND Lt.3</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-03_data">R. Primary Packaging RND Lt. 3</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-04_data">R. Coating RND Lt.3</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-05_data">R. Aging Gummy RND Lt.3</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-06_data">Koridor 1 RND Lt.3</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-07_data">Koridor 2 RND Lt.3</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-08_data">R. Tool RND Lt.3</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-09_data">R. Tumbler RND Lt.3</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-10_data">R. WIP RND Lt.3</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-11_data">R. Proses Gummy RND Lt.3</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-12_data">R. Granulation & FBD RND Lt.3</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-13_data">R. Washing RND Lt.3</option>
            <option value="cMT-HVAC-RND-Lt.3_EMS_RND3_HMI-14_data">Locker RND Lt.3</option>
          </Select>
        </div>
        <div>
          <h5 className="mb-1">Start Time</h5>
          <Input
            onChange={dateStart}
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
              background: "var(--color-background)", // background color from Tailwind config
    
              _hover: {
                borderColor: hoverBorderColor,
              },
            }}
          /> 
        </div>
        <div>
          <h5 className="mb-1">Finish Time</h5>
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
              background: "var(--color-background)", // background color from Tailwind config
    
              _hover: {
                borderColor: hoverBorderColor,
              },
            }}
          />
        </div>
        <div className="w-full flex justify-center xl:w-auto">
          <div className="ml-0 xl:ml-6 mt-7 truncate">
            <Button colorScheme="blue" onClick={() => fetchRNDSuhu()}>
              Submit
            </Button>
          </div>
          <div className="ml-2 mt-7 truncate">
            <Button isDisabled={state} colorScheme="red" onClick={generatePDF}>
              Export to PDF
            </Button>
          </div>
        </div>
      </div>
      <div className="block p-1 bg-card rounded-lg shadow-lg mx-auto overflow-x-auto"> 
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
      <Stack
        className="flex flex-row justify-center mb-4  "
        direction="row"
        spacing={4}
        align="center">
        <div className="mt-3">
            <div className="ml-16 text-text">Avg Suhu = {avgSuhu.toLocaleString()} °C</div>
            <div className="ml-16 text-text">Max Suhu = {maxSuhu.toLocaleString()} °C</div>
            <div className="ml-16 text-text">Min Suhu = {minSuhu.toLocaleString()} °C</div>
        </div>
        <div className="mt-3">
            <div className="ml-16 text-text">Avg RH = {avgRH.toLocaleString()} %</div>
            <div className="ml-16 text-text">Max RH = {maxRH.toLocaleString()} %</div>
            <div className="ml-16 text-text">Min RH = {minRH.toLocaleString()} %</div>
        </div>
        <div className="mt-3">
            <div className="ml-16 text-text">Avg DP = {avgDP.toLocaleString()} Pa</div>
            <div className="ml-16 text-text">Max DP = {maxDP.toLocaleString()} Pa</div>
            <div className="ml-16 text-text">Min DP = {minDP.toLocaleString()} Pa</div>
        </div>
      </Stack>
      <br />
      <Stack className="flex flex-row justify-center gap-2"
        direction="row"
        spacing={2}
        align="center">
        <div className="mt-2">
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
          <Button
            className="w-40 mt-2"
            colorScheme="red"
            onClick={() => setIsTableVisible(!isTableVisible)}>
            {isTableVisible ? "Hide All Data" : "Show All Data"}
          </Button>
        </div>
      </Stack>
      {isTableVisible && (
      <div className="mt-8 bg-card rounded-md mx-20" ref={ComponentPDF}>
        <TableContainer>
          <Table key={colorMode} variant="simple">
            <Thead>
              <Tr>
                <Th sx={{
                color: tulisanColor,
                }}>No</Th>
                <Th sx={{
                color: tulisanColor,
                }}>Date Time</Th>
                <Th sx={{
                color: tulisanColor,
                }}>Temperature</Th>
                <Th sx={{
                color: tulisanColor,
                }}>Relative Humidity (RH)</Th>
                <Th sx={{
                color: tulisanColor,
                }}>Differential Presure (DP)</Th>
              </Tr>
            </Thead>
            <Tbody>{table()}</Tbody>
          </Table>
        </TableContainer>
      </div>
      )}
      {/* Pagination Controls */}
      <div className="flex justify-center items-center my-4 gap-4">
        <Button
          onClick={handlePrevPage}
          isDisabled={currentPage === 1}
          colorScheme="blue"
        >
          Previous
        </Button>
        <span className="text-text">
          Page {currentPage} of {Math.ceil(AllDataRND.length / rowsPerPage)}
        </span>
        <Button
          onClick={handleNextPage}
          isDisabled={currentPage === Math.ceil(AllDataRND.length / rowsPerPage)}
          colorScheme="blue"
        >
          Next
        </Button>
      </div>
    </div>
  );
}