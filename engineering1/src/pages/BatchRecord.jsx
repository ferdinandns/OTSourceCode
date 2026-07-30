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

function BatchRecord() {
  const [fetchLineData, setFetchLineData] = useState([]);
  const [fetchProcesData, setFetchProcesData] = useState([]);
  const [fetchMachineData, setFetchMachineData] = useState([]);
  const [newLine, setNewLine] = useState("");
  const [newProces, setNewProces] = useState("");
  const [newMachine, setNewMachine] = useState("");
  const [noBatch, setNoBatch] = useState("");
  const [mainData, setMainData] = useState([]);

  const fetchLine = async () => {
    let response = await axios.get("http://10.126.15.137:8002/part/lineData");
    setFetchLineData(response.data);
  };

  const fetchProces = async (line) => {
    let response = await axios.get(
      "http://10.126.15.137:8002/part/procesData",
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
      "http://10.126.15.137:8002/part/machineData",
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
      "http://10.126.15.137:8002/part/PmaGetData",
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

  const renderLine = () => {
    return fetchLineData.map((lineCategory) => {
      return (
        <option value={lineCategory.line_name}>{lineCategory.line_name}</option>
      );
    });
  };

  const renderProces = () => {
    return fetchProcesData.map((procesCategory) => {
      return (
        <option value={procesCategory.proces_name}>
          {procesCategory.proces_name}
        </option>
      );
    });
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
  const lineHendeler = (event) => {
    setNewLine(event.target.value);
    fetchProces(event.target.value);
    //console.log(event.target.value);
  };

  const procesHendeler = (event) => {
    setNewProces(event.target.value);
    fetchMachine(newLine, event.target.value);
    //console.log(event.target.value);
  };

  const machineHendeler = (event) => {
    setNewMachine(event.target.value);
    //console.log(event.target.value);
  };

  const submitHendeler = (even) => {
    getDataWithMachine();
    console.log(newMachine);
  };

  const batchHendeler = (even) => {
    setNoBatch(even.target.value);
    console.log(even.target.value);
  };

  useEffect(() => {
    fetchLine();
  }, []);

  return (
    <>
      <h1 className="text-center text-4xl antialiased hover:subpixel-antialiased p-8">
        BATCH RECORD
      </h1>

      <div className="flex flex-row justify-center items-center">
        <div className="main flex flex-row gap-x-6">
          <div>
            <label
              htmlFor="line"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Start Date
            </label>
            <Input
              //onChange={dateStart}
              placeholder="Select Date and Time"
              size="md"
              type="datetime-local"
            />
          </div>
          <div>
            <label
              htmlFor="line"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Finish Date
            </label>
            <Input
              //onChange={dateFinish}
              placeholder="Select Date and Time"
              size="md"
              type="datetime-local"
            />
          </div>

          <div>
            <label
              htmlFor="line"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Search Batch
            </label>
            <div className="search">
              <Input
                id="outlined-basic"
                label="Search"
                onChange={batchHendeler}
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="line"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Line Area
            </label>
            <div className="mt-2">
              <Select placeholder="All Line" id="line" onChange={lineHendeler}>
                {renderLine()}
              </Select>
            </div>
          </div>
          <div>
            <label
              htmlFor="proces"
              className="block text-sm font-medium leading-6 text-gray-900"
            >
              Process
            </label>
            <div className="mt-2">
              <Select placeholder="All Process" onChange={procesHendeler}>
                {renderProces()}
              </Select>
            </div>
          </div>
          <div>
            <label
              htmlFor="machine"
              className="block text-sm font-medium leading-6 text-gray-900"
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
      <div className="mt-8">
        <TableContainer>
          <Table variant="simple">
            <TableCaption>Imperial to metric conversion factors</TableCaption>
            <Thead>
              <Tr>
                <Th>No</Th>
                <Th>Batch-ID</Th>
                <Th>Process</Th>
                <Th>Date</Th>
                <Th>Data1</Th>
                <Th>Data2</Th>
                <Th>Data3</Th>
                <Th>Data4</Th>
                <Th>Data5</Th>
                <Th>Data6</Th>
                <Th>Data7</Th>
                <Th>Data8</Th>
              </Tr>
            </Thead>
            <Tbody>{renderData()}</Tbody>
          </Table>
        </TableContainer>
      </div>
    </>
  );
}

export default BatchRecord;
