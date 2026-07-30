import { React, useState, useEffect } from "react";
import {
  Table,
  Tbody,
  Tr,
  Td,
  TableCaption,
  TableContainer,
  Button,
  Input,
  Spinner,
  Select,
  Center
} from "@chakra-ui/react";
import axios from "axios";
import { useColorMode, useColorModeValue } from "@chakra-ui/react";
import * as XLSX from 'xlsx';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function BatchRecord() {
// States for fetching data
const [fetchLineData, setFetchLineData] = useState([]);
const [fetchProcesData, setFetchProcesData] = useState([]);
const [fetchMachineData, setFetchMachineData] = useState([]);
const [fetchBatchData, setFetchBatchData] = useState([]);
const [mainData, setMainData] = useState([]);

// States for user selections
const [newLine, setNewLine] = useState("");
const [newProces, setNewProces] = useState("");
const [newMachine, setNewMachine] = useState("");
const [dbMachine, setDbMachine] = useState("");
const [selectedBatch, setSelectedBatch] = useState("");
const [allDataEBR, setAllDataEBR] = useState([])

const [startDate, setStartDate] = useState("");
const [finishDate, setFinishDate] = useState("");

const [currentPage, setCurrentPage] = useState(1);
const [rowsPerPage, setRowsPerPage] = useState(10);
const [sortConfig, setSortConfig] = useState({ key: 'time@timestamp', direction: 'asc' });
const [isLoading, setIsLoading] = useState(false);

const { colorMode } = useColorMode();
const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");
const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");

const [isDarkMode, setIsDarkMode] = useState(
  document.documentElement.getAttribute("data-theme") === "dark"
);

useEffect(() => {
  fetchLine(); // Fetch line data on component mount
}, []);

useEffect(() => {
  if (newLine) {
    fetchProces(newLine);
  }
}, [newLine]);

useEffect(() => {
  if (newLine && newProces) {
    fetchMachine(newLine, newProces);
  }
}, [newProces]);

useEffect(() => {
  if (newLine && newMachine && startDate && finishDate) {
    fetchBatch(newLine, newMachine, startDate, finishDate);
  }
}, [newMachine, startDate, finishDate]);

const formatTimestamp = (uniqueTimestamp) => {
  const [seconds] = uniqueTimestamp.toString().split(".");
  const date = new Date(seconds * 1000); // Convert seconds to milliseconds
  const formattedDate = date.toLocaleString("en-US", {
    timeZone: "UTC",
  });
  return `${formattedDate}`; // Return the formatted date without fractional seconds
  // return `${formattedDate}.${fractional || "00"}`; // Uncomment this line if you want to include fractional seconds
};

function formatTimestampUTC(uniqueTimestamp) {
  if (!uniqueTimestamp) return "";
  const [seconds, fractional = "000"] = uniqueTimestamp.toString().split(".");
  const date = new Date(Number(seconds) * 1000);

  // Format: YYYY-MM-DD HH:mm:ss.mmm UTC
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  const ms = fractional.padEnd(3, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}.${ms} `;
}

// const formatTimestampUTC = (uniqueTimestamp) => {
//   if (!uniqueTimestamp) return "";
//   const [seconds, fractional = "000"] = uniqueTimestamp.toString().split(".");
//   const date = new Date(Number(seconds) * 1000);
//   const formattedDate = date.toLocaleString("en-US", {
//     timeZone: "UTC",
//     year: "numeric", month: "long", day: "numeric",
//     hour: "2-digit", minute: "2-digit", second: "2-digit",
//     hour12: true
//   });
//   return `${formattedDate}.${fractional.padEnd(3, "0")}`  ;
// };

  // Fetch Line data
  const fetchLine = async () => {
    let response = await axios.get("http://10.126.15.197:8002/part/lineData");
    setFetchLineData(response.data);
  };

  // Fetch Process data based on the selected line
  const fetchProces = async (line) => {
    let response = await axios.get(
      "http://10.126.15.197:8002/part/procesData",
      { params: { line_name: line } }
    );
    setFetchProcesData(response.data);
  };

  // Fetch Machine data based on the selected line and process
  const fetchMachine = async (line, proces) => {
    let response = await axios.get(
      "http://10.126.15.197:8002/part/machineData",
      { params: { line_name: line, proces_name: proces } }
    );
    setFetchMachineData(response.data);
  };

  const fetchBatch = async (line, machine, start, finish) => {
    // Validate line and machine values
    if (!line || !machine || typeof line !== 'string' || typeof machine !== 'string') {
      console.error(`Invalid line or machine value. Line: ${line}, Machine: ${machine}`);
      return;
    }

    const endpoint = determineEndpoint(line, machine);
    if (!endpoint) {
      console.error(`Invalid endpoint determined for line: ${line}, machine: ${machine}`);
      return;
    }

    try {
      const response = await axios.get(endpoint, { params: { start, finish } });
      // console.log("ini", response);
      if (response.data && Array.isArray(response.data)) {
        const batchData = response.data.map(item => item.BATCH || "Unknown Batch");
        setFetchBatchData(batchData);
        // console.log("ini", batchData);
      } else {
        setFetchBatchData([]);
      }
    } catch (error) {
      console.error("Error fetching batch data:", error);
      alert("Failed to fetch batch data. Please check your input and try again.");
    }
  };

  const determineEndpoint = (line, machine) => {
    const endpoints = {
      line1: {
        PMA: "/PMARecord1",
        Binder: "/BinderRecord1",
        Wetmill: "/WetmillRecord1",
        FBD: "/FBDRecord1",
        EPH: "/EPHRecord1",
        Tumbler: "/TumblerRecord1",
        Fette: "/FetteRecord1",
        Deduster: "/DedusterRecord1",
        Lifter: "/LifterRecord1",
        MetalDetector: "/MetalDetectorRecord1",
        HM: "/HMRecord1",
        IJP: "/IJPRecord1",
        CM1: "/CM1Record1",
      },
      line3: {
        PMA: "/PMARecord3",
        Binder: "/BinderRecord3",
        Wetmill: "/WetmillRecord3",
        FBD: "/FBDRecord3",
        EPH: "/EPHRecord3",
        Tumbler: "/TumblerRecord3",
        Fette: "/FetteRecord3",
        Deduster: "/DedusterRecord3",
        Lifter: "/LifterRecord3",
        MetalDetector: "/MetalDetectorRecord3",
        HM: "/HMRecord3",
        IJP: "/IJPRecord3",
        CM1: "/CM1Record3",
      }
    };
    const endpoint = endpoints[line]?.[machine];
    if (!endpoint) {
      console.error(`Endpoint not found for line: ${line}, machine: ${machine}`);
      return null;
    }
    return `http://10.126.15.197:8002/part${endpoint}`;
  };

  const determineSearchEndpoint = (line, machine) => {
    const searchEndpoints = {
      line1: {
        PMA: "/SearchPMARecord1",
        Binder: "/SearchBinderRecord1",
        Wetmill: "/WetmillRecord1",
        FBD: "/SearchFBDRecord1",
        EPH: "/SearchEPHRecord1",
        Tumbler: "/SearchTumblerRecord1",
        Fette: "/SearchFetteRecord1",
      },
      line3: {
        PMA: "/SearchPMARecord3",
        Wetmill: "/WetmillRecord3",
        FBD: "/SearchFBDRecord3",
        EPH: "/SearchEPHRecord3",
        HM: "/SearchHMRecord3",
      }
    };
    const endpoint = searchEndpoints[line]?.[machine];
    if (!endpoint) {
      console.error(`Search endpoint not found for line: ${line}, machine: ${machine}`);
      return null;
    }
    return `http://10.126.15.197:8002/part${endpoint}`;
  };


  const getDataEbrData = async (batchList) => {
    // console.log(selectedBatch);
    if (!selectedBatch) {
      alert("Please select a valid batch before fetching data.");
      return;
    }
    setIsLoading(true); // MULAI LOADING
    const endpoint = determineSearchEndpoint(newLine, newMachine);
    if (!endpoint) {
      setIsLoading(false);
      console.error(`Invalid search endpoint determined for line: ${newLine}, machine: ${newMachine}`);
      return;
    }

    // try {
    //   const response = await axios.get(endpoint, { params: { data: selectedBatch } });
    //   const processedData = response.data.map(item => {
    //     const newItem = { ...item };
    //     // Convert Buffer objects to strings
    //     for (const key in newItem) {
    //       newItem[key] = cleanBuffer(newItem[key]);
    //       newItem[key] = formatValue(key, newItem[key]);
    //     }
    //     return newItem;
    //   });
    //   setAllDataEBR(processedData);
    try {
      let allResults = [];
      // Loop jika batchList > 1 (All Batch), atau hanya 1 batch
      for (const batch of batchList) {
        const response = await axios.get(endpoint, { 
          params: { 
            data: batch,
            start: startDate,
            finish: finishDate
          } 
        });
        const processedData = response.data.map(item => {
          const newItem = { ...item };
          // Convert Buffer objects to strings
          for (const key in newItem) {
            newItem[key] = cleanBuffer(newItem[key]);
            newItem[key] = formatValue(key, newItem[key]);
          }
          return newItem;
        });
        allResults = allResults.concat(processedData.map(d => ({ ...d, batch })));
      }
      setAllDataEBR(allResults);
    } catch (error) {
      console.error("Error fetching EBR data:", error);
      toast.error("Failed to fetch EBR data.");
    } finally {
      setIsLoading(false); // SELESAI LOADING
    }
  };

  const handleSubmit = async () => {
    // e.preventDefault();
    // await fetchBatch(newLine, newMachine, startDate, finishDate);
    // await getDataEbrData();
    if (selectedBatch === "ALL") {
      if (!cleanBatchData.length) {
        alert("Batch data kosong.");
        return;
      }
      await getDataEbrData(cleanBatchData);
    } else if (selectedBatch) {
      await getDataEbrData([selectedBatch]);
    } else {
      alert("Please select a valid batch before fetching data.");
    }
  };
  
  // Handlers for input changes
  const lineHandler = (event) => {
    const selectedLine = event.target.value;
    setNewLine(selectedLine);
    fetchProces(selectedLine); // Fetch processes based on the selected line

      // Buat Reset State ini
      setNewProces("");        
      setFetchProcesData([]);  
      setNewMachine("");       
      setFetchMachineData([]);  
      setSelectedBatch("");     
      setFetchBatchData([]);    
      setAllDataEBR([]);        
  };

  const procesHandler = (event) => {
    const selectedProces = event.target.value;
    setNewProces(selectedProces);
    // fetchMachine(newLine, selectedProces); // Fetch machines based on line and process
    fetchMachine(newLine || "", selectedProces); // Ensure `newLine` is valid
  };

  const machineHandler = (event) => {
    setNewMachine(event.target.value);

      // Reset batch & table data
      setSelectedBatch("");
      setFetchBatchData([]);
      setAllDataEBR([]);
  };

  const startDateHandler = (event) => {
    setStartDate(event.target.value);
  };

  const finishDateHandler = (event) => {
    const finishValue = event.target.value;
    setFinishDate(finishValue);

    // Check if all necessary inputs are filled
    if (newLine && newMachine && startDate && finishValue) {
      fetchBatch(newLine, newMachine, startDate, finishValue);
    }
  };

  const cleanBuffer = (buffer) => {
    if (buffer && buffer.type === 'Buffer') {
      return String.fromCharCode.apply(null, new Uint16Array(buffer.data)).replace(/\u0000/g, '');
    }
    return buffer;
  };

  const formatValue = (key, value) => {
    if (key === 'span') {
      return value.toFixed(3);
    }
    if (key === 'Speedpv') {
      return Math.round(value);
    }
    return value;
  };

  const cleanBatchData = fetchBatchData.map(batch => {
    // Remove unprintable characters and trim
    const cleaned = batch.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
    // Extract only the part before unwanted characters (e.g., $, %, !)
    const match = cleaned.match(/^[A-Za-z0-9-]+/);
    return match ? match[0] : cleaned;
  });
  //console.log("Cleaned Batch Data:", cleanBatchData);

  useEffect(() => {
    console.log("Current line:", newLine);
    console.log("Current process:", newProces);
    console.log("Current machine:", newMachine);
    console.log("Selected batch:", selectedBatch);
  }, [newLine, newProces, newMachine, selectedBatch]);

  // Rendering the fetched data into options
  const renderLine = () => {
    return fetchLineData.map((line) => (
      <option key={line.line_name} value={line.line_name}>
        {line.line_name}
      </option>
    ));
  };

  const renderProces = () => {
    return fetchProcesData.map((proces) => (
      <option key={proces.proces_name} value={proces.proces_name}>
        {proces.proces_name}
      </option>
    ));
  };

  const renderMachine = () => {
    return fetchMachineData.map((machine) => (
      <option key={machine.machine_name} value={machine.machine_name}>
        {machine.machine_name}
      </option>
    ));
  };

  // const handleSubmit = () => {
  //   const machine = selectedMachine; // Selected machine from dropdown
  //   const start = selectedStartDate; // Start date
  //   const finish = selectedEndDate; // End date
  //   const line = selectedLine; // Selected line
  
  //   fetchBatch(machine, start, finish, line, setMainData);
  // };
  
  // const renderBatch = () => {
  //   return fetchBatchData.map((batch) => (
  //     <option key={batch.id} value={batch.batch}>
  //       {batch.batch}
  //     </option>
  //   ));
  // };


  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(allDataEBR.length / rowsPerPage)));
  };

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1); // reset ke page 1
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = [...allDataEBR].sort((a, b) => {
    if (sortConfig.key === 'time@timestamp') {
      const dateA = new Date(a[sortConfig.key]);
      const dateB = new Date(b[sortConfig.key]);
      return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    } else {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    }
  });

  const renderTableHeader= () => {
    // Pastikan visibleData tidak kosong
    if (allDataEBR.length > 0) {
      // Ambil semua kunci dari objek pertama dalam visibleData
      const dataKeys = Object.keys(allDataEBR[0]);

      return (
        <thead>
          <tr>
            {dataKeys.map((dataKey, index) => (
              <th className="text-center px-4 py-2 whitespace-normal" key={index} onClick={() => handleSort(dataKey)}>
                <div className="flex items-center justify-between cursor-pointer">
                  {dataKey}
                  {dataKey === 'data_index' && (
                    <SortIcon active={sortConfig.key === dataKey} direction={sortConfig.direction} />
                  )}
                  {dataKey === 'time@timestamp' && (
                    <SortIcon active={sortConfig.key === dataKey} direction={sortConfig.direction} />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
      );
    }
    return null; // Jika visibleData kosong, kembalikan null
  };

  const cleanData = (dataKey, value, selectedMachine, selectedLine) => {
    if (dataKey === "BATCH" || dataKey === "PROCESS"  || dataKey === "PMA_BATCH" || dataKey === "PMA_PROCESS" || dataKey === "WET_PROCESS") {
      return value.replace(/[^a-zA-Z0-9\s-]/g, '');
    }
    if (dataKey === "impeller_rpm" || dataKey === "impeller_ampere") {
      // Format the value to 2 decimal places
      return parseFloat(value).toFixed(2);
    }
    // if (dataKey === "time@timestamp") {
    //   // Format the timestamp to a readable format
    //   return formatTimestamp(value);
    // }
    // return value;
    if (dataKey === "time@timestamp") {
      if (selectedMachine === "FBD") {
        return formatTimestamp(value); // pakai format readable
      } else if (selectedLine === "line1" || selectedMachine === "PMA") {
        // Hanya untuk line1 & PMA
        return formatTimestampUTC(value);
      }
      return value; // mesin lain: tampilkan apa adanya
    }
    return value;
  };

  // Helper: dapatkan data terfilter & terformat seperti di tabel 
  const getFormattedExportData = () => {
    // Export semua data yang sudah terurut/terfilter
    return sortedData.map(row => {
      const dataKeys = Object.keys(row);
      let cleanedRow = {};
      dataKeys.forEach(key => {
        cleanedRow[key] = cleanData(key, row[key], newMachine);
      });
      return cleanedRow;
    });
  };

  // 1. Untuk EXPORT ke Excel
const exportToExcel = (selectedLine, selectedProcess, selectedMachine, startDateInput, finishDateInput, selectedBatch) => {
    const exportData = getFormattedExportData();

    if (!exportData || exportData.length === 0) {
        toast.warning("No data to export!");
        return;
    }

    // Helper function to safely get and sanitize the value
    const sanitizeFileName = (input) => {
        if (!input) return 'N_A';
        
        // Handle object inputs (like from Select components)
        if (typeof input === 'object') {
            // Try common property names
            return input.value || input.name || input.line_name || 'N_A';
        }
        
        // Convert to string and remove invalid characters
        return String(input).replace(/[\/\\:*?"<>|]/g, '_');
    };

    const formatDateForFileName = (dateString) => {
        if (!dateString || dateString.toLowerCase() === 'dd/mm/yyyy') return 'AnyDate';
        const parts = dateString.split('/');
        return (parts.length === 3) ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateString;
    };

    // Sanitize and format all variables
    const lineArea = sanitizeFileName(selectedLine);
    const process = sanitizeFileName(selectedProcess);
    const machine = sanitizeFileName(selectedMachine);
    const startDate = formatDateForFileName(startDateInput);
    const finishDate = formatDateForFileName(finishDateInput);
    const batch = sanitizeFileName(selectedBatch);
    const prefix = `${lineArea}-${process}-${machine}`; // Example: LINE1-GRANULASI-PMA
    const startdateRange = `${startDate.replace(/-/g, '')}`; // Example: 20251001
    const finishdateRange = `${finishDate.replace(/-/g, '')}`; // Example: 20251031
    
    // Construct the final file name with all parameters
    const fileName = `${batch}_${prefix}_(${startdateRange}-${finishdateRange}).xlsx`;

    // Export
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BatchRecord");
    XLSX.writeFile(workbook, fileName);
};

  const exportToPDF = (selectedLine, selectedProcess, selectedMachine, startDateInput, finishDateInput, selectedBatch) => {

    const sanitizeFileName = (input) => {
        if (!input) return 'N_A';
        
        if (typeof input === 'object') {
            return input.value || input.name || input.line_name || 'N_A';
        }
        
        return String(input).replace(/[\/\\:*?"<>|]/g, '_');
    };

    // Helper function to format the date (Moved up to prevent TDZ issues)
    const formatDateForFileName = (dateString) => {
        if (!dateString || dateString.toLowerCase() === 'dd/mm/yyyy') return 'AnyDate';
        const parts = dateString.split('/');
        // Format YYYY-MM-DD for consistency and sorting
        return (parts.length === 3) ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateString;
    };

    const lineArea = sanitizeFileName(selectedLine);
    const process = sanitizeFileName(selectedProcess);
    const machine = sanitizeFileName(selectedMachine);
    const batch = sanitizeFileName(selectedBatch);
    const startDate = formatDateForFileName(startDateInput);
    const finishDate = formatDateForFileName(finishDateInput);
    
    // --- Data Check ---
    const exportData = getFormattedExportData(); // sama seperti untuk Excel

    if (!exportData || exportData.length === 0) {
      toast.warning("No data to export!");
      return;
    }

    // Siapkan header kolom dari key object
    const columns = Object.keys(exportData[0]).map((key) => ({ header: key, dataKey: key }));

    // --- PDF Setup ---
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "A4"
    });

    // Judul PDF
    doc.setFontSize(16);
    doc.text("Batch Record", 40, 30);
    
    // Keterangannya bos ngikutin state yg distate
    doc.setFontSize(10);
    let infoY = 50; // Y awal
    const infoLineHeight = 16;
    
    // --- PDF Info (Used correct input variables/parameters) ---
    doc.text(`Line: ${lineArea || "-"}`, 40, infoY); // FIX: Used lineArea instead of newLine
    doc.text(`Process: ${process || "-"}`, 180, infoY); // FIX: Used process instead of newProces
    doc.text(`Machine: ${machine || "-"}`, 380, infoY); // FIX: Used machine instead of newMachine
    infoY += infoLineHeight;
    doc.text(`Start Date: ${startDate || "-"}`, 40, infoY); // Now safe
    doc.text(`Finish Date: ${finishDate || "-"}`, 180, infoY); // Now safe
    doc.text(`Batch: ${batch || "-"}`, 380, infoY);

    // Render tabel setelah keterangan
    autoTable(doc, {
      columns,
      body: exportData,
      startY: infoY + infoLineHeight + 10,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [41, 128, 185] },
      margin: { left: 40, right: 40 },
    });
    
    // --- File Name Generation ---
    const prefix = `${lineArea}-${process}-${machine}`; // Example: LINE1-GRANULASI-PMA
    // Remove hyphens for compact date range
    const startdateRange = `${startDate.replace(/-/g, '')}`; 
    const finishdateRange = `${finishDate.replace(/-/g, '')}`; 
    
    doc.save(`${batch}_${prefix}_(${startdateRange}-${finishdateRange}).pdf`);
};


  const renderData = () => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const visibleData = sortedData.slice(startIndex, startIndex + rowsPerPage);

    if (allDataEBR.length == 0) {
      return (
        <Tr>
          <Td colSpan={12} className="text-red-500" textAlign="center" display="table-cell">
            No data available
          </Td>
        </Tr>
      );
    } else {
      return visibleData.map((row, index) => {
        // Ambil semua kunci dari objek row
        const dataKeys = Object.keys(row);
      
        return (
          <Tr key={index}>
            {dataKeys.map((dataKey, dataIndex) => (
              <Td className="text-center bg-cobabg" key={dataIndex}>
                {cleanData(dataKey, row[dataKey], newMachine)}
              </Td>
            ))}
          </Tr>
        );
      });  
    }
  };

  const SortIcon = ({ active, direction }) => (
    <span className="inline-block ml-1">
      <svg
        className={`w-4 h-4 transform ${active ? 'text-blue-600' : 'text-gray-400'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {direction === 'asc' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        )}
      </svg>
    </span>
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

//========================HENDELER========================================
// const lineHendeler = (event) => {
//   setNewLine(event.target.value);
//   fetchProces(event.target.value);
//   //console.log(event.target.value);
// };

// const procesHendeler = (event) => {
//   setNewProces(event.target.value);
//   fetchMachine(newLine, event.target.value);
//   //console.log(event.target.value);
// };

// const machineHendeler = (event) => {
//   setNewMachine(event.target.value);
//   //console.log(event.target.value);
// };

// const submitHendeler = (even) => {
//   getDataWithMachine();
//   console.log(newMachine);
// };

// const batchHendeler = (even) => {
//   setNoBatch(even.target.value);
//   console.log(even.target.value);
// };

// useEffect(() => {
//   fetchLine();
// }, []);

  return (
    <>
      <h1 className="text-center text-text text-5xl font-medium font-sans">Batch Record</h1>
      <div className="flex flex-wrap justify-center items-center my-4 gap-6">
        <div className="w-full sm:w-1/3 md:w-auto">
          <div>
            <label
              htmlFor="line"
              className="block text-sm font-medium leading-6 text-text"
            >
              Line Area
            </label>
            <div className="mt-2">
              <Select placeholder="All Line" id="line" onChange={lineHandler}
                sx={{
                  border: "1px solid",
                  borderColor: borderColor,
                  borderRadius: "0.395rem",
                  background: "var(--color-background)", // background color from Tailwind config
        
                  _hover: {
                    borderColor: hoverBorderColor,
                  },
                }}>
                {renderLine()}
              </Select>
            </div>
          </div>
        </div>
        <div className="w-full sm:w-1/3 md:w-auto">
          <div>
            <label
              htmlFor="proces"
              className="block text-sm font-medium leading-6 text-text"
            >
              Process
            </label>
            <div className="mt-2">
              <Select placeholder="All Process" onChange={procesHandler}
                sx={{
                  borderRadius: "0.395rem",
                }}>
                {renderProces()}
              </Select>
            </div>
          </div>
        </div>
        <div className="w-full sm:w-1/3 md:w-auto">
          <div>
            <label
              htmlFor="machine"
              className="block text-sm font-medium leading-6 text-text"
            >
              Machine
            </label>
            <div className="mt-2">
              <Select placeholder="All Machine" onChange={machineHandler}>
                {renderMachine()}
              </Select>
            </div>
          </div> 
        </div>
        <div className="w-full sm:w-1/2 md:w-auto">
          <div>
            <label
              htmlFor="start"
              className="block text-sm font-medium leading-6 text-text"
            >
              Start Date
            </label>
            <div className="mt-2">
              <Input
                //onChange={dateStart}
                placeholder="Select Date and Time"
                size="md"
                type="date"
                value={startDate}
                onChange={startDateHandler}
                // onChange={(e) => setStartDate(e.target.value)}
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
        </div>
        <div className="w-full sm:w-1/2 md:w-auto">
          <div>
            <label
              htmlFor="finish"
              className="block text-sm font-medium leading-6 text-text"
            >
              Finish Date
            </label>
            <div className="mt-2">
              <Input
                placeholder="Select Date and Time"
                size="md"
                type="date"
                value={finishDate}
                onChange={finishDateHandler}
                // onChange={(e) => setFinishDate(e.target.value)}
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
        </div>
        <div className="w-full sm:w-1/2 md:w-auto">
          <div>
            <label htmlFor="batch" className="block text-sm font-medium leading-6 text-text">Search Batch</label>
            <div className="search mt-2">
              <Select
                placeholder="Select Batch"
                value={selectedBatch}
                sx={{
                  border: "1px solid",
                  borderColor: borderColor,
                  borderRadius: "0.395rem",
                  background: "var(--color-background)", // background color from Tailwind config
        
                  _hover: {
                    borderColor: hoverBorderColor,
                  },
                }}
                onChange={(e) => setSelectedBatch(e.target.value)}
              >
              {/* Opsi All Batch */}
              {cleanBatchData.length > 0 && (
                <option value="ALL">All Batch</option>
              )}
              {/* <option value="">Select Batch</option> */}
              {cleanBatchData.length > 0 ? (
                cleanBatchData.map((batch, index) => (
                  <option key={index} value={batch}>
                    {batch}
                  </option>
                ))
              ) : (
                <option value="" disabled>
                  No Batch Data Available
                </option>
              )}
              </Select>
            </div>
          </div>
        </div>
        {/* <div className="w-full sm:w-1/2 md:w-auto">
          <label className="block text-sm font-medium leading-6 text-text invisible">
            Submit Button
          </label>
            <Button
              className="w-40 mt-2"
              colorScheme="blue"
              type="submit"
              //onSubmit={handleSubmit}
                onClick={() => handleSubmit()}
            >
              Submit
            </Button>
        </div> */}
      </div>
      <div className="mt-4 flex justify-center space-x-2">
        <Button colorScheme="blue" type="submit"
          //onSubmit={handleSubmit}
          onClick={() => handleSubmit()}
        >
          Submit
        </Button>
        <Select
          value={rowsPerPage}
          onChange={handleRowsPerPageChange}
          // onChange={(e) => setRowsPerPage(Number(e.target.value))}
          width="80px">
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={40}>40</option>
          <option value={60}>60</option>
          <option value={100}>100</option>
        </Select>
<Button colorScheme="green" className="mb-4" onClick={() => exportToExcel(newLine, newProces, newMachine, startDate, finishDate, selectedBatch)}>
  Export to Excel
</Button>
        <Button colorScheme="red" className="mb-4" onClick={() => exportToPDF(newLine, newProces, newMachine, startDate, finishDate, selectedBatch)}>
          Export to PDF
        </Button>
      </div>
      {isLoading ? (
        <Center py={10}>
          <Spinner size="xl" thickness="4px" color="blue.500" />
        </Center>
      ) : (
        <div className="flex justify-center">
          <TableContainer className="bg-card rounded-md mt-4" sx={{ overflowX: "auto", maxWidth: "90%" }}>
            <Table key={colorMode} variant="simple" sx={{ minWidth: "1260px"}} >
              <TableCaption sx={{color: tulisanColor}}>Batch Record</TableCaption>
              {renderTableHeader()}
              <Tbody>{renderData()}</Tbody>
            </Table>
          </TableContainer>
        </div>
      )}
      {/* Pagination Controls */}
      <div className="flex justify-center items-center my-4 gap-4">
        <Button
          onClick={handlePrevPage}
          isDisabled={currentPage === 1}
          colorScheme="blue"
        >
          Previous
        </Button>
        <span className="text-text">
          Page {currentPage} of {Math.ceil(allDataEBR.length / rowsPerPage)}
        </span>
        <Button
          onClick={handleNextPage}
          isDisabled={currentPage === Math.ceil(allDataEBR.length / rowsPerPage)}
          colorScheme="blue"
        >
          Next
        </Button>
      </div>
      <ToastContainer position="top-center" draggable />
    </>
  );
}

export default BatchRecord;
