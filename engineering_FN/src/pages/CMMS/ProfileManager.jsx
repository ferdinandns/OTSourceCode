import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Heading,
  Grid,
  Card,
  CardBody,
  Text,
  Avatar,
  VStack,
  HStack,
  Badge,
  useColorModeValue,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Input,
  InputGroup,
  InputLeftElement,
  Icon
} from '@chakra-ui/react';
import axios from 'axios';
import { Search } from '@mui/icons-material';

const ProfileManager = () => {
  const [technicians, setTechnicians] = useState([]);
  const [filteredTechnicians, setFilteredTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Dark mode colors
  const pageBg = useColorModeValue('gray.50', 'gray.900');
  const cardBg = useColorModeValue('white', 'gray.800');
  const textCol = useColorModeValue('gray.800', 'white');
  const subCol = useColorModeValue('gray.600', 'gray.400');
  const borderCol = useColorModeValue('gray.200', 'gray.700');
  const searchBg = useColorModeValue('white', 'gray.700');

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

  useEffect(() => {
    fetchTechnicians();
  }, []);

  useEffect(() => {
    // Filter technicians based on search query
    if (searchQuery.trim() === '') {
      setFilteredTechnicians(technicians);
    } else {
      const filtered = technicians.filter((tech) => {
        const searchLower = searchQuery.toLowerCase();
        return (
          tech.name.toLowerCase().includes(searchLower) ||
          tech.email.toLowerCase().includes(searchLower) ||
          tech.username.toLowerCase().includes(searchLower) ||
          tech.id_users.toString().includes(searchLower)
        );
      });
      setFilteredTechnicians(filtered);
    }
  }, [searchQuery, technicians]);

  const fetchTechnicians = async () => {
    try {
      const token = localStorage.getItem('user_token');
      const response = await axios.get('http://10.126.15.197:8002/part/technicians', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('Technicians fetched:', response.data);
      setTechnicians(response.data.data);
      setFilteredTechnicians(response.data.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching technicians:', err);
      setError(err.response?.data?.message || 'Failed to fetch technicians');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxW="container.xl" py={8} bg={pageBg} minH="100vh">
        <Box textAlign="center" py={10}>
          <Spinner size="xl" color="blue.500" />
          <Text mt={4} color={textCol}>Loading technicians...</Text>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxW="container.xl" py={8} bg={pageBg} minH="100vh">
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Error!</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
      </Container>
    );
  }

  return (
    
    <Container maxW="container.xl" py={8} bg="transparent" minH="100vh" color={textCol}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="lg" color={textCol} mb={2}>
            Technician Profiles
          </Heading>
          <Text color={subCol}>
            View all registered technicians in the system
          </Text>
        </Box>

        {/* Search Bar */}
        <InputGroup maxW="400px">
          <InputLeftElement pointerEvents="none">
            <Icon as={Search} color={subCol} />
          </InputLeftElement>
          <Input
            placeholder="Search by name, email, username, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            bg={searchBg}
            borderColor={borderCol}
            color={textCol}
            _placeholder={{ color: subCol }}
          />
        </InputGroup>

        {/* Stats */}
        <HStack spacing={4}>
          <Box bg={cardBg} p={4} borderRadius="md" borderWidth="1px" borderColor={borderCol}>
            <Text fontSize="sm" color={subCol}>Total Technicians</Text>
            <Text fontSize="2xl" fontWeight="bold" color={textCol}>
              {technicians.length}
            </Text>
          </Box>
          <Box bg={cardBg} p={4} borderRadius="md" borderWidth="1px" borderColor={borderCol}>
            <Text fontSize="sm" color={subCol}>Showing</Text>
            <Text fontSize="2xl" fontWeight="bold" color={textCol}>
              {filteredTechnicians.length}
            </Text>
          </Box>
        </HStack>

        {/* Technicians Grid */}
        {filteredTechnicians.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Text color={subCol} fontSize="lg">
              {searchQuery ? 'No technicians found matching your search' : 'No technicians registered yet'}
            </Text>
          </Box>
        ) : (
          <Grid templateColumns="repeat(auto-fill, minmax(300px, 1fr))" gap={6}>
            {filteredTechnicians.map((tech) => (
              <Card
                key={tech.id_users}
                bg="transparent"
                borderWidth="1px"
                borderColor={borderCol}
                _hover={{
                  transform: 'translateY(-4px)',
                  shadow: 'lg',
                  transition: 'all 0.3s ease'
                }}
              >
                <CardBody>
                  <VStack spacing={4} align="center">
                    {/* Avatar */}
                    <Avatar
                      size="xl"
                      name={tech.name}
                      src={tech.imagePath ? `http://10.126.15.197:8002${tech.imagePath}` : null}
                      bg="blue.500"
                    />

                    {/* Name */}
                    <VStack spacing={1} align="center">
                      <Text fontSize="xl" fontWeight="bold" color={isDarkMode ? 'white' : 'gray.800'}>
                        {tech.name}
                      </Text>
                      <Badge colorScheme="blue" fontSize="xs">
                        Level {tech.level} - Technician
                      </Badge>
                    </VStack>

                    {/* Details */}
                    <VStack spacing={2} align="stretch" w="full" pt={2}>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color={isDarkMode ? 'gray.400' : 'gray.600'}>User ID:</Text>
                        <Text fontSize="sm" fontWeight="medium" color={isDarkMode ? 'white' : 'gray.800'}>
                          {tech.id_users}
                        </Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color={isDarkMode ? 'gray.400' : 'gray.600'}>Username:</Text>
                        <Text fontSize="sm" fontWeight="medium" color={isDarkMode ? 'white' : 'gray.800'}>
                          {tech.username}
                        </Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text fontSize="sm" color={isDarkMode ? 'gray.400' : 'gray.600'}>Email:</Text>
                        <Text fontSize="sm" fontWeight="medium" color={isDarkMode ? 'white' : 'gray.800'} isTruncated>
                          {tech.email}
                        </Text>
                      </HStack>
                    </VStack>
                  </VStack>
                </CardBody>
              </Card>
            ))}
          </Grid>
        )}
      </VStack>
    </Container>
  );
};

export default ProfileManager;
