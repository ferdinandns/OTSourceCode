// import React, { useEffect, useState } from "react";
// import CanvasJSReact from "../canvasjs.react";
// import axios from "axios";
// import moment from "moment-timezone";

// import {
//   CircularProgress,
//   CircularProgressLabel,
//   Progress,
// } from "@chakra-ui/react";

// import {
//   Table,
//   Thead,
//   Tbody,
//   Tr,
//   Th,
//   Td,
//   TableCaption,
//   TableContainer,
//   Button,
//   Stack,
//   Input,
//   Select,
//   Card,
//   CardBody,
//   Heading,
//   Text,
//   Grid,
//   GridItem,
//   Spinner
// } from "@chakra-ui/react";
// import Header from "../components/header";
// import { useColorMode, useColorModeValue } from "@chakra-ui/react";
// //import { useNavigate } from "react-router-dom";

// var CanvasJS = CanvasJSReact.CanvasJS;
// var CanvasJSChart = CanvasJSReact.CanvasJSChart;

// const ProductionIsi = () => {
//     const [oeeCm1, setOeeCm1] = useState([]);
//     const [oeeVar, setVarOee] = useState([{ Ava: 0, Per: 0, Qua: 0, oee: 0 }]);
//     const [avaLine, setAvaLine] = useState([]);
//     const [perLine, setPerLine] = useState([]);
//     const [quaLine, setQuaLine] = useState([]);
  
//     const [toalOut, setTotalOut] = useState();
//     const [totalRun, setTotalRun] = useState();
//     const [totalStop, setTotalStop] = useState();
//     const [totalIdle, setTotalIdle] = useState();
//     const [totalSpeed, setTotalSpeed] = useState();
//     const [oeeChart, setOeeChart] = useState();
//     const [currentPage, setCurrentPage] = useState(1);
//     const [rowsPerPage, setRowsPerPage] = useState(10);
  
//     const [machineData, setMachine] = useState();
//     const [startDate, setStartDate] = useState();
//     const [finishDate, setFinishDate] = useState();
  
//     const [loading, setLoading] = useState(false);
//     const [error, setError] = useState(null);
  
//     const { colorMode } = useColorMode();
//     const [isTableVisible, setIsTableVisible] = useState(true);
//     const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
//     const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");
//     const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");
//     const kartuColor = useColorModeValue("rgba(var(--color-card))", "rgba(var(--color-card))");
  
//     const [isDarkMode, setIsDarkMode] = useState(
//       document.documentElement.getAttribute("data-theme") === "dark"
//     );
  
//     const handlePrevPage = () => {
//       if (currentPage > 1) {
//         setCurrentPage(currentPage - 1);
//       }
//     };
    
//     const handleNextPage = () => {
//       if (currentPage < Math.ceil(oeeCm1.length / rowsPerPage)) {
//         setCurrentPage(currentPage + 1);
//       }
//     };
  
//     var visitorsChartDrilldownHandler = (e) => {
//       //console.log(e.dataPoint.name);
//     };
  
//     const fetchData = async (data, start, finish) => {
//       let response = await axios.get("http://10.126.15.197:8002/part/oee", {
//         params: {
//           machine: data,
//           start: start,
//           finish: finish,
//         },
//       });
  
//       let response1 = await axios.get(
//         "http://10.126.15.197:8002/part/variableoee",
//         {
//           params: {
//             machine: data,
//             start: start,
//             finish: finish,
//           },
//         }
//       );
//       console.log(response.data);
//       console.log(response1.data);
  
//       setOeeCm1(response.data);
//       setVarOee(response1.data);
  
//       console.log(oeeChart);
  
//       var resultAva = [];
//       for (var i = 0; i < response.data.length; i++) {
//         var objAva = {
//           x: response.data[i].id,
//           y: Number(response.data[i].avability.toFixed(2)),
//         };
//         resultAva.push(objAva);
//       }
//       setAvaLine(resultAva);
  
//       var resultPer = [];
//       for (i = 0; i < response.data.length; i++) {
//         var objPer = {
//           x: response.data[i].id,
//           y: Number(response.data[i].performance.toFixed(2)),
//         };
//         resultPer.push(objPer);
//       }
//       setPerLine(resultPer);
  
//       var resultQua = [];
//       for (i = 0; i < response.data.length; i++) {
//         var objQua = {
//           x: response.data[i].id,
//           y: Number(response.data[i].quality.toFixed(2)),
//         };
//         resultQua.push(objQua);
//       }
//       setQuaLine(resultQua);
  
