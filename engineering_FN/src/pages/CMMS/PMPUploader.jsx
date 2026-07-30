// src/pages/PMPUploader.jsx

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Heading, FormControl, FormLabel, Input, Button, VStack,
  Container, useToast, Table, Thead, Tbody, Tr, Th, Td,
  IconButton, Divider, HStack, Select, Badge, Radio, RadioGroup, Stack,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter,
  ModalBody, ModalCloseButton, useDisclosure, Text
} from '@chakra-ui/react';
import { Delete, Edit, Save } from "@mui/icons-material";
import Papa from 'papaparse'; // Import the CSV parser


// Helper for month names
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function PMPUploader() {
// --- State for Bulk Uploader ---
  const [stagedJobs, setStagedJobs] = useState([]);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const toast = useToast();
  const [uploadCategory, setUploadCategory] = useState('Maintenance'); // Default
  const [importCategory, setImportCategory] = useState('Maintenance');


  // --- State for CRUD Manager ---
  const [pendingJobs, setPendingJobs] = useState([]); // Holds the list from the DB
  const [machineList, setMachineList] = useState([]); // Holds all machines for dropdowns
  const [isLoading, setIsLoading] = useState(false);
  const [editingJob, setEditingJob] = useState(null); // Holds the job being edited
  const { isOpen, onOpen, onClose } = useDisclosure(); // For the Edit Modal

  // --- STATE: Filters (Default to Current Date) ---
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth()); // 0-11
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

// --- State for Forms ---
  const [newJobMachineId, setNewJobMachineId] = useState('');
  const [newJobWoNumber, setNewJobWoNumber] = useState('');

  // Fetch all data on load
  useEffect(() => {
    fetchPendingJobs();
    fetchMachineList();
  }, []);

  // --- 1. Parse the CSV file in the browser ---
