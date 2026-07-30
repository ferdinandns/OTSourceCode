import React from "react";
import {
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Box,
} from "@chakra-ui/react";
import HardnessPage from "./HardnessPage";
import Sartorius from "./Sartorius";
import Moisture from "./Moisture";
import Mettler from "./Mettler";

function Instrument() {
  return (
    <div>
      <>
        <Tabs isFitted size={"lg"} variant="enclosed" width="100%" maxW="1400px" mx="auto" mt="16px">
          <TabList>
            <Tab>Hardness</Tab>
            <Tab>Sartorius</Tab>
            <Tab>Moisture</Tab>
            <Tab>Mettler</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <Box overflow="auto">
                <HardnessPage />
              </Box>
            </TabPanel>
            {/* <TabPanel>
              <IPCPage />
            </TabPanel> */}
            <TabPanel>
              <Box overflow="auto">
                <Sartorius />
              </Box>
            </TabPanel>
            <TabPanel>
              <Moisture />
            </TabPanel>
            <TabPanel>
              <Mettler />
            </TabPanel>
          </TabPanels>
        </Tabs>
        </>
    </div>
  );
}

export default Instrument;