//       //Output==================================
//       let objOut = 0;
//       for (i = 0; i < response.data.length; i++) {
//         objOut += Number(response.data[i].output);
//       }
//       setTotalOut(objOut);
  
//       //Runtime====================================
//       let objRun = 0;
//       for (i = 0; i < response.data.length; i++) {
//         objRun += Number(response.data[i].runTime);
//       }
//       setTotalRun(objRun);
  
//       //Stop==================================
//       let objStop = 0;
//       for (i = 0; i < response.data.length; i++) {
//         objStop += Number(response.data[i].stopTime);
//       }
//       setTotalStop(objStop);
//       //Idle====================================
//       let objIdle = 0;
//       for (i = 0; i < response.data.length; i++) {
//         objIdle += Number(response.data[i].idleTime);
//       }
//       setTotalIdle(objIdle);
  
//       ////Speed========================================
//       let objSpeed = ((objOut * 25) / 4 / objRun).toFixed(1);
  
//       setTotalSpeed(objSpeed);
  
//       //OEE CHART========================================
//       var OeeChart = [];
//       for (i = 0; i < response.data.length; i++) {
//         var objOeeChart = {
//           label: moment
//             .tz(
//               new Date(response.data[i].time * 1000).toLocaleString(),
//               "America/Los_Angeles"
//             )
//             .format("YYYY-MM-DD HH:mm"),
//           y: Number(response.data[i].oee.toFixed(2)),
//         };
//         OeeChart.push(objOeeChart);
//       }
//       setOeeChart(OeeChart);
//       //console.log(OeeChart);
//     };
  
//     let changeMachine = (e) => {
//       var dataInput = e.target.value;
//       setMachine(dataInput);
//     };
  
//     let dateStart = (e) => {
//       var dataInput = e.target.value;
  
//       let unixStart = Math.floor(new Date(dataInput).getTime() / 1000);
//       setStartDate(unixStart);
//     };
  
//     let dateFinish = (e) => {
//       var dataInput = e.target.value;
  
//       let unixFinish = Math.floor(new Date(dataInput).getTime() / 1000);
//       setFinishDate(unixFinish);
//     };
  
//     let submitData = () => {
//       fetchData(machineData, startDate, finishDate);
//     };
  
//     useEffect(() => {}, []);
  
//     let oeeCalculation =
//       (oeeVar[0].Ava / 100) * (oeeVar[0].Per / 100) * (oeeVar[0].Qua / 100) * 100;
  
//       const renderCm1 = () => {
//         const indexOfLastRow = currentPage * rowsPerPage;
//         const indexOfFirstRow = indexOfLastRow - rowsPerPage;
//         const currentData = oeeCm1.slice(indexOfFirstRow, indexOfLastRow);
      
//         if (oeeCm1.length === 0) {
//           return (
//             <Tr>
//               <Td colSpan={10} className="text-center">
//                 No data available
//               </Td>
//             </Tr>
//           );
//         }
      
//         return currentData.map((cm1, index) => (
//           <Tr key={cm1.id}>
//             <Td>{indexOfFirstRow + index + 1}</Td> {/* Row Number */}
//             <Td>
//               {moment
//                 .unix(cm1.time)
//                 .tz("GMT")
//                 .format("YYYY-MM-DD HH:mm")
//                 }
//             </Td>
//             <Td className="bg-blue-400">{cm1.avability.toFixed(2)}</Td>
//             <Td className="bg-red-400">{cm1.performance.toFixed(2)}</Td>
//             <Td className="bg-green-400">{cm1.quality.toFixed(2)}</Td>
//             <Td>{cm1.oee.toFixed(2)}</Td>
//             <Td>{cm1.output}</Td>
//             <Td>{cm1.runTime}</Td>
//             <Td>{cm1.stopTime}</Td>
//             <Td>{cm1.idleTime}</Td>
//           </Tr>
//         ));
//       };
      
//     useEffect(() => {
//       const handleThemeChange = () => {
//         const currentTheme = document.documentElement.getAttribute('data-theme');
//         setIsDarkMode(currentTheme === 'dark');
//       };
//       // Observe attribute changes
//       const observer = new MutationObserver(handleThemeChange);
//       observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  
//       return () => observer.disconnect();
//     }, []);
  
