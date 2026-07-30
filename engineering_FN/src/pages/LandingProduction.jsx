import React, { useEffect, Component, useState } from "react";
import axios from "axios";
import CanvasJSReact from "../canvasjs.react";
import {CircularProgress, CircularProgressLabel, Select} from "@chakra-ui/react";
import { getDateProd } from "../features/part/prodSlice";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useColorMode, useColorModeValue } from "@chakra-ui/react";

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

function LandingProduction() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const dateValue = useSelector((state) => state.prod.date);

  const [opeVar, setOpeVar] = useState([{ Ava: 0, Per: 0, Qua: 0, oee: 0 }]);
  const [dateGlobal, setDate] = useState();
  const [datawidth, setWidth] = useState(window.innerWidth);
  const [dataheight, setHeight] = useState(500);

  // Responsive sizing with mobile-first approach
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );

  const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
  const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");
  const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");


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

  // useEffect(() => {
  //   const handleResize = () => {
  //     setWidth(document.body.clientWidth);
  //     setHeight(document.body.clientHeight > 600 ? 500 : 800); // Adjust height based on conditions
  //   };

  //   window.addEventListener("resize", handleResize);

  //   return () => {
  //     window.removeEventListener("resize", handleResize);
  //   };
  // }, []);

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setDate(dateValue);
    fetchOPE(dateValue);
  }, [dateValue]);

  let opeCalculation =
    (opeVar[0].Ava / 100) * (opeVar[0].Per / 100) * (opeVar[0].Qua / 100) * 100;

const fetchOPE = async (date) => {
    try {
        let response = await axios.get("http://10.126.15.197:8002/part/ope", {
            params: {
                date: date,
            },
        });

        // 🚨 FIXING THE FLAWED PERFORMANCE DATA HERE
        const rawData = response.data;
        if (rawData.length > 0 && rawData[0].Per) {
            
            // This attempts to clean the flawed number.
            // If the number is still astronomical, it will be capped to a default or rounded.
            const cleanedPerformance = parseFloat(rawData[0].Per);
            
            // Set a fallback if the number is clearly wrong (e.g., > 100 or huge)
            if (cleanedPerformance > 1000 || isNaN(cleanedPerformance)) {
                console.error("Performance data is flawed from API. Resetting to 0.");
                rawData[0].Per = 0.00; // Reset to a safe value
            } else {
                // Otherwise, round it to 2 decimals for display
                rawData[0].Per = cleanedPerformance.toFixed(2);
            }
        }
        
        // Update the state with the cleaned data
        setOpeVar(rawData);

    } catch (error) {
        console.error("Error fetching OPE data:", error);
    }
};

  const getChartDimensions = () => {
    // Mobile-first responsive dimensions
    const width = dimensions.width;
    if (width < 640) { // sm breakpoint
      return { width: width - 40, height: 400 };
    } else if (width < 768) { // md breakpoint
      return { width: width - 80, height: 450 };
    } else if (width < 1024) { // lg breakpoint
      return { width: width - 120, height: 500 };
    } else { // xl and above
      return { width: Math.min(1360, width - 160), height: 500 };
    }
  };

  var visitorsChartDrilldownHandler = (e) => {
    let chartClick = e.dataPoint.name;
    if (chartClick == "Availability") {
      navigate("/avabilityope");
    }
  };

  var visitorsCentralClick = (e) => {
    //console.log(e);
  };

  const getDate = (e) => {
    var dataInput = e.target.value;

    dispatch(getDateProd(dataInput));
  };

  const headerHendeler = (e) => {
    navigate("/oeeLine");
  };

  const options = {
    zoomEnabled: true,
    theme: isDarkMode ? "dark2" : "light2",
    backgroundColor: isDarkMode ? "#171717" : "#ffffff",
    ...getChartDimensions(),
    title: {},
    subtitles: [
      {
        //text: `${oeeCalculation.oee.toFixed(2)}% OEE`,

        text: `${opeCalculation.toFixed(2)}% OEE`,
        verticalAlign: "center",
        fontColor: isDarkMode ? "white" : "black",
        fontSize: dimensions.width < 640 ? 24 : 36,
        fontStyle: "oblique",
        dockInsidePlotArea: true,
      },
    ],

    data: [
      {
        click: visitorsChartDrilldownHandler,
        type: "doughnut",
        showInLegend: true,
        indexLabel: "{name}: {y}",
        indexLabelFontSize: dimensions.width < 640 ? 14 : 20,
        yValueFormatString: "#,###'%'",

        dataPoints: [
          { name: "Availability", y: opeVar[0].Ava },
          { name: "Performance", y: opeVar[0].Per },
          { name: "Quality", y: opeVar[0].Qua },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row justify-center gap-6 mb-4">
          <div>
            <h5 className="mb-1 text-text">Year Search</h5>
            <Select
              sx={{
                border: "1px solid",
                borderColor: borderColor,
                text: tulisanColor,
                borderRadius: "0.395rem",
                background: "var(--color-background)",
                _hover: {
                  borderColor: hoverBorderColor,
                },
              }}>
              <option value="2021">2021</option>
              <option value="2022">2022</option>
              <option value="2023">2023</option>
              <option value="2024">2024</option>
              <option value="2025">2025</option>
            </Select>
          </div>
          <div>
            <h5 className="mb-1 text-text">Month Search</h5>
            <Select onChange={getDate} value={dateValue}
              sx={{
                border: "1px solid",
                borderColor: borderColor,
                borderRadius: "0.395rem",
                background: "var(--color-background)",
                _hover: {
                  borderColor: hoverBorderColor,
                },
              }}>
              <option value="0">All</option>
              <option value="1">Jan</option>
              <option value="2">Feb</option>
              <option value="3">Mar</option>
              <option value="4">Apr</option>
              <option value="5">Mei</option>
              <option value="6">Jun</option>
              <option value="7">Jul</option>
              <option value="8">Agu</option>
              <option value="9">Sep</option>
              <option value="10">Okt</option>
              <option value="11">Nov</option>
              <option value="12">Des</option>
            </Select>
          </div>
        </div>
      </div>
      <div className="flex flex-col ">
        <h1
          onClick={() => headerHendeler()}
          className="text-center text-text text-5xl font-bold cursor-pointer mb-1 ml-12">
          Overall Plant Effectiveness
        </h1>
        <div overflow="hidden" className="my-3 mx-5 flex justify-center">
          <CanvasJSChart options={options} />
        </div>
      </div>      

    </div>
  );
}

export default LandingProduction;
