import React, { useState, useEffect, useRef } from "react";
import {
  Select,
  Input,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableCaption,
  TableContainer,
  Stack
} from "@chakra-ui/react";
import CanvasJSReact from "../canvasjs.react";
import axios from "axios";
import { useReactToPrint } from "react-to-print";

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

function BuildingEMS() {
  const [dataListTable, setDataListTable] = useState([]);
  const [allDataTable, setAllDataTable] = useState([]);
  const [tempChartData, setTempChartData] = useState([]);
  const [dpChartData, setDpChartData] = useState([]);
  const [rhChartData, setRhChartData] = useState([]);
  const [areaPicker, setAreaPicker] = useState();
  const [datePickerStart, setDatePickerStart] = useState();
  const [datePickerFinish, setDatePickerFinish] = useState();
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
  const [state, setState] = useState(true);
  const ComponentPDF= useRef();

  useEffect(() => {
    const fetchData = async () => {
      let response = await axios.get(
        "http://10.126.15.137:8002/part/getTabelEMS"
      );
      setDataListTable(response.data);
    };
    fetchData();
  }, []);

  const renderDropDownArea = () => {
    return dataListTable.map((entry) => {
      const tableName = entry.TABLE_NAME;
      const cleanedName = tableName
        .replace("cMT-PMWorkshop_", "")
        .replace("_data", "");
      return (
        <>
          <option value={tableName}>{cleanedName}</option>;
        </>
      );
    }); 
  }; 

  const getSubmit = async () => {
    const response1 = await axios.get(
      "http://10.126.15.137:8002/part/getTempChart",
      {
        params: {
          area: areaPicker,
          start: datePickerStart,
          finish: datePickerFinish,
          format: 0,
        },
      }
    ); 
    const response2 = await axios.get(
      "http://10.126.15.137:8002/part/getTempChart",
      {
        params: {
          area: areaPicker,
          start: datePickerStart,
          finish: datePickerFinish,
          format: 1,
        },
      }
    );
    const response3 = await axios.get(
      "http://10.126.15.137:8002/part/getTempChart",
      {
        params: {
          area: areaPicker,
          start: datePickerStart,
          finish: datePickerFinish,
          format: 2,
        },
      }
    );
    const response4 = await axios.get(
      "http://10.126.15.137:8002/part/getAllDataEMS",
      {
        params: {
          area: areaPicker,
          start: datePickerStart,
          finish: datePickerFinish,
        },
      }
    );
    setTempChartData(response1.data);
    setRhChartData(response2.data);
    setDpChartData(response3.data);
    setAllDataTable(response4.data);

    if (response1.data.length !== 0 
      && response2.data.length !== 0 
      && response3.data.length !== 0
      && response4.data.length !== 0){
      setState(false);
    } else {
      setState(true);
    }

    const maxSuhu = response1.data.reduce ((acc, data) => Math.max (acc, data.y), Number.NEGATIVE_INFINITY);
    var max = Number(maxSuhu.toFixed(2))
    setmaxSuhu(max)

    const minSuhu = Math.min(...response1.data.map((data) => data.y));
    var min = Number(minSuhu.toFixed(2))
    setminSuhu(min)

    const totalSuhu = response1.data.reduce ((sum, data) => sum + data.y, 0);
    var total = 0
    total = Number(totalSuhu.toFixed(2))
    const averageSuhu = totalSuhu / response1.data.length;
    var avgSuhu = Number(averageSuhu.toFixed(2))
    setavgSuhu(avgSuhu);

    const maxRH = response2.data.reduce ((acc, data) => Math.max (acc, data.y), Number.NEGATIVE_INFINITY);
    var max = Number(maxRH.toFixed(2))
    setmaxRH(max)

    const minRH = Math.min(...response2.data.map((data) => data.y));
    var min = Number(minRH.toFixed(2))
    setminRH(min)

    const totalRH = response2.data.reduce ((sum, data) => sum + data.y, 0);
    var total = 0
    total = Number(totalRH.toFixed(2))
    const averageRH = totalRH / response1.data.length;
    var avgRH = Number(averageRH.toFixed(2))
    setavgRH(avgRH);

    const maxDP = response3.data.reduce ((acc, data) => Math.max (acc, data.y), Number.NEGATIVE_INFINITY);
    var max = Number(maxDP.toFixed(2))
    setmaxDP(max)

    const minDP = Math.min(...response3.data.map((data) => data.y));
    var min = Number(minDP.toFixed(2))
    setminDP(min)

    const totalDP = response3.data.reduce ((sum, data) => sum + data.y, 0);
    var total = 0
    total = Number(totalDP.toFixed(2))
    const averageDP = totalDP / response3.data.length;
    var avgDP = Number(averageDP.toFixed(2))
    setavgDP(avgDP);

    const areaname = areaPicker
    .replace("cMT-PMWorkshop_","")
    .replace("_data","");
    setName(areaname)

  };

  const renderTable = () => {
    return allDataTable.map((data) => {
      return (
        <Tr>
          <Td>{data.id}</Td>
          <Td>{data.date}</Td>
          <Td>{data.temp}</Td>
          <Td>{data.RH}</Td>
          <Td>{data.DP}</Td>
        </Tr>
      );
    });
  };

  const emsAreaPick = (e) => {
    var dataInput = e.target.value;
    setAreaPicker(dataInput);
  };

  const datePickStart = (e) => {
    var dataInput = e.target.value;
    setDatePickerStart(dataInput);
  };
  const datePickFinish = (e) => {
    var dataInput = e.target.value;
    setDatePickerFinish(dataInput);
  };

  const options = {
    zoomEnabled: true,
    theme: "light2",
    title: {
      text: "Enviroment Room",
    },
    subtitles: [
      {
        text: "Enviroment Management System",
      },
    ],
    axisY: {
      prefix: "",
    },
    toolTip: {
      shared: true,
    },
    data: [
      {
        type: "line",
        name: "Temperature",
        showInLegend: true,
        xValueFormatString: "",
        yValueFormatString: "",
        dataPoints: tempChartData,
      },
      {
        type: "line",
        name: "RH",
        showInLegend: true,
        xValueFormatString: "",
        yValueFormatString: "",
        dataPoints: rhChartData,
      },
      {
        type: "line",
        name: "DP",
        showInLegend: true,
        xValueFormatString: "",
        yValueFormatString: "",
        dataPoints: dpChartData,
      },
    ],
  };

  const generatePDF =  useReactToPrint({
    content: ()=> ComponentPDF.current,
    documentTitle: Name+" Data"
  });

  return (
    <>
      <div className="flex flex-row justify-center mt-8 mb-8">
        <div className="w-96 ml-4">
          <Select onChange={emsAreaPick} placeholder="Ruangan">
            {renderDropDownArea()}
          </Select>
        </div>
        <div className="ml-4  ">
          <Input
            onChange={datePickStart}
            placeholder="Start Date"
            size="md"
            type="date"
          />
        </div>
        <div className="ml-4  ">
          <Input
            onChange={datePickFinish}
            placeholder="Finish Date"
            size="md"
            type="date"
          />
        </div>
        <div className="ml-4  ">
          <Button onClick={() => getSubmit()} colorScheme="gray">
            Submit
          </Button>
        </div>
        <div className="ml-4  ">
            <Button
            isDisabled={state}
            className="m1-4"
            colorScheme="gray"
            onClick={generatePDF}>
            Export to PDF
            </Button>
        </div>
      </div>
      <div>
        <CanvasJSChart className="" options={options} />
      </div>
      <Stack
                className="flex flex-row justify-center mb-4  "
                direction="row"
                spacing={4}
                align="center"
                >
                <div className="mt-3">
                    <div className="ml-16">Avg Suhu = {avgSuhu.toLocaleString()} °C</div>
                    <div className="ml-16">Max Suhu = {maxSuhu.toLocaleString()} °C</div>
                    <div className="ml-16">Min Suhu = {minSuhu.toLocaleString()} °C</div>
                </div>
                <div className="mt-3">
                    <div className="ml-16">Avg RH = {avgRH.toLocaleString()} %</div>
                    <div className="ml-16">Max RH = {maxRH.toLocaleString()} %</div>
                    <div className="ml-16">Min RH = {minRH.toLocaleString()} %</div>
                </div>
                <div className="mt-3">
                    <div className="ml-16">Avg DP = {avgDP.toLocaleString()} Pa</div>
                    <div className="ml-16">Max DP = {maxDP.toLocaleString()} Pa</div>
                    <div className="ml-16">Min DP = {minDP.toLocaleString()} Pa</div>
                </div>
      </Stack>
      <div className="mt-20 mx-20" ref={ComponentPDF}>
        <TableContainer>
          <Table variant="simple">
            <TableCaption>Machine Performance</TableCaption>
            <Thead>
              <Tr>
                <Th>id</Th>
                <Th>Date Time</Th>
                <Th>Temperature</Th>
                <Th>Relative Humidity (RH)</Th>
                <Th>Differential Presure (DP)</Th>
              </Tr>
            </Thead>
            <Tbody>{renderTable()}</Tbody>
          </Table>
        </TableContainer>
      </div>
    </>
  );
}

export default BuildingEMS;
