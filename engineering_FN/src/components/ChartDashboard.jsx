import { useEffect, useState } from 'react';
import Axios from 'axios';
import CanvasJSReact from '../canvasjs.react'; // Pastikan Anda sudah menginstall dan mengimport CanvasJS
import { Chart } from "react-google-charts";
import { useColorMode, useColorModeValue } from "@chakra-ui/react";

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

function ChartDashboard({endpoint, area, title, colors, name}) {
  const [waterGraph, setWaterGraph] = useState([]);
  const [waterOsmoGraph, setWaterOsmoGraph] = useState([]);

  const [powerGraph, setPowerGraph] = useState([]);

  // const taman = 'cMT-DB-WATER-UTY_Met_Taman_data'; // Nama tabel yang ingin digunakan
  // const domestik = 'cMT-DB-WATER-UTY_Met_Domestik_data'; 
  // const inlet = 'cMT-DB-WATER-UTY_Met_Inlet_Pt_data'; 
  // const osmo = 'cMT-DB-WATER-UTY_Met_RO_data'; 
  // const boiler = 'cMT-DB-WATER-UTY_Met_Boiler_data'; 
  // const pdam = 'cMT-DB-WATER-UTY_Met_PDAM_data'; 

  // const inv16 = 'cMT-Gedung-UTY_Inverter1-6_SP_data'; 
  // const inv712 = 'cMT-Gedung-UTY_Inverter7-12_SP_data'; 
  // const sdp1 = 'cMT-Gedung-UTY_SDP.1-Produksi_data'; 
  // const sdp2 = 'cMT-Gedung-UTY_SDP.2-Produksi_data'; 
  // const sdputil = 'cMT-Gedung-UTY_SDP.1-Utility_data'; 
  // const chiller = 'cMT-Gedung-UTY_PP.1-Chiller_data'; 
  // const hydrant = 'cMT-Gedung-UTY_PP.2-Hydrant_data'; 
  // const lvmdp = ' '; 
  // const power = 'cMT-Gedung-UTY_MVMDP_data'; 

  const [isDarkMode, setIsDarkMode] = useState(
      document.documentElement.getAttribute("data-theme") === "dark"
    );

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

  const fetchGraphData = async () => {
    try {
      let response = await Axios.get(
        endpoint,
        {
          params: 
          { area }
        }
        
      );
      console.log(response);
      const processedData = response.data.map((row) => ({
        x: new Date(row.x * 1000), // Konversi timestamp ke objek Date
        y: Math.max(0, Number(row.y))
      }));
      setWaterGraph(processedData);
    //   setWaterOsmoGraph(processedData);
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, [endpoint, area]);

  const WaterOptions = {
    animationEnabled: true, // change to true	
    zoomEnabled: true,
    theme: isDarkMode ? "dark2" : "light2",
    axisY: {
      prefix: "",
      gridColor: isDarkMode ? "#444" : "#bfbfbf",
      labelFontColor: isDarkMode ? "white" : "black",
      tickLength: 5,
      tickThickness: 2,
      tickColor: isDarkMode ? "#d6d6d6" : "#5e5e5e",
    },
    axisX: {
      lineColor: isDarkMode ? "#d6d6d6" : "#474747",
      labelFontColor: isDarkMode ? "white" : "black",
      tickLength: 5,
      tickThickness: 2,
      tickColor: isDarkMode ? "#d6d6d6" : "#474747",
    },
    toolTip: {
      shared: true,
    },
    backgroundColor: isDarkMode ? "#171717" : "#ffffff",
    title: {
      text: title,
      fontColor: isDarkMode ? "white" : "black"
    },
    data: [
      {
        type: "column",
        name: name,
        showInLegend: true,
        lineColor: isDarkMode ? colors.dark : colors.light,
        color: isDarkMode ? colors.dark : colors.light,
        markerColor: isDarkMode ? colors.dark : colors.light,
        markerSize: 2,
        dataPoints: waterGraph,
      },
    ],
  };
//   const RejectOsmoOptions = {
//     theme: isDarkMode ? "dark2" : "light2",
//     axisY: {
//       prefix: "",
//       gridColor: isDarkMode ? "#444" : "#bfbfbf",
//       labelFontColor: isDarkMode ? "white" : "black",
//       tickLength: 5,
//       tickThickness: 2,
//       tickColor: isDarkMode ? "#d6d6d6" : "#5e5e5e",
//     },
//     axisX: {
//       lineColor: isDarkMode ? "#d6d6d6" : "#474747",
//       labelFontColor: isDarkMode ? "white" : "black",
//       tickLength: 5,
//       tickThickness: 2,
//       tickColor: isDarkMode ? "#d6d6d6" : "#474747",
//     },
//     toolTip: {
//       shared: true,
//     },
//     backgroundColor: isDarkMode ? "#171717" : "#ffffff",
//     title: {
//       text: "Reject Osmotron Data Graph",
//       fontColor: isDarkMode ? "white" : "black"
//     },
//     data: [
//       {
//         type: "column",
//         showInLegend: true,
//         lineColor: isDarkMode ? "#ec1eff" : "#a11eff",
//         color: isDarkMode ? "#ec1eff" : "#a11eff",
//         markerColor: isDarkMode ? "#ec1eff" : "#a11eff",
//         markerSize: 2,
//         dataPoints: waterOsmoGraph,
//       },
//     ],
//   };

  return (
    <>
        <div className="block bg-card p-2 rounded-lg shadow-lg mx-6 overflow-x-auto">
            <CanvasJSChart options={WaterOptions} />
            {/* <CanvasJSChart options={RejectOsmoOptions} /> */}
        </div>
    </>
  );
}

export default ChartDashboard;
