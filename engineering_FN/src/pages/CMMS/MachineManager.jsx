// src/pages/MachineManager.jsx

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
} from '@chakra-ui/react';
import { Delete, Add, Check, Edit, Refresh } from "@mui/icons-material";


function MachineManager() {
  // --- State Hooks ---
  const [machines, setMachines] = useState([]);
  const [machineName, setMachineName] = useState('');
  const [assetNumber, setAssetNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const toast = useToast();

  // --- READ ---
  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    try {
      // Calls your new GET /part/machines route
      const response = await fetch('http://10.126.15.197:8002/part/machines');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setMachines(data);
    } catch (err) {
      toast({
        title: 'Error fetching machines',
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
    setEditingId(null);
  };

  // --- CREATE ---
  const handleCreate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('http://10.126.15.197:8002/part/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_name: machineName,
          asset_number: assetNumber,
        }),
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.details || 'Failed to create machine');

      toast({
        title: 'Machine created.',
        description: `Successfully added ${machineName}.`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      clearForm();
      fetchMachines();
    } catch (err) {
      toast({
        title: 'Error creating machine',
        description: err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- UPDATE ---
  const handleEditClick = (machine) => {
    setEditingId(machine.machine_id);
    setMachineName(machine.machine_name);
    setAssetNumber(machine.asset_number);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`http://10.126.15.197:8002/part/machines/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_name: machineName,
          asset_number: assetNumber,
        }),
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.details || 'Failed to update machine');
      
      toast({
        title: 'Machine updated.',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      clearForm();
      fetchMachines();
    } catch (err) {
      toast({
        title: 'Error updating machine',
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
    if (!window.confirm('Are you sure you want to delete this machine? This cannot be undone.')) return;
    try {
      const response = await fetch(`http://10.126.15.197:8002/part/machines/${id}`, { method: 'DELETE' });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.details || 'Failed to delete machine');

      toast({
        title: 'Machine deleted.',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      fetchMachines();
    } catch (err) {
      toast({
        title: 'Error deleting machine',
        description: err.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

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
          onSubmit={editingId ? handleUpdate : handleCreate}
        >
          <Heading as="h2" size="lg" mb={6}>
            {editingId ? 'Edit Machine' : 'Add New Machine'}
          </Heading>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel>Machine Name</FormLabel>
              <Input
                type="text"
                placeholder="e.g., Chopper GEA PMA"
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Asset Number</FormLabel>
              <Input
                type="text"
                placeholder="e.g., CKR-02-03-010-010-020"
                value={assetNumber}
                onChange={(e) => setAssetNumber(e.target.value)}
              />
            </FormControl>

            <HStack w="full" mt={4}>
              <Button
                type="submit"
                colorScheme="blue"
                isLoading={isLoading}
                isFullWidth
              >
                {editingId ? 'Update Machine' : 'Save Machine'}
              </Button>
              {editingId && (
                <Button variant="ghost" onClick={clearForm} isFullWidth>
                  Cancel
                </Button>
              )}
            </HStack>
          </VStack>
        </Box>

        <Divider />

        {/* --- READ Table --- */}
        <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg">
          <Heading as="h2" size="lg" mb={6}>
            Machine Master List
          </Heading>
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Machine Name</Th>
                  <Th>Asset Number</Th>
                  <Th isNumeric>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {machines.length === 0 && (
                  <Tr>
                    <Td colSpan={3}>
                      <Text textAlign="center">No machines found.</Text>
                    </Td>
                  </Tr>
                )}
                {machines.map((machine) => (
                  <Tr key={machine.machine_id}>
                    <Td>{machine.machine_name}</Td>
                    <Td>{machine.asset_number}</Td>
                    <Td isNumeric>
                      <HStack spacing={2} justify="flex-end">
                        <IconButton
                          colorScheme="blue"
                          aria-label="Edit machine"
                          icon={<Edit />}
                          size="sm"
                          onClick={() => handleEditClick(machine)}
                        />
                        <IconButton
                          colorScheme="red"
                          aria-label="Delete machine"
                          icon={<Delete />}
                          size="sm"
                          onClick={() => handleDelete(machine.machine_id)}
                        />
                      </HStack>
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

export default MachineManager;