import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  VStack,
  HStack,
  Text,
  Select,
  SimpleGrid,
  Card,
  CardBody,
  IconButton,
  Tooltip as ChakraTooltip,
} from '@chakra-ui/react';
import { FiDownload, FiRefreshCw } from 'react-icons/fi';
import CanvasJSReact from '../canvasjs.react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import moment from 'moment';

var CanvasJS = CanvasJSReact.CanvasJS;
var CanvasJSChart = CanvasJSReact.CanvasJSChart;

function SteamControl() {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [finishDate, setFinishDate] = useState('');
  const [isFiltered, setIsFiltered] = useState(false);
  const [loading, setLoading] = useState(false);

  // Follow the app's data-theme attribute, since the global toggle uses it.
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute('data-theme') === 'dark'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Make cards follow the global page background; keep borders transparent
  const cardBg = 'transparent';
  const cardBorder = 'transparent';

  // Fetch data when component mounts
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://10.126.15.197:8002/part/vortexdata');
      const vortexData = response.data.data || response.data;
      setData(vortexData);
      setFilteredData(vortexData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    if (!startDate || !finishDate) {
      alert('Please select both start and finish dates');
      return;
    }

    const start = moment(startDate);
    const finish = moment(finishDate);

    const filtered = data.filter((row) => {
      const rowDate = moment(row.formatted_date, 'YYYY-MM-DD HH:mm:ss');
      return rowDate.isBetween(start, finish, null, '[]');
    });

    setFilteredData(filtered);
    setIsFiltered(true);
  };

  const handleReset = () => {
    setFilteredData(data);
    setStartDate('');
    setFinishDate('');
    setIsFiltered(false);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredData.map((row) => ({
        Time: row.formatted_date,
        Totalizer: row.totalizer,
        Flowmeter: row.flowmeter,
        'Suhu (°C)': row.suhu,
        'Tekanan (Bar)': row.tekanan,
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vortex Data');
    XLSX.writeFile(workbook, `Vortex_Flowmeter_${moment().format('YYYY-MM-DD')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Vortex Flowmeter Data', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated: ${moment().format('YYYY-MM-DD HH:mm:ss')}`, 14, 30);

    const tableData = filteredData.map((row) => [
      row.formatted_date,
      row.totalizer,
      row.flowmeter,
      row.suhu,
      row.tekanan,
    ]);

    doc.autoTable({
      head: [['Time', 'Totalizer', 'Flowmeter', 'Suhu (°C)', 'Tekanan (Bar)']],
      body: tableData,
      startY: 35,
    });

    doc.save(`Vortex_Flowmeter_${moment().format('YYYY-MM-DD')}.pdf`);
  };

  // Prepare chart data
  const chartData = filteredData.map((row, index) => ({
    x: index,
    label: moment(row.formatted_date).format('DD-MMM HH:mm'),
    flowmeter: parseFloat(row.flowmeter) || 0,
    suhu: parseFloat(row.suhu) || 0,
    tekanan: parseFloat(row.tekanan) || 0,
    totalizer: parseFloat(row.totalizer) || 0,
  }));

  // Calculate statistics
  const avgFlowmeter = chartData.length > 0 
    ? (chartData.reduce((sum, d) => sum + d.flowmeter, 0) / chartData.length).toFixed(2) 
    : 0;
  const avgSuhu = chartData.length > 0 
    ? (chartData.reduce((sum, d) => sum + d.suhu, 0) / chartData.length).toFixed(2) 
    : 0;
  const avgTekanan = chartData.length > 0 
    ? (chartData.reduce((sum, d) => sum + d.tekanan, 0) / chartData.length).toFixed(2) 
    : 0;

  // Chart options
  const flowmeterChartOptions = {
    theme: isDarkMode ? 'dark2' : 'light2',
    animationEnabled: true,
    responsive: true,
    title: {
      text: 'Flow Rate (m³/h)',
      fontColor: isDarkMode ? 'white' : 'black',
    },
    backgroundColor: 'transparent',
    axisX: {
      title: 'Time',
      labelFontColor: isDarkMode ? 'white' : 'black',
      titleFontColor: isDarkMode ? 'white' : 'black',
      interval: Math.ceil(chartData.length / 10),
    },
    axisY: {
      title: 'Flow Rate',
      labelFontColor: isDarkMode ? 'white' : 'black',
      titleFontColor: isDarkMode ? 'white' : 'black',
    },
    data: [
      {
        type: 'spline',
        name: 'Flowmeter',
        showInLegend: true,
        color: '#3182ce',
        dataPoints: chartData.map((d) => ({ x: d.x, y: d.flowmeter, label: d.label })),
      },
    ],
  };

  const suhuChartOptions = {
    theme: isDarkMode ? 'dark2' : 'light2',
    animationEnabled: true,
    responsive: true,
    title: {
      text: 'Temperature (°C)',
      fontColor: isDarkMode ? 'white' : 'black',
    },
    backgroundColor: 'transparent',
    axisX: {
      title: 'Time',
      labelFontColor: isDarkMode ? 'white' : 'black',
      titleFontColor: isDarkMode ? 'white' : 'black',
      interval: Math.ceil(chartData.length / 10),
    },
    axisY: {
      title: 'Temperature',
      labelFontColor: isDarkMode ? 'white' : 'black',
      titleFontColor: isDarkMode ? 'white' : 'black',
    },
    data: [
      {
        type: 'spline',
        name: 'Suhu',
        showInLegend: true,
        color: '#38a169',
        dataPoints: chartData.map((d) => ({ x: d.x, y: d.suhu, label: d.label })),
      },
    ],
  };

  const tekananChartOptions = {
    theme: isDarkMode ? 'dark2' : 'light2',
    animationEnabled: true,
    responsive: true,
    title: {
      text: 'Pressure (Bar)',
      fontColor: isDarkMode ? 'white' : 'black',
    },
    backgroundColor: 'transparent',
    axisX: {
      title: 'Time',
      labelFontColor: isDarkMode ? 'white' : 'black',
      titleFontColor: isDarkMode ? 'white' : 'black',
      interval: Math.ceil(chartData.length / 10),
    },
    axisY: {
      title: 'Pressure',
      labelFontColor: isDarkMode ? 'white' : 'black',
      titleFontColor: isDarkMode ? 'white' : 'black',
    },
    data: [
      {
        type: 'spline',
        name: 'Tekanan',
        showInLegend: true,
        color: '#ed8936',
        dataPoints: chartData.map((d) => ({ x: d.x, y: d.tekanan, label: d.label })),
      },
    ],
  };

  const allMetricsChartOptions = {
    theme: isDarkMode ? 'dark2' : 'light2',
    animationEnabled: true,
    responsive: true,
    title: {
      text: 'All Metrics Overview',
      fontColor: isDarkMode ? 'white' : 'black',
    },
    backgroundColor: 'transparent',
    axisX: {
      title: 'Time',
      labelFontColor: isDarkMode ? 'white' : 'black',
      titleFontColor: isDarkMode ? 'white' : 'black',
      interval: Math.ceil(chartData.length / 10),
    },
    axisY: {
      title: 'Values',
      labelFontColor: isDarkMode ? 'white' : 'black',
      titleFontColor: isDarkMode ? 'white' : 'black',
    },
    toolTip: {
      shared: true,
    },
    data: [
      {
        type: 'spline',
        name: 'Flowmeter',
        showInLegend: true,
        color: '#3182ce',
        dataPoints: chartData.map((d) => ({ x: d.x, y: d.flowmeter, label: d.label })),
      },
      {
        type: 'spline',
        name: 'Suhu',
        showInLegend: true,
        color: '#38a169',
        dataPoints: chartData.map((d) => ({ x: d.x, y: d.suhu, label: d.label })),
      },
      {
        type: 'spline',
        name: 'Tekanan',
        showInLegend: true,
        color: '#ed8936',
        dataPoints: chartData.map((d) => ({ x: d.x, y: d.tekanan, label: d.label })),
      },
    ],
  };

  return (
    <Box p={6} minH="100vh" bg="transparent" color={isDarkMode ? 'white' : 'black'}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
          <Heading size="lg" color={isDarkMode ? 'white' : 'black'}>
            Vortex Flowmeter Monitoring
          </Heading>
          <HStack spacing={3}>
            <ChakraTooltip label="Refresh Data">
              <IconButton
                icon={<FiRefreshCw />}
                onClick={fetchData}
                isLoading={loading}
                colorScheme="blue"
                aria-label="Refresh"
              />
            </ChakraTooltip>
            <Button leftIcon={<FiDownload />} colorScheme="green" onClick={exportToExcel}>
              Export Excel
            </Button>
            <Button leftIcon={<FiDownload />} colorScheme="red" onClick={exportToPDF}>
              Export PDF
            </Button>
          </HStack>
        </Flex>

        {/* Date Filter */}
        <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px">
          <CardBody>
            <HStack spacing={4} wrap="wrap">
              <Box>
                <Text mb={2} fontSize="sm" fontWeight="medium">
                  Start Date
                </Text>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Box>
              <Box>
                <Text mb={2} fontSize="sm" fontWeight="medium">
                  Finish Date
                </Text>
                <Input
                  type="datetime-local"
                  value={finishDate}
                  onChange={(e) => setFinishDate(e.target.value)}
                />
              </Box>
              <Box pt={7}>
                <HStack spacing={2}>
                  <Button colorScheme="blue" onClick={handleFilter}>
                    Filter
                  </Button>
                  <Button colorScheme="red" onClick={handleReset}>
                    Reset
                  </Button>
                </HStack>
              </Box>
            </HStack>
          </CardBody>
        </Card>

        {/* Statistics Cards */}
        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px">
            <CardBody>
              <Text fontSize="sm" color="gray.500" mb={2}>
                Avg Flow Rate
              </Text>
              <Text fontSize="3xl" fontWeight="bold" color="blue.500">
                {avgFlowmeter} m³/h
              </Text>
            </CardBody>
          </Card>
          <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px">
            <CardBody>
              <Text fontSize="sm" color="gray.500" mb={2}>
                Avg Temperature
              </Text>
              <Text fontSize="3xl" fontWeight="bold" color="green.500">
                {avgSuhu} °C
              </Text>
            </CardBody>
          </Card>
          <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px">
            <CardBody>
              <Text fontSize="sm" color="gray.500" mb={2}>
                Avg Pressure
              </Text>
              <Text fontSize="3xl" fontWeight="bold" color="orange.500">
                {avgTekanan} Bar
              </Text>
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Charts Grid */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
          <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px">
            <CardBody>
              <CanvasJSChart options={flowmeterChartOptions} />
            </CardBody>
          </Card>
          <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px">
            <CardBody>
              <CanvasJSChart options={suhuChartOptions} />
            </CardBody>
          </Card>
          <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px">
            <CardBody>
              <CanvasJSChart options={tekananChartOptions} />
            </CardBody>
          </Card>
          <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px">
            <CardBody>
              <CanvasJSChart options={allMetricsChartOptions} />
            </CardBody>
          </Card>
        </SimpleGrid>

        {/* Data Table */}
        <Card bg={cardBg} borderColor={cardBorder} borderWidth="1px">
          <CardBody>
            <Heading size="md" mb={4}>
              Recent Readings ({filteredData.length} records)
            </Heading>
            <Box overflowX="auto">
              <Table variant="striped" size="sm">
                <Thead>
                  <Tr>
                    <Th>Time</Th>
                    <Th isNumeric>Totalizer</Th>
                    <Th isNumeric>Flowmeter</Th>
                    <Th isNumeric>Suhu (°C)</Th>
                    <Th isNumeric>Tekanan (Bar)</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredData.slice(-20).reverse().map((row) => (
                    <Tr key={row.id}>
                      <Td>{row.formatted_date}</Td>
                      <Td isNumeric>{row.totalizer}</Td>
                      <Td isNumeric>{row.flowmeter}</Td>
                      <Td isNumeric>{row.suhu}</Td>
                      <Td isNumeric>{row.tekanan}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
}

export default SteamControl;