import React, { useState, useEffect } from 'react';
import {
  Box, Flex, Heading, Text, Input, InputGroup, InputLeftElement,
  SimpleGrid, Badge, VStack, HStack, IconButton, Avatar,
  Stat, StatLabel, StatNumber, StatHelpText, Icon, Spacer,
  Container, useColorModeValue, Button, useDisclosure,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter,
  ModalBody, ModalCloseButton, FormControl, FormLabel, Textarea,
  Select, Divider, Table, Thead, Tbody, Tr, Th, Td
} from '@chakra-ui/react';
import { 
  FiSearch, FiBell, FiMail, FiCheckCircle, FiClipboard, FiTool, FiCalendar 
} from 'react-icons/fi';
import { toast, ToastContainer } from "react-toastify"  ;
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';



// Helper to format dates
const formatDate = (dateString) => {
  if (!dateString) return 'No Date';
  return new Date(dateString).toLocaleDateString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric' 
  });
};

// --- COMPONENT: STAT CARD ---
const StatCard = ({ label, value, icon, color }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderCol = useColorModeValue('gray.100', 'gray.700');
  const labelCol = useColorModeValue('gray.500', 'gray.400');
  const valueCol = useColorModeValue('gray.700', 'gray.100');
  const iconBg = useColorModeValue(`${color}.50`, 'gray.700');
  const iconCol = useColorModeValue(`${color}.500`, `${color}.300`);
  return (
    <Box 
      bg={cardBg} p={6} borderRadius="xl" boxShadow="sm" 
      border="1px solid" borderColor={borderCol}
      transition="all 0.2s" _hover={{ boxShadow: "md" }}
    >
      <Flex justify="space-between" align="center">
        <Box>
          <Text fontSize="sm" color={labelCol} mb={1}>{label}</Text>
          <Text fontSize="3xl" fontWeight="bold" color={valueCol}>{value}</Text>
        </Box>
        <Box p={3} bg={iconBg} borderRadius="lg">
          <Icon as={icon} w={6} h={6} color={iconCol} />
        </Box>
      </Flex>
    </Box>
  );
};

// --- COMPONENT: CIRCULAR CHART ---
const CircularChart = ({ completed, total, label }) => {
  const data = [
    { name: 'Completed', value: completed },
    { name: 'Remaining', value: total - completed }
  ];
  const COLORS = ['#48bb78', '#c2c6daff'];
  const textCol = useColorModeValue('gray.700', 'gray.100');
  const subCol = useColorModeValue('gray.500', 'gray.400');
  
  return (
    <Box textAlign="center">
      <Heading size="sm" color={textCol} mb={3}>{label}</Heading>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <Text fontSize="lg" fontWeight="bold" color={textCol}>{completed}/{total}</Text>
      <Text fontSize="sm" color={subCol}>Completed</Text>
    </Box>
  );
};

const TaskCard = ({ job, isUrgent, onEdit }) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderCol = useColorModeValue('gray.100', 'gray.700');
  const headingCol = useColorModeValue('gray.700', 'gray.100');
  const textCol = useColorModeValue('gray.500', 'gray.400');
  return (
    <Box 
      bg={cardBg} p={5} borderRadius="xl" boxShadow="sm" 
      border="1px solid" borderColor={borderCol} w="100%"
      _hover={{ borderColor: "blue.200", boxShadow: "md" }}
      cursor="pointer"
      onClick={() => onEdit(job)}
    >
      <Flex justify="space-between" align="start" mb={2}>
        <Heading size="sm" color={headingCol} noOfLines={1}>
          {job.machine_name || "Unknown Machine"}
        </Heading>
        <Badge colorScheme={isUrgent ? "red" : "orange"} borderRadius="full" px={2}>
          {isUrgent ? "High" : "Medium"}
        </Badge>
      </Flex>
      
      <Text fontSize="xs" color={textCol} mb={3} fontWeight="medium">
        {job.wo_number} • {job.category || 'Maintenance'}
      </Text>

      <HStack fontSize="sm" color={textCol}>
        <Icon as={FiCalendar} />
        <Text>Due: {formatDate(job.scheduled_date)}</Text>
      </HStack>
    </Box>
  );
};