//     const options = {
//       theme: isDarkMode ? "dark2" : "light2",
//       animationEnabled: true,
//       title: {
//         text: "Overall Equipment Effectiveness",
//         fontColor: isDarkMode ? "white" : "black"
//       },
//       subtitles: [
//         {
//           //text: `${oeeCalculation.oee.toFixed(2)}% OEE`,
//           text: `${oeeCalculation.toFixed(2)}% OEE`,
//           verticalAlign: "center",
//           fontSize: 26,
//           dockInsidePlotArea: true,
//           fontColor: isDarkMode ? "white" : "black",
//         },
//       ],
//       backgroundColor: isDarkMode ? "#171717" : "#ffffff",
//       // height: 410, //buat naikin tinggi 
//       data: [
//         {
//           click: visitorsChartDrilldownHandler,
//           type: "doughnut",
//           showInLegend: true,
//           indexLabel: "{name}: {y}",
//           yValueFormatString: "#,###'%'",
  
//           dataPoints: [
//             { name: "Avability", y: oeeVar[0].Ava },
//             { name: "Performance", y: oeeVar[0].Per },
//             { name: "Quality", y: oeeVar[0].Qua },
//           ],
//         },
//       ],
//     };
  
//     const options1 = {
//       theme: isDarkMode ? "dark2" : "light2",
//       title: {
//         text: "OEE",
//         fontColor: isDarkMode ? "white" : "black",
//       },
//       subtitles: [
//         {
//           text: "instrument production",
//           fontColor: isDarkMode ? "white" : "black",
//         },
//       ],
//       axisY: {
//         prefix: "",
//       },
//       toolTip: {
//         shared: true,
//       },
//       backgroundColor: isDarkMode ? "#171717" : "#ffffff",
//       borderRadius: 12, // Membuat sudut melengkung (mirip rounded-lg)
//       margin: {
//         top: 10,
//         left: 10,
//         right: 10,
//         bottom: 10,
//       },
//       data: [
//         {
//           type: "spline",
//           name: "Avability",
//           showInLegend: true,
//           xValueFormatString: "",
//           yValueFormatString: "",
//           dataPoints: avaLine,
//         },
//         {
//           type: "spline",
//           name: "Performance",
//           showInLegend: true,
//           xValueFormatString: "",
//           yValueFormatString: "",
//           dataPoints: perLine,
//         },
//         {
//           type: "spline",
//           name: "Quality",
//           showInLegend: true,
//           xValueFormatString: "",
//           yValueFormatString: "",
//           dataPoints: quaLine,
//         },
//       ],
//     };
  
//     const options3 = {
//       theme: isDarkMode ? "dark2" : "light2",
//       animationEnabled: true,
//       title: {
//         text: "OEE Shift",
//         fontColor: isDarkMode ? "white" : "black",
//       },
//       backgroundColor: isDarkMode ? "#171717" : "#ffffff",
//       data: [
//         {
//           // Change type to "doughnut", "line", "splineArea", etc.
//           type: "column",
//           dataPoints: oeeChart,
//         },
//       ],
//     };

//   return (
//     <>
//     <div className="flex flex-col bg-background justify-center mx-12 gap-2 rounded-md shadow-md md:flex-row">
//       <div className="w-full md:w-1/2">
//         <CanvasJSChart options={options} />
//       </div>
//       <div className="w-full md:w-1/2">
//         <CanvasJSChart options={options3} />
//       </div>
//     </div>
//     <br />
//     <div className="flex flex-col md:flex-row bg-background justify-center mx-1 pb-10 pr-0 gap-4">
//       <Card
//         direction={{ base: "column", sm: "row" }}
//         overflow="hidden"
//         variant="outline"
//         sx={{
//           borderRadius: "0.395rem",
//           background: kartuColor,
//         }}
//       >
//         <div>
//           <CircularProgress
//             value={oeeVar[0].Ava.toFixed(2)}
//             color="purple.400"
//             size="200px"
//             fontSize="150px"
//           >
//             <CircularProgressLabel>
//               {oeeVar[0].Ava.toFixed(2)}%
//             </CircularProgressLabel>
//           </CircularProgress>
//         </div>
        
//         <Stack>
//           <CardBody>
//             <Heading size="md">Availability</Heading>

//             <Text py="2">
//               Runtime ({totalRun} Min)
//               <Progress hasStripe value={100} colorScheme="purple" />
//               Idletime ({totalIdle} Min)
//               <Progress hasStripe value={(totalIdle / totalRun) * 100} colorScheme="purple" />
//               Stoptime ({totalStop} Min)
//               <Progress hasStripe value={(totalStop / totalRun) * 100} colorScheme="purple" />
//               <br />
//               availability is the ratio of Run Time to Planned Production
//               Time.
//             </Text>
//           </CardBody>
//         </Stack>
//       </Card>

