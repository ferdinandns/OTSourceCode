import { useEffect, useState, useRef } from "react";
import moment from "moment/moment";
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableCaption,
  TableContainer,
  Button,
  Select,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import App from "./PareetoLine";
import Pareto from "./ParetoData";
import { useSelector, useDispatch } from "react-redux";
import { fetchPart } from "../features/part/partSlice";
import { deletePartListData } from "../features/part/partSlice";
import { getDateMaintenance } from "../features/part/partSlice";
import { useColorMode, useColorModeValue, Box } from "@chakra-ui/react";
import { useReactToPrint } from "react-to-print";


function MaintenanceBreakdown() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const userGlobal = useSelector((state) => state.user.user);

  const [inputText, setInputText] = useState("");
  const [dropDown, UseDropDown] = useState("");
  const [datePicker, SetDatePicker] = useState(4);
  const partValue = useSelector((state) => state.part.partValue);
  const dateValue = useSelector((state) => state.prod.date);
  const [Name, setName] = useState();
  const ComponentPDF= useRef();

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: "Total", direction: "desc" });

  const [isTableVisible, setIsTableVisible] = useState(true);
  const { colorMode } = useColorMode();
  const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
  const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");
  const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );

  // const fetchDataPLC = async () => {
  //   let response = await axios.get("http://10.126.15.197:8002/plc");
  //   let ava = response.data
  //     .replace(/455|(\r\n|\n|\r)/g, "")
  //     .replace(/(\w+)\s*:/g, '"$1":')
  //     .replace(/:\s*(\w+)/g, ': "$1"')
  //     .replace(/}0$/, "}");

  //   console.log(ava);
  // };

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

  useEffect(() => {
    // fetchDataPLC();
  }, []);
  
  const idData = "";
  const getDate = (e) => {
    var dataInput = e.target.value;

    SetDatePicker(dataInput);
    dispatch(fetchPart(dataInput));
    dispatch(getDateMaintenance(dataInput));
  };
  const deleteData = (id) => {
    dispatch(deletePartListData(id));
  };

  const inputHandler = (e) => {
    var variableInputData =  e.target.value;
    setInputText(variableInputData.toUpperCase())
  };

  let doprDown = (e) => {
    var dataInput1 = e.target.value;
    UseDropDown(dataInput1);
  };

  // const filteredData = partValue.filter((obj) => {
  //   const month = new Date(obj.Tanggal).getUTCMonth();
  //   return month === 1;
  // });

  //console.log(filteredData);

  // const renderPartList = () => {
  //   const filterData = partValue.filter((el) => {
  //     if (inputText == "" && dropDown == "") {
  //       return el;
  //     }
  //     if (!dropDown == "" && inputText == "") {
  //       return el.Line.includes(dropDown);
  //     }
  //     if (!inputText == "" && dropDown == "") {
  //       return el.Mesin.toUpperCase().includes(inputText);
  //     }
  //     if (!dropDown == "" && !inputText == "") {
  //       return el.Mesin.toUpperCase().includes(inputText) && el.Line.includes(dropDown);
  //     }
  //     if (inputText !== "" && dropDown === "") {
  //     return el.Mesin.toUpperCase().includes(inputText.toUpperCase());
  //     }
  //     // Filter by both Mesin and Line (case-insensitive)
  //     if (dropDown !== "" && inputText !== "") {
  //       return (
  //         el.Mesin.toUpperCase().includes(inputText.toUpperCase()) &&
  //         el.Line.includes(dropDown)
  //     );
  //   }
  // });
  
  const filteredData = partValue.filter((el) => {
    if (inputText === "" && dropDown === "") return true;
    if (dropDown !== "" && inputText === "") return el.Line.includes(dropDown);
    if (inputText !== "" && dropDown === "") return el.Mesin.toUpperCase().includes(inputText);
    return el.Mesin.toUpperCase().includes(inputText) && el.Line.includes(dropDown);
  });

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) {
      // Jika sortConfig belum dipilih, default ke Total (descending)
      return b.Total - a.Total;
    }
    
    if (sortConfig.key === "Tanggal") {
      return sortConfig.direction === "asc"
        ? new Date(a.Tanggal) - new Date(b.Tanggal)
        : new Date(b.Tanggal) - new Date(a.Tanggal);
    }
    return sortConfig.direction === "asc" ? a[sortConfig.key] - b[sortConfig.key] : b[sortConfig.key] - a[sortConfig.key];
  });
  
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  // 3. current page-nya pagination (halaman saat  ini)
  const paginatedData = sortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // Fungsi untuk menangani tombol navigasi next dan previous pagination
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  // ini kalau jumlah rows berubah, reset ke halaman pertama
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const toggleSort = (key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === "asc" ? "desc" : "asc",
    }));
  };

  //   return filterData
  //     .sort((a, b) => b.Total - a.Total)
  //     .map((partdata) => (
  //       <Tr>
  //         <Td  className="whitespace-nowrap px-2 py-1">{partdata.Mesin}</Td>
  //         <Td  className="whitespace-nowrap px-2 py-1">{partdata.Line}</Td>
  //         <Td className="break-words whitespace-pre-line">{partdata.Pekerjaan}</Td>
  //         <Td>{moment(partdata.Tanggal).format("DD/MM/YYYY")}</Td>
  //         <Td  className="whitespace-nowrap px-2 py-1">{partdata.Quantity}</Td>
  //         <Td  className="whitespace-nowrap px-2 py-1">{partdata.Unit}</Td>
  //         <Td className="whitespace-nowrap px-2 py-1">{partdata.Pic}</Td>
  //         <Td className="whitespace-nowrap px-2 py-1">{partdata.Tawal}</Td>
  //         <Td className="whitespace-nowrap px-2 py-1">{partdata.Tahir}</Td>
  //         <Td className="whitespace-nowrap px-2 py-1">{partdata.Total}</Td>
  //         <Td>
  //         {userGlobal.level > 2 ? (
  //           <Button
  //             colorScheme="green"
  //             onClick={() => {
  //               navigate(`/createedite/${partdata.id}`);
  //             }}
  //           >
  //             Edit
  //           </Button>
  //         ) : (
  //           <></>
  //         )}
  //         <Button colorScheme="red" onClick={() => deleteData(partdata.id)}>
  //           Delete
  //         </Button>
  //       </Td>
  //     </Tr>
  //   ));
  // };

  const generatePDF =  useReactToPrint({
    content: ()=> ComponentPDF.current,
    documentTitle: Name+" Data"
  });

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

  return (
    <div className="my-4">
      <div>
        <h1 class="text-center text-4xl my-2">
          PARETO MACHINE BREAKDOWN
        </h1>
        {userGlobal.level == 1 ? (
          <></>
        ) : (
          <div className="flex flex-col shadow-md">
            <App 
             width="100%" 
             height={400}/>
            <Pareto 
             width="100%" 
             height={450} />
          </div>
        )}
      </div>
      
      <div className="flex flex-col xl:flex-row justify-center space-y-4 xl:space-y-0 xl:space-x-4">
        <div className="flex flex-col xl:flex-row justify-center space-y-4 xl:space-y-0 xl:space-x-4">
          <div className="flex flex-col items-center xl:w-1/3">
            <h6 className="mb-2">Search Mesin</h6>
            <div>
              <input
                onChange={inputHandler}
                id="outlined-basic"
                data-type="instrument"
                variant="outlined"
                fullWidth
                label="Search"
                className="block w-full rounded-md pl-1 bg-background border border-border hover:border-border2 text-text py-1.5 focus:ring-1 focus:ring-blue-700 focus:outline-none sm:text-sm sm:leading-6"
              />
            </div>
          </div>
          <Box className="flex flex-col items-center xl:w-1/3" key={colorMode}>
            <h6 className="mb-2">Monthly Search</h6>
            <Select placeholder="Select Month" onChange={getDate} 
              sx={{
                border: "1px solid",
                borderColor: borderColor,
                borderRadius: "0.395rem",
                background: "var(--color-background)", // background color from Tailwind config
      
                _hover: {
                  borderColor: hoverBorderColor,
                },
              }}>
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
          </Box>
          <Box className="flex flex-col items-center xl:w-1/3" key={colorMode}>
            <h6 className="mb-2">Line</h6>
            <Select placeholder="Select Line" onChange={doprDown}
              sx={{
                border: "1px solid",
                borderColor: borderColor,
                borderRadius: "0.395rem",
                background: "var(--color-background)", // background color from Tailwind config
      
                _hover: {
                  borderColor: hoverBorderColor,
                },
              }}>
              <option value="Line1">Line 1</option>
              <option value="Line2">Line 2</option>
              <option value="Line3">Line 3</option>
              <option value="Line4">Line 4</option>
            </Select>
          </Box>
        </div>
        <div className="flex flex-wrap justify-center gap-2 xl:flex-nowrap xl:space-x-4">
          <div className="flex flex-col items-center">
            <h6 className="mb-2 invisible">Row Selector</h6>
            <Select value={rowsPerPage} onChange={handleRowsPerPageChange} width="80px"
            sx={{
                border: "1px solid",
                borderColor: borderColor,
                borderRadius: "0.395rem",
                background: "var(--color-background)", // background color from Tailwind config
      
                _hover: {
                  borderColor: hoverBorderColor,
                },
              }}>
              {[5, 10, 20, 40, 60, 100].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </Select>
      
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-2 invisible">Label Placeholder</div> 
            <Button
              className="w-36 font-sans"
              colorScheme="blue"
              onClick={() => {
                navigate(`/createnew`);
              }}
            >
              Create New
            </Button>
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-2 invisible">Label Placeholder</div> 
            <Button
              className="w-36 font-sans"
              colorScheme="red"
              onClick={() => setIsTableVisible(!isTableVisible)}
            >
              {isTableVisible ? "Hide All Data" : "Show All Data"}
            </Button>
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-2 invisible">Label Placeholder</div> 
            <Button
              className="w-36 font-sans"
              colorScheme="green"
              onClick={generatePDF}
            >
              Export to PDF
            </Button>
          </div>
        </div>
        {/* Pilihan Jumlah Row & Sorting Tanggal */}
        <div className="flex flex-wrap justify-center gap-2 mt-4 xl:flex-nowrap xl:space-x-4">
          {/* Pilihan Jumlah Row */}
          
        </div>
      </div>
      <br />
      {isTableVisible && (
      <div className="w-full mx-auto" style={{ maxWidth: "86%" }}>
        <TableContainer className="bg-card rounded-md overflow-x-auto">
          <Table
            key={colorMode}
            variant="simple"
            ref={ComponentPDF}
            className="w-full" // Tabel ikut mengecil saat viewport mengecil
          >
            <TableCaption 
              className="text-center"
              sx={{ color: tulisanColor }}
            >
              Imperial to metric conversion factors
            </TableCaption>
            <Thead>
              <Tr>
                <Th sx={{ color: tulisanColor }}>Mesin</Th>
                <Th sx={{ color: tulisanColor }}>Line</Th>
                <Th sx={{ color: tulisanColor }}>Pekerjaan</Th>
                <Th onClick={() => toggleSort("Tanggal")} className="cursor-pointer" sx={{ color: tulisanColor }}>Tanggal
                  <SortIcon active={sortConfig.key === "Tanggal"} direction={sortConfig.direction} />
                </Th>
                <Th sx={{ color: tulisanColor }}>Quantity</Th>
                <Th sx={{ color: tulisanColor }}>Unit</Th>
                <Th sx={{ color: tulisanColor }}>Pic</Th>
                <Th sx={{ color: tulisanColor }}>Awal Pengerjaan</Th>
                <Th sx={{ color: tulisanColor }}>Akhir Pengerjaan</Th>
                <Th sx={{ color: tulisanColor }}>Total</Th>
                <Th sx={{ color: tulisanColor }}>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((partdata, index) => (
                <Tr key={index}>
                  <Td className="px-2 py-1">{partdata.Mesin}</Td>
                  <Td className="px-2 py-1">{partdata.Line}</Td>
                  <Td className="break-words whitespace-normal px-2 py-1">{partdata.Pekerjaan}</Td>
                  <Td>{moment(partdata.Tanggal).format("DD/MM/YYYY")}</Td>
                  <Td className="px-2 py-1">{partdata.Quantity}</Td>
                  <Td className="px-2 py-1">{partdata.Unit}</Td>
                  <Td className="px-2 py-1">{partdata.Pic}</Td>
                  <Td className="px-2 py-1">{partdata.Tawal}</Td>
                  <Td className="px-2 py-1">{partdata.Tahir}</Td>
                  <Td className="px-2 py-1">{partdata.Total}</Td>
                  <Td>
                    {userGlobal.level > 2 && (
                      <Button
                        colorScheme="green"
                        onClick={() => navigate(`/createedite/${partdata.id}`)}
                      >
                        Edit
                      </Button>
                    )}
                    <Button colorScheme="red" onClick={() => deleteData(partdata.id)}>
                      Delete
                    </Button>
                  </Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={11} textAlign="center">
                  No data available
                </Td>
              </Tr>
            )}
            </Tbody>
          </Table>
        </TableContainer>
      </div>
      )}
      {/* Pagination Controls */}
      <div className="flex justify-center items-center mt-4 gap-4">
        <Button onClick={handlePrevPage} isDisabled={currentPage === 1} colorScheme="blue">
          Previous
        </Button>
        <span className="text-text">
          Page {currentPage} of {totalPages || 1}
        </span>
        <Button onClick={handleNextPage} isDisabled={currentPage === totalPages} colorScheme="blue">
          Next
        </Button>
      </div>
    </div>
  );
}

export default MaintenanceBreakdown;
