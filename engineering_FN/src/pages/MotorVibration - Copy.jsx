import { React, useState, useEffect } from "react";
import {
  Table,
  Thead,
  Tbody,
  Tfoot,
  Tr,
  Th,
  Td,
  TableCaption,
  TableContainer,
  Button,
  ButtonGroup,
  Stack,
  Input,
  Select,
} from "@chakra-ui/react";
import axios from "axios";
import Header from "../components/header";
import { useColorMode, useColorModeValue } from "@chakra-ui/react";

function Motor() {
  const [fetchLineData, setFetchLineData] = useState([]);
  const [fetchProcesData, setFetchProcesData] = useState([]);
  const [fetchMachineData, setFetchMachineData] = useState([]);
  const [newLine, setNewLine] = useState("");
  const [newProces, setNewProces] = useState("");
  const [newMachine, setNewMachine] = useState("");
  const [noBatch, setNoBatch] = useState("");
  const [mainData, setMainData] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );

  const { colorMode } = useColorMode();
  const borderColor = useColorModeValue("rgba(var(--color-border))", "rgba(var(--color-border))");
  const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");
  const hoverBorderColor = useColorModeValue("rgba(var(--color-border2))", "rgba(var(--color-border2))");

  const fetchLine = async () => {
    let response = await axios.get("http://10.126.15.197:8002/part/lineData");
    setFetchLineData(response.data);
  };

  const fetchProces = async (line) => {
    let response = await axios.get(
      "http://10.126.15.197:8002/part/procesData",
      {
        params: {
          line_name: line,
        },
      }
    );

    setFetchProcesData(response.data);
  };

  const fetchMachine = async (line, proces) => {
    let response = await axios.get(
      "http://10.126.15.197:8002/part/machineData",
      {
        params: {
          line_name: line,
          proces_name: proces,
        },
      }
    );
    setFetchMachineData(response.data);
  };

  const getDataWithMachine = async () => {
    let response = await axios.get(
      "http://10.126.15.197:8002/part/PmaGetData",
      {
        params: {
          machine: newMachine,
          batch: noBatch,
        },
      }
    );

    console.log(response.data);
    setMainData(response.data);
  };

  const renderMachine = () => {
    return fetchMachineData.map((machineCategory) => {
      return (
        <option value={machineCategory.machine_name}>
          {machineCategory.machine_name}
        </option>
      );
    });
  };

  const renderData = () => {
    return mainData.map((ebr) => {
      return (
        <Tr>
          <Td>{ebr.data_index}</Td>
          <Td>{ebr.data_format_0_string}</Td>
          <Td>{ebr.data_format_1_string}</Td>
          <Td>{ebr.label}</Td>
          <Td>{ebr.data_format_2}</Td>
          <Td>{ebr.data_format_3}</Td>
          <Td>{ebr.data_format_4}</Td>
          <Td>{ebr.data_format_5}</Td>
          <Td>{ebr.data_format_6}</Td>
          <Td>{ebr.data_format_7}</Td>
        </Tr>
      );
    });
  };

  //========================HENDELER========================================

  const machineHendeler = (event) => {
    setNewMachine(event.target.value);
    //console.log(event.target.value);
  };

  const submitHendeler = (even) => {
    getDataWithMachine();
    console.log(newMachine);
  };

  // useEffect(() => {
  //   fetchLine();
  // }, []);

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

  return (
    <div>
      <div>
        <h1 className="text-center text-text text-4xl antialiased hover:subpixel-antialiased p-6">
          MOTOR VIBRATION
        </h1>
      </div>

      <div className="flex flex-row justify-center items-center">
        <div className="main flex flex-row gap-x-6">
          <div>
            <label
              htmlFor="line"
              className="block text-sm font-medium leading-6 text-text"
            >
              Start Date
            </label>
            <Input
              //onChange={dateStart}
              placeholder="Select Date and Time"
              size="md"
              type="datetime-local"
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
          <div>
            <label
              htmlFor="line"
              className="block text-sm font-medium leading-6 text-text"
            >
              Finish Date
            </label>
            <Input
              //onChange={dateFinish}
              placeholder="Select Date and Time"
              size="md"
              type="datetime-local"
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

          <div>
            <label
              htmlFor="machine"
              className="block text-sm font-medium leading-6 text-text"
            >
              Machine
            </label>
            <div className="mt-2">
              <Select placeholder="All Machine" onChange={machineHendeler}>
                {renderMachine()}
              </Select>
            </div>
          </div>

          <div className="no-print">
            <Button
              className="w-40 mt-8 no-print"
              colorScheme="blue"
              onClick={() => submitHendeler()}
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-8 bg-card rounded-md">
        <TableContainer>
          <Table key={colorMode} variant="simple">
            <TableCaption>Imperial to metric conversion factors</TableCaption>
            <Thead>
              <Tr>
                <Th sx={{
                color: tulisanColor,
                }}>No</Th>
                <Th sx={{
                color: tulisanColor,
                }}>Date</Th>
                <Th sx={{
                color: tulisanColor,
                }}>Velocity</Th>
              </Tr>
            </Thead>
            <Tbody>{renderData()}</Tbody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
}

export default Motor;