//       <Card
//         direction={{ base: "column", sm: "row" }}
//         overflow="hidden"
//         variant="outline"
//         width=""
//         sx={{
//           borderRadius: "0.395rem",
//           background: kartuColor,
//         }}
//       >
//         <div>
//           <CircularProgress
//             value={oeeVar[0].Per.toFixed(2)}
//             color="green.400"
//             size="200px"
//             fontSize="150px"
//           >
//             <CircularProgressLabel>
//               {oeeVar[0].Per.toFixed(2)}%
//             </CircularProgressLabel>
//           </CircularProgress>
//         </div>

//         <Stack>
//           <CardBody>
//             <Heading size="md">Performance </Heading>
//             <Text py="2">
//               Actual Speed {totalSpeed} slave/min
//               <Progress hasStripe value={totalSpeed} colorScheme="green" />
//               Setpoint Speed 40 slave/min
//               <Progress hasStripe value={40} colorScheme="green" />
//               <br />
//               Performance is the second of the three OEE factors to be
//               calculated.
//             </Text>
//           </CardBody>
//         </Stack>
//       </Card>
//       <Card
//         direction={{ base: "column", sm: "row" }}
//         overflow="hidden"
//         variant="outline"
//         className="basis-1/3 flex-shrink-0 flex-grow-0"
//         sx={{
//           borderRadius: "0.395rem",
//           background: kartuColor,
//         }}
//       >
//         <div>
//           <CircularProgress
//             value={oeeVar[0].Qua.toFixed(2)}
//             color="red.400"
//             size="200px"
//             fontSize="150px"
//           >
//             <CircularProgressLabel>
//               {oeeVar[0].Qua.toFixed(2)}%
//             </CircularProgressLabel>
//           </CircularProgress>
//         </div>

//         <Stack>
//           <CardBody>
//             <Heading size="md">Quality</Heading>

//             <Text py="2">
//               Good Product ({toalOut} Box)
//               <Progress hasStripe value={64} colorScheme="red" />
//               Afkir Product (0 Box)
//               <Progress hasStripe value={0} colorScheme="red" />
//               <br />
//               Quality takes into account manufactured parts that do not meet
//               quality standards,
//             </Text>
//           </CardBody>
//         </Stack>
//       </Card>
//     </div>

//     <br />
//     <div className="block bg-card rounded-lg shadow-lg p-4 mx-2 overflow-x-auto">
//       <CanvasJSChart options={options1} />
//     </div>
//     <br />
    
