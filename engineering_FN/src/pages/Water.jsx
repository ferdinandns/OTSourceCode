import React from "react";
import {
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Box,
} from "@chakra-ui/react";
import WaterManagement from "./WaterManagement";
import WaterExport from "./WaterExport";

function Water() {
  return (
    <>
      <Tabs isFitted size={"lg"} variant="enclosed" width="100%" maxW="1300px" mx="auto">
        <TabList>
          <Tab>Water Consumption Graph</Tab>
          <Tab>Export Water Data</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Box overflow="auto">
              <WaterManagement />
            </Box>
          </TabPanel>
          <TabPanel>
            <WaterExport />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </>
  );
}

export default Water;