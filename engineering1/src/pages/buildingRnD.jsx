import React, { useEffect, Component, useState, useRef } from "react";
import CanvasJSReact from "../canvasjs.react";
import { Button, ButtonGroup, Stack, Input, Select, Table, Thead, Tbody, Tr, Th, Td, TableCaption, TableContainer } from "@chakra-ui/react";
import axios from "axios";
import { useReactToPrint } from "react-to-print";

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

         const fetchRNDSuhu = async () => {
            let response = await axios.get(
              "http://10.126.15.137:8002/part/BuildingRNDSuhu", 
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
                "http://10.126.15.137:8002/part/BuildingRNDRH",
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
                  "http://10.126.15.137:8002/part/BuildingRNDDP",
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
                    "http://10.126.15.137:8002/part/BuildingRNDAll",
                    {
                      params: {
                        area: Area,
                        start: startDate,
                        finish: finishDate,
                      },
                    }
                  );     
                    setAllDataRND(response3.data);

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

        };

        const table = () => {
          return AllDataRND.map((data) => {
            return (
              <Tr>
                <Td>{data.tgl}</Td>
                <Td>{data.temp}</Td>
                <Td>{data.RH}</Td>
                <Td>{data.DP}</Td>
              </Tr>
            );
          });
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
            theme: "light1",
            title: {
              text: "RND LABORATORIUM GRAPH",
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
                markerType: "none",
              },
              {
                type: "spline",
                name: "RH (%)",
                showInLegend: true,
                xValueFormatString: "",
                yValueFormatString: "",
                dataPoints: RHData,
                markerType: "none",
              },
              {
                type: "spline",
                name: "DP (Pa)",
                showInLegend: true,
                xValueFormatString: "",
                yValueFormatString: "",
                dataPoints: DPData,
                markerType: "none",
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
             <Stack
                className="flex flex-row justify-center mb-4  "
                direction="row"
                spacing={4}
                align="center"
                >
                <div>
                    <h2>Area</h2>
                    <Select placeholder="Select Area"  onChange={getArea}>
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
                <h2>Start Time</h2>
                <Input
                    onChange={dateStart}
                    placeholder="Select Date and Time"
                    size="md"
                    type="date"
                /> 
                </div>
                <div>Finish Time
                <Input
                    onChange={dateFinish}
                    placeholder="Select Date and Time"
                    size="md"
                    type="date"
                />
                </div>
                <div>
                    <br />
                    <Button
                        className="m1-4"
                        colorScheme="gray"
                        onClick={() => fetchRNDSuhu()}
                    >
                        Submit
                    </Button>
                </div>
                <div>
                    <br />
                    <Button
                        isDisabled={state}
                        className="m1-4"
                        colorScheme="gray"
                        onClick={generatePDF}>
                        Export to PDF
                    </Button>
                </div>
            </Stack>
            <div className="flex flex-row justify-center mx-12 pb-10 "> 
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
            <Thead>
              <Tr>
                <Th>Date Time</Th>
                <Th>Temperature</Th>
                <Th>Relative Humidity (RH)</Th>
                <Th>Differential Presure (DP)</Th>
              </Tr>
            </Thead>
            <Tbody>{table()}</Tbody>
          </Table>
        </TableContainer>
      </div>
        </div>
    )
}