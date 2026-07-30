import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import YardIcon from '@mui/icons-material/Yard';
import { GrFanOption } from "react-icons/gr";
import { GiBaseDome } from "react-icons/gi";
import { PiPlantFill } from "react-icons/pi";
import { IoLogoElectron } from "react-icons/io5";
import ChartDashboard from "../components/ChartDashboard";
import ChartYearly from "../components/ChartYearly";
import axios from 'axios';
// Depending on how CanvasJS is installed in your project, it usually looks like this:
import CanvasJSReact from "../canvasjs.react";



const PDAM = forwardRef((props, ref) => {
    const [inlet, setInlet] = useState(null);
    const [domestic, setDomestic] = useState(null);
    const [tamanpos, setTamanPos] = useState(null);
    const [rejectosmo, setRejectOsmo] = useState(null);
    const [boiler, setBoiler] = useState(null);

    const socketRef = useRef(null);

    const [showInlet, setShowInlet] = useState(false); // ini kode bikin pop-up coba dulu dah
    const [showDomestic, setShowDomestic] = useState(false);
    const [showTamanPos, setShowTamanPos] = useState(false); 
    const [showOsmo, setShowOsmo] = useState(false); 
    const [showBoiler, setShowBoiler] = useState(false); 

    const Colors1 = { dark: "#81d1fc", light: "#a7defc" };
    const Colors2 = { dark: "#a2c7eb", light: "#b0e6f5" };

    const [waterCostDaily, setWaterCostDaily] = useState([]);
    const [isCostLoading, setIsCostLoading] = useState(false);
    const [costError, setCostError] = useState(null);

    const [totalCost, setTotalCost] = useState(0);
    const [maxCost, setMaxCost] = useState(0);
    const [minCost, setMinCost] = useState(0);

    const CanvasJSChart = CanvasJSReact.CanvasJSChart;


    const [isDarkMode, setIsDarkMode] = useState(
        document.documentElement.getAttribute("data-theme") === "dark"
    );

    // Fungsi untuk mengambil data PDAM PDF
    useImperativeHandle(ref, () => ({
        getPDAMData: () => [
        { title: "Boiler",value: `${parseFloat(boiler).toFixed(2)}` },
        { title: "Domestik", value: `${domestic}` },
        { title: "Inlet Pre-Treatment", value: `${inlet}` },
        { title: "Reject Osmotron", value: `${parseFloat(rejectosmo).toFixed(2) }` },
        { title: "Taman Pos Jaga", value: `${parseFloat(tamanpos).toFixed(2) }` },
        ],
    }));

    const grafanaPDAMMonth = isDarkMode 
    ? "https://snapshots.raintank.io/dashboard/snapshot/T7IQgfFb5B4gGT16l7u7mV7RKmzoBJSW?orgId=0&kiosk"
    : "https://snapshots.raintank.io/dashboard/snapshot/T7IQgfFb5B4gGT16l7u7mV7RKmzoBJSW?orgId=0&kiosk&theme=light";
    const grafanaPDAMYear = isDarkMode 
    ? "https://snapshots.raintank.io/dashboard/snapshot/hV5Qr0FJLj4uBZ2EIkhChrfJwibVyrUz?orgId=0&kiosk"
    : "https://snapshots.raintank.io/dashboard/snapshot/hV5Qr0FJLj4uBZ2EIkhChrfJwibVyrUz?orgId=0&kiosk&theme=light";

    const fetch7DayWaterCost = async () => {
    setIsCostLoading(true);
    setCostError(null);

    // 1. Calculate the exact 7-day window locally inside the function
    const today = new Date();
    const finish = new Date(today);
    finish.setDate(finish.getDate() - 1);
    const start = new Date(today);
    start.setDate(start.getDate() - 7); 

    const finishDateStr = finish.toISOString().split('T')[0];
    const startDateStr = start.toISOString().split('T')[0];

    try {
      // 2. Pass the local strings directly to the API
      let response = await axios.get(
        "http://10.126.15.197:8002/part/waterCostSystem", 
        {
          params: { 
            area: "cMT-DB-WATER-UTY3_PDAM_Sehari_data", // Hardcoded table name
            start: startDateStr,                        // Local calculated start date
            finish: finishDateStr                       // Local calculated finish date
          },
        }
      );

      if (!response.data || response.data.length === 0) {
        setCostError(null); 
        setWaterCostDaily([]);
        setTotalCost(0);
        setMaxCost(0);
        setMinCost(0);
        setIsCostLoading(false);
        return;
      }
      
      const dataArray = response.data;
      
      let total = 0;
      let max = -Infinity;
      let min = Infinity;

      dataArray.forEach(item => {
        const dailyCost = Number(item.cost) || 0;
        total += dailyCost;
        if (dailyCost > max) max = dailyCost;
        if (dailyCost < min) min = dailyCost;
      });

      setWaterCostDaily(dataArray);
      setTotalCost(total);
      setMaxCost(max === -Infinity ? 0 : max);
      setMinCost(min === Infinity ? 0 : min);
      
      setIsCostLoading(false);

    } catch (error) {
      console.error("API Error:", error);
      setCostError("Failed to fetch 7-day cost data");
      setWaterCostDaily([]);
      setIsCostLoading(false);
    }
};

    useEffect(() => {
        // Buat koneksi WebSocket
        socketRef.current = new WebSocket("ws://10.126.15.197:1880/ws/test");
        fetch7DayWaterCost();
    
        socketRef.current.onopen = () => {
        console.log("WebSocket connected");
        };
    
        socketRef.current.onmessage = (event) => {
            try {
                const message = event.data;
                const varWebSocket = JSON.parse(message);
                // console.log(varWebSocket);
        
                // Set state untuk masing-masing nilai
                setInlet(varWebSocket["Inlet"]);
                setDomestic(varWebSocket["Domestic"]);
                setTamanPos(varWebSocket["TamanPosJaga"]);
                setBoiler(varWebSocket["Boiler"]);
                setRejectOsmo(varWebSocket["RejectOsmotron"]);
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };
    
        socketRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        };
    
        socketRef.current.onclose = () => {
        console.log("WebSocket disconnected");
        };
    
        // Tutup koneksi WebSocket saat komponen akan di-unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []); // Kosongkan dependency array sehingga useEffect hanya berjalan sekali saat komponen di-mount

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

    const costGraphOptions = {
    animationEnabled: true,
    theme: "light2", 
    backgroundColor: "transparent", // Lets your 'bg-coba' class show through
    axisY: {
        title: "Cost (Rp)",
        valueFormatString: "#,##0",
        gridThickness: 1
    },
    axisX: {
        valueFormatString: "YYYY-MM-DD",
    },
    data: [{
        type: "column", // Or "splineArea" depending on the vibe you want
        color: "#4CAF50",
        xValueType: "dateTime",
        dataPoints: waterCostDaily.map(day => ({ 
            label: day.label, 
            x: new Date(day.x).getTime(), // Ensure this parses cleanly for CanvasJS
            y: day.cost 
        })) 
    }]
}
      

  return (
    <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-2 transition delay-300">
            <div className="rounded-md mt-2 flex flex-col border border-border px-7.5 py-6 shadow-buatcard bg-coba cursor-pointer"
            onClick={() => setShowBoiler(true)}>
                <div className="flex items-center gap-4">
                    <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-lingkaran">
                        <GrFanOption size={31} className="flex-shrink-0 m-1 z-10 "/>
                    </div>
                    <h1 className="text-text text-2xl font-semibold font-DMSans">Boiler</h1>
                </div>
                <div className="mt-4 flex items-end justify-between">
                    <div>
                        <h4 className="text-[28px] font-bold font-poppins relative text-black dark:text-white">{boiler !== null && boiler !== undefined 
                            ? parseFloat(boiler).toFixed(2) 
                            : "N/A"}
                        </h4>
                        <span className="text-[16px] gap-1 font-medium font-poppins text-black dark:text-white">Total</span>
                    </div>
                    <span
                        className="flex items-center gap-1 text-[16px] font-medium text-meta-3">0.43%
                        <svg
                        className="fill-meta-3"
                        width="10"
                        height="11"
                        viewBox="0 0 10 11"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        >
                        <path
                            d="M4.35716 2.47737L0.908974 5.82987L5.0443e-07 4.94612L5 0.0848689L10 4.94612L9.09103 5.82987L5.64284 2.47737L5.64284 10.0849L4.35716 10.0849L4.35716 2.47737Z"
                            fill=""
                        />
                        </svg>
                    </span>
                </div>
            </div>
            {/* Pop-Up */}
            {showBoiler && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 backdrop-blur-sm">
                    <div className="rounded-md border border-border shadow-buatcard bg-coba p-6 relative w-full">
                    <p className="text-text my-2">Ini adalah pop-up dari card Boiler.</p>
                    <ChartDashboard endpoint="http://10.126.15.197:8002/part/GrafanaWater" area="cMT-DB-WATER-UTY_Met_Boiler_data" title="Boiler Data Graph" colors={Colors1}
                        style={{
                        border: 'none', // Removes border
                        position: 'relative',
                        width: '100%', // Full width of parent div
                        aspectRatio: '16 / 6', // Adjust aspect ratio as needed
                        height: '580px'
                        }}/>
                    <button
                        onClick={() => setShowBoiler(false)}
                        className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full transition-all duration-300 ease-in-out hover:scale-110 hover:bg-red-600 active:scale-95 shadow-md"
                    >
                        X
                    </button>
                    </div>
                </div>
            )}
{/* ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */}
            <div className="rounded-md mt-2 border border-border px-7.5 py-6 shadow-buatcard bg-coba cursor-pointer"
            onClick={() => setShowDomestic(true)}>
                <div className="flex items-center gap-4">
                    <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-lingkaran">
                        <GiBaseDome size={31} className="flex-shrink-0 m-1 z-10 "/>
                    </div>
                    <h1 className="text-text text-2xl font-semibold font-DMSans">Domestik</h1>
                </div>
                <div className="mt-4 flex items-end justify-between">
                    <div>
                        <h4 className="text-[28px] font-bold font-poppins text-black dark:text-white">{domestic ?? "N/A"}</h4>
                        <span className="text-[16px] font-medium font-poppins text-black dark:text-white">Total</span>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-medium text-meta-3">4.35%
                        <svg
                        class="fill-meta-3"
                        width="10"
                        height="11"
                        viewBox="0 0 10 11"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        >
                        <path
                            d="M5.64284 7.69237L9.09102 4.33987L10 5.22362L5 10.0849L-8.98488e-07 5.22362L0.908973 4.33987L4.35716 7.69237L4.35716 0.0848701L5.64284 0.0848704L5.64284 7.69237Z"
                            fill=""
                        />
                        </svg>
                    </span>
                </div>
            </div>
            {/* Pop-Up */}
            {showDomestic && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 backdrop-blur-sm">
                <div className="rounded-md border border-border shadow-buatcard bg-coba p-6 relative w-full">
                <p className="text-text my-2">Ini adalah pop-up dari card Domestik.</p>
                <ChartDashboard endpoint="http://10.126.15.197:8002/part/GrafanaWater" area="cMT-DB-WATER-UTY_Met_Domestik_data" title="Domestik Data Graph" colors={Colors2}
                    style={{
                    border: 'none', // Removes border
                    position: 'relative',
                    width: '100%', // Full width of parent div
                    aspectRatio: '16 / 6', // Adjust aspect ratio as needed
                    height: '580px'
                    }}/>
                <button
                    onClick={() => setShowDomestic(false)}
                    className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full transition-all duration-300 ease-in-out hover:scale-110 hover:bg-red-600 active:scale-95 shadow-md"
                >
                    X
                </button>
                </div>
            </div>
            )}
{/* ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ */}
            <div className="rounded-md mt-2 border border-border px-7.5 py-6 shadow-buatcard bg-coba cursor-pointer"
            onClick={() => setShowInlet(true)}>
                <div className="flex items-center gap-4">
                    <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-lingkaran relative">
                        <PiPlantFill size={32} className="flex-shrink-0 m-1 z-10 "/>
                    </div>
                    <h1 className="text-text text-2xl font-semibold font-DMSans">Inlet Pre-Treatment</h1>
                </div>
                <div className="mt-4 flex items-end justify-between">
                    <div>
                        <h4 className="text-[28px] font-bold font-poppins text-black dark:text-white">{inlet ?? "N/A"}</h4>
                        <span className="text-[16px] font-medium font-poppins text-black dark:text-white">Total</span>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-medium text-meta-3">2.59%
                        <svg
                        className="fill-meta-3"
                        width="10"
                        height="11"
                        viewBox="0 0 10 11"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        >
                        <path
                            d="M4.35716 2.47737L0.908974 5.82987L5.0443e-07 4.94612L5 0.0848689L10 4.94612L9.09103 5.82987L5.64284 2.47737L5.64284 10.0849L4.35716 10.0849L4.35716 2.47737Z"
                            fill=""
                        />
                        </svg>
                    </span>
                </div>
            </div>
        </div>
        {/* Pop-Up */}
        {showInlet && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 backdrop-blur-sm">
            <div className="rounded-md border border-border shadow-buatcard bg-coba p-6 relative w-full">
              <p className="text-text my-2">Ini adalah pop-up dari card Inlet.</p>
              <ChartDashboard endpoint="http://10.126.15.197:8002/part/GrafanaWater" area="cMT-DB-WATER-UTY_Met_Inlet_Pt_data" title="Inlet Pre-Treatment Data Graph" colors={Colors1}
                    style={{
                    border: 'none', // Removes border
                    position: 'relative',
                    width: '100%', // Full width of parent div
                    aspectRatio: '16 / 6', // Adjust aspect ratio as needed
                    height: '580px'
                    }}/>
              <button
                onClick={() => setShowInlet(false)}
                className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full transition-all duration-300 ease-in-out hover:scale-110 hover:bg-red-600 active:scale-95 shadow-md"
              >
                X
              </button>
            </div>
          </div>
        )}
{/* -----------------------------------------------------------   &&&  -------------------------------------------------------------------- */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-2 transition delay-300">
            <div className="rounded-md mt-2 flex flex-col border border-border px-7.5 py-6 shadow-buatcard bg-coba cursor-pointer"
            onClick={() => setShowOsmo(true)}>
                <div className="flex items-center gap-4">
                    <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-lingkaran">
                        <IoLogoElectron size={32}  className="flex-shrink-0 m-1 z-10 "/>
                    </div>
                    <h1 className="text-text text-2xl font-semibold font-DMSans">Reject Osmotron</h1>
                </div>
                <div className="mt-4 flex items-end justify-between">
                    <div>
                        <h4 className="text-[28px] font-bold font-poppins relative text-black dark:text-white">{rejectosmo !== null && rejectosmo !== undefined 
                            ? parseFloat(rejectosmo).toFixed(2) 
                            : "N/A"}
                        </h4>
                        <span className="text-[16px] gap-1 font-medium font-poppins text-black dark:text-white">Total</span>
                    </div>
                    <span
                        className="flex items-center gap-1 text-[16px] font-medium text-meta-3">0.43%
                        <svg
                        className="fill-meta-3"
                        width="10"
                        height="11"
                        viewBox="0 0 10 11"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        >
                        <path
                            d="M4.35716 2.47737L0.908974 5.82987L5.0443e-07 4.94612L5 0.0848689L10 4.94612L9.09103 5.82987L5.64284 2.47737L5.64284 10.0849L4.35716 10.0849L4.35716 2.47737Z"
                            fill=""
                        />
                        </svg>
                    </span>
                </div>
            </div>
            {/* Pop-Up */}
            {showOsmo && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 backdrop-blur-sm">
                <div className="rounded-md border border-border shadow-buatcard bg-coba p-6 relative w-full">
                <p className="text-text my-2">Ini adalah pop-up dari card Reject Osmotron.</p>
                <ChartDashboard endpoint="http://10.126.15.197:8002/part/GrafanaWater" area="cMT-DB-WATER-UTY_Met_RO_data" title="Reject Osmotron Data Graph" colors={Colors1}
                    style={{
                    border: 'none', // Removes border
                    position: 'relative',
                    width: '100%', // Full width of parent div
                    aspectRatio: '16 / 6', // Adjust aspect ratio as needed
                    height: '580px'
                    }}/>
                <button
                    onClick={() => setShowOsmo(false)}
                    className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full transition-all duration-300 ease-in-out hover:scale-110 hover:bg-red-600 active:scale-95 shadow-md"
                >
                    X
                </button>
                </div>
            </div>
            )}
{/* --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */}
            <div className="rounded-md mt-2 border border-border px-7.5 py-6 shadow-buatcard bg-coba cursor-pointer"
            onClick={() => setShowTamanPos(true)}>
                <div className="flex items-center gap-4">
                    <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-lingkaran relative">
                        <YardIcon sx={{ fontSize: 32 }} className="flex-shrink-0 m-1 z-10 "/>
                    </div>
                    <h1 className="text-text text-2xl font-semibold font-DMSans">Taman Pos Jaga</h1>
                </div>
                <div className="mt-4 flex items-end justify-between">
                    <div>
                        <h4 className="text-[28px] font-bold font-poppins text-black dark:text-white">{tamanpos !== null && tamanpos !== undefined 
                            ? parseFloat(tamanpos).toFixed(2) 
                            : "N/A"}</h4>
                        <span className="text-[16px] font-medium font-poppins text-black dark:text-white">Total</span>
                    </div>
                    <span className="flex items-center gap-1 text-sm font-medium text-meta-3">2.59%
                        <svg
                        className="fill-meta-3"
                        width="10"
                        height="11"
                        viewBox="0 0 10 11"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        >
                        <path
                            d="M4.35716 2.47737L0.908974 5.82987L5.0443e-07 4.94612L5 0.0848689L10 4.94612L9.09103 5.82987L5.64284 2.47737L5.64284 10.0849L4.35716 10.0849L4.35716 2.47737Z"
                            fill=""
                        />
                        </svg>
                    </span>
                </div>
            </div>
        </div>
        {/* Pop-Up */}
        {showTamanPos && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 backdrop-blur-sm">
            <div className="rounded-md border border-border shadow-buatcard bg-coba p-6 relative w-full">
              <p className="text-text my-2">Ini adalah pop-up dari card Taman Pos Jaga.</p>
              <ChartDashboard endpoint="http://10.126.15.197:8002/part/GrafanaWater" area="cMT-DB-WATER-UTY_Met_Taman_data" title="Taman Pos Jaga Data Graph" colors={Colors2}
                style={{
                  border: 'none', // Removes border
                  position: 'relative',
                  width: '100%', // Full width of parent div
                  aspectRatio: '16 / 6', // Adjust aspect ratio as needed
                  height: '580px'
                }}/>
              <button
                onClick={() => setShowTamanPos(false)}
                className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full transition-all duration-300 ease-in-out hover:scale-110 hover:bg-red-600 active:scale-95 shadow-md"
              >
                X
              </button>
            </div>
          </div>
        )}
{/* -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------         */}
        <div className="text-center mt-8 p-2 shadow-buatcard bg-coba rounded-md relative">
            <h1 className="text-center text-text text-4xl antialiased hover:subpixel-antialiased mb-2">PDAM Chart</h1>
            <ChartYearly endpoint="http://10.126.15.197:8002/part/GrafanaPDAMYear" area="cMT-DB-WATER-UTY3_PDAM_Sehari_data" title=" " name="PDAM" colors={Colors2}
                style={{
                border: 'none', // Removes border
                position: 'relative',
                width: '100%', // Full width of parent div
                aspectRatio: '16 / 6', // Adjust aspect ratio as needed
                height: '580px'
                }}/>
            <br/>
            {/* <iframe
            src={grafanaPDAMYear}
            style={{
                border: 'none', // Removes border
                position: 'relative',
                width: '100%', // Full width of parent div
                aspectRatio: '16 / 6', // Adjust aspect ratio to match the desired size
                height: '800px', // Set a fixed height for the iframe
            }}
            title="Grafana Chart">
            </iframe> */}
        </div>
        {/* --- NEW: 7-DAY COST CHART CARD --- */}
<div className="text-center mt-8 p-2 shadow-buatcard bg-coba rounded-md relative">
    <h1 className="text-center text-text text-4xl antialiased hover:subpixel-antialiased mb-2">7-Day Water Cost</h1>
    
    {/* Stats Header (Aligned to the right using Tailwind) */}
    <div className="flex justify-end mb-4 pr-8 text-text text-sm">
        <div className="text-left font-semibold tracking-wide">
            <p>Total = Rp {totalCost.toLocaleString('id-ID')}</p>
            <p>Max = Rp {maxCost.toLocaleString('id-ID')}</p>
            <p>Min = Rp {minCost.toLocaleString('id-ID')}</p>
        </div>
    </div>

    {/* The CanvasJS Chart Container */}
    <div style={{ position: 'relative', width: '100%', height: '580px' }}>
        {isCostLoading ? (
            <div className="flex items-center justify-center h-full">
                <p className="text-text text-xl">Loading cost data...</p>
            </div>
        ) : costError ? (
            <div className="flex items-center justify-center h-full">
                <p className="text-red-500 text-xl">{costError}</p>
            </div>
        ) : (
            <CanvasJSChart options={costGraphOptions} />
        )}
    </div>
</div>

    </>
  );
})

export default PDAM