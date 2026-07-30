import { useEffect, useState } from "react";
import CanvasJSReact from "../canvasjs.react";
import { Button, Input, Select, Spinner } from "@chakra-ui/react";
import axios from "axios";
import { Chart } from "react-google-charts";
import { useColorMode, useColorModeValue } from "@chakra-ui/react";

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

export default function WaterManagement() {
  const [WaterDaily, setWaterDaily] = useState([]);
  const [startDate, setStartDate] = useState();
  const [finishDate, setFinishDate] = useState();
  const [WaterArea, setWaterArea] = useState();
  const [totalair, settotalair]= useState ([]);
  const [highair, sethighair]= useState ([]);
  const [lowair, setlowhair]= useState ([]);  
  const [SumberPDAM, setSumberPDAM] = useState([]);
  const [PDAMDom, setPDAMDom] = useState([]);
  const [DomWorkshop, setDomWork] = useState([]);
  const [DomQC, setDomQC] = useState([]);
  const [DomToilet, setDomToilet] = useState([]);
  const [PDAMIP, setPDAMIP] = useState([]);
  const [IPOP, setIPOP] = useState([]);
  const [OPOsmo, setOPOsmo] = useState([]);
  const [OsmoCIP, setOsmoCIP] = useState([]);
  const [OsmoPDAM, setOsmoPDAM] = useState([]);
  const [OPSoftwater, setOPSoftwater] = useState([]);
  const [SoftLab, setSoftLab] = useState([]);
  const [SoftChill, setSoftChill] = useState([]);
  const [SoftHot, setSoftHot] = useState([]);
  const [PDAMBoiler, setPDAMBoiler] = useState([]);
  const [PDAMTaman, setPDAMTaman] = useState([]);
  const [TamanAirMancur, setTamanAirMancur] = useState([]);
  const [OsmoRO, setOsmoRO] = useState([]);
  const [startSankey, setStartSankey] = useState();
  const [finishSankey, setFinishSankey] = useState();
  const [SupplyAir, setSupllyAir]= useState ([]);
  const [SoftWashing, setWashing]= useState ([]);
  const [OsmoLoopo, setOsmoLoopo]= useState ([]);
  const [LoopoProduksi, setLoopoProduksis]= useState ([]);
  const [Lantai1, setlantai1]= useState ([]);
  
  const [PDAMDomm3, setPDAMDomm3] = useState([]);
  const [DomWorkshopm3, setDomWorkm3] = useState([]);
  const [DomQCm3, setDomQCm3] = useState([]);
  const [DomToiletm3, setDomToiletm3] = useState([]);
  const [PDAMIPm3, setPDAMIPm3] = useState([]);
  const [IPOPm3, setIPOPm3] = useState([]);
  const [OPOsmom3, setOPOsmom3] = useState([]);
  const [OsmoCIPm3, setOsmoCIPm3] = useState([]);
  const [OPSoftwaterm3, setOPSoftwaterm3] = useState([]);
  const [SoftLabm3, setSoftLabm3] = useState([]);
  const [SoftChillm3, setSoftChillm3] = useState([]);
  const [SoftHotm3, setSoftHotm3] = useState([]);
  const [PDAMBoilerm3, setPDAMBoilerm3] = useState([]);
  const [PDAMTamanm3, setPDAMTamanm3] = useState([]);
  const [TamanAirMancurm3, setTamanAirMancurm3] = useState([]);
  const [OsmoROm3, setOsmoROm3] = useState([]);
  const [SoftWashingm3, setWashingm3]= useState ([]);
  const [OsmoLoopom3, setOsmoLoopom3]= useState ([]);
  const [LoopoProduksim3, setLoopoProduksism3]= useState ([]);
  const [OsmoPDAM1, setOsmoPDAM1] = useState([]);
  const [SumberPDAM1, setSumberPDAM1] = useState([]);
  const [Lantai1m3, setlantai1m3]= useState ([]);

  // New
  const [waterCostDaily, setWaterCostDaily] = useState([]);
const [isCostLoading, setIsCostLoading] = useState(false);
const [costError, setCostError] = useState(null);

const [totalCost, setTotalCost] = useState(0);
const [maxCost, setMaxCost] = useState(0);
const [minCost, setMinCost] = useState(0);

  const { colorMode } = useColorMode();
  const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
  const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");
  const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );
  
  const fetchWaterSankey = async () => {
    let response1 = await axios.get(
      "http://10.126.15.197:8002/part/waterSankey", 
      {
        params: {
          start: startSankey,
          finish: finishSankey, 
        }
      }
    ); 

    // Guard against empty data
    if (!response1.data || response1.data.length === 0) return;

    // ONE single loop to process everything efficiently
    for (let i = 0; i < response1.data.length; i++) {
      let row = response1.data[i];

      // 1. SAFE EXTRACTION: Convert everything to pure numbers first
      let pdam = Number(row.Pdam || 0);
      let ro = Number(row.RejectOsmotron || 0);
      let dom = Number(row.Domestik || 0);
      let qc = Number(row.AtasLabQC || 0);
      let toilet = Number(row.AtasToiletLt2 || 0);
      let wh = Number(row.Workshop || 0);
      let op = Number(row.OutletPretreatment || 0);
      let soft = Number(row.Softwater || 0);
      let cip = Number(row.Cip || 0);
      let ip = Number(row.InletPretreatment || 0);
      let boiler = Number(row.Boiler || 0);
      let airMancur = Number(row.AirMancur || 0);
      let lab = Number(row.Lab || 0);
      let hot = Number(row.Hotwater || 0);
      let chill = Number(row.Chiller || 0);
      let taman = Number(row.Taman || 0);

      // 2. BASE MATH
      let sumber = pdam + ro;

      // 3. HELPER FUNCTION: Safely calculates percentage without dividing by zero
      const safePercent = (val, totalSrc) => totalSrc > 0 ? (val / totalSrc) * 100 : 0;

      // --- CALCULATE AND SET ALL NODES ---
      
      // Lantai 1
      let valLantai1 = dom - qc - toilet - wh;
      setlantai1(Number(safePercent(valLantai1, sumber).toFixed(2)));
      setlantai1m3(Number(valLantai1.toFixed(2)));

      // Loopo to Produksi
      let valLoopo = op - ro - soft - cip;
      setLoopoProduksis(Number(safePercent(valLoopo, sumber).toFixed(2)));
      setLoopoProduksism3(Number(valLoopo.toFixed(2))); 

      // PDAM to Domestik
      setPDAMDom(Number(safePercent(dom, sumber).toFixed(2)));
      setPDAMDomm3(Number(dom.toFixed(2)));

      // Osmotron to RO
      setOsmoRO(Number(safePercent(ro, sumber).toFixed(2)));
      setOsmoROm3(Number(ro.toFixed(2)));

      // PDAM to IP
      setPDAMIP(Number(safePercent(ip, sumber).toFixed(2)));
      setPDAMIPm3(Number(ip.toFixed(2)));

      // PDAM to Boiler
      setPDAMBoiler(Number(safePercent(boiler, sumber).toFixed(2)));
      setPDAMBoilerm3(Number(boiler.toFixed(2)));

      // Sumber to PDAM
      setSumberPDAM(Number(pdam.toFixed(2)));
      setSumberPDAM1(Number(safePercent(pdam, sumber).toFixed(2)));

      // Supply Air
      setSupllyAir(Number(sumber.toFixed(2)));

      // Domestik to Workshop
      setDomWork(Number(safePercent(wh, sumber).toFixed(2)));
      setDomWorkm3(Number(wh.toFixed(2)));

      // Domestik to QC
      setDomQC(Number(safePercent(qc, sumber).toFixed(2)));
      setDomQCm3(Number(qc.toFixed(2)));

      // Domestik to Toilet
      setDomToilet(Number(safePercent(toilet, sumber).toFixed(2)));
      setDomToiletm3(Number(toilet.toFixed(2)));

      // IP to OP
      setIPOP(Number(safePercent(op, sumber).toFixed(2)));
      setIPOPm3(Number(op.toFixed(2)));

      // OP to Osmotron
      let valOPOs = op - soft;
      setOPOsmo(Number(safePercent(valOPOs, sumber).toFixed(2)));
      setOPOsmom3(Number(valOPOs.toFixed(2)));

      // Osmotron to CIP
      setOsmoCIP(Number(safePercent(cip, sumber).toFixed(2)));
      setOsmoCIPm3(Number(cip.toFixed(2)));

      // Osmotron to PDAM
      setOsmoPDAM(Number(ro.toFixed(2)));
      setOsmoPDAM1(Number(safePercent(ro, sumber).toFixed(2)));

      // OP to Softwater
      setOPSoftwater(Number(safePercent(soft, sumber).toFixed(2)));
      setOPSoftwaterm3(Number(soft.toFixed(2)));

      // Taman to Air Mancur
      setTamanAirMancur(Number(safePercent(airMancur, sumber).toFixed(2)));
      setTamanAirMancurm3(Number(airMancur.toFixed(2)));

      // Soft to Lab
      setSoftLab(Number(safePercent(lab, sumber).toFixed(2)));
      setSoftLabm3(Number(lab.toFixed(2)));

      // Soft to Washing
      let valWash = soft - lab - hot - chill;
      setWashing(Number(safePercent(valWash, sumber).toFixed(2)));
      setWashingm3(Number(valWash.toFixed(2)));

      // Soft to Chiller
      setSoftChill(Number(safePercent(chill, sumber).toFixed(2)));
      setSoftChillm3(Number(chill.toFixed(2)));

      // Soft to Hotwater
      setSoftHot(Number(safePercent(hot, sumber).toFixed(2)));
      setSoftHotm3(Number(hot.toFixed(2)));

      // PDAM to Taman
      setPDAMTaman(Number(safePercent(taman, sumber).toFixed(2)));
      setPDAMTamanm3(Number(taman.toFixed(2)));
    }
  }

  const fetchWaterDaily = async () => {
    setLoading(true);
    setError(null);

    try {
      let response = await axios.get(
        "http://10.126.15.197:8002/part/waterSystem",
        {
          params: {
            area: WaterArea,
            start: startDate,
            finish: finishDate,
          },
        }
      );

      // Error guard: if no data comes back, stop execution here to prevent math crashes
      if (!response.data || response.data.length === 0) {
        setError("No available data");
        setWaterDaily([]);
        settotalair(0);
        sethighair(0);
        setlowhair(0);
        setLoading(false);
        return;
      }

      // Simplified redundant if/else mapping
      const multipliedData = response.data.map((data) => ({
        label: data.label,
        y: Number(data.y || 0), // Ensure 'y' is safely a number
        x: data.x,
      }));
      
      setWaterDaily(multipliedData);

      // Safe Math calculations
      const totalWater = multipliedData.reduce((sum, data) => sum + data.y, 0);
      settotalair(Number(totalWater.toFixed(2))); 

      const maxwater = multipliedData.reduce((acc, data) => Math.max(acc, data.y), Number.NEGATIVE_INFINITY);
      sethighair(Number(maxwater.toFixed(2)));

      const minwater = Math.min(...multipliedData.map((data) => data.y));
      setlowhair(Number(minwater.toFixed(2)));

    } catch (err) {
      setError("No available data");
    } finally {
      setLoading(false);
    }
  };

  let dateStart = (e) =>{
      setStartDate(e.target.value);
  };
  let dateFinish = (e) =>{
      setFinishDate(e.target.value);
  };
  let getWaterArea = (e) =>{
      setWaterArea(e.target.value);
  };

  let sankeyStart = (e) =>{
      setStartSankey(e.target.value);
  };
  let sankeyFinish = (e) =>{
      setFinishSankey(e.target.value);
  };

  const fetchWaterCostDaily = async () => {
    setIsCostLoading(true);
    setCostError(null);

    try {
      let response = await axios.get(
        "http://10.126.15.197:8002/part/waterCostSystem", 
        {
          params: { area: WaterArea, start: startDate, finish: finishDate },
        }
      );

      // 1. Handle Empty State
      if (!response.data || response.data.length === 0) {
        setCostError(null); // Clear error so the empty chart still renders
        setWaterCostDaily([]);
        setTotalCost(0);
        setMaxCost(0);
        setMinCost(0);
        setIsCostLoading(false);
        return;
      }
      
      const dataArray = response.data;
      
      // 2. Calculate Min, Max, and Total
      let total = 0;
      let max = -Infinity;
      let min = Infinity;

      dataArray.forEach(item => {
        const dailyCost = Number(item.cost) || 0;
        total += dailyCost;
        if (dailyCost > max) max = dailyCost;
        if (dailyCost < min) min = dailyCost;
      });

      // 3. Save to State
      setWaterCostDaily(dataArray);
      setTotalCost(total);
      setMaxCost(max === -Infinity ? 0 : max);
      setMinCost(min === Infinity ? 0 : min);
      
      setIsCostLoading(false);

    } catch (error) {
      console.error(error);
      setCostError("Failed to fetch cost data");
      setWaterCostDaily([]);
      setIsCostLoading(false);
    }
};

