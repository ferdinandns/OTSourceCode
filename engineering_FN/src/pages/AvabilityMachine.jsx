import { useEffect, useRef } from "react";
import CanvasJSReact from "../canvasjs.react";
import moment from "moment/moment";
import axios from "axios";
import { Button } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useState } from "react";
import {
  CircularProgress,
  CircularProgressLabel,
  Progress,
  Card,
  CardBody,
  Text,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableCaption,
  TableContainer,
  Stack,
  Select,
} from "@chakra-ui/react";
import { useColorMode, useColorModeValue } from "@chakra-ui/react";

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

function AvabilityMachine() {
  const chartRef = useRef(null);
  const navigate = useNavigate();

  const dateValue = useSelector((state) => state.prod.date);

  const [avabilityMachine, setAvabilityMachine] = useState([]);
  const [selectMachine, UseSelectMachine] = useState("");
  const [fetchPartData, UseFetchPartData] = useState([]);
  const [totalBreakdown, SetTotalBreakdown] = useState();
  const [circularData, UseCircularData] = useState(0);
  const [datacountMinor, setcountMinor] = useState(0);
  const [filterDataSave, setFilterDataSave] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isTableVisible, setIsTableVisible] = useState(true);

  const { colorMode } = useColorMode();
  const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
  const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");
  const kartuColor = useColorModeValue("rgba(var(--color-card))", "rgba(var(--color-card))");

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );

  const fetchAvaMachine = async (date) => {
    let response = await axios.get(
      "http://10.126.15.197:8002/part/avamachine",
      {
        params: {
          date: date,
        },
      }
    );
    setAvabilityMachine(response.data);
  };

  const fetchPart = async (data) => {
    let response = await axios.get("http://10.126.15.197:8002/part/get", {
      params: {
        date: data,
      },
    });
    UseFetchPartData(response.data);
  };

  const dataPointsAva = avabilityMachine;

  useEffect(() => {
    createPareto();
    fetchAvaMachine(dateValue);
    fetchPart(dateValue);
  }, []);

  useEffect(() => {
    renderCountMinor();
  }, [selectMachine]);

  const backPage = () => {
    navigate("/avabilityope");
  };

  const filterData = fetchPartData.filter((el) => {
    if (selectMachine == "") {
      return;
    }
    if (selectMachine == "Avability CM1") {
      return el.Mesin.includes("CM1");
    }
    if (selectMachine == "Avability CM2") {
      return el.Mesin.includes("CM2");
    }
    if (selectMachine == "Avability CM3") {
      return el.Mesin.includes("CM3");
    }
    if (selectMachine == "Avability CM4") {
      return el.Mesin.includes("CM4");
    }
    if (selectMachine == "Avability CM5") {
      return el.Mesin.includes("CM5");
    }
    setIsTableVisible(true); // Show the table
  });

  let objTotalBreakdown = 0;
  for (var i = 0; i < filterData.length; i++) {
    objTotalBreakdown += filterData[i].Total;
  }

  var visitorsChartDrilldownHandler = (e) => {
    let chartClick = e.dataPoint.label;
    window.scrollTo(0, document.body.scrollHeight);

    UseSelectMachine(chartClick);
  };

  const filterAva = dataPointsAva.filter((el) => {
    if (selectMachine == "") {
      //return el.label.includes("Avability CM1");
      return;
    }
    if (selectMachine == "Avability CM1") {
      return el.label.includes("Avability CM1");
    }
    if (selectMachine == "Avability CM2") {
      return el.label.includes("Avability CM2");
    }
    if (selectMachine == "Avability CM3") {
      return el.label.includes("Avability CM3");
    }
    if (selectMachine == "Avability CM4") {
      return el.label.includes("Avability CM4");
    }
    if (selectMachine == "Avability CM5") {
      return el.label.includes("Avability CM5");
    }
  });

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };
  
  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(filterData.length / rowsPerPage)));
  };

  const renderPartList = () => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const visibleData = filterData.slice(startIndex, startIndex + rowsPerPage);

    if (filterData.length === 0) {
      return (
        <Tr>
          <Td colSpan={10} textAlign="center" className="text-red-500" display="table-cell">
            No data available
          </Td>
        </Tr>
      );
    }
    return visibleData
      .sort((a, b) => b.Total - a.Total)
      .map((partdata, index) => (
          <Tr key={index}>
            <Td>{partdata.Mesin}</Td>
            <Td>{partdata.Line}</Td>
            {partdata.Total <= 10 ? (
              <Td className="bg-amber-200">{partdata.Pekerjaan}</Td>
            ) : (
              <Td>{partdata.Pekerjaan}</Td>
            )}

            <Td>{moment(partdata.Tanggal).format("DD/MM/YYYY")}</Td>
            <Td>{partdata.Quantity}</Td>
            <Td>{partdata.Unit}</Td>
            <Td>{partdata.Pic}</Td>
            <Td>{partdata.Tawal}</Td>
            <Td>{partdata.Tahir}</Td>
            {partdata.Total <= 10 ? (
              <Td className="bg-amber-200">{partdata.Total}</Td>
            ) : (
              <Td>{partdata.Total}</Td>
            )}
          </Tr>
        )
      );
  };

  const renderCountMinor = () => {
    var count = 0;
    for (var i = 0; i < filterData.length; i++) {
      if (filterData[i].Total <= 10) {
        count++;
      }
    }
    setcountMinor(count);
  };

  const createPareto = () => {
    var dps = [];
    var chart = chartRef.current;
    var yValue,
      yTotal = 0,
      yPercent = 0;
    for (var i = 0; i < chart.data[0].dataPoints.length; i++)
      yTotal += chart.data[0].dataPoints[i].y;
    for (var i = 0; i < chart.data[0].dataPoints.length; i++) {
      yValue = chart.data[0].dataPoints[i].y;
      yPercent += (yValue / yTotal) * 100;
      dps.push({ label: chart.data[0].dataPoints[i].label, y: yPercent });
    }
    chart.addTo("data", {
      type: "line",
      yValueFormatString: "0.##" % "",
      dataPoints: dps,
    });
    chart.data[1].set("axisYType", "secondary", false);
    chart.axisY[0].set("maximum", Math.round(yTotal / 20) * 20);
    chart.axisY2[0].set("maximum", 100);
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

  const options = {
    zoomEnabled: true,
    theme: isDarkMode ? "dark2" : "light2",
    backgroundColor: isDarkMode ? "#171717" : "#ffffff",
    margin: 8,
    height: 800,
    title: {
      text: "Availability Machine",
      fontColor: isDarkMode ? "white" : "black"
    },

    axisY: {
      title: "Data in (%)",
      lineColor: "#4F81BC",
      tickColor: "#4F81BC",
      labelFontColor: "#4F81BC",
    },
    data: [
      {
        indexLabelFontColor: isDarkMode ? "white" : "black",
        click: visitorsChartDrilldownHandler,
        type: "column",
        dataPoints: dataPointsAva,
      },
    ],
  };

  return (
    <div>
      <div className="block bg-card rounded-md justify-center my-2 mx-12 p-1 lg:overflow-y-hidden ">
        <CanvasJSChart
          options={options}
          overflow="hidden"
          onRef={(ref) => (chartRef.current = ref)}
        />
        {/*You can get reference to the chart instance as shown above using onRef. This allows you to access all chart properties and methods*/}
      </div>
      <br />
      <Stack
        className="flex flex-row justify-left mb-4  "
        direction="row"
        spacing={4}
        >
        <Button className="ml-12" colorScheme="red" onClick={() => backPage()}>
          Back
        </Button>
      </Stack>

      <div className="flex flex-row justify-center  pb-10 ">
        <Card
          direction={{ base: "column", sm: "row" }}
          overflow="hidden"
          variant="outline"
          className="mr-4"
          sx={{
            borderRadius: "0.395rem",
            background: kartuColor,
          }}
        >
          <div>
            <CircularProgress
              value={filterAva[0] ? filterAva[0].y.toFixed(2) : 0}
              color="green.400"
              size="200px"
            >
              <CircularProgressLabel>
                {filterAva[0] ? filterAva[0].y.toFixed(2) : 0}%
              </CircularProgressLabel>
            </CircularProgress>
          </div>
          <Stack>
            <CardBody>
              <Heading size="md">
                {filterAva[0] ? filterAva[0].label : "Availability"}
              </Heading>

              <Text py="2">
                Stop Time ({objTotalBreakdown} Min)
                <Progress hasStripe value={objTotalBreakdown} />
                <p className="mt-1">Minor Stop ({datacountMinor}x)</p>
                <br />
                Availability is the ratio of Run Time to Planned Production
                Time.
              </Text>
            </CardBody>
          </Stack>
        </Card>
      </div>
      <Stack 
        className="flex flex-row justify-center "
        direction="row"
        spacing={4}
        align="center"
      >
        <div>
          <Select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
            width="80px"
            marginTop="26px"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={40}>40</option>
            <option value={60}>60</option>
            <option value={100}>100</option>
          </Select>
        </div>
        <div>
          <br />
          <Button
            className="w-40 font-sans"
            colorScheme="red"
            onClick={() => setIsTableVisible(!isTableVisible)}
          >
            {isTableVisible ? "Hide All Data" : "Show All Data"}
          </Button>
        </div>
      </Stack>
      <br />
      <div className="mx-8 rounded-md bg-card">
        <TableContainer className="overflow-y-hidden">
          <Table variant="simple">
            <TableCaption>Imperial to metric conversion factors</TableCaption>
            <Thead>
              <Tr>
                <Th>Mesin</Th>
                <Th>Line</Th>
                <Th>Pekerjaan</Th>
                <Th>Tanggal</Th>
                <Th>Quantity</Th>
                <Th>Unit</Th>
                <Th>Pic</Th>
                <Th>Awal Pengerjaan</Th>
                <Th>Ahir Pengerjaan</Th>
                <Th>Total</Th>
              </Tr>
            </Thead>
            <Tbody>{renderPartList()}</Tbody>
          </Table>
        </TableContainer>
      </div>
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
          Page {currentPage} of {Math.ceil(filterData.length / rowsPerPage)}
        </span>
        <Button
          onClick={handleNextPage}
          isDisabled={currentPage === Math.ceil(filterData.length / rowsPerPage)}
          colorScheme="blue"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export default AvabilityMachine;
