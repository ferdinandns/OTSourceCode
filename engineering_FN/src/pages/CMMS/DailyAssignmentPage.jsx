// src/pages/DailyAssignmentPage.jsx

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
  Text,
  Divider,
  HStack,
  Checkbox,
  InputGroup,
  InputLeftElement,
  Select,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure
} from '@chakra-ui/react';
import { Search } from "@mui/icons-material";
import { Edit } from "@mui/icons-material";

// Helper constant for month names
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function DailyAssignmentPage() {
  const [pendingJobs, setPendingJobs] = useState([]); 
  const [selectedJobs, setSelectedJobs] = useState(new Set()); 
  const [scheduledDate, setScheduledDate] = useState(''); 
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); 

  // --- NEW STATE: Month and Year Filters ---
  // Default to CURRENT Month (0-11) and CURRENT Year
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth()); 
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const [technicianList, setTechnicianList] = useState([]); // List from DB
  const [selectedTech, setSelectedTech] = useState('');     // Selected Value

  // --- ASSIGNED JOBS STATE ---
  const [assignedJobs, setAssignedJobs] = useState([]);
  const [searchQueryAssigned, setSearchQueryAssigned] = useState('');
  const [filterMonthAssigned, setFilterMonthAssigned] = useState(new Date().getMonth());
  const [filterYearAssigned, setFilterYearAssigned] = useState(new Date().getFullYear());

  // --- EDIT MODAL STATE ---
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [editingJob, setEditingJob] = useState(null);
  const [editScheduledDate, setEditScheduledDate] = useState('');
  const [editTechnicianId, setEditTechnicianId] = useState('');

  const toast = useToast();

  useEffect(() => {
    fetchPendingJobs();
    fetchAssignedJobs();
    fetchTechnicians(); // <--- Fetch users on load
  }, []);

  const fetchPendingJobs = async () => {
    try {
      const response = await fetch('http://localhost:8002/part/pending-jobs');
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      setPendingJobs(data);
    } catch (err) {
      toast({ title: 'Error fetching pending jobs', status: 'error' });
    }
  };

  const fetchAssignedJobs = async () => {
    try {
      const response = await fetch('http://localhost:8002/part/getAssignedJobs');
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      setAssignedJobs(data);
    } catch (err) {
      toast({ title: 'Error fetching assigned jobs', status: 'error' });
    }
  };

  const handleEditClick = (job) => {
    setEditingJob(job);
    setEditScheduledDate(job.scheduled_date ? job.scheduled_date.split('T')[0] : '');
    setEditTechnicianId(job.technician_id || '');
    onOpen();
  };

  const handleUpdateJob = async () => {
    if (!editScheduledDate) {
      toast({ title: 'Please select a scheduled date', status: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8002/part/updateAssignedJob', {
        method: 'PUT', // Ensure your backend route is defined as router.put()
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // FIX: Use editingJob.id (from the fetch alias) but send it as pmp_id (for the backend)
          pmp_id: editingJob.id, 
          scheduled_date: editScheduledDate,
          technician_id: editTechnicianId || null
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        toast({ title: 'Success', description: 'Job updated successfully', status: 'success' });
        fetchAssignedJobs();
        onClose();
      } else {
        throw new Error(result.error || 'Failed to update'); // Changed result.message to result.error to catch backend errors
      }
    } catch (err) {
      console.error("Update Error:", err);
      toast({ title: 'Error', description: err.message, status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // 1. Fetch Users from Database
  const fetchTechnicians = async () => {
    try {
      const response = await fetch('http://localhost:8002/part/users');
      const data = await response.json();
      setTechnicianList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load technicians");
    }
  };

  const handleCheckboxChange = (jobId) => {
    const newSet = new Set(selectedJobs);
    if (newSet.has(jobId)) {
      newSet.delete(jobId);
    } else {
      newSet.add(jobId);
    }
    setSelectedJobs(newSet);
  };

  // --- GET UNIQUE YEARS FROM DATA ---
  // This ensures the dropdown contains years present in your database
  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()]); // Always include current year
    pendingJobs.forEach(job => {
      if (job.created_at) {
        years.add(new Date(job.created_at).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Sort descending (2025, 2024...)
  }, [pendingJobs]);

  // --- FILTERING LOGIC ---
  const filteredJobs = pendingJobs.filter((job) => {
    // 1. Text Search across WO number, machine name, and asset number
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
  (job.wo_number?.toLowerCase() || "").includes(query) ||
  (job.machine_name?.toLowerCase() || "").includes(query) ||
  (job.asset_number?.toLowerCase() || "").includes(query);
    
    // 2. Date Filter
    // We parse the DB date. If created_at is null, it fails the filter.
    if (!job.created_at) return false;

    const jobDate = new Date(job.created_at);
    
    // Check if valid date
    if (isNaN(jobDate.getTime())) return false;

    // Compare Month (0-11) and Year
    const matchesMonth = jobDate.getMonth() === parseInt(filterMonth);
    const matchesYear = jobDate.getFullYear() === parseInt(filterYear);

    return matchesSearch && matchesMonth && matchesYear;
  });

  // Count of pending PWOs in the selected month
  const pendingCount = filteredJobs.length;

  // --- FILTERING LOGIC FOR ASSIGNED JOBS ---
  const filteredAssignedJobs = assignedJobs.filter((job) => {
    const query = searchQueryAssigned.toLowerCase();
    const matchesSearch = 
      job.wo_number.toLowerCase().includes(query) ||
      (job.machine_name && job.machine_name.toLowerCase().includes(query)) ||
      (job.asset_number && job.asset_number.toLowerCase().includes(query));
    
    if (!job.scheduled_date) return false;
    const jobDate = new Date(job.scheduled_date);
    if (isNaN(jobDate.getTime())) return false;

    const matchesMonth = jobDate.getMonth() === parseInt(filterMonthAssigned);
    const matchesYear = jobDate.getFullYear() === parseInt(filterYearAssigned);

    return matchesSearch && matchesMonth && matchesYear;
  });

  const assignedCount = filteredAssignedJobs.length;

  const availableYearsAssigned = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    assignedJobs.forEach(job => {
      if (job.scheduled_date) {
        years.add(new Date(job.scheduled_date).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [assignedJobs]);

  const handleAssignJobs = async () => {
    if (selectedJobs.size === 0) {
      toast({ title: 'No jobs selected', status: 'warning' });
      return;
    }
    if (!scheduledDate) {
      toast({ title: 'Please select a scheduled date', status: 'warning' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8002/part/assign-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobIds: Array.from(selectedJobs),
          scheduled_date: scheduledDate,
          technician_id: selectedTech // <--- SEND SELECTION
        }),
      });

      const result = await response.json();
      
      if (response.status === 201) {
        toast({ title: 'Success', description: result.message, status: 'success' });
        setSelectedJobs(new Set());
        setScheduledDate('');
        setSelectedTech(''); // Reset dropdown
        fetchPendingJobs();
        fetchAssignedJobs(); 
      } else {
        throw new Error(result.message || 'Failed to assign');
      }
    } catch (err) {
      console.error("Assignment Error:", err); // <--- ADD THIS
      toast({ title: 'Error', description: err.message, status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Heading as="h2" size="lg">
          Daily PMP Job Management
        </Heading>

        <Tabs colorScheme="blue" variant="enclosed">
          <TabList>
            <Tab fontWeight="semibold">📋 Assign New Jobs</Tab>
            <Tab fontWeight="semibold">✏️ Update Assigned Jobs</Tab>
          </TabList>

          <TabPanels>
            {/* TAB 1: ASSIGN NEW JOBS */}
            <TabPanel>

       {/* --- Assignment Controls --- */}
        <Box p={6} borderWidth={1} borderRadius="lg" boxShadow="lg" bg="blue.50">
          <Heading as="h3" size="md" mb={4}>Assignment Controls</Heading>
          <HStack spacing={4} align="flex-end">
            
            <FormControl w="200px" isRequired>
              <FormLabel>Scheduled Date</FormLabel>
              <Input
                bg="white"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </FormControl>

            {/* --- NEW: Technician Dropdown --- */}
<FormControl w="250px">
                <FormLabel>Assign To (Optional)</FormLabel>
                <Select 
                    bg="white" 
                    placeholder="Select Technician..." 
                    value={selectedTech} // This will now hold the ID (e.g. 66)
                    onChange={(e) => setSelectedTech(e.target.value)}
                >
                    {technicianList.map((user) => (
                        // KEY CHANGE: Value is the ID, Label is the Name
                        <option key={user.id_users} value={user.id_users}>
                            {user.name}
                        </option>
                    ))}
                </Select>
            </FormControl>

            <Button
              colorScheme="blue"
              onClick={handleAssignJobs}
              isLoading={isLoading}
              minW="180px"
            >
              Assign {selectedJobs.size} Jobs
            </Button>
          </HStack>
        </Box>

        <Divider />

        {/* --- Pending Jobs Table --- */}
        <Box p={6} borderWidth={1} borderRadius="lg" boxShadow="lg">
          
          {/* Header + Filters Area */}
          <HStack justify="space-between" mb={4} wrap="wrap" spacing={4} align="flex-end">
            <HStack spacing={3}>
              <Heading as="h3" size="md" mb={1}>
                Pending Jobs List (Holding Pen)
              </Heading>
              <Badge colorScheme="blue" fontSize="md" px={3} py={1} borderRadius="full">
                {pendingCount} Pending
              </Badge>
            </HStack>
            
            <HStack spacing={3}>
                {/* --- MONTH SELECTOR --- */}
                <FormControl w="150px">
                    <FormLabel fontSize="xs" mb={0} color="gray.500">Filter Month</FormLabel>
                    <Select 
                        value={filterMonth} 
                        onChange={(e) => setFilterMonth(e.target.value)} 
                        size="md"
                        borderColor="gray.300"
                    >
                        {MONTH_NAMES.map((month, index) => (
                            <option key={index} value={index}>{month}</option>
                        ))}
                    </Select>
                </FormControl>

                {/* --- YEAR SELECTOR --- */}
                <FormControl w="100px">
                    <FormLabel fontSize="xs" mb={0} color="gray.500">Filter Year</FormLabel>
                    <Select 
                        value={filterYear} 
                        onChange={(e) => setFilterYear(e.target.value)} 
                        size="md"
                        borderColor="gray.300"
                    >
                        {availableYears.map((year) => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </Select>
                </FormControl>

                {/* --- Search Input --- */}
                <Box w="250px">
                    <FormLabel fontSize="xs" mb={0} color="gray.500">Search</FormLabel>
                    <InputGroup>
                        <InputLeftElement pointerEvents='none'>
                            <Search color='gray.300' />
                        </InputLeftElement>
                        <Input 
                            placeholder="PWO, Machine, or Asset..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </InputGroup>
                </Box>
            </HStack>
          </HStack>

          <Box 
  overflowY="auto"      // Enables vertical scrolling
  overflowX="auto"      // Enables horizontal scrolling (if table is wide)
  maxHeight="500px"     // Sets the limit. Table scrolls if content exceeds this.
  borderWidth="1px"     // Optional: Adds a border around the scrollable area
  borderRadius="lg"     // Optional: Rounds the corners
>
            <Table variant="simple">
              <Thead position="sticky" top={0} zIndex={1} bg="gray.50">
                <Tr>
                  <Th>Assign?</Th>
                  <Th>WO Number</Th>
                  <Th>Machine Name</Th>
                  <Th>Asset Number</Th>
                  <Th>Created Date</Th> 
                </Tr>
              </Thead>
              <Tbody>
                {filteredJobs.length === 0 && (
                  <Tr>
                    <Td colSpan={5}>
                      <Text textAlign="center" py={4} color="gray.500">
                        {pendingJobs.length === 0 
                            ? "No pending jobs found in database." 
                            : `No jobs found for ${MONTH_NAMES[filterMonth]} ${filterYear}.`}
                      </Text>
                    </Td>
                  </Tr>
                )}
                
                {filteredJobs.map((job) => (
                  <Tr key={job.pending_id}>
                    <Td>
                      <Checkbox
                        isChecked={selectedJobs.has(job.pending_id)}
                        onChange={() => handleCheckboxChange(job.pending_id)}
                      />
                    </Td>
                    <Td fontWeight="bold">{job.wo_number}</Td>
                    <Td>{job.machine_name}</Td>
                    <Td>{job.asset_number}</Td>
                    <Td>
                        {/* Show formatted date */}
                        {job.created_at ? new Date(job.created_at).toLocaleDateString('en-GB') : '-'}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
            </TabPanel>

            {/* TAB 2: UPDATE ASSIGNED JOBS */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                <Box p={6} borderWidth={1} borderRadius="lg" boxShadow="lg">
                  {/* Header + Filters Area */}
                  <HStack justify="space-between" mb={4} wrap="wrap" spacing={4} align="flex-end">
                    <HStack spacing={3}>
                      <Heading as="h3" size="md" mb={1}>
                        Assigned Jobs
                      </Heading>
                      <Badge colorScheme="green" fontSize="md" px={3} py={1} borderRadius="full">
                        {assignedCount} Assigned
                      </Badge>
                    </HStack>
                    
                    <HStack spacing={3}>
                      {/* --- MONTH SELECTOR --- */}
                      <FormControl w="150px">
                        <FormLabel fontSize="xs" mb={0} color="gray.500">Filter Month</FormLabel>
                        <Select 
                          value={filterMonthAssigned} 
                          onChange={(e) => setFilterMonthAssigned(e.target.value)} 
                          size="md"
                          borderColor="gray.300"
                        >
                          {MONTH_NAMES.map((month, index) => (
                            <option key={index} value={index}>{month}</option>
                          ))}
                        </Select>
                      </FormControl>

                      {/* --- YEAR SELECTOR --- */}
                      <FormControl w="100px">
                        <FormLabel fontSize="xs" mb={0} color="gray.500">Filter Year</FormLabel>
                        <Select 
                          value={filterYearAssigned} 
                          onChange={(e) => setFilterYearAssigned(e.target.value)} 
                          size="md"
                          borderColor="gray.300"
                        >
                          {availableYearsAssigned.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </Select>
                      </FormControl>

                      {/* --- Search Input --- */}
                      <Box w="250px">
                        <FormLabel fontSize="xs" mb={0} color="gray.500">Search</FormLabel>
                        <InputGroup>
                          <InputLeftElement pointerEvents='none'>
                            <Search color='gray.300' />
                          </InputLeftElement>
                          <Input 
                            placeholder="PWO, Machine, or Asset..." 
                            value={searchQueryAssigned}
                            onChange={(e) => setSearchQueryAssigned(e.target.value)}
                          />
                        </InputGroup>
                      </Box>
                    </HStack>
                  </HStack>

                  <Box 
                    overflowY="auto"
                    overflowX="auto"
                    maxHeight="500px"
                    borderWidth="1px"
                    borderRadius="lg"
                  >
                    <Table variant="simple">
                      <Thead position="sticky" top={0} zIndex={1} bg="gray.50">
                        <Tr>
                          <Th>WO Number</Th>
                          <Th>Machine Name</Th>
                          <Th>Asset Number</Th>
                          <Th>Scheduled Date</Th>
                          <Th>Assigned To</Th>
                          <Th>Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {filteredAssignedJobs.length === 0 && (
                          <Tr>
                            <Td colSpan={6}>
                              <Text textAlign="center" py={4} color="gray.500">
                                {assignedJobs.length === 0 
                                  ? "No assigned jobs found." 
                                  : `No jobs found for ${MONTH_NAMES[filterMonthAssigned]} ${filterYearAssigned}.`}
                              </Text>
                            </Td>
                          </Tr>
                        )}
                        
                        {filteredAssignedJobs.map((job) => (
                          <Tr key={job.pmp_id}>
                            <Td fontWeight="bold">{job.wo_number}</Td>
                            <Td>{job.machine_name}</Td>
                            <Td>{job.asset_number}</Td>
                            <Td>
                              {job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString('en-GB') : '-'}
                            </Td>
                            <Td>{job.technician_name || 'Unassigned'}</Td>
                            <Td>
                              <IconButton
                                icon={<Edit />}
                                size="sm"
                                colorScheme="blue"
                                aria-label="Edit job"
                                onClick={() => handleEditClick(job)}
                              />
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </Box>
                </Box>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* EDIT MODAL */}
        <Modal isOpen={isOpen} onClose={onClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Update Job Assignment</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>WO Number</FormLabel>
                  <Input value={editingJob?.wo_number || ''} isReadOnly bg="gray.100" />
                </FormControl>

                <FormControl>
                  <FormLabel>Machine</FormLabel>
                  <Input value={editingJob?.machine_name || ''} isReadOnly bg="gray.100" />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>Scheduled Date</FormLabel>
                  <Input
                    type="date"
                    value={editScheduledDate}
                    onChange={(e) => setEditScheduledDate(e.target.value)}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Assign To</FormLabel>
                  <Select 
                    placeholder="Select Technician..." 
                    value={editTechnicianId} 
                    onChange={(e) => setEditTechnicianId(e.target.value)}
                  >
                    {technicianList.map((user) => (
                      <option key={user.id_users} value={user.id_users}>
                        {user.name}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </VStack>
            </ModalBody>

            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={handleUpdateJob} isLoading={isLoading}>
                Update Job
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

      </VStack>
    </Container>
  );
}

export default DailyAssignmentPage;