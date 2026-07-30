// src/pages/OperationsManager.jsx

import React, { useState, useEffect } from 'react';
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
  HStack,
  Select,
  List,
  ListItem,
  ListIcon,
} from '@chakra-ui/react';
import { Delete, Add, Check } from "@mui/icons-material";

function OperationsManager() {
  // --- State Hooks ---
  const [machineList, setMachineList] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  
  // State for the machine name typed by the user
  const [machineNameInput, setMachineNameInput] = useState('');

  const [currentOperations, setCurrentOperations] = useState([]);
  
  // States for the batch list builder
  const [currentOperationInput, setCurrentOperationInput] = useState(''); // Text in the "add" input
  const [operationsList, setOperationsList] = useState([]); // The list of operations to be added
  const [allOperationsList, setAllOperationsList] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // --- Data Fetching ---
  useEffect(() => {
    fetchMachineList();
    fetchAllOperationsList();
  }, []);

  // Fetch operations when a valid machine ID is selected
  useEffect(() => {
    if (selectedMachineId) {
      fetchOperationsForMachine(selectedMachineId);
    } else {
      setCurrentOperations([]); // Clear table if no machine is selected
    }
  }, [selectedMachineId]);

  const fetchMachineList = async () => {
    try {
      const response = await fetch('http://10.126.15.197:8002/part/machines-list');
      const data = await response.json();
      setMachineList(data);
    } catch (err) {
      toast({ title: 'Error fetching machines', status: 'error' });
    }
  };

  const fetchAllOperationsList = async () => {
    try {
      const response = await fetch('http://10.126.15.197:8002/part/all-operations-list');
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      setAllOperationsList(data); // data is now an array of strings
    } catch (err) {
      toast({ title: 'Error fetching operations list', status: 'warning' });
    }
  };

  const fetchOperationsForMachine = async (machineId) => {
    try {
      const response = await fetch(`http://10.126.15.197:8002/part/default-operations/${machineId}`);
      if (!response.ok) throw new Error('Server responded with an error');
      const data = await response.json();
      setCurrentOperations(data);
    } catch (err) {
      toast({ title: 'Error fetching operations', status: 'error' });
      setCurrentOperations([]);
    }
  };

  // --- Handlers ---

  // REVISED: Handler for the machine autofill input
  // Searches by the unique combined string: "Machine Name [Asset Number]"
  const handleMachineNameChange = (value) => {
    setMachineNameInput(value);
    
    // Find the machine where the COMBINED string matches the input value
    const selectedMachine = machineList.find(machine => {
        const uniqueString = `${machine.machine_name} [${machine.asset_number}]`;
        return uniqueString === value;
    });

    if (selectedMachine) {
      setSelectedMachineId(selectedMachine.machine_id); // Set the correct unique ID
    } else {
      setSelectedMachineId(''); // Clear the ID if no exact match found yet
    }
  };

  // Handler to add an operation to the temporary list
  const handleAddToList = () => {
    if (currentOperationInput.trim() === '') return;
    setOperationsList([...operationsList, currentOperationInput.trim()]);
    setCurrentOperationInput(''); // Clear the input
  };

  // Handler to save the entire batch to the DB
  const handleSaveBatch = async (e) => {
    e.preventDefault();
    if (!selectedMachineId || operationsList.length === 0) {
      toast({ title: 'Please select a machine and add at least one operation', status: 'warning' });
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('http://10.126.15.197:8002/part/default-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: selectedMachineId,
          descriptions: operationsList, // Send the array
        }),
      });

      if (!response.ok) throw new Error('Failed to save operations');
      
      toast({ title: 'Operations added successfully', status: 'success' });
      setOperationsList([]); // Clear the list
      fetchOperationsForMachine(selectedMachineId); // Refresh the table

    } catch (err) {
      toast({ title: 'Error creating operations', status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (operationId) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      // Calls the delete endpoint
      await fetch(`http://10.126.15.197:8002/part/default-operations/${operationId}`, {
        method: 'DELETE',
      });
      toast({ title: 'Operation deleted', status: 'info' });
      fetchOperationsForMachine(selectedMachineId); // Refresh the list
    } catch (err) {
      toast({ title: 'Error deleting operation', status: 'error' });
    }
  };

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Heading as="h2" size="lg">
          Manage Preset Operations
        </Heading>

        {/* --- 1. Machine Selector (Updated for Unique Selection) --- */}
        <FormControl>
          <FormLabel>Select a Machine to Edit</FormLabel>
          <Input
            placeholder="Type machine name or asset number..."
            value={machineNameInput}
            onChange={(e) => handleMachineNameChange(e.target.value)}
            list="machine-list"
            autoComplete="off"
          />
          <datalist id="machine-list">
            {machineList.map((machine) => (
              // KEY CHANGE: The 'value' must be the full unique string so the input matches exactly.
              <option 
                key={machine.machine_id} 
                value={`${machine.machine_name} [${machine.asset_number}]`}
              >
                {/* Optional helper text depending on browser implementation */}
                Asset: {machine.asset_number}
              </option>
            ))}
          </datalist>
        </FormControl>

        <Divider />

        {/* --- 2. Create Operation Form --- */}
        <Box
          p={6}
          borderWidth={1}
          borderRadius="lg"
          boxShadow="lg"
          as="form"
          onSubmit={handleSaveBatch} // Form submits the whole batch
        >
          <Heading as="h3" size="md" mb={4}>
            Add New Operations (Batch)
          </Heading>
          <HStack>
           <FormControl> 
              <FormLabel>Operation Description</FormLabel>
              <Input
                placeholder="Type or select an operation..."
                value={currentOperationInput}
                onChange={(e) => setCurrentOperationInput(e.target.value)}
                isDisabled={!selectedMachineId}
                list="operations-datalist" 
              />
              <datalist id="operations-datalist">
                {allOperationsList.map((op, index) => (
                  <option key={index} value={op} />
                ))}
              </datalist>
            </FormControl>
            <Button
              colorScheme="green"
              aria-label="Add to list"
              icon={<Add />}
              alignSelf="flex-end"
              isDisabled={!selectedMachineId}
              onClick={handleAddToList} // This button adds to the list, not the DB
            >
              Add
            </Button>
          </HStack>
          
          {/* --- The list of operations to be added --- */}
          {operationsList.length > 0 && (
            <VStack align="stretch" mt={4}>
              <Text as="b">Operations to be saved:</Text>
              <List spacing={2}>
                {operationsList.map((op, index) => (
                  <ListItem key={index}>
                    <ListIcon as={Check} color="green.500" />
                    {op}
                  </ListItem>
                ))}
              </List>
              <Button
                type="submit"
                colorScheme="blue"
                isLoading={isLoading}
                mt={4}
              >
                Save All {operationsList.length} Operations
              </Button>
            </VStack>
          )}
        </Box>

        {/* --- 3. Read/Delete Table --- */}
        <Box p={6} borderWidth={1} borderRadius="lg" boxShadow="lg">
          <Heading as="h3" size="md" mb={4}>
            Current Preset Operations
          </Heading>
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Description</Th>
                  <Th isNumeric>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {currentOperations.length === 0 && (
                  <Tr>
                    <Td colSpan={2}>
                      <Text textAlign="center">
                        {selectedMachineId ? 'No operations found.' : 'Please select a machine.'}
                      </Text>
                    </Td>
                  </Tr>
                )}
                {currentOperations.map((op) => (
                  <Tr key={op.default_op_id}>
                    <Td>{op.description}</Td>
                    <Td isNumeric>
                      <IconButton
                        colorScheme="red"
                        aria-label="Delete operation"
                        icon={<Delete />}
                        size="sm"
                        onClick={() => handleDelete(op.default_op_id)}
                      />
                    </Td>
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

export default OperationsManager;