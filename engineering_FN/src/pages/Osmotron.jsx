import React, { useEffect, Component, useState } from "react";
import CanvasJSReact from "../canvasjs.react";
import { Button, ButtonGroup, Stack, Input, Select } from "@chakra-ui/react";
import { useColorMode, useColorModeValue } from "@chakra-ui/react";
import axios from "axios";

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

export default function Osmotron() {
  const [startDate, setStartDate] = useState();
  const [finishDate, setFinishDate] = useState();
  const [OsmoArea, setOsmoArea] = useState();
  const [OsmoData, setOsmoData] = useState();
  const [max, setmax]= useState ([]);
  const [min, setmin]= useState ([]);
  const [avg, setavg]= useState ([]);
  const [unit, setunit] = useState();
  const [title, setTitle] = useState();

  const { colorMode } = useColorMode();
  const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
  const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );

        const fetchOsmo = async () => {
            let response = await axios.get(
                "http://10.126.15.197:8002/part/Osmotron",
                {
                  params: {
                    area: OsmoArea,
                    start: startDate,
                    finish: finishDate,
                  },
                }
              ) 
              console.log(response);
              if (OsmoArea === "B270A_6.1") {
                var multipliedData = response.data.map((data) => ({
                  label: data.label,
                  y: data.y,
                  x: data.x,
                }));
              } else if (OsmoArea === "ET270A_6.11" ) {
                var multipliedData = response.data.map((data) => ({
                  label: data.label,
                  y: data.y,
                  x: data.x,
                }));
              } else if (OsmoArea === "ET270A_6.12"){
                var multipliedData = response.data.map((data) => ({
                  label: data.label,
                  y: data.y,
                  x: data.x,
                }));
              } else {
                var multipliedData = response.data.map((data) => ({
                  label: data.label,
                  y: data.y,
                  x: data.x,
                }));
              }
              setOsmoData(multipliedData);

              if (OsmoArea === "osmo_ET270A_6.11"){
                setunit("Volt")
              } else if (OsmoArea === "osmo_ET270A_6.12"  ){
                setunit("Ampere")
              } else if  (OsmoArea === "osmo_FIT270_5.50" || OsmoArea === "osmo_FIT270A_5.2" || OsmoArea === "osmo_FT270A_5.51"
              || OsmoArea === "osmo_FT270A_6.1" || OsmoArea === "osmo_FT270A_6.2"
              ){
                setunit("Liter/Hour")
              } else if  (OsmoArea === "osmo_FT270A_5.1"){
                setunit("Meter Cubic/Hour")
              }else if  (OsmoArea === "osmo_PDY270A_5.4" || OsmoArea === "osmo_PDY270A_5.7" || OsmoArea === "osmo_PT270A_1.1"
              || OsmoArea === "osmo_PT270A_5.1" || OsmoArea === "osmo_PT270A_5.4" || OsmoArea === "osmo_PT270A_5.5"
              || OsmoArea === "osmo_PT270A_5.6" || OsmoArea === "osmo_PT270A_5.7" || OsmoArea === "osmo_PT270A_5.8"
              || OsmoArea === "osmo_PT270A_6.1" || OsmoArea === "osmo_PT270A_6.2" || OsmoArea === "osmo_PT270A_6.3"){
                setunit("Bar")
              }else if  (OsmoArea === "osmo_QE270A_11.1"){
                setunit("mV")
              }else if  (OsmoArea === "osmo_QE270A_12.1"){
                setunit("pH")
              }else if  (OsmoArea === "osmo_QE270A_5.1" || OsmoArea === "osmo_QE270A_6.1" || OsmoArea === "osmo_QE270A_6.2"){
                setunit("μS/cm")
              }else if  (OsmoArea === "osmo_TE270A_5.1" || OsmoArea === "osmo_TE270A_6.1" || OsmoArea === "osmo_TT270A_5.2"){
                setunit("°C")
              }else if  (OsmoArea === "osmo_WCF_Factor"){
                setunit("%")
              }else if  (OsmoArea === "FT270A_6.1"){
                setunit("Meter Cubic")
              }else {
                setunit("")
              }
            
            const maxOsmo = multipliedData.reduce ((acc, data) => Math.max (acc, data.y), Number.NEGATIVE_INFINITY);
            var max = Number(maxOsmo.toFixed(2))
            setmax(max)

            const minOsmo = Math.min(...response.data.map((data) => data.y));
            var min = Number(minOsmo.toFixed(2))
            setmin(min)

            const totalOsmo = multipliedData.reduce ((sum, data) => sum + data.y, 0);
            var total = 0
            total = Number(totalOsmo.toFixed(2))
            const averageOsmo = totalOsmo / multipliedData.length;
            var avg = Number(averageOsmo.toFixed(2))
            setavg(avg);
        }

        let dateStart = (e) => {
            var dataInput = e.target.value;
            setStartDate(dataInput);
          };
        
        let dateFinish = (e) => {
            var dataInput = e.target.value;
            setFinishDate(dataInput);
          };
        
        let getOsmoArea = (e) => {
            var dataInput = e.target.value;
            setOsmoArea(dataInput);
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
            animationEnabled: true,
            responsive: true,
            theme: isDarkMode ? "dark2" : "light2",
            backgroundColor: isDarkMode ? "#171717" : "#ffffff",
            title: {
              text: "Osmotron Data Graph",
              fontColor: isDarkMode ? "white" : "black"
            },
            subtitles: [
                {
                  text: unit,
                  fontSize: "20"
                },
              ],
            axisY: {
              prefix: "",
            },
            axisX: {
              valueFormatString: "YYYY-MMM-DD HH:mm",
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
                name: unit,
                showInLegend: true,
                markerType: "circle",
                yValueFormatString: "",
                xValueType: "dateTime",
                dataPoints: OsmoData,
                color: "green"
              },
            ],
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

  return(
    <div className="my-4">
      <div className="flex justify-center items-center my-6 mx-auto w-full">
        <div className="grid lg:grid-cols-4 gap-4 w-full max-w-screen-xl xl:flex xl:flex-row xl:justify-center xl:items-center">
          {/* Column 1: Select Parameter */}
          <div className="w-full flex flex-col items-center xl:w-96">
            <h5 className="mb-1">Parameter</h5>
            <Select placeholder="Select Parameter" className="w-full" onChange={getOsmoArea}
            sx={{
              border: "1px solid",
              borderColor: borderColor,
              borderRadius: "0.395rem",
              background: "var(--color-background)", // background color from Tailwind config
    
              _hover: {
                borderColor: hoverBorderColor,
              },
            }}>
              <option value="osmo_B270A_6.1">B270A_6.1 (Unit EDI)</option>
              <option value="osmo_ET270A_6.11">ET270A_6.11 (Voltase EDI)</option>
              <option value="osmo_ET270A_6.12">ET270A_6.12 (Ampere EDI)</option>
              <option value="osmo_FIT270_5.50">FIT270A_5.50 (Flow reject membrane fase 2)</option>
              <option value="osmo_FIT270A_5.2">FIT270A_5.2 (Flow meter reject membrane fase 1)</option>
              <option value="osmo_FT270A_5.1">FT270A_5.1 (Flow transmitter)</option>
              <option value="osmo_FT270A_5.51">FIT270A_5.51 (low meter recycle membrane fase 2)</option>
              <option value="osmo_FT270A_6.1">FT270A_6.1 (Flow product RO fase 2)</option>
              <option value="osmo_FT270A_6.2">FT270A_6.2 (Flow meter before EDI)</option>
              <option value="osmo_P270A_1.1">P270A_1.1 (Feed Pump)</option>
              <option value="osmo_P270A_11.1">P270A_11.1 (NaHSO3 Dosing Pump)</option>
              <option value="osmo_P270A_12.1">P270A_12.1 (NaOH Dosing Pump)</option>
              <option value="osmo_P270A_13.1">P270A_13.1 (NaHCO3 Dosing Pump)</option>
              <option value="osmo_P270A_5.1">P270A_5.1 (High pressure pump fase 1)</option>
              <option value="osmo_P270A_5.2">P270A_5.2 (High pressure pump fase 2)</option>
              <option value="osmo_P270A_6.1">P270A_6.1 (EDI Pump)</option>
              <option value="osmo_P270A_7.1">P270A_7.1 (DIP DOsing Pump)</option>
              <option value="osmo_PDY270A_5.4">PDY270A_5.4 (∆T pressure membrane fase 1)</option>
              <option value="osmo_PDY270A_5.7">PDY270A_5.7 (∆T Pressure membrane fase 2)</option>
              <option value="osmo_PT270A_1.1">PT270A_1.1 (Feed pump)</option>
              <option value="osmo_PT270A_5.1">PT270A_5.1 (Pressure before PHE)</option>
              <option value="osmo_PT270A_5.4">PT270A_5.4 (Inlet membrane fase 1)</option>
              <option value="osmo_PT270A_5.5">PT270A_5.5 (Reject membrane fase 1)</option>
              <option value="osmo_PT270A_5.6">PT270A_5.6 (Before HPP fase 2)</option>
              <option value="osmo_PT270A_5.7">PT270A_5.7 (Inlet membrane fase 2)</option>
              <option value="osmo_PT270A_5.8">PT270A_5.8 (Reject membrane fase 2)</option>
              <option value="osmo_PT270A_6.1">PT270A_6.1 (Presssure product RO fase 2)</option>
              <option value="osmo_PT270A_6.2">PT270A_6.2 (Pressure before EDI)</option>
              <option value="osmo_PT270A_6.3">PT270A_6.3 (Pressure after EDI)</option>
              <option value="osmo_QE270A_11.1">QE270A_11.1 (ORP sensor)</option>
              <option value="osmo_QE270A_12.1">QE270A_12.1 (pH sensor)</option>
              <option value="osmo_QE270A_5.1">QE270A_5.1 (Conductivity RO fase 2)</option>
              <option value="osmo_QE270A_6.1">QE270A_6.1 (Conductivity product EDI)</option>
              <option value="osmo_QE270A_6.2">QE270A_6.2 (Conductivity inlet EDI)</option>
              <option value="osmo_TE270A_5.1">TE270A_5.1 (Suhu RO fase 2)</option>
              <option value="osmo_TE270A_6.1">TE270A_6.1 (Temperature product EDI)</option>
              <option value="osmo_TT270A_5.2">TT270A_5.2 (Suhu after PHE)</option>
              <option value="osmo_V270A_5.10">V270A_5.10 (Valve Bypass RO2 To EDI)</option>
              <option value="osmo_V270A_5.50">V270A_5.50 (Valve Drain RO1)</option>
              <option value="osmo_V270A_5.51">V270A_5.51 (Valve Bypass RO1 - RO2)</option>
              <option value="osmo_V270A_6.2">V270A_6.2 (Outlet To Loopo)</option>
              <option value="osmo_V270A_6.5">V270A_6.5 (Valve Brine Tank EDI)</option>
              <option value="osmo_W270A_5.1">W270A_5.1 (Plat Heat Exchanger)</option>
              <option value="osmo_WCF_Factor">WCF_Factor (Water Conversion Factor)</option>
              <option value="FT270A_6.1">FT270A_6.1 (Output Osmotron)</option>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full xl:w-96">
            <div className="flex flex-col items-center">
              <h5 className="mb-1">Start Time</h5>
              <Input
                onChange={dateStart}
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
            <div className="flex flex-col items-center">
              <h5 className="mb-1">Finish Time</h5>
              <Input
                onChange={dateFinish}
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
          </div>
          <div className="w-full flex flex-col items-center xl:w-48">
            <h5 className="mb-1 invisible">Placeholder</h5>
            <Button className="w-full xl:w-auto xl:px-8" style={{ minWidth: '120px' }} colorScheme="blue" onClick={() => fetchOsmo()}>
              Submit
            </Button>
          </div>
          <div className="flex flex-col justify-center items-center text-center w-full xl:w-36">
            <div className="text-text">Avg = {avg.toLocaleString()} {unit}</div>
            <div className="text-text">Max = {max.toLocaleString()} {unit}</div>
            <div className="text-text">Min = {min.toLocaleString()} {unit}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-row justify-center mx-6 p-1 bg-card rounded-md shadow-lg overflow-x-auto"> 
          <CanvasJSChart options={options} />
      </div>
    </div>
  )
}