function TechnicianDashboard() {
  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const headingCol = useColorModeValue('gray.700', 'gray.100');
  const subTextCol = useColorModeValue('gray.500', 'gray.400');
  const listHeaderCol = useColorModeValue('gray.700', 'gray.100');
  const listCountCol = useColorModeValue('gray.500', 'gray.400');
  const listContainerBg = useColorModeValue('white', 'gray.800');
  const listBorderCol = useColorModeValue('gray.100', 'gray.700');
  const modalBg = useColorModeValue('white', 'gray.800');
  const modalTextCol = useColorModeValue('gray.800', 'white');
  const inputBg = useColorModeValue('white', 'gray.700');
  const inputBorderCol = useColorModeValue('gray.200', 'gray.600');

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute('data-theme') === 'dark'
  );

  useEffect(() => {
    const handleThemeChange = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(currentTheme === 'dark');
    };
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  const { isOpen, onOpen, onClose } = useDisclosure();


  const [workOrders, setWorkOrders] = useState([]);
  const [myAssignedPwoData, setMyAssignedPwoData] = useState([]);
  const [userName, setUserName] = useState("Technician");
  const [userId, setUserId] = useState(null);
  const [searchAllQuery, setSearchAllQuery] = useState("");
  const [searchMyQuery, setSearchMyQuery] = useState("");

  // Modal and edit states
  const [selectedWorkOrder, setSelectedWorkOrder] = useState(null);
  const [operations, setOperations] = useState([]);
  const [technicianName, setTechnicianName] = useState('');
  const [mainStatus, setMainStatus] = useState('In Progress');
  const [startTime, setStartTime] = useState('');
  const [completedTime, setCompletedTime] = useState('');
  const [mainTechnicianNote, setMainTechnicianNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

// Put this inside TechnicianDashboard function
  
  useEffect(() => {
    // 1. Log when the component mounts
    console.log("🟢 Dashboard Component Mounted!"); 
    fetchMyData();
  }, []);

  const fetchMyData = async () => {
    console.log("🚀 STARTING fetchMyData function...");

    // 2. Check Local Storage
    const token = localStorage.getItem('user_token');
    
    if (!token) {
        console.error("❌ STOPPING: No 'user_token' found in localStorage.");
        console.warn("👉 Please Log Out and Log In again to save the token.");
        toast.error("Authentication Error: No token found. Please relogin.");
        return; 
    }

    console.log("✅ Token found:", token.substring(0, 15) + "..."); // Print part of token

    // Decode user info from token (including user ID)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUserName(payload.name || "Technician");
      setUserId(payload.id);
      console.log("👤 User Name from token:", payload.name);
      console.log("🆔 User ID from token:", payload.id);
    } catch (e) {
      console.error("❌ Failed to decode token:", e);
    }

    try {
      await Promise.all([
        fetchAllPwo(token),
        fetchAssignedPwo(token)
      ]);
    } catch (err) {
      console.error("🔥 FETCH ERROR:", err);
      toast.error("Failed to load tasks.");
    }
  };

  const fetchAllPwo = async (token) => {
    console.log("📡 Request: /live-work-orders (ALL)");
    const response = await fetch('http://10.126.15.197:8002/part/live-work-orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("📥 ALL PWO Status:", response.status);
    if (!response.ok) throw new Error(`ALL PWO failed: ${response.status}`);
    const data = await response.json();
    console.log("📦 ALL PWO DATA:", Array.isArray(data) ? data.length : data);
    if (Array.isArray(data)) setWorkOrders(data);
  };

  const fetchAssignedPwo = async (token) => {
    console.log("📡 Request: /live-work-orders-assigned (MY)");
    const response = await fetch('http://10.126.15.197:8002/part/live-work-orders-assigned', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("📥 MY PWO Status:", response.status);
    if (!response.ok) throw new Error(`MY PWO failed: ${response.status}`);
    const data = await response.json();
    console.log("📦 MY PWO DATA:", Array.isArray(data) ? data.length : data);
    if (Array.isArray(data)) setMyAssignedPwoData(data);
  };

  const fetchOperations = async (workOrderId) => {
    try {
      const response = await fetch(`http://localhost:8002/part/work-order-operations/${workOrderId}`);
      if (!response.ok) throw new Error('Could not fetch operations');
      const data = await response.json();
      console.log('🔍 Operations API Response:', data);
      console.log('🔍 First operation object:', data[0]);
      setOperations(data);
    } catch (err) {
      toast({ title: 'Error fetching operations list', status: 'error' });
      setOperations([]);
    }
  };

  const handleOpenModal = (workOrder) => {
    setSelectedWorkOrder(workOrder);
    setTechnicianName(workOrder.technician_name || '');
    setMainTechnicianNote(workOrder.technician_note || '');
    setMainStatus(workOrder.status || 'In Progress');
    setStartTime(formatDateTimeForInput(workOrder.start_time));
    setCompletedTime(formatDateTimeForInput(workOrder.completed_time));
    // Prefer operations bundled with work order (from liveWorkOrdersAssigned)
    if (Array.isArray(workOrder.operations) && workOrder.operations.length > 0) {
      setOperations(workOrder.operations);
    } else {
      fetchOperations(workOrder.work_order_id);
    }
    onOpen();
  };

  const handleCloseModal = () => {
    onClose();
    setOperations([]);
  };

  const handleNoteSave = async (operationId, newNote) => {
    const updatedOperations = operations.map(op => 
      op.operation_id === operationId ? { ...op, technician_note: newNote } : op
    );
    setOperations(updatedOperations);

    try {
      await fetch(`http://10.126.15.197:8002/part/work-order-operation/${operationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technician_note: newNote }),
      });
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
      await Promise.all([
        fetchAllPwo(localStorage.getItem('user_token')),
        fetchAssignedPwo(localStorage.getItem('user_token'))
      ]);
      handleCloseModal();

    } catch (err) {
      toast({ title: 'Error updating record', description: err.message, status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // --- FILTERING LOGIC ---
  // Treat 'Pending Approval' as done: exclude from incomplete lists
  const allPwoBase = workOrders.filter(
    j => j.status !== 'Completed' && j.status !== 'Pending Approval' && (j.wo_number || '').includes('PWO')
  );
  const myPwoBase = myAssignedPwoData.filter(
    j => j.status !== 'Completed' && j.status !== 'Pending Approval' && (j.wo_number || '').includes('PWO')
  );

  const matchesSearch = (job, term) => {
    const q = term.toLowerCase();
    const wo = (job.wo_number || '').toLowerCase();
    const machine = (job.machine_name || '').toLowerCase();
    return wo.includes(q) || machine.includes(q);
  };

  const allPwoTasks = allPwoBase.filter(j => matchesSearch(j, searchAllQuery));
  const myAssignedPwo = myPwoBase.filter(j => matchesSearch(j, searchMyQuery));

  // Stats use full data (not filtered by search)
  // Consider 'Pending Approval' as completed for stats
  const completedPwoCount = workOrders.filter(
    j => (j.status === 'Completed' || j.status === 'Pending Approval') && (j.wo_number || '').includes('PWO')
  ).length;
  const totalPwoCount = workOrders.filter(j => (j.wo_number || '').includes('PWO')).length;
  const totalIncompleteCount = allPwoBase.length;

  return (
    <Box bg="transparent" minH="100vh" py={8} color={headingCol}>
      <Container maxW="container.xl" bg="transparent">
        
        {/* --- 1. HEADER (Navbar removed, simple greeting kept) --- */}
        <Flex mb={8} align="center" direction={{ base: "column", md: "row" }} gap={4}>
          <Box>
            <Heading size="lg" color={isDarkMode ? 'white' : 'gray.700'}>Good Morning, {userName}</Heading>
            <Text color={isDarkMode ? 'gray.400' : 'gray.500'}>Here's your task overview for today</Text>
          </Box>
        </Flex>

        {/* --- 2. STATS GRID --- */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={8}>
          <StatCard 
            label="All Incomplete PWO" 
            value={allPwoTasks.length} 
            icon={FiClipboard} 
            color="blue" 
          />
          <StatCard 
            label="My Assigned PWO" 
            value={myAssignedPwo.length} 
            icon={FiTool} 
            color="orange" 
          />
          <StatCard 
            label="Completed PWO" 
            value={completedPwoCount} 
            icon={FiCheckCircle} 
            color="green" 
          />
          <StatCard 
            label="Total PWO" 
            value={totalPwoCount} 
            icon={FiCalendar} 
            color="purple" 
          />
        </SimpleGrid>

        {/* --- 3. CIRCULAR CHARTS GRID --- */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8} mb={8}>
          <Box bg="transparent" border="1px solid" borderColor={listBorderCol} borderRadius="xl" p={6}>
            <CircularChart 
              completed={completedPwoCount} 
              total={totalPwoCount} 
              label="Overall PWO Status"
            />
          </Box>
          <Box bg="transparent" border="1px solid" borderColor={listBorderCol} borderRadius="xl" p={6}>
            <CircularChart 
              completed={myAssignedPwo.length} 
              total={totalIncompleteCount} 
              label="My Assignment Status"
            />
          </Box>
        </SimpleGrid>

        {/* --- 4. MAIN CONTENT (Task Lists) --- */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8}>
          
          {/* LEFT COLUMN: All Incomplete PWO */}
          <Box>
            <Flex justify="space-between" align="center" mb={3}>
              <Heading size="md" color={isDarkMode ? 'white' : 'gray.700'}>All Incomplete PWO</Heading>
              <Text fontSize="sm" color={isDarkMode ? 'gray.400' : 'gray.500'}>{allPwoTasks.length} tasks</Text>
            </Flex>
            <InputGroup mb={3}>
              <InputLeftElement pointerEvents="none"><Icon as={FiSearch} /></InputLeftElement>
              <Input 
                placeholder="Search PWO number..." 
                value={searchAllQuery}
                onChange={(e) => setSearchAllQuery(e.target.value)}
              />
            </InputGroup>
            <Box bg="transparent" border="1px solid" borderColor={listBorderCol} borderRadius="xl" p={3} maxH="60vh" overflowY="auto">
            <VStack spacing={4} align="stretch">
              {allPwoTasks.length === 0 ? (
                 <Box p={6} bg="transparent" borderRadius="xl" textAlign="center" color={isDarkMode ? 'gray.400' : 'gray.500'}>
                    <Icon as={FiClipboard} w={10} h={10} mb={3} />
                    <Text fontSize="md" fontWeight="medium">No incomplete PWO tasks</Text>
                 </Box>
              ) : (
                allPwoTasks.map(job => (
                    <TaskCard key={job.work_order_id} job={job} isUrgent={false} onEdit={handleOpenModal} />
                ))
              )}
            </VStack>
            </Box>
          </Box>

          {/* RIGHT COLUMN: My Assigned PWO */}
          <Box>
            <Flex justify="space-between" align="center" mb={3}>
              <Heading size="md" color={isDarkMode ? 'white' : 'gray.700'}>My Assigned PWO</Heading>
              <Text fontSize="sm" color={isDarkMode ? 'gray.400' : 'gray.500'}>{myAssignedPwo.length} assigned to me</Text>
            </Flex>
            <InputGroup mb={3}>
              <InputLeftElement pointerEvents="none"><Icon as={FiSearch} /></InputLeftElement>
              <Input 
                placeholder="Search PWO number..." 
                value={searchMyQuery}
                onChange={(e) => setSearchMyQuery(e.target.value)}
              />
            </InputGroup>
            <Box bg="transparent" border="1px solid" borderColor={listBorderCol} borderRadius="xl" p={3} maxH="60vh" overflowY="auto">
            <VStack spacing={4} align="stretch">
              {myAssignedPwo.length === 0 ? (
                 <Box p={6} bg="transparent" borderRadius="xl" textAlign="center" color={isDarkMode ? 'gray.400' : 'gray.500'}>
                    <Icon as={FiTool} w={10} h={10} mb={3} />
                    <Text fontSize="md" fontWeight="medium">No PWO assigned to you</Text>
                    <Text fontSize="sm" mt={2}>Check back later or contact your supervisor</Text>
                 </Box>
              ) : (
                myAssignedPwo.map(job => (
                    <TaskCard key={job.work_order_id} job={job} isUrgent={true} onEdit={handleOpenModal} />
                ))
              )}
            </VStack>
            </Box>
          </Box>

        </SimpleGrid>

        {/* --- MODAL FOR EDITING PWO --- */}
        <Modal isOpen={isOpen} onClose={handleCloseModal} size="4xl">
          <ModalOverlay />
          <ModalContent bg={modalBg} color={modalTextCol} maxW="90vw">
            <ModalHeader>Edit Work Order: {selectedWorkOrder?.wo_number || 'N/A'}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedWorkOrder && (
                <form onSubmit={handleSaveTechnicianData}>
                  {/* Technician Details */}
                  <VStack spacing={4} mb={6}>
                    <FormControl>
                      <FormLabel fontSize="sm" fontWeight="600">Technician Name</FormLabel>
                      <Input 
                        type="text"
                        value={technicianName}
                        onChange={(e) => setTechnicianName(e.target.value)}
                        placeholder="Enter technician name"
                        bg={inputBg}
                        borderColor={inputBorderCol}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm" fontWeight="600">Status</FormLabel>
                      <Select 
                        value={mainStatus}
                        onChange={(e) => setMainStatus(e.target.value)}
                        bg={inputBg}
                        borderColor={inputBorderCol}
                      >
                        <option value="In Progress">In Progress</option>
                        <option value="Pending Approval">Pending Approval</option>
                      </Select>
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm" fontWeight="600">Start Time</FormLabel>
                      <Input 
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        bg={inputBg}
                        borderColor={inputBorderCol}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm" fontWeight="600">Completed Time</FormLabel>
                      <Input 
                        type="datetime-local"
                        value={completedTime}
                        onChange={(e) => setCompletedTime(e.target.value)}
                        bg={inputBg}
                        borderColor={inputBorderCol}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontSize="sm" fontWeight="600">Overall Notes</FormLabel>
                      <Textarea 
                        value={mainTechnicianNote}
                        onChange={(e) => setMainTechnicianNote(e.target.value)}
                        placeholder="Add notes about this work order"
                        bg={inputBg}
                        borderColor={inputBorderCol}
                        rows={3}
                      />
                    </FormControl>
                  </VStack>

                  {/* Operations Checklist */}
                  <Divider my={6} />
                  <Heading size="sm" mb={4}>Operations Checklist</Heading>
                  
                  <Box mb={6} overflowX="hidden">
                    <Table size="sm" variant="striped" layout="fixed" width="100%">
                      <Thead>
                        <Tr>
                          <Th width="40%">Description</Th>
                          <Th width="60%">Technician Note</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {operations && operations.length > 0 ? (
                          operations.map(op => (
                            <Tr key={op.operation_id}>
                              <Td fontSize="sm" whiteSpace="normal" wordBreak="break-word">
                                {op.description || 'N/A'}
                              </Td>
                              <Td p={2}>
                                <Textarea 
                                  size="sm"
                                  value={op.technician_note || ''}
                                  onChange={(e) => handleNoteSave(op.operation_id, e.target.value)}
                                  placeholder="Enter note"
                                  rows={2}
                                  bg={inputBg}
                                  borderColor={inputBorderCol}
                                  width="100%"
                                  maxWidth="100%"
                                  resize="vertical"
                                />
                              </Td>
                            </Tr>
                          ))
                        ) : (
                          <Tr>
                            <Td colSpan="3" textAlign="center" py={4}>
                              <Text fontSize="sm" color={subTextCol}>No operations found</Text>
                            </Td>
                          </Tr>
                        )}
                      </Tbody>
                    </Table>
                  </Box>

                  {/* Save Button */}
                  <Flex gap={3} mt={6}>
                    <Button 
                      type="submit"
                      colorScheme="blue"
                      isLoading={isLoading}
                      flex={1}
                    >
                      Save Changes
                    </Button>
                    <Button 
                      colorScheme="red"
                      onClick={handleCloseModal}
                      flex={1}
                    >
                      Cancel
                    </Button>
                  </Flex>
                </form>
              )}
            </ModalBody>
          </ModalContent>
        </Modal>
      </Container>
    </Box>
  );
}

export default TechnicianDashboard;