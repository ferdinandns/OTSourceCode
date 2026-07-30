import React, { useEffect, Component, useState } from "react";
import {
    Tabs,
    TabList,
    TabPanels,
    Tab,
    TabPanel,
    Card,
    CardBody,
    Box,
  } from "@chakra-ui/react";
  import WaterExportDaily from "./WaterExportDaily";
  import WaterExportMonthly from "./WaterExportMonthly";
  import WaterExportYearly from "./WaterExportYearly";

function WaterExport() {
  return (
    <div>
    <br />
      <Tabs isFitted width="100%" maxW="inherit" mx="auto">
        <TabList>
          <Tab>Daily</Tab>
          <Tab>Monthly</Tab>
          <Tab>Yearly</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Box overflow="auto">
              <WaterExportDaily />
            </Box>
          </TabPanel>
          <TabPanel>
            <Box overflow="auto">
              <WaterExportMonthly />
            </Box>
          </TabPanel>
          <TabPanel>
            <Box overflow="auto">
              <WaterExportYearly />
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
  );
    
}
export default WaterExport;