import React, { useEffect, Component, useState } from "react";
import { Button, 
    ButtonGroup, 
    Stack, 
    Input, 
    Select, 
    Radio, 
    RadioGroup, 
    Table, 
    Thead, 
    Tbody, 
    Tr, 
    Th, 
    Td, 
    TableContainer 
} from "@chakra-ui/react";
import axios from "axios";

function AlarmList() {
    const [AlarmType, setAlarmType] = useState();
    const [startDate, setStartDate] = useState();
    const [finishDate, setFinishDate] = useState();
    const [AlarmData, setAlarmData] = useState([]);

    const fetchAlarm = async () => {
        let response = await axios.get(
            "http://10.126.15.137:8002/part/AlarmList", 
            {
              params: {
                type: AlarmType,
                start: startDate,
                finish: finishDate,
              }
            }
          );
          setAlarmData(response.data);console.log(AlarmData);
    };

    let dateStart = (e) =>{
        var dataInput = e.target.value;
        setStartDate(dataInput);
        
    };
    let dateFinish = (e) =>{
        var dataInput = e.target.value;
        setFinishDate(dataInput);
    };
    let getAlarmType = (e) => {
        var dataInput = e.target.value;
        setAlarmType(dataInput);
    };

    const table = () => {
        return AlarmData.map((data) => {
          return (
            <Tr>
              <Td border="1px">{data.Tanggal}</Td>
              <Td border="1px">{data.Event}</Td>
            </Tr>
          );
        });
      };
      
    return (
        <div>
            <div align="center"><h1 style={{ fontSize: "2rem"}}><b>Alarm Event List </b></h1></div>
            <Stack
                className="flex flex-row justify-center mb-4  "
                direction="row"
                spacing={4}
                align="center"
            >
                <div>
                    <h2>Parameter</h2>
                    <Select placeholder="Select Alarm" onChange={getAlarmType}>
                        <option value="Alarm_Air_Event_Log">Pemakaian Air</option>
                        <option value="Alarm_Loopo_Event_Log">Loopo</option>
                        <option value="Alarm_Osmotron_Event_Log">Osmotron</option>
                        <option value="Alarm_Suhu_Event_Log">Suhu</option>
                        <option value="Alarm_RH_Event_Log">RH</option>
                        <option value="Alarm_DP_Event_Log">DP</option>
                    </Select>
                </div>
            <div>
                <h2>Start Time</h2>
                <Input
                    onChange={dateStart} 
                    placeholder="Select Date"
                    size="md"
                    type="date"
                />
                </div>
                <div>Finish Time
                <Input
                    onChange={dateFinish}
                    placeholder="Select Date"
                    size="md"
                    type="date"
                />
            </div>
            <div>
                    <br />
                    <Button
                        className="m1-4"
                        colorScheme="gray"
                        onClick={() => fetchAlarm()}
                    >
                        Submit
                    </Button>
            </div>
            </Stack>
            <TableContainer class="center" marginLeft={"25%"} marginRight={"25%"}>
          <Table  variant="simple"  border="1px">
            <Thead>
              <Tr backgroundColor="aliceblue" border="1px">
                <Th border="1px" textAlign={"center"}>Date Time</Th>
                <Th border="1px" textAlign={"center"}>Event</Th>
              </Tr>
            </Thead>
            <Tbody >{table()}</Tbody>
          </Table>
        </TableContainer>
        </div>
    )
}
export default AlarmList;