//     <div className="flex flex-col gap-4 p-4">
//       {/* Input Fields and Buttons */}
//       <div className="grid grid-cols-1 md:grid-cols-2 xl:flex xl:flex-row xl:justify-center gap-4 w-full">
//         <div className="col-span-1 xl:flex-1">
//           <label className="block text-sm font-medium leading-4 text-text">
//             Mesin
//           </label>
//           <Select
//             placeholder="Select Machine"
//             onChange={changeMachine}
//             sx={{
//               border: "1px solid",
//               borderColor: borderColor,
//               borderRadius: "0.395rem",
//               background: "var(--color-background)",
//               _hover: {
//                 borderColor: hoverBorderColor,
//               },
//             }}
//           >
//             <option value="mezanine.tengah_Cm1_data">Cm1</option>
//             <option value="mezanine.tengah_Cm2_data">Cm2</option>
//             <option value="mezanine.tengah_Cm3_data">Cm3</option>
//             <option value="mezanine.tengah_Cm4_data">Cm4</option>
//             <option value="mezanine.tengah_Cm5_data">Cm5</option>
//             <option value="mezanine.tengah_Hm1_data">Hm1</option>
//           </Select>
//         </div>
//         <div className="col-span-1 xl:flex-1">
//           <label className="block text-sm font-medium leading-4 text-text">
//             Start Time
//           </label>
//           <Input
//             onChange={dateStart}
//             placeholder="Select Date"
//             size="md"
//             type="date"
//             css={{
//               "&::-webkit-calendar-picker-indicator": {
//                 color: isDarkMode ? "white" : "black",
//                 filter: isDarkMode ? "invert(1)" : "none",
//               },
//             }}
//             sx={{
//               border: "1px solid",
//               borderColor: borderColor,
//               borderRadius: "0.395rem",
//               background: "var(--color-background)",
//               _hover: {
//                 borderColor: hoverBorderColor,
//               },
//             }}
//           />
//         </div>
//         <div className="col-span-1 xl:flex-1">
//           <label className="block text-sm font-medium leading-4 text-text">
//             Finish Time
//           </label>
//           <Input
//             onChange={dateFinish}
//             placeholder="Select Date and Time"
//             size="md"
//             type="date"
//             css={{
//               "&::-webkit-calendar-picker-indicator": {
//                 color: isDarkMode ? "white" : "black",
//                 filter: isDarkMode ? "invert(1)" : "none",
//               },
//             }}
//             sx={{
//               border: "1px solid",
//               borderColor: borderColor,
//               borderRadius: "0.395rem",
//               background: "var(--color-background)",
//               _hover: {
//                 borderColor: hoverBorderColor,
//               },
//             }}
//           />
//         </div>
//         <div className="col-span-1 xl:flex xl:flex-none xl:w-20 flex-col ">
//           <label className="block text-sm font-medium leading-4 text-text">
//             Rows
//           </label>
//           <Select
//             value={rowsPerPage}
//             onChange={(e) => setRowsPerPage(Number(e.target.value))}
//             width="80px"
//             sx={{
//               border: "1px solid",
//               borderColor: borderColor,
//               borderRadius: "0.395rem",
//               background: "var(--color-background)",
//               _hover: {
//                 borderColor: hoverBorderColor,
//               },
//             }}
//           >
//             <option value={10}>10</option>
//             <option value={20}>20</option>
//             <option value={40}>40</option>
//             <option value={60}>60</option>
//             <option value={100}>100</option>
//           </Select>
//         </div>
//         <div className="col-span-1 xl:flex-1 xl:flex xl:flex-grow flex items-end">
//           <Button
//             className="w-full"
//             colorScheme="blue"
//             onClick={() => submitData()}
//           >
//             Submit
//           </Button>
//         </div>
//         <div className="col-span-1 xl:flex-1 flex items-end xl:grow">
//           <Button
//             className="w-full"
//             colorScheme="red"
//             onClick={() => setIsTableVisible(!isTableVisible)}
//           >
//             {isTableVisible ? "Hide All Data" : "Show All Data"}
//           </Button>
//         </div>
//       </div>
//     </div>
//     <div className="flex justify-center">
//     {isTableVisible && (
//       <TableContainer className="bg-card rounded-md mt-4 mx-4" sx={{ overflowX: "auto", maxWidth: "90%" }}>
//         <Table key={colorMode} variant="simple" sx={{ minWidth: "1200px"}}>
//           <TableCaption sx={{
//           color: tulisanColor,
//           }}>Machine Performance</TableCaption>
//           <Thead>
//             <Tr>
//               <Th sx={{
//           color: tulisanColor,
//           }}>id</Th>
//               <Th sx={{
//           color: tulisanColor,
//           }}>Date Time</Th>
//               <Th sx={{
//           color: tulisanColor,
//           }}>Availability</Th>
//               <Th sx={{
//           color: tulisanColor,
//           }}>Performance</Th>
//               <Th sx={{
//           color: tulisanColor,
//           }}>Quality</Th>
//               <Th sx={{
//           color: tulisanColor,
//           }}>OEE</Th>
//               <Th sx={{
//           color: tulisanColor,
//           }}>Output</Th>
//               <Th sx={{
//           color: tulisanColor,
//           }}>RunTime</Th>
//               <Th sx={{
//           color: tulisanColor,
//           }}>StopTime</Th>
//               <Th sx={{
//           color: tulisanColor,
//           }}>Idle Time</Th>
//             </Tr>
//           </Thead>
//           <Tbody>{renderCm1()}</Tbody>
//         </Table>
//       </TableContainer>
//       )}
//       </div>
//       <br />
//       <div className="flex justify-center items-center mt-2 gap-4 mb-2">
//         <Button 
//           onClick={handlePrevPage} 
//           isDisabled={currentPage === 1} 
//           colorScheme="blue"
//         >
//           Previous
//         </Button>
//         <span className="text-text">
//           Page {currentPage} of {Math.ceil(oeeCm1.length / rowsPerPage)}
//         </span>
//         <Button 
//           onClick={handleNextPage} 
//           isDisabled={currentPage === Math.ceil(oeeCm1.length / rowsPerPage)} 
//           colorScheme="blue"
//         >
//           Next
//         </Button>
//       </div>
//     </>
//   );
// }

// export default ProductionIsi