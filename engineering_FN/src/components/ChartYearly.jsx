import { useEffect, useState } from 'react';
import Axios from 'axios';
import CanvasJSReact from '../canvasjs.react'; // Pastikan Anda sudah menginstall dan mengimport CanvasJS

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

function ChartYearly({ endpoint, area, title, name, colors, style, yAxisFormat, tooltipFormat }) {
  const [graphData, setGraphData] = useState([]);
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
      let response = await Axios.get(endpoint, { params: { area } });
      console.log(response);
      const processedData = response.data.map((row) => ({
        x: new Date(row.time),
        y: Number(row.monthly_total),
        label: `${row.year}-${row.month}`,
        toolTipContent: `Time: ${row.time.replace(/T.*Z/, '')}, Monthly Total: ${row.monthly_total}`
      }));
      setGraphData(processedData);
    } catch (error) {
      console.error("Error fetching data: ", error);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, [endpoint, area]);

  const chartOptions = {
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
      valueFormatString: yAxisFormat || "#,##0.##",
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
        dataPoints: graphData,
        yValueFormatString: tooltipFormat || "#,##0.##",
        toolTipContent: `Time: {label}, Monthly Total: {y} ${tooltipFormat ? tooltipFormat.replace('#,##0.##', '').trim() : ''}`,
        
      },
    ],
  };

  return (
    <div className="block bg-card p-2 rounded-lg shadow-lg mx-6 overflow-x-auto">
      <CanvasJSChart options={chartOptions} />
    </div>
  );
}

export default ChartYearly;