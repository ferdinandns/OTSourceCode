import { useEffect, useState } from 'react';
import Axios from 'axios';
import CanvasJSReact from '../canvasjs.react'; // Pastikan Anda sudah menginstall dan mengimport CanvasJS
import { Chart } from "react-google-charts";
import { useColorMode, useColorModeValue } from "@chakra-ui/react";

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

function HVAChendeling() {
  const [waterGraph, setWaterGraph] = useState([]);
  const [waterTamanGraph, setWaterTamanGraph] = useState([]);

  const [powerGraph, setPowerGraph] = useState([]);

  const area = 'cMT-DB-WATER-UTY_Met_Taman_data'; // Nama tabel yang ingin digunakan
  const domestik = 'cMT-DB-WATER-UTY_Met_Domestik_data'; 
  const inlet = 'cMT-DB-WATER-UTY_Met_Inlet_Pt_data'; 
  const osmo = 'cMT-DB-WATER-UTY_Met_RO_data'; 
  const boiler = 'cMT-DB-WATER-UTY_Met_Boiler_data'; 
  const pdam = 'cMT-DB-WATER-UTY_Met_PDAM_data'; 

  const inv16 = 'cMT-Gedung-UTY_Inverter1-6_SP_data'; 
  const inv712 = 'cMT-Gedung-UTY_Inverter7-12_SP_data'; 
  const sdp1 = 'cMT-Gedung-UTY_SDP.1-Produksi_data'; 
  const sdp2 = 'cMT-Gedung-UTY_SDP.2-Produksi_data'; 
  const sdputil = 'cMT-Gedung-UTY_SDP.1-Utility_data'; 
  const chiller = 'cMT-Gedung-UTY_PP.1-Chiller_data'; 
  const hydrant = 'cMT-Gedung-UTY_PP.2-Hydrant_data'; 
  const lvmdp = 'cMT-Gedung-UTY_LVMDP1_data'; 
  const power = 'cMT-Gedung-UTY_MVMDP_data'; 

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

  // const fetchGraphData = async () => {
  //   try {
  //     let response = await Axios.get(
  //       `http://10.126.15.197:8002/part/GrafanaWater`,
  //       {
  //         params: 
  //         { area }
  //       }
        
  //     );
  //     console.log(response);
  //     const processedData = response.data.map((row) => ({
  //       x: new Date(row.x * 1000), // Konversi timestamp ke objek Date
  //       y: Math.max(0, Number(row.y))
  //     }));
  //     setWaterTamanGraph(processedData);
  //   } catch (error) {
  //     console.error("Error fetching data: ", error);
  //   }
  // };

  // useEffect(() => {
  //   fetchGraphData();
  // }, []);

  const TamanOptions = {
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
      text: "Water Data Graph",
      fontColor: isDarkMode ? "white" : "black"
    },
    data: [
      {
        type: "column",
        showInLegend: true,
        lineColor: isDarkMode ? "#00bfff" : "#1e90ff",
        color: isDarkMode ? "#00bfff" : "#1e90ff",
        markerColor: isDarkMode ? "#00bfff" : "#1e90ff",
        markerSize: 2,
        dataPoints: waterTamanGraph,
      },
    ],
  };

  return (
    <>
      <div>Trial Air Handling</div>
      <br />
      {/* <div className="block bg-card p-2 rounded-lg shadow-lg mx-6 overflow-x-auto">
        <CanvasJSChart options={TamanOptions} />
      </div> */}
    </>
  );
}

export default HVAChendeling;