// --- 2. CSV Parser (Smart Header Search + PM Number) ---
  // --- 2. CSV Parser (Smart Header Search + Category Detection) ---
  // --- 2. CSV Parser (Auto-Selects Category) ---
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        
        complete: (results) => {
          const rows = results.data;
          let headerRowIndex = -1;
          let woIndex = -1;
          let assetIndex = -1;
          let machineIndex = -1;
          let pmIndex = -1;

          // 1. Find the Real Header Row
          for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const row = rows[i].map(cell => cell ? cell.toString().toLowerCase().trim() : '');
            
            const wIdx = row.findIndex(cell => cell.includes('no') && cell.includes('wo'));
            const aIdx = row.findIndex(cell => cell.includes('asset') && cell.includes('number'));
            
            if (wIdx !== -1 && aIdx !== -1) {
                headerRowIndex = i;
                woIndex = wIdx;
                assetIndex = aIdx;
                machineIndex = row.findIndex(cell => cell.includes('nama') || cell.includes('machine'));
                
                // Check if "No. PM" column exists
                pmIndex = row.findIndex(cell => cell.includes('no') && cell.includes('pm'));
                break;
            }
          }

          if (headerRowIndex === -1) {
             toast({ title: "Header Detection Failed", status: "error" });
             return;
          }

          // 2. AUTO-DETECT CATEGORY
          // If we found the PM column, switch the radio button to 'Utility'
          const detectedCategory = pmIndex !== -1 ? 'Utility' : 'Maintenance';
          setUploadCategory(detectedCategory); // <--- THIS IS THE FIX

          // 3. Map Data - Skip A rows (metadata rows that have 'A' in wo_number column)
          const rawJobs = rows.slice(headerRowIndex + 1)
            .map((row) => ({
              machine_name: machineIndex !== -1 ? row[machineIndex] : 'Unknown', 
              asset_number: row[assetIndex],
              wo_number: row[woIndex],
            }))
            // Filter: Remove A-rows and rows without wo_number
            .filter(job => {
              const wo = job.wo_number ? job.wo_number.toString().trim() : '';
              // Skip if wo_number is empty, 'A', or doesn't contain 'PWO'
              return wo && wo !== 'A' && wo.toUpperCase().includes('PWO') && job.machine_name && job.machine_name !== 'Unknown';
            });

          // 4. Deduplication - Filter out PWOs already in database
          const existingWOs = new Set(pendingJobs.map(j => j.wo_number));
          const newJobs = rawJobs.filter(job => !existingWOs.has(job.wo_number));
          const duplicateCount = rawJobs.length - newJobs.length;

          setStagedJobs(newJobs);

          // Show detailed feedback
          if (rawJobs.length > 0) {
            let message = `Found ${rawJobs.length} total PWOs. `;
            if (duplicateCount > 0) {
              message += `${duplicateCount} already exist in database (skipped). `;
            }
            message += `${newJobs.length} new PWOs ready to upload.`;
            
            toast({
              title: "File Parsed",
              description: message,
              status: duplicateCount > 0 ? "warning" : "success"
            });
          }
        },
        error: (err) => {
            toast({ title: "Error parsing CSV", description: err.message, status: "error" });
        }
      });
    }
  };

  // --- 2. Handle deleting a row from the staging table ---
  const handleDeleteRow = (wo_number) => {
    // Filter out the row with the matching WO number
    const newJobs = stagedJobs.filter(job => job.wo_number !== wo_number);
    setStagedJobs(newJobs);
  };

  // --- 3. Send the FINAL JSON list to the backend ---
  // --- SAVE HANDLER (Sends Category) ---
  const handleSaveToPending = async () => {
        if (stagedJobs.length === 0) {
            toast({
                title: 'No data to save',
                description: 'Please upload a file and review the rows.',
                status: 'warning',
                duration: 5000,
                isClosable: true,
            });
            return;
        }

        setIsLoading(true);

        try {
            // ✅ UPDATED: We now send an object containing both 'jobs' and 'category'
            const payload = {
                jobs: stagedJobs,
                category: importCategory
            };

            console.log("Sending Payload:", payload);

            const response = await fetch('http://localhost:8002/api/bulk-import-pending', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload), 
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to import');
            }

            toast({
                title: 'Import Successful',
                description: `Successfully created ${result.createdCount} pending jobs in category: ${importCategory}.`,
                status: 'success',
                duration: 9000,
                isClosable: true,
            });

            // Clear the form and reset category
            setStagedJobs([]);
            setFileName('');
            setImportCategory('Maintenance'); // Optional: Reset to default

        } catch (err) {
            toast({
                title: 'Import Error',
                description: err.message,
                status: 'error',
                duration: 9000,
                isClosable: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

  // --- CRUD Functions ---

  const fetchPendingJobs = async () => {
    try {
      const response = await fetch('http://10.126.15.197:8002/part/pending-jobs');
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      setPendingJobs(data);
    } catch (err) {
      toast({ title: 'Error fetching pending jobs', status: 'error' });
    }
  };

  const fetchMachineList = async () => {
    try {
      const response = await fetch('http://10.126.15.197:8002/part/machines-list');
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      setMachineList(data);
    } catch (err) {
      toast({ title: 'Error fetching machines', status: 'error' });
    }
  };

  // --- FILTER LOGIC ---
  // 1. Get unique years from data + current year
  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    pendingJobs.forEach(job => {
      if (job.created_at) {
        years.add(new Date(job.created_at).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [pendingJobs]);

  // 2. Filter the jobs based on selection
  const filteredPendingJobs = pendingJobs.filter(job => {
    if (!job.created_at) return false;
    const date = new Date(job.created_at);
    if (isNaN(date.getTime())) return false;

    // Filter by Month (if not "All") and Year
    const matchMonth = filterMonth === "" || date.getMonth() === parseInt(filterMonth);
    const matchYear = date.getFullYear() === parseInt(filterYear);

    return matchMonth && matchYear;
  });

  // Handle CREATE
  const handleCreateJob = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('http://10.126.15.197:8002/part/pending-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: newJobMachineId,
          wo_number: newJobWoNumber,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create job');

      toast({ title: 'Pending job created', status: 'success' });
      setNewJobMachineId('');
      setNewJobWoNumber('');
      fetchPendingJobs(); // Refresh list
    } catch (err) {
      toast({ title: 'Error creating job', description: err.message, status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle UPDATE
  const openEditModal = (job) => {
    setEditingJob(job); // Set the job to be edited
    onOpen(); // Open the modal
  };

  const handleUpdateJob = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`http://10.126.15.197:8002/part/pending-job/${editingJob.pending_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: editingJob.machine_id,
          wo_number: editingJob.wo_number,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update job');

      toast({ title: 'Pending job updated', status: 'success' });
      onClose(); // Close modal
      setEditingJob(null);
      fetchPendingJobs(); // Refresh list
    } catch (err) {
      toast({ title: 'Error updating job', description: err.message, status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle DELETE
  const handleDeleteJob = async (id) => {
    if (!window.confirm('Are you sure you want to delete this pending job?')) return;
    try {
      await fetch(`http://10.126.15.197:8002/part/pending-job/${id}`, { method: 'DELETE' });
      toast({ title: 'Pending job deleted', status: 'info' });
      fetchPendingJobs(); // Refresh list
    } catch (err) {
      toast({ title: 'Error deleting job', status: 'error' });
    }
  };


return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Heading as="h2" size="lg">Manage PMP Database</Heading>

        {/* --- PART 1: BULK CSV UPLOADER --- */}
        <Box p={6} borderWidth={1} borderRadius="lg" boxShadow="md" bg="white">
          <Heading as="h3" size="md" mb={4}>Step 1: Bulk Import from CSV</Heading>
          <VStack spacing={4} align="stretch">
            
            {/* NEW: Category Selector */}
            {stagedJobs.length > 0 && (
                <Box mb={4} mt={4}>
                    <label style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
                        Select Category for Import:
                    </label>
                    <Select 
                        value={importCategory} 
                        onChange={(e) => setImportCategory(e.target.value)}
                        width="300px"
                    >
                        <option value="Maintenance">Maintenance</option>
                        <option value="Utility">Utility</option>
                    </Select>
                </Box>
            )}

            <FormControl>
              <FormLabel>Select Monthly PMP CSV File</FormLabel>
              <Input type="file" accept=".csv" onChange={handleFileChange} p={1} />
            </FormControl>
            {fileName && <Text fontSize="sm" color="gray.500">Selected: {fileName}</Text>}
            
            {stagedJobs.length > 0 && (
              
                <Box mt={4}>
                    <HStack justify="space-between" mb={2}>
                        <Text fontWeight="bold">Preview ({stagedJobs.length} rows)</Text>
                        <Button leftIcon={<Save />} colorScheme="blue" size="sm" onClick={handleSaveToPending} isLoading={isUploading}>
                            Save to Database
                        </Button>
                    </HStack>
                    <Box maxHeight="200px" overflowY="auto" border="1px solid #eee">
                        <Table size="sm" variant="simple">
                            <Thead><Tr><Th>WO Number</Th><Th>Machine</Th><Th>Asset</Th></Tr></Thead>
                            <Tbody>
                                {stagedJobs.slice(0, 10).map((job, i) => (
                                    <Tr key={i}><Td>{job.wo_number}</Td><Td>{job.machine_name}</Td><Td>{job.asset_number}</Td></Tr>
                                ))}
                            </Tbody>
                        </Table>
                    </Box>
                </Box>
            )}
          </VStack>
        </Box>

        <Divider />

        {/* --- PART 2: MANUAL ADD --- */}
        <Box p={6} borderWidth={1} borderRadius="lg" boxShadow="md" bg="white" as="form" onSubmit={handleCreateJob}>
          <Heading as="h3" size="md" mb={4}>Step 2: Add Single Job Manually</Heading>
          <HStack spacing={4} align="flex-end">
            <FormControl>
              <FormLabel>Machine</FormLabel>
              <Select placeholder="Select machine" value={newJobMachineId} onChange={(e) => setNewJobMachineId(e.target.value)}>
                {machineList.map(m => <option key={m.machine_id} value={m.machine_id}>{m.machine_name} ({m.asset_number})</option>)}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>WO Number</FormLabel>
              <Input placeholder="PWO-..." value={newJobWoNumber} onChange={(e) => setNewJobWoNumber(e.target.value)} />
            </FormControl>
            <Button type="submit" colorScheme="green" minW="100px">Add</Button>
          </HStack>
        </Box>

        <Divider />

        {/* --- PART 3: MANAGE PENDING LIST (With Filters) --- */}
        <Box p={6} borderWidth={1} borderRadius="lg" boxShadow="md" bg="white">
            <HStack justify="space-between" mb={4} align="flex-end">
                <Heading as="h3" size="md">Current Pending Jobs</Heading>
                
                {/* --- FILTERS --- */}
                <HStack spacing={2}>
                    <FormControl w="140px">
                        <FormLabel fontSize="xs" mb={0} color="gray.500">Month</FormLabel>
                        <Select 
                            size="sm" 
                            value={filterMonth} 
                            onChange={(e) => setFilterMonth(e.target.value)}
                        >
                            <option value="">All Months</option>
                            {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </Select>
                    </FormControl>
                    <FormControl w="100px">
                        <FormLabel fontSize="xs" mb={0} color="gray.500">Year</FormLabel>
                        <Select 
                            size="sm" 
                            value={filterYear} 
                            onChange={(e) => setFilterYear(e.target.value)}
                        >
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </Select>
                    </FormControl>
                </HStack>
            </HStack>
            
            <Box overflowX="auto" maxHeight="500px">
                <Table variant="simple">
                    <Thead position="sticky" top={0} zIndex={1} bg="gray.50">
                        <Tr>
                            <Th>WO Number</Th>
                            <Th>Machine Name</Th>
                            <Th>Asset Number</Th>
                            <Th>Created Date</Th>
                            <Th isNumeric>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {filteredPendingJobs.length === 0 ? (
                            <Tr><Td colSpan={5} textAlign="center" color="gray.500">
                                {pendingJobs.length === 0 
                                    ? "Database empty." 
                                    : `No jobs found for ${filterMonth !== "" ? MONTH_NAMES[filterMonth] : "selected month"} ${filterYear}.`}
                            </Td></Tr>
                        ) : (
                            filteredPendingJobs.map((job) => (
                                <Tr key={job.pending_id}>
                                    <Td fontWeight="bold">{job.wo_number}</Td>
                                    <Td>{job.machine_name}</Td>
                                    <Td>{job.asset_number}</Td>
                                    <Td>{job.created_at ? new Date(job.created_at).toLocaleDateString() : '-'}</Td>
                                    <Td isNumeric>
                                        <HStack justify="flex-end" spacing={2}>
                                            <IconButton icon={<Edit />} size="sm" onClick={() => openEditModal(job)} aria-label="Edit" />
                                            <IconButton icon={<Delete />} colorScheme="red" size="sm" onClick={() => handleDeleteJob(job.pending_id)} aria-label="Delete" />
                                        </HStack>
                                    </Td>
                                </Tr>
                            ))
                        )}
                    </Tbody>
                </Table>
            </Box>
        </Box>

        {/* Edit Modal */}
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent as="form" onSubmit={handleUpdateJob}>
                <ModalHeader>Edit Pending Job</ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={6}>
                    <VStack spacing={4}>
                        <FormControl isRequired>
                            <FormLabel>Machine</FormLabel>
                            <Select 
                                value={editingJob?.machine_id} 
                                onChange={(e) => setEditingJob({...editingJob, machine_id: e.target.value})}
                            >
                                {machineList.map(m => <option key={m.machine_id} value={m.machine_id}>{m.machine_name}</option>)}
                            </Select>
                        </FormControl>
                        <FormControl isRequired>
                            <FormLabel>WO Number</FormLabel>
                            <Input value={editingJob?.wo_number} onChange={(e) => setEditingJob({...editingJob, wo_number: e.target.value})} />
                        </FormControl>
                    </VStack>
                </ModalBody>
                <ModalFooter>
                    <Button onClick={onClose} mr={3}>Cancel</Button>
                    <Button colorScheme="blue" type="submit">Save Update</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>

      </VStack>
    </Container>
  );
}

export default PMPUploader;