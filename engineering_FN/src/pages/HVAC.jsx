import React from "react";
import {
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Box,
  Card,
  CardBody,
} from "@chakra-ui/react";
import HVACchillerChart from "./HVACchillerChart";
import HVAChandeling from "./HVAChandeling";
import HVACheating from "./HVACheating";

function HVAC() {
  return (
    <>
      <Tabs isFitted size={"lg"} variant="enclosed" width="100%" maxW="1300px" mx="auto">
        <TabList>
          <Tab>CHILLER</Tab>
          <Tab>AIR HANDLING</Tab>
          <Tab>HEATING</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Box overflow="auto">
              <HVACchillerChart />
            </Box>
          </TabPanel>
          <TabPanel>
            <HVAChandeling />
          </TabPanel>
          <TabPanel>
            <HVACheating />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </>
  );
}

export default HVAC;
