// src/pages/Excel.js

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Button,
  VStack,
  Container,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  Text,
  Divider,
  HStack, // We'll use this to group the action buttons
  Textarea, // Using Textarea for the description
  Select
} from '@chakra-ui/react';
import { Delete, Refresh } from "@mui/icons-material";
  

const months = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function PMPDataEditor() {
const [records, setRecords] = useState([]);
const [machineList, setMachineList] = useState([]); // <-- NEW: Holds the master machine list

  const [machineName, setMachineName] = useState('');
  const [assetNumber, setAssetNumber] = useState('');
  const [woNumber, setWoNumber] = useState('');
  const [operations, setOperations] = useState('');
  const [month, setMonth] = useState(''); // <-- 2. Add new state for month
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const toast = useToast();

  // --- NEW: Create unique suggestion lists ---
  const uniqueMachineNames = useMemo(() => {
    // A 'Set' automatically handles duplicates
    return [...new Set(records.map(record => record.machine_name))];
  }, [records]); // This list will only update when 'records' changes

  const uniqueAssetNumbers = useMemo(() => {
    return [...new Set(records.map(record => record.asset_number))];
  }, [records]);

  // --- NEW: Create Lookup Maps ---
  // We use useMemo so these maps are only rebuilt when the 'records' data changes.
const { nameToAssetMap, assetToNameMap } = useMemo(() => {
    const nameMap = new Map();
    const assetMap = new Map();
    for (const machine of machineList) { // <-- CHANGED from 'records'
      if (machine.machine_name && machine.asset_number) {
        nameMap.set(machine.machine_name, machine.asset_number);
        assetMap.set(machine.asset_number, machine.machine_name);
      }
    }
    return { nameToAssetMap: nameMap, assetToNameMap: assetMap };
  }, [machineList]); // <-- CHANGED dependency to 'machineList'

  // --- Data Fetching ---
  useEffect(() => {
    fetchRecords(); // Fetches the main PMP data
    fetchMachineList(); // <-- NEW: Fetches the master machine list
  }, []);

// --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  // 1. Convert rowsPerPage to state, default to 5
  const [rowsPerPage, setRowsPerPage] = useState(5); 

  // ... (fetchRecords, clearForm, handleCreate, handleEditClick, handleUpdate, handleDelete functions are all the same) ...

  // --- Pagination Logic ---
  // These calculations now use the 'rowsPerPage' state and will update automatically
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentData = records.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(records.length / rowsPerPage);

  // --- Pagination Handlers ---
  const handlePrevPage = () => {
    setCurrentPage((prev) => (prev > 1 ? prev - 1 : prev));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => (prev < totalPages ? prev + 1 : prev));
  };

  // 2. Add the new handler function for the dropdown
  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(Number(event.target.value));
    setCurrentPage(1); // Reset to page 1 when rows per page changes
  };

  // --- READ ---
  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      const response = await fetch('http://10.126.15.197:8002/part/pmp-data');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setRecords(data);
    } catch (err) {
      console.error('Error fetching records:', err);
      toast({
        title: 'Error fetching records',
        description: err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // --- Form Reset Function ---
  const clearForm = () => {
    setMachineName('');
    setAssetNumber('');
    setWoNumber('');
    setOperations('');
    setEditingId(null); // Go back to "Create" mode
  };

  // --- NEW: Smart Change Handlers ---
  const handleMachineNameChange = (value) => {
    setMachineName(value); // Update the machine name state
    
    // Check our map. If this name has a matching asset, fill it in.
    const matchingAsset = nameToAssetMap.get(value);
    if (matchingAsset) {
      setAssetNumber(matchingAsset);
    }
  };

  const handleAssetNumberChange = (value) => {
    setAssetNumber(value); // Update the asset number state

    // Check our other map. If this asset has a matching name, fill it in.
    const matchingName = assetToNameMap.get(value);
    if (matchingName) {
      setMachineName(matchingName);
    }
  };

  const fetchMachineList = async () => {
    try {
      const response = await fetch('http://10.126.15.197:8002/part/machines-list');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setMachineList(data);
    } catch (err) {
      console.error('Error fetching machine list:', err);
      toast({
        title: 'Error fetching machine list',
        description: "Could not load autofill suggestions. " + err.message,
        status: 'warning',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // --- CREATE ---
  const handleCreate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('http://10.126.15.197:8002/part/pmp-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_name: machineName,
          asset_number: assetNumber,
          wo_no: woNumber,
          operations: operations,
          month: month,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || 'Failed to create record');
      }

      toast({
        title: 'Record created.',
        description: `Successfully added ${machineName}.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      clearForm();
      fetchRecords();

    } catch (err) {
      toast({
        title: 'Error creating record',
        description: err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- NEW: UPDATE ---
  // 1. Function to load record data into the form
  const handleEditClick = (record) => {
    setEditingId(record.record_id);
    setMachineName(record.machine_name);
    setAssetNumber(record.asset_number);
    setWoNumber(record.wo_no);
    setOperations(record.operations);
    setMonth(record.month);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to see the form
  };

  // 2. Function to handle the update submission
  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`http://10.126.15.197:8002/part/pmp-data/${editingId}`, {
        method: 'PUT', // Use PUT for updates
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_name: machineName,
          asset_number: assetNumber,
          wo_no: woNumber,
          operations: operations,
        month: month,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || 'Failed to update record');
      }
      
      toast({
        title: 'Record updated.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      clearForm();
      fetchRecords();

    } catch (err) {
      toast({
        title: 'Error updating record',
        description: err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };


  // --- DELETE ---
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    try {
      // Small fix: capture the response to check it
      const response = await fetch(`http://10.126.15.197:8002/part/pmp-data/${id}`, { method: 'DELETE' });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || 'Failed to delete record');
      }

      toast({
        title: 'Record deleted.',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      fetchRecords(); // Refresh the list
    } catch (err) {
      toast({
        title: 'Error deleting record',
        description: err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // --- Component Render (JSX) ---
  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        
        {/* --- DYNAMIC CREATE/UPDATE Form --- */}
        <Box 
          p={8} 
          borderWidth={1} 
          borderRadius="lg" 
          boxShadow="lg"
          as="form" 
          // 3. Dynamically choose which function to call
          onSubmit={editingId ? handleUpdate : handleCreate}
        >
          <Heading as="h2" size="lg" mb={6}>
            {/* 4. Dynamically change the title */}
            {editingId ? 'Edit PMP Record' : 'Create New PMP Record'}
          </Heading>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Machine Name</FormLabel>
              <Input
                type="text"
                placeholder="e.g., Chopper GEA PMA"
                value={machineName}
                onChange={(e) => handleMachineNameChange(e.target.value)}
                list="machine-name-list"
              />
              <datalist id="machine-name-list">
                {/* This datalist is now built from the 'nameToAssetMap' */}
                {[...nameToAssetMap.keys()].map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Asset Number</FormLabel>
              <Input
                type="text"
                placeholder="e.g., CKR-02-03-010-010-020"
                value={assetNumber}
                onChange={(e) => handleAssetNumberChange(e.target.value)}
                list="asset-number-list"
              />
             <datalist id="asset-number-list">
                {/* This datalist is now built from the 'assetToNameMap' */}
                {[...assetToNameMap.keys()].map((asset) => (
                  <option key={asset} value={asset} />
                ))}
              </datalist>
              
            </FormControl>

            <FormControl>
              <FormLabel>WO Number</FormLabel>
              <Input
                type="text"
                placeholder="e.g., PWO-296235"
                value={woNumber}
                onChange={(e) => setWoNumber(e.target.value)}
              />
            </FormControl>

            <FormControl>
              <FormLabel>Operations</FormLabel>
              {/* Changed to Textarea for more space */}
              <Textarea
                placeholder="Enter a short description of what to do..."
                value={operations}
                onChange={(e) => setOperations(e.target.value)}
              />
            </FormControl>

            {/* 7. Add new FormControl for Month */}
            <FormControl>
              <FormLabel>Month</FormLabel>
              <Select 
                placeholder="Select month" 
                value={month} 
                onChange={(e) => setMonth(e.target.value)}
              >
                {months.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </FormControl>

            <HStack w="full" mt={4}>
              <Button
                type="submit"
                colorScheme="blue"
                isLoading={isLoading}
                isFullWidth
              >
                {/* 5. Dynamically change the button text */}
                {editingId ? 'Update Record' : 'Save Record'}
              </Button>
              
              {/* 6. Show a "Cancel" button only when editing */}
              {editingId && (
                <Button
                  variant="ghost"
                  onClick={clearForm}
                  isFullWidth
                >
                  Cancel
                </Button>
              )}
            </HStack>
          </VStack>
        </Box>

        <Divider />

        {/* --- READ Table --- */}
        {/* --- READ Table --- */}
        <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg">
          <Heading as="h2" size="lg" mb={6}>
            Existing Records
          </Heading>

          {/* This is your new Select component */}
           <Text>Rows</Text>
            <Select
              value={rowsPerPage}
              onChange={handleRowsPerPageChange}
              width="100px"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
              <option value={100}>100</option>
            </Select>
          
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Machine Name</Th>
                  <Th>Asset Number</Th>
                  <Th>WO Number</Th>
                  <Th>Month</Th>
                  <Th>Operations</Th>
                  <Th isNumeric>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {records.length === 0 && (
                  <Tr>
                    <Td colSpan={6}>
                      <Text textAlign="center">No records found.</Text>
                    </Td>
                  </Tr>
                )}
                
                {/* --- 2. Update map to use 'currentData' --- */}
                {currentData.map((record) => (
                  <Tr key={record.record_id}>
                    <Td>{record.machine_name}</Td>
                    <Td>{record.asset_number}</Td>
                    <Td>{record.wo_no}</Td>
                    <Td>{record.month}</Td>
                    <Td maxW="300px" whiteSpace="pre-wrap">{record.operations}</Td>
                    <Td isNumeric>
                      <HStack spacing={2} justify="flex-end">
                        <IconButton
                          colorScheme="blue"
                          aria-label="Edit record"
                          icon={<Refresh />}
                          size="sm"
                          onClick={() => handleEditClick(record)}
                        />
                        <IconButton
                          colorScheme="red"
                          aria-label="Delete record"
                          icon={<Delete />}
                          size="sm"
                          onClick={() => handleDelete(record.record_id)}
                        />
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {/* --- 3. Add Pagination Controls --- */}
          <HStack spacing={4} justify="center" mt={8}>
            <Button 
              onClick={handlePrevPage} 
              isDisabled={currentPage === 1} 
              colorScheme="blue"
            >
              Previous
            </Button>
            <Text>
              Page {currentPage} of {totalPages}
            </Text>
            <Button 
              onClick={handleNextPage} 
              isDisabled={currentPage === totalPages || records.length === 0} 
              colorScheme="blue"
            >
              Next
            </Button>
            
          </HStack>

        </Box>
        
      </VStack>
    </Container>
  );
}

export default PMPDataEditor;