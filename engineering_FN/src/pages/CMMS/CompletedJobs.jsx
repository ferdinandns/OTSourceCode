import React, { useState, useEffect } from 'react';
import {
  Box, Heading, Button, VStack, Container, useToast, Table, Thead, Tbody,
  Tr, Th, Td, Text, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalFooter, ModalBody, ModalCloseButton, FormControl,
  FormLabel, Select, Divider, HStack, Badge, Input // Added Badge for styling
} from '@chakra-ui/react';

const formatDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return 'N/A';
  try { return new Date(dateTimeStr).toLocaleString(); }
  catch (e) { return 'Invalid Date'; }
};

// Helper for just the date (no time) for approved_date
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try { return new Date(dateStr).toLocaleDateString(); }
    catch (e) { return 'Invalid Date'; }
};

const months = [
  { num: 1, name: 'January' }, { num: 2, name: 'February' }, { num: 3, name: 'March' },
  { num: 4, name: 'April' }, { num: 5, name: 'May' }, { num: 6, name: 'June' },
  { num: 7, name: 'July' }, { num: 8, name: 'August' }, { num: 9, name: 'September' },
  { num: 10, name: 'October' }, { num: 11, name: 'November' }, { num: 12, name: 'December' },
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 2 }, (_, i) => currentYear - i);

function CompletedJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  // --- CHANGED: Default to CURRENT Month and Year ---
  // Note: getMonth() returns 0 for Jan, so we add +1 to match your 'months' array values
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1); 
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterDate, setFilterDate] = useState(''); // <--- NEW: Specific Date Filter

  const [selectedJob, setSelectedJob] = useState(null);
  const [jobOperations, setJobOperations] = useState([]);
  const { isOpen, onOpen, onClose } = useDisclosure();

useEffect(() => {
    fetchJobs();
  }, [filterMonth, filterYear, filterDate]);

  const fetchJobs = async () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    
// Logic: If Date is set, send Date. Otherwise send Month/Year.
    if (filterDate) {
        params.append('date', filterDate);
    } else {
        if (filterMonth) params.append('month', filterMonth);
        if (filterYear) params.append('year', filterYear);
    }

    try {
      const response = await fetch(`http://10.126.15.197:8002/part/completed-jobs?${params.toString()}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setJobs(data);
    } catch (err) {
      toast({ title: 'Error fetching jobs', description: err.message, status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOperations = async (workOrderId) => {
    try {
      const response = await fetch(`http://10.126.15.197:8002/part/work-order-operations/${workOrderId}`);
      if (!response.ok) throw new Error('Could not fetch operations');
      const data = await response.json();
      setJobOperations(data);
    } catch (err) {
      toast({ title: 'Error fetching operations list', status: 'error' });
      setJobOperations([]);
    }
  };

  // UX Handler: When user picks a Specific Date, clear Month/Year to avoid confusion
  const handleDateChange = (e) => {
      setFilterDate(e.target.value);
      if(e.target.value) {
          setFilterMonth('');
          setFilterYear('');
      }
  };

  // UX Handler: When user picks Month/Year, clear Specific Date
  const handleMonthYearChange = (type, val) => {
      setFilterDate(''); // Clear specific date
      if(type === 'month') setFilterMonth(val);
      if(type === 'year') setFilterYear(val);
  };

  const handleFilterClick = () => { fetchJobs(); };
  