const costGraphOptions = {
  animationEnabled: true,
  theme: "light2", // "light1", "dark1", "dark2"
  title: {
    text: "Daily Water Cost",
  },
  axisY: {
    title: "Cost (Rp)",
    valueFormatString: "#,##0", // Adds thousand separators
  },
  axisX: {
    valueFormatString: "YYYY-MM-DD",
    labelAngle: -50,
  },
  data: [
    {
      type: "splineArea", // Matches your existing design
      color: "#4CAF50", // A different color (green) to distinguish from volume
      xValueType: "dateTime", // Required if x is a timestamp
      dataPoints: waterCostDaily.map((day) => ({
        label: day.label,
        x: day.x, // Assuming x is a timestamp or index
        y: day.cost, // Pointing to the new calculated cost
      })),
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

  const colors = ['#a6cee3', '#b2df8a', '#fb9a99', '#fdbf6f',
  '#cab2d6', '#ffff99', '#1f78b4', '#33a02c'];

  const options1 = {
    responsive: true,
    maintainAspectRatio: false, 
    tooltip: { isHtml: true },
    sankey: {
      node: { nodePadding: 20,
              label: { fontSize: 16 },
            },
      link: {
        colorMode: 'gradient',
        colors: colors
      }, 
    }
  };

  const options = {
    zoomEnabled: true,
    theme: isDarkMode ? "dark1" : "light1",
    backgroundColor: isDarkMode ? "#171717" : "#ffffff",
    
    title: {
      text: "Daily Water Consumption",
      fontColor: isDarkMode ? "white" : "black"
    },
    subtitles: [
      {
        text: "Meter Cubic",
        fontColor: isDarkMode ? "white" : "black"
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
        type: "splineArea",
        name: "Meter Cubic",
        showInLegend: true,
        xValueFormatString: "",
        yValueFormatString: "",
        dataPoints: WaterDaily,
      },
    ],
  };
    
  const data = [
    ["From", "To", "Consumption (%)"],
    ["a","b",0] 
  ]; 
    
    if (OsmoCIP >0){
      var cip = ['Loopo','CIP']
      cip.push(OsmoCIP)
      data.push(cip)
    }
    if (OsmoLoopo >0){
      var loopo = ['Osmotron','Loopo']
      loopo.push(OsmoLoopo)
      data.push(loopo)
    } 
    if (TamanAirMancur >0){
      var airmancur = ["Taman & Pos Jaga","Air Mancur"]
      airmancur.push(TamanAirMancur)
      data.push(airmancur)
    }
    if (PDAMDom >0){
      var dom = ["Total Supply Air","Domestik"]
      dom.push(PDAMDom)
      data.push(dom)
    }
    if (PDAMBoiler >0){
      var boiler = ["Total Supply Air","Boiler"]
      boiler.push(PDAMBoiler)
      data.push(boiler)
    }
    if (PDAMIP >0){
      var IP = ["Total Supply Air","Inlet Pretreatment"]
      IP.push(PDAMIP)
      data.push(IP)
    }
    if (PDAMTaman >0){
      var taman = ["Total Supply Air","Taman & Pos Jaga"]
      taman.push(PDAMTaman)
      data.push(taman)
    }
    if (DomQC >0){
      var QC = ["Domestik","Atas Lab QC"]
      QC.push(DomQC)
      data.push(QC)
    }
    if (DomToilet >0){
      var toilet = ["Domestik","Atas Toilet Lt.2"]
      toilet.push(DomToilet)
      data.push(toilet)
    }
    if (DomWorkshop >0){
      var Workshop = ["Domestik","Workshop"]
      Workshop.push(DomWorkshop)
      data.push(Workshop)
    }
    if (IPOP >0){
      var OP = ["Inlet Pretreatment","Outlet Pretreatment"]
      OP.push(IPOP)
      data.push(OP)
    }
    if (OPOsmo >0){
      var Osmo = ["Outlet Pretreatment","Osmotron"]
      Osmo.push(OPOsmo)
      data.push(Osmo)
    }
    if (OPSoftwater >0){
      var soft = ["Outlet Pretreatment","Softwater"]
      soft.push(OPSoftwater)
      data.push(soft)
    }
    if (SoftLab >0){
      var lab = ["Softwater","Lab"]
      lab.push(SoftLab)
      data.push(lab)
    }
    if (SoftHot >0){
      var hot = ["Softwater","Hotwater"]
      hot.push(SoftHot)
      data.push(hot)
    }
    if (SoftChill >0){
      var chill = ["Softwater","Chiller"]
      chill.push(SoftChill)
      data.push(chill)
    }
    if (SoftWashing >0){
      var wash = ["Softwater","Washing"]
      wash.push(SoftWashing)
      data.push(wash)
    }
    if (OsmoRO >0){
      var ro = ["Osmotron","Reject Osmotron"]
      ro.push(OsmoRO)
      data.push(ro)
    }
    if (Lantai1 >0){
      var l1 = ["Domestik","Lantai 1"]
      l1.push(Lantai1)
      data.push(l1)
    }
    if (LoopoProduksi >0){
      var produksi = ["Loopo","Lab & Produksi"]
      produksi.push(LoopoProduksi)
      data.push(produksi)
    }
    if (SumberPDAM1 >0){
      var pdam1 = ["PDAM","Total Supply Air"]
      pdam1.push(SumberPDAM1)
      data.push(pdam1)
    }
    if (OsmoPDAM1 >0){
      var ropdam1 = ["RO","Total Supply Air"]
      ropdam1.push(OsmoPDAM1)
      data.push(ropdam1)
    }

  const data1 = [
    ["From", "To", "Consumption (m3)"],
    ["a","b",0] 
  ]; 

    if (OsmoCIPm3 >0){
      var cip3 = ['Loopo','CIP']
      cip3.push(OsmoCIPm3)
      data1.push(cip3)
    }
    if (OsmoLoopom3 >0){
      var loopo3 = ['Osmotron','Loopo']
      loopo3.push(OsmoLoopom3)
      data1.push(loopo3)
    } 
    if (TamanAirMancurm3 >0){
      var airmancur3 = ["Taman & Pos Jaga","Air Mancur"]
      airmancur3.push(TamanAirMancurm3)
      data1.push(airmancur3)
    }
    if (PDAMDomm3 >0){
      var dom3 = ["Total Supply Air","Domestik"]
      dom3.push(PDAMDomm3)
      data1.push(dom3)
    }
    if (PDAMBoilerm3 >0){
      var boiler3 = ["Total Supply Air","Boiler"]
      boiler3.push(PDAMBoilerm3)
      data1.push(boiler3)
    }
    if (PDAMIPm3 >0){
      var IP3 = ["Total Supply Air","Inlet Pretreatment"]
      IP3.push(PDAMIPm3)
      data1.push(IP3)
    }
    if (PDAMTamanm3 >0){
      var taman3 = ["Total Supply Air","Taman & Pos Jaga"]
      taman3.push(PDAMTamanm3)
      data1.push(taman3)
    }
    if (DomQCm3 >0){
      var QC3 = ["Domestik","Atas Lab QC"]
      QC3.push(DomQCm3)
      data1.push(QC3)
    }
    if (DomToiletm3 >0){
      var toilet3 = ["Domestik","Atas Toilet Lt.2"]
      toilet3.push(DomToiletm3)
      data1.push(toilet3)
    }
    if (DomWorkshopm3 >0){
      var Workshop3 = ["Domestik","Workshop"]
      Workshop3.push(DomWorkshopm3)
      data1.push(Workshop3)
    }
    if (IPOPm3 >0){
      var OP3= ["Inlet Pretreatment","Outlet Pretreatment"]
      OP3.push(IPOPm3)
      data1.push(OP3)
    }
    if (OPOsmom3 >0){
      var Osmo3 = ["Outlet Pretreatment","Osmotron"]
      Osmo3.push(OPOsmom3)
      data1.push(Osmo3)
    }
    if (OPSoftwaterm3 >0){
      var soft3 = ["Outlet Pretreatment","Softwater"]
      soft3.push(OPSoftwaterm3)
      data1.push(soft3)
    }
    if (SoftLabm3 >0){
      var lab3 = ["Softwater","Lab"]
      lab3.push(SoftLabm3)
      data1.push(lab3)
    }
    if (SoftHotm3 >0){
      var hot3 = ["Softwater","Hotwater"]
      hot3.push(SoftHotm3)
      data1.push(hot3)
    }
    if (SoftChillm3 >0){
      var chill3 = ["Softwater","Chiller"]
      chill3.push(SoftChillm3)
      data1.push(chill3)
    }
    if (SoftWashingm3 >0){
      var wash3 = ["Softwater","Washing"]
      wash3.push(SoftWashingm3)
      data1.push(wash3)
    }
    if (OsmoROm3 >0){
      var ro3 = ["Osmotron","Reject Osmotron"]
      ro3.push(OsmoROm3)
      data1.push(ro3)
    }
    if (Lantai1m3 >0){
      var l1m3 = ["Domestik","Lantai 1"]
      l1m3.push(Lantai1m3)
      data1.push(l1m3)
    }
    if (LoopoProduksim3 >0){
      var produksi3 = ["Loopo","Lab & Produksi"]
      produksi3.push(LoopoProduksim3)
      data1.push(produksi3)
    }
    if (SumberPDAM >0){
      var pdam3 = ["PDAM","Total Supply Air"]
      pdam3.push(SumberPDAM)
      data1.push(pdam3)
    }
    if (OsmoPDAM >0){
      var ropdam = ["RO","Total Supply Air"]
      ropdam.push(OsmoPDAM)
      data1.push(ropdam)
    }
    
  return(
    <div>
      <div className="flex flex-col xl:flex-row justify-center my-4 space-y-4 xl:space-y-0 xl:space-x-4">
        <div className="flex flex-col items-center xl:w-64">
          <h5 className="mb-1">Flow Meter</h5>
          <Select placeholder="Select Flow Meter" onChange={getWaterArea}>
            <option value="cMT-DB-WATER-UTY3_PDAM_Sehari_data">PDAM</option>
            <option value="cMT-DB-WATER-UTY3_Dom_sehari_data">Domestik</option>
            <option value="cMT-DB-WATER-UTY3_Softwater_sehari_data">Softwater</option>
            <option value="cMT-DB-WATER-UTY3_Boiler_sehari_data">Boiler</option>
            <option value="cMT-DB-WATER-UTY3_Inlet_Sehari_data">Inlet Pretreatment</option>
            <option value="cMT-DB-WATER-UTY3_Outlet_sehari_data">Outlet Pretreatment</option>
            <option value="cMT-DB-WATER-UTY3_RO_sehari_data">Reject Osmotronn</option>
            <option value="cMT-DB-WATER-UTY3_Chiller_sehari_data">Chiller</option>
            <option value="cMT-DB-WATER-UTY3_Taman_sehari_data">Taman & Pos Jaga</option>
            <option value="cMT-DB-WATER-UTY3_WWTP_Biologi_1d_data">WWTP Biologi</option>
            <option value="cMT-DB-WATER-UTY3_WWTP_Kimia_1d_data">WWTP Kimia</option>
            <option value="cMT-DB-WATER-UTY3_WWTP_Outlet_1d_data">WWTP Outlet</option>
            <option value="cMT-DB-WATER-UTY3_CIP_Sehari_data">CIP</option>
            <option value="cMT-DB-WATER-UTY3_Hotwater_Sehari_data">Hotwater</option>
            <option value="cMT-DB-WATER-UTY3_Lab_Sehari_data">Lab</option>
            <option value="cMT-DB-WATER-UTY3_AtsToilet_Sehari_data">Atas Toilet lt.2</option>
            <option value="cMT-DB-WATER-UTY3_Atas QC_Sehari_data">Atas Lab QC</option>
            <option value="cMT-DB-WATER-UTY3_Workshop_Sehari_data">Workshop</option>
            <option value="cMT-DB-WATER-UTY3_AirMancur_Sehari_data">Air Mancur</option>
            <option value="cMT-DB-WATER-UTY3_Osmotron_Sehari_data">Osmotron</option>
            <option value="cMT-DB-WATER-UTY3_Loopo_Sehari_data">Loopo</option>
            <option value="cMT-DB-WATER-UTY3_Produksi_Sehari_data">Produksi</option>
            <option value="cMT-DB-WATER-UTY3_Washing_Sehari_data">Washing</option>
            <option value="cMT-DB-WATER-UTY3_Lantai1_Sehari_data">Lantai 1</option>
          </Select>
        </div>
        <div className="flex flex-col items-center xl:w-56">
          <h5 className="mb-1">Start Time</h5>
          <Input
            onChange={dateStart}
            placeholder="Select Date and Time"
            size="md"
            type="date"
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
        <div className="flex flex-col items-center xl:w-56">
          <h5 className="mb-1">Finish Time</h5>
          <Input
            onChange={dateFinish}
            placeholder="Select Date and Time"
            size="md"
            type="date"
            // width="200px"
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
        <div className="flex flex-col">
          <div className="mb-1 invisible">jan diapus</div>
          <Button
            className="ml-2"
            colorScheme="blue"
            onClick={() => {
    fetchWaterDaily();
    fetchWaterCostDaily();
  }}
          >
            Submit
          </Button>
        </div>
        <div className="mt-3">
          <div className="ml-16 text-text">Total = {totalair.toLocaleString()} Meter Cubic</div>
          <div className="ml-16 text-text">Max = {highair.toLocaleString()} Meter Cubic</div>
          <div className="ml-16 text-text">Min = {lowair.toLocaleString()} Meter Cubic</div>
        </div>
      </div>
      <div className="flex flex-row justify-center p-1 mx-8 bg-card rounded-lg shadow-lg overflow-x-auto relative">
        {loading ? (
          <div className="flex justify-center items-center w-full ">
            <Spinner size="xl" color="blue.500" />
          </div>
        ) : error ? (
          <div className="text-red-500 w-full flex justify-center items-center ">
            {error}
          </div>
        ) : (
          <CanvasJSChart options={options} />
        )}
      </div>
      {/* --- GRAPH 2: NEW WATER COST --- */}
<div className="graph-section" style={{ marginTop: "40px" }}>
  
  {/* Cost Statistics Header */}
  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "10px", fontSize: "14px" }}>
    <div style={{ textAlign: "left" }}>
      <p>Total = Rp {totalCost.toLocaleString('id-ID')}</p>
      <p>Max = Rp {maxCost.toLocaleString('id-ID')}</p>
      <p>Min = Rp {minCost.toLocaleString('id-ID')}</p>
    </div>
  </div>

  {/* Chart Rendering */}
  {isCostLoading ? (
    <p>Loading cost data...</p>
  ) : costError ? (
    <p style={{ color: "red" }}>{costError}</p>
  ) : (
    // By removing the array length check, CanvasJS will render the empty grid when data is []
    <CanvasJSChart options={costGraphOptions} />
  )}
  
</div>
      <br />
      <div className="flex flex-col xl:flex-row justify-center my-4 space-y-4 xl:space-y-0 xl:space-x-4">
        <div className="flex flex-col xl:w-56">
          <h5 className="mb-1">Start Time</h5>
          <Input
            onChange={sankeyStart}
            placeholder="Select Date and Time"
            size="md"
            type="date"
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
        <div className="flex flex-col xl:w-56">
          <h5 className="mb-1">Finish Time</h5>
          <Input
            onChange={sankeyFinish}
            placeholder="Select Date and Time"
            size="md"
            type="date"
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
        <div className="flex flex-col">
          <div className="mb-1 invisible">jan diapus</div>
          <Button
            className="ml-1"
            colorScheme="blue"
            onClick={() => fetchWaterSankey()}
          >
            Submit
          </Button>
        </div>
      </div>
      <div align="center"><h1 style={{ fontSize: "2rem"}}><b>Water Sankey Diagram (%)</b></h1></div>
      <div align="center"><h3 style={{ fontSize: "1rem"}}><b>PDAM : {SumberPDAM} Meter Cubic</b></h3></div>
      <div align="center"><h3 style={{ fontSize: "1rem"}}><b>Reject Osmotron : {OsmoPDAM} Meter Cubic</b></h3></div>
      <div align="center"><h3 style={{ fontSize: "1rem"}}><b>Total Supply Air (PDAM+RO) : {SupplyAir} Meter Cubic</b></h3></div>
      <div align="center" className={`flex flex-row justify-center pb-10 overflow-x-auto overflow-y-hidden relative ${isDarkMode ? 'sankey-dark' : 'sankey-light'}`}>
        <Chart
          chartType="Sankey"
          width= "900px"
          height="1000px"
          data={data}
          options={options1}
          style={{ minWidth: "1000px" }}>
        </Chart>
      </div>
      <div align="center"><h1 style={{ fontSize: "2rem"}}><b>Water Sankey Diagram </b></h1></div>
      <div align="center"><h3 style={{ fontSize: "1rem"}}><b>Meter Cubic</b></h3></div>
      <div className={`flex flex-row justify-center pb-10 overflow-x-auto overflow-y-hidden relative ${isDarkMode ? 'sankey-dark' : 'sankey-light'}`}>
        <Chart
          chartType= "Sankey"
          width= "900px"
          height="1000px"
          data={data1}
          options={options1}
          style={{ minWidth: "1000px" }}>
        </Chart>
      </div>
    </div>
  );
}