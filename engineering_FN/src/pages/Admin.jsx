import React, { useEffect, useState } from "react";
import { Tabs, TabList, TabPanels, Tab, TabPanel, Box} from "@chakra-ui/react";
import AdminTabel from "./AdminTabel";
import LogLogin from "./LogLogin";


function Admin() {

  return (
    <div className="my-2">
      <>
        <Tabs variant='line' >
          <TabList>
            <Tab sx={{ outline: 'none', boxShadow: 'none' }} >
              User Tabel
            </Tab>
            <Tab sx={{ outline: 'none', boxShadow: 'none' }} >
              Log History User Login
            </Tab>
            <Tab sx={{ outline: 'none', boxShadow: 'none' }} >
              Settings
            </Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <Box overflow="auto">
                <AdminTabel />
              </Box>
            </TabPanel>
            <TabPanel>
              <LogLogin />
            </TabPanel>
            <TabPanel>
              <p>three!</p>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </>
    </div>
  );
}

export default Admin;