const handleClearFilters = () => {
    setFilterMonth('');
    setFilterYear('');
    setFilterDate('');
  };
  
  const handleViewDetails = (job) => {
    setSelectedJob(job);
    fetchOperations(job.work_order_id);
    onOpen();
  };

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Heading as="h2" size="lg">Completed PMP History</Heading>

        {/* --- Filter Controls --- */}
        <Box p={6} borderWidth={1} borderRadius="lg" boxShadow="lg">
          <Heading as="h3" size="md" mb={4}>Filter by Date Completed</Heading>
          <HStack spacing={4} align="flex-end" flexWrap="wrap">
            
            {/* 1. Month Dropdown */}
            <FormControl w="150px">
              <FormLabel>Month</FormLabel>
              <Select 
                placeholder="Select Month" 
                value={filterMonth} 
                onChange={(e) => handleMonthYearChange('month', e.target.value)}
              >
                {months.map((m) => <option key={m.num} value={m.num}>{m.name}</option>)}
              </Select>
            </FormControl>

            {/* 2. Year Dropdown */}
            <FormControl w="100px">
              <FormLabel>Year</FormLabel>
              <Select 
                placeholder="Year" 
                value={filterYear} 
                onChange={(e) => handleMonthYearChange('year', e.target.value)}
              >
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </FormControl>

            <Text fontWeight="bold" pb={2}>OR</Text>

            {/* 3. NEW: Specific Date Filter */}
            <FormControl w="180px">
              <FormLabel>Specific Date</FormLabel>
              <Input 
                type="date" 
                value={filterDate} 
                onChange={handleDateChange} 
              />
            </FormControl>

            <Button variant="ghost" onClick={handleClearFilters} colorScheme="red">
              Clear Filters
            </Button>

          </HStack>
        </Box>

        {/* --- Completed Jobs Table --- */}
        <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg">
          <Heading as="h3" size="md" mb={4}>Finished Jobs</Heading>
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Completed Date</Th>
                  <Th>WO Number</Th>
                  <Th>Machine</Th>
                  <Th>Technician</Th>
                  <Th>Approved By</Th>
                  <Th isNumeric>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {isLoading && <Tr><Td colSpan={6} textAlign="center">Loading...</Td></Tr>}
                {!isLoading && jobs.length === 0 && <Tr><Td colSpan={6} textAlign="center">No jobs found.</Td></Tr>}
                
                {jobs.map((job) => (
                  <Tr key={job.work_order_id}>
                    <Td>{formatDateTime(job.completed_time)}</Td>
                    <Td>{job.wo_number}</Td>
                    <Td>{job.machine_name}</Td>
                    <Td>{job.technician_name}</Td>
                    <Td>
                        {job.approved_by ? (
                            <Text fontWeight="bold" color="green.600">{job.approved_by}</Text>
                        ) : (
                            <Badge colorScheme="orange">Pending Approval</Badge>
                        )}
                    </Td>
                    <Td isNumeric>
                      <Button colorScheme="gray" size="sm" onClick={() => handleViewDetails(job)}>
                        View Details
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      </VStack>

      {/* --- Details Modal (Unchanged) --- */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="3xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Job Details: {selectedJob?.wo_number}</ModalHeader>
          <ModalCloseButton />
          
          <ModalBody pb={6}>
            <VStack spacing={4} align="stretch">
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={4}>
                <Box>
                    <Text><strong>Machine:</strong> {selectedJob?.machine_name}</Text>
                    <Text><strong>Technician:</strong> {selectedJob?.technician_name}</Text>
                    <Text><strong>Started:</strong> {formatDateTime(selectedJob?.start_time)}</Text>
                    <Text><strong>Completed:</strong> {formatDateTime(selectedJob?.completed_time)}</Text>
                </Box>
                
                <Box bg="green.50" p={3} borderRadius="md" border="1px dashed" borderColor="green.200">
                    <Heading size="xs" mb={2} color="green.800">APPROVAL STATUS</Heading>
                    <Text><strong>Approved By:</strong> {selectedJob?.approved_by || 'Not yet approved'}</Text>
                    <Text><strong>Date:</strong> {formatDate(selectedJob?.approved_date)}</Text>
                </Box>
              </Box>

              <Divider />
              <Box>
                <Heading as="h4" size="sm" mb={2}>Overall Job Note:</Heading>
                <Text p={2} bg="gray.50" borderRadius="md">
                  {selectedJob?.technician_note || 'N/A'}
                </Text>
              </Box>
              
              <Divider />
              <Heading as="h4" size="sm" mb={2}>Operations Checklist</Heading>
              <Box overflowY="auto" maxH="300px" borderWidth={1} borderRadius="md" p={4}>
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>Operation</Th>
                      <Th>Note</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {jobOperations.map(op => (
                      <Tr key={op.operation_id}>
                        <Td>{op.description}</Td>
                        <Td>{op.technician_note || 'N/A'}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            </VStack>
          </ModalBody>
          
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}

export default CompletedJobsPage;