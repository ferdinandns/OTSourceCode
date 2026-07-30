import React, { useEffect, Component, useState } from "react";
import CanvasJSReact from "../canvasjs.react";
import { Button, ButtonGroup, Stack, Input, Select } from "@chakra-ui/react";
import axios from "axios";
import { useColorMode, useColorModeValue, Box } from "@chakra-ui/react";

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

export default function Loopo() {
  const [startDate, setStartDate] = useState();
  const [finishDate, setFinishDate] = useState();
  const [LoopoArea, setLoopoArea] = useState();
  const [LoopoData, setLoopoData] = useState();
  const [max, setmax]= useState ([]);
  const [min, setmin]= useState ([]);
  const [avg, setavg]= useState ([]);
  const [unit, setunit] = useState();
  const [title, setTitle] = useState();

  const { colorMode } = useColorMode();
  const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
  const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");
  const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );

  const fetchLoopo = async () => {
    let response = await axios.get(
      "http://10.126.15.197:8002/part/Loopo",
      {
        params: {
          area: LoopoArea,
          start: startDate,
          finish: finishDate,
        },
      }
    ); 

    if (LoopoArea === "lopo_A845A_2.1") {
      var multipliedData = response.data.map((data) => ({
        label: data.label,
        y: data.y,
        x: data.x,
      }));
      } else if (
        LoopoArea === "lopo_FT845A_8.1" 
      ) {
      var multipliedData = response.data.map((data) => ({
        label: data.label,
        y: data.y,
        x: data.x,
      }));
      } else if (LoopoArea === "lopo_LT845A_1.1"){
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
        setLoopoData(multipliedData);

      if (LoopoArea === "lopo_FT845A_8.1"){
        setunit("Meter Cubic/Hour")
      } else if (LoopoArea === "lopo_PT845A_1.1" || LoopoArea === "lopo_PT845A_8.1"  ){
        setunit("Bar")
      } else if  (LoopoArea === "lopo_QE845A_4.1"){
        setunit("W/Square Meter")
      } else if  (LoopoArea === "lopo_QE845A_5.1"){
        setunit("ppb")
      }else if  (LoopoArea === "lopo_TT845A_3.1" || LoopoArea ==="TE845A_8.1"){
        setunit("°C")
      }else if  (LoopoArea === "lopo_LT560A_1.1"){
        setunit("%")
      }else if  (LoopoArea === "lopo_LT560A_1.1"){
        setunit("%")
      }else if  (LoopoArea === "QE845A_6.1"){
        setunit("ppb")
      }else if  (LoopoArea === "QE845A_8.1"){
        setunit("µS/cm")
      }else {
        setunit("")
      }
            
      const maxLoopo = multipliedData.reduce ((acc, data) => Math.max (acc, data.y), Number.NEGATIVE_INFINITY);
      var max = Number(maxLoopo.toFixed(2))
      setmax(max)

      const minLoopo = Math.min(...response.data.map((data) => data.y));
      var min = Number(minLoopo.toFixed(2))
      setmin(min)

      const totalLoopo = multipliedData.reduce ((sum, data) => sum + data.y, 0);
      var total = 0
      total = Number(totalLoopo.toFixed(2))
      const averageLoopo = totalLoopo / multipliedData.length;
      var avg = Number(averageLoopo.toFixed(2))
      setavg(avg);
  };

  let dateStart = (e) => {
      var dataInput = e.target.value;
      setStartDate(dataInput);
    };
  
  let dateFinish = (e) => {
      var dataInput = e.target.value;
      setFinishDate(dataInput);
    };
  
  let getLoopoArea = (e) => {
      var dataInput = e.target.value;
      setLoopoArea(dataInput);
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
      responsive: true, 
      maintainAspectRatio: true,
      theme: isDarkMode ? "dark2" : "light2",
      backgroundColor: isDarkMode ? "#171717" : "#ffffff",
      // Margin: 8,
      title: {
        text: "Loopo Data Graph",
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
          dataPoints: LoopoData,
          color: "purple"
        },
      ],
    };

  return(
    <div className="my-4">
      <div className="flex justify-center items-center my-6 mx-auto w-full">
        <div className="grid lg:grid-cols-4 gap-4 w-full max-w-screen-xl xl:flex xl:flex-row xl:justify-center xl:items-center">
          {/* Column 1: Select Parameter */}
          <div className="w-full flex flex-col items-center xl:w-96">
            <h5 className="mb-1">Parameter</h5>
            <Select placeholder="Select Parameter" className="w-full" onChange={getLoopoArea}
            sx={{
              border: "1px solid",
              borderColor: borderColor,
              borderRadius: "0.395rem",
              background: "var(--color-background)", // background color from Tailwind config
    
              _hover: {
                borderColor: hoverBorderColor,
              },
            }}>
              <option value="lopo_A845A_2.1">A845A_2.1 (Ozone Hours Meter)</option>
              <option value="lopo_FT845A_8.1">FT845A_8.1 (Flow Meter Return)</option>
              <option value="lopo_LT560A_1.1">LT560A_1.1 (PW Tank)</option>
              <option value="lopo_P845A_1.1">P845A_1.1 (Pompa Supply)</option>
              <option value="lopo_PT845A_1.1">PT845A_1.1 (Pressure Supply)</option>
              <option value="lopo_PT845A_8.1">PT845A_8.1 (Pressure Return)</option>
              <option value="lopo_QE845A_4.1">QE845A_4.1 (UV Hours Meter)</option>
              <option value="lopo_QE845A_5.1">QE845A_5.1 (Ozone After Pompa)</option>
              <option value="lopo_TT845A_3.1">TT845A_3.1 (Suhu After PHE)</option>
              <option value="lopo_V845A_3.1">V845A_3.1 (Valve Motorize Chiller PHE)</option>
              <option value="QE845A_6.1">QE845A 6.1 (TOC)</option>
              <option value="QE845A_8.1">QE845A 8.1 (Conductivity)</option>
              <option value="TE845A_8.1">TE845A 8.1 (Suhu Return)</option>
            </Select>
          </div>
          {/* Kolom 2 */}
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
            <Button className="w-full xl:w-auto xl:px-8" style={{ minWidth: '120px' }} colorScheme="blue" onClick={() => fetchLoopo()}>
              Submit
            </Button>
          </div>
        
          {/* Kolom 4: Statistik Tengah */}
          <div className="flex flex-col justify-center items-center text-center w-full xl:w-36">
            <div className="text-text">Avg = {avg.toLocaleString()} {unit}</div>
            <div className="text-text">Max = {max.toLocaleString()} {unit}</div>
            <div className="text-text">Min = {min.toLocaleString()} {unit}</div>
          </div>
        </div>
      </div>
      <div className="flex flex-row justify-center mx-6 p-1 bg-card rounded-md shadow-lg overflow-x-auto "> 
        <CanvasJSChart options={options} />
      </div>
      <br />
      <div className="mt-3">
        <div className="ml-16 text-text">Standard value :</div>
        <div className="ml-16 text-text">Conductivity = below/equal 1,3µS/cm (25°)</div>
        <div className="ml-16 text-text">Total Organic Carbon = below/equal 500ppb</div>
      </div>
    </div>
  );
}