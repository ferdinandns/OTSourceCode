import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Heading, Button, VStack, Container, useToast, Table, Thead, Tbody,
  Tr, Th, Td, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalFooter, ModalBody, ModalCloseButton, FormControl,
  FormLabel, Input, Select, Divider, HStack, Badge
} from '@chakra-ui/react';

const formatDateTimeForInput = (dateTimeStr) => {
  if (!dateTimeStr) return '';
  try {
    const date = new Date(dateTimeStr);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  } catch (e) { return ''; }
};

const formatDateTimeForTable = (dateTimeStr) => {
  if (!dateTimeStr) return 'N/A';
  try { return new Date(dateTimeStr).toLocaleString(); }
  catch (e) { return 'Invalid Date'; }
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function TechnicianPage() {
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // --- FILTERS ---
  const [statusFilter, setStatusFilter] = useState('Open');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth()); 
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const statusColors = {
    'Finished': 'green',
    'Open': 'red',
    'In Progress': 'yellow',
    'Pending Approval': 'orange',
    'Approved': 'green'
  };

  // --- Modal States ---
  const [operations, setOperations] = useState([]);
  const [technicianName, setTechnicianName] = useState('');
  const [mainStatus, setMainStatus] = useState('In Progress');
  const [startTime, setStartTime] = useState('');
  const [completedTime, setCompletedTime] = useState('');
  const [mainTechnicianNote, setMainTechnicianNote] = useState('');

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      const response = await fetch('http://10.126.15.197:8002/part/live-work-orders');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setWorkOrders(data);
    } catch (err) {
      toast({ title: 'Error fetching work orders', status: 'error' });
    }
  };

  const fetchOperations = async (workOrderId) => {
    try {
      const response = await fetch(`http://10.126.15.197:8002/part/work-order-operations/${workOrderId}`);
      if (!response.ok) throw new Error('Could not fetch operations');
      const data = await response.json();
      setOperations(data);
    } catch (err) {
      toast({ title: 'Error fetching operations list', status: 'error' });
      setOperations([]);
    }
  };

  // --- 1. Compute Available Years dynamically ---
  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    workOrders.forEach(wo => {
      if (wo.scheduled_date) {
        years.add(new Date(wo.scheduled_date).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [workOrders]);

  // --- 2. FILTER LOGIC ---
  const filteredWorkOrders = workOrders.filter((wo) => {
    // A. Status Filter
    let matchStatus = false;
    if (statusFilter === 'All') {
      matchStatus = true;
    } else if (statusFilter === 'Open') {
      matchStatus = wo.status === 'Open' || wo.status === 'Assigned';
    } else {
      matchStatus = wo.status === statusFilter;
    }

    // B. Date Filter
    if (!wo.scheduled_date) return false; 
    
    const date = new Date(wo.scheduled_date);
    if (isNaN(date.getTime())) return false;

    // Check Month (allow "All" if filter is empty string)
    const matchMonth = filterMonth === "" || date.getMonth() === parseInt(filterMonth);
    
    // Check Year
    const matchYear = date.getFullYear() === parseInt(filterYear);

    return matchStatus && matchMonth && matchYear;
  });

  const handleOpenModal = (workOrder) => {
    setSelectedWorkOrder(workOrder);
    setTechnicianName(workOrder.technician_name || '');
    setMainTechnicianNote(workOrder.technician_note || '');
    setMainStatus(workOrder.status || 'In Progress');
    setStartTime(formatDateTimeForInput(workOrder.start_time));
    setCompletedTime(formatDateTimeForInput(workOrder.completed_time));
    fetchOperations(workOrder.work_order_id);
    onOpen();
  };

  const handleCloseModal = () => {
    onClose();
    setOperations([]);
  };

  // --- FIXED: Local State Update (Controlled Component) ---
  // This ensures that typing in one box ONLY updates that specific box in memory
  const handleNoteChange = (operationId, newText) => {
    setOperations(prevOps => 
      prevOps.map(op => 
        op.operation_id === operationId ? { ...op, technician_note: newText } : op
      )
    );
  };

  // --- FIXED: Backend Save (On Blur) ---
  // This sends the data to the server only when you finish typing (click away)
  const handleNoteBlur = async (operationId, noteValue) => {
    try {
      await fetch(`http://10.126.15.197:8002/part/work-order-operation/${operationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technician_note: noteValue }),
      });
      // Silent success to avoid toast spam
    } catch (err) {
      toast({ title: 'Note save failed', status: 'error' });
    }
  };

  const handleSaveTechnicianData = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`http://10.126.15.197:8002/part/pmp-data-tech/${selectedWorkOrder.work_order_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technician_name: technicianName,
          technician_note: mainTechnicianNote,
          status: mainStatus,
          start_time: startTime || null,
          completed_time: completedTime || null,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.details || 'Failed to update record');
      }

      toast({ title: 'Work Order Updated', status: 'success' });
      fetchWorkOrders();
      onClose();

    } catch (err) {
      toast({ title: 'Error updating record', description: err.message, status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Heading as="h2" size="lg">Technician Work Orders</Heading>

        {/* --- 3. FILTER UI --- */}
        <Box p={6} borderWidth={1} borderRadius="lg" bg="gray.50" boxShadow="sm">
            <HStack spacing={4} align="end" wrap="wrap">
                
                {/* Status Filter */}
                <FormControl maxW="250px">
                    <FormLabel fontSize="xs" mb={1} color="gray.500">Status</FormLabel>
                    <Select 
                        bg="white" 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="Open">Show Only Open (Default)</option>
                        <option value="In Progress">Show In Progress</option>
                        <option value="Pending Approval">Show Pending Approval</option>
                        <option value="All">Show All Active Jobs</option>
                    </Select>
                </FormControl>

                {/* Month Filter */}
                <FormControl maxW="160px">
                    <FormLabel fontSize="xs" mb={1} color="gray.500">Month</FormLabel>
                    <Select 
                        bg="white" 
                        value={filterMonth} 
                        onChange={(e) => setFilterMonth(e.target.value)}
                    >
                        <option value="">All Months</option>
                        {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </Select>
                </FormControl>

                {/* Year Filter */}
                <FormControl maxW="100px">
                    <FormLabel fontSize="xs" mb={1} color="gray.500">Year</FormLabel>
                    <Select 
                        bg="white" 
                        value={filterYear} 
                        onChange={(e) => setFilterYear(e.target.value)}
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </Select>
                </FormControl>

            </HStack>
        </Box>

        {/* --- READ Table --- */}
        <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg">
          <Box overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>WO Number</Th>
                  <Th>Machine Name</Th>
                  <Th>Scheduled Date</Th>
                  <Th>Status</Th>
                  <Th>Start Time</Th>
                  <Th>Technician</Th>
                  <Th isNumeric>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {/* Empty State */}
                {filteredWorkOrders.length === 0 && (
                  <Tr>
                      <Td colSpan={7} textAlign="center" py={6} color="gray.500">
                          No {statusFilter === 'All' ? '' : statusFilter} jobs found for {filterMonth !== "" ? MONTH_NAMES[filterMonth] : "selected month"} {filterYear}.
                      </Td>
                  </Tr>
                )}

                {/* Filtered List */}
                {filteredWorkOrders.map((wo) => (
                  <Tr key={wo.work_order_id}>
                    <Td fontWeight="medium">{wo.wo_number}</Td>
                    <Td>{wo.machine_name || 'N/A'}</Td> 
                    <Td>{new Date(wo.scheduled_date).toLocaleDateString('en-GB')}</Td>
                    <Td>
                      <Badge colorScheme={statusColors[wo.status] || 'gray'}>
                        {wo.status}
                      </Badge>
                    </Td>
                    <Td>{formatDateTimeForTable(wo.start_time)}</Td>
                    <Td>{wo.technician_name || 'N/A'}</Td>
                    <Td isNumeric>
                      <Button colorScheme="blue" size="sm" onClick={() => handleOpenModal(wo)}>
                        {wo.status === 'Pending Approval' ? 'View/Edit' : 'Start/Update'}
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </Box>
      </VStack>

      {/* --- UPDATE MODAL --- */}
      <Modal isOpen={isOpen} onClose={handleCloseModal} isCentered size="4xl">
        <ModalOverlay />
        <ModalContent as="form" onSubmit={handleSaveTechnicianData}>
          <ModalHeader>Update Work Order: {selectedWorkOrder?.wo_number}</ModalHeader>
          <ModalCloseButton />
          
          <ModalBody pb={6}>
            <VStack spacing={6} align="stretch">
              <Box>
                <Heading as="h4" size="md" mb={4}>Operations Checklist</Heading>
                <Box overflowY="auto" maxH="300px" borderWidth={1} borderRadius="md" p={4}>
                  <Table variant="simple" size="sm">
                    <Thead><Tr><Th>Description</Th><Th>Technician Note</Th></Tr></Thead>
                    <Tbody>
                      {operations.map(op => (
                        <Tr key={op.operation_id}>
                          <Td>{op.description}</Td>
                          <Td>
                            {/* FIXED INPUT LOGIC */}
                            <Input
                              size="sm"
                              placeholder="Add note..."
                              // 1. Controlled: Value comes directly from this specific row
                              value={op.technician_note || ''} 
                              // 2. Local Update: Updates UI instantly
                              onChange={(e) => handleNoteChange(op.operation_id, e.target.value)}
                              // 3. Backend Save: Saves when you leave the field
                              onBlur={(e) => handleNoteBlur(op.operation_id, e.target.value)}
                            />
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>
              </Box>

              <Divider />
              
              <Box>
                <Heading as="h4" size="md" mb={4}>Main Job Details</Heading>
                <HStack spacing={4} mb={4}>
                  <FormControl isRequired>
                    <FormLabel>Technician Name</FormLabel>
                    <Input value={technicianName} onChange={(e) => setTechnicianName(e.target.value)} />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Overall Status</FormLabel>
                    <Select value={mainStatus} onChange={(e) => setMainStatus(e.target.value)}>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Pending Approval">Pending Approval</option>
                    </Select>
                  </FormControl>
                </HStack>
                
                <HStack spacing={4} mb={4}>
                  <FormControl>
                    <FormLabel>Start Time</FormLabel>
                    <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Completed Time</FormLabel>
                    <Input type="datetime-local" value={completedTime} onChange={(e) => setCompletedTime(e.target.value)} />
                  </FormControl>
                </HStack>
              </Box>
            </VStack>
          </ModalBody>
          
          <ModalFooter>
            <Button onClick={handleCloseModal} mr={3}>Cancel</Button>
            <Button colorScheme="blue" type="submit" isLoading={isLoading}>Save and Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </Container>
  );
}

export default TechnicianPage;