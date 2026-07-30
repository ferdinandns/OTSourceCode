// src/pages/EBRDataExporter.jsx

import React, { useState } from 'react';
import {
  Box, Heading, FormControl, FormLabel, Input, Button, VStack,
  Container, useToast, Text, Table, Thead, Tbody, Tr, Th, Td,
  Divider, HStack,
} from '@chakra-ui/react';
import * as XLSX from 'xlsx';

// Helper function to make dates readable in the table
const formatDateTime = (unixTimestamp) => {
  if (!unixTimestamp) return 'N/A';
  try {
    // Convert Unix timestamp (seconds) to milliseconds
    return new Date(unixTimestamp * 1000).toLocaleString(); 
  }
  catch (e) { return 'Invalid Date'; }
};

function EBRDataExporter() {
  // --- State Hooks ---
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // --- State for Filters ---
  // These states will still hold the string from the <Input>
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [batch, setBatch] = useState('');

  // --- 1. Fetch Data from Backend (UPDATED) ---
  const fetchData = async () => {
    if (!startTime || !endTime) {
      toast({
        title: 'Missing Date Range',
        description: 'Please select both a start and end time.',
        status: 'warning',
        isClosable: true,
      });
      return;
    }

    setIsLoading(true);

    // --- THIS IS THE FIX ---
    // 1. Convert the date strings (e.g., "2025-10-13T10:00") into Date objects
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    // 2. Convert the Date objects into Unix timestamps (in seconds)
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);
    // --- END OF FIX ---


    // 3. Build the query string with the new timestamps
    const params = new URLSearchParams();
    params.append('start_time', startTimestamp); // Send the timestamp
    params.append('end_time', endTimestamp);   // Send the timestamp
    if (batch) params.append('batch', batch);

    try {
      const response = await fetch(`http://localhost:8002/part/ebr-data-export?${params.toString()}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || 'Network response was not ok');
      }
      const result = await response.json();
      setData(result);
      if (result.length === 0) {
        toast({ title: 'No data found', status: 'info', isClosable: true });
      }
    } catch (err) {
      toast({ title: 'Error fetching data', description: err.message, status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2. Export Data to Excel ---
  const handleExport = () => {
    if (data.length === 0) {
      toast({ title: 'No data to export', status: 'warning', isClosable: true });
      return;
    }

    // We need to format the timestamp *before* exporting
    const formattedData = data.map(row => ({
      ...row,
      timestamp: formatDateTime(row.timestamp), // Convert timestamp to readable date
    }));

    // 1. Create a new "worksheet" from our JSON data
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    
    // 2. Create a new "workbook"
    const workbook = XLSX.utils.book_new();
    
    // 3. Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'EBR_Data');

    // 4. (Optional) Set column widths
// Set column widths
    worksheet["!cols"] = [
      { wch: 25 }, // timestamp
      { wch: 15 }, // batch_id
      { wch: 15 }, // process_id
      { wch: 15 }, // Chopper RPM
      { wch: 18 }, // Chopper Current
      { wch: 15 }, // Impeller RPM
      { wch: 18 }, // Impeller Current
      { wch: 15 }, // Impeller KWh
    ];

    // 5. Trigger the file download in the browser
    XLSX.writeFile(workbook, `EBR_Data_Export_${batch || ''}.xlsx`);
  };

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Heading as="h2" size="lg">
          EBR Data Exporter (FBD Impeller)
        </Heading>

        {/* --- 1. Filter Controls --- */}
        <Box p={6} borderWidth={1} borderRadius="lg" boxShadow="lg">
          <Heading as="h3" size="md" mb={4}>Filter Data</Heading>
          <VStack spacing={4}>
            <HStack w="full" spacing={4}>
              <FormControl isRequired>
                <FormLabel>Start Time</FormLabel>
                <Input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>End Time</FormLabel>
                <Input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </FormControl>
            </HStack>
            <FormControl>
              <FormLabel>Batch (data_format_0)</FormLabel>
              <Input
                type="text"
                placeholder="Enter exact batch name (optional)"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
              />
            </FormControl>
            <Button colorScheme="blue" onClick={fetchData} isLoading={isLoading}>
              Fetch Data
            </Button>
          </VStack>
        </Box>

        {/* --- 2. Data Preview Table --- */}
        <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg">
          <HStack justify="space-between" mb={4}>
            <Heading as="h3" size="md">
              Results ({data.length} rows)
            </Heading>
            <Button
              colorScheme="green"
              onClick={handleExport}
              isDisabled={data.length === 0}
            >
              Export to Excel
            </Button>
          </HStack>
          <Box overflowX="auto" maxH="600px" overflowY="auto">
            <Table variant="simple">
  <Thead>
    <Tr>
      <Th>Timestamp</Th>
      <Th>Batch ID</Th>
      <Th>Process ID</Th>
      <Th isNumeric>Chopper RPM</Th>
      <Th isNumeric>Chopper Current</Th>
      <Th isNumeric>Impeller RPM</Th>
      <Th isNumeric>Impeller Current</Th>
      <Th isNumeric>Impeller KWh</Th>
    </Tr>
  </Thead>
  <Tbody>
    {isLoading && (
      <Tr><Td colSpan={8} textAlign="center">Loading...</Td></Tr>
    )}
    {!isLoading && data.length === 0 && (
      <Tr><Td colSpan={8} textAlign="center">No data found. Adjust filters and "Fetch Data".</Td></Tr>
    )}
    {data.map((row, index) => (
      <Tr key={`${row.timestamp}-${index}`}>
        <Td>{formatDateTime(row.timestamp)}</Td>
        <Td>{row.batch_id}</Td>
        <Td>{row.process_id}</Td>
        <Td isNumeric>{row['Chopper RPM']}</Td>
        <Td isNumeric>{row['Chopper Current']}</Td>
        <Td isNumeric>{row['Impeller RPM']}</Td>
        <Td isNumeric>{row['Impeller Current']}</Td>
        <Td isNumeric>{row['Impeller KWh']}</Td>
      </Tr>
    ))}
  </Tbody>
</Table>
          </Box>
        </Box>
      </VStack>
    </Container>
  );
}

export default EBRDataExporter;