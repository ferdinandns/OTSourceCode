import React from 'react'
import { Image, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import LogoIconn2 from '../assets/logo-kalbe CH-black.png';
import MerriRegular from '../fonts/Merriweather_24pt-Regular.ttf'
import HelveticaBold from '../fonts/Helvetica-Bold.ttf'

// Register FONT
Font.register({ family: 'MerriRegular', src: MerriRegular });
Font.register({ family: 'HelveticaBold', src: HelveticaBold });

// Kalbe brand colors
const kalbePrimaryColor = '#00843D'; // Green
const kalbeSecondaryColor = '#2c3e50'; // Dark blue/gray
const borderColor = '#E0E0E0';

// Style untuk PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    color: '#333',
    fontFamily: 'MerriRegular',
  },
  // Header styles
  header: {
    flexDirection: 'row',
    borderBottom: `2px solid ${kalbePrimaryColor}`,
    paddingBottom: 10,
    marginBottom: 20,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  logo: { 
    width: 120,
    marginBottom: 5,
  },
  addressText: {
    fontSize: 8,
    color: '#555',
    lineHeight: 1.4,
  },
  dateTime: {
    fontSize: 8,
    color: '#555',
    marginTop: 5,
  },
  // Title styles
  title: {
    fontSize: 16,
    fontFamily: 'HelveticaBold',
    marginBottom: 20,
    textAlign: 'center',
    color: kalbePrimaryColor,
    backgroundColor: '#f8f8f8',
    padding: 8,
    borderRadius: 4,
  },
  // Section styles
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'HelveticaBold',
    marginTop: 15,
    marginBottom: 10,
    color: kalbeSecondaryColor,
    backgroundColor: '#f4f4f4',
    padding: 6,
    borderLeft: `4px solid ${kalbePrimaryColor}`,
  },
  // Content styles
  contentContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  itemContainer: {
    width: '48%', // Two columns layout
    marginBottom: 12,
    borderRadius: 4,
    border: `1px solid ${borderColor}`,
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  subtitle: {
    fontSize: 10,
    fontFamily: 'HelveticaBold',
    backgroundColor: '#f8f8f8',
    padding: 6,
    color: kalbeSecondaryColor,
    borderBottom: `1px solid ${borderColor}`,
  },
  value: {
    fontSize: 10,
    color: '#555',
    padding: 8,
  },
  positiveValue: {
    color: kalbePrimaryColor,
    fontFamily: 'HelveticaBold',
  },
  warningValue: {
    color: '#F39C12', // Orange warning color
    fontFamily: 'HelveticaBold',
  },
  highlightValue: {
    fontSize: 11,
    fontFamily: 'HelveticaBold',
  },
  // Summary row
  summaryRow: {
    flexDirection: 'row',
    borderTop: `1px solid ${kalbePrimaryColor}`,
    marginTop: 10,
    paddingTop: 10,
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: 'HelveticaBold',
    color: kalbeSecondaryColor,
  },
  summaryValue: {
    fontFamily: 'HelveticaBold',
    color: kalbePrimaryColor,
  },
  // Footer styles
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    fontSize: 8,
    color: '#666',
    borderTop: '1px solid #ddd',
    paddingTop: 10,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    color: '#666',
  },
  pageNumber: {
    color: '#666',
  }
});

// Header component with logo, address, and current date/time
const Header = () => {
  const currentDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const currentTime = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Image style={styles.logo} src={LogoIconn2} />
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.addressText}>Kawasan Greenland International Industrial Center (GIIC)</Text>
        <Text style={styles.addressText}>Blok BB No.6, Kota Deltamas</Text>
        <Text style={styles.addressText}>Cikarang 17530, Indonesia</Text>
        <Text style={styles.dateTime}>{currentDate} - {currentTime}</Text>
      </View>
    </View>
  );
};

// Footer component
const Footer = ({ pageNumber, totalPages }) => (
  <View style={styles.footer}>
    <View style={styles.footerContent}>
      <Text style={styles.footerText}>Kalbe Consumer Health Report - Confidential</Text>
      <Text style={styles.pageNumber}>Page {pageNumber} of {totalPages}</Text>
    </View>
  </View>
);

// Helper to group data by category
const groupDataByCategory = (data) => {
  const categories = {
    'Cost Analysis': ['Today Total Cost / Unit', 'Line 1 Cost / Unit', 'Line 2 Cost / Unit', 'Line 3 Cost / Unit'],
    'Utility Usage': ['Boiler Gas Usage', 'PDAM Water Usage', 'Electricity Usage'],
    'Utility Cost': ['Total Boiler Cost', 'Total PDAM Cost', 'Total Electricity Cost'],
    'Production Data': ['Master Box Line 1 - 1', 'Master Box Line 2 - 2', 'Master Box Line 3 - 1', 'Master Box Line 3 - 2'],
    'Daily Limits': ['Daily Electricity', 'Daily PDAM', 'Daily Gas'],
    'Others': []
  };
  
  const groupedData = {};
  
  // Initialize groups
  Object.keys(categories).forEach(category => {
    groupedData[category] = [];
  });
  
  // Assign data to groups
  data.forEach(item => {
    let assigned = false;
    
    Object.keys(categories).forEach(category => {
      if (categories[category].includes(item.title)) {
        groupedData[category].push(item);
        assigned = true;
      }
    });
    
    // If not assigned to any specific category, put in Other
    if (!assigned) {
      groupedData['Others'].push(item);
    }
  });
  
  // Remove empty categories
  Object.keys(groupedData).forEach(category => {
    if (groupedData[category].length === 0) {
      delete groupedData[category];
    }
  });
  
  return groupedData;
};

// Function to determine value styling based on item title
const getValueStyle = (title, value) => {
  if (title.includes('Cost')) {
    return styles.highlightValue;
  }
  return null;
};

// Main document component
const MyDocument = ({ dashboardData }) => {
  const groupedData = groupDataByCategory(dashboardData);
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header />
        <Text style={styles.title}>KALBE CONSUMER HEALTH REPORTING</Text>
        
        {Object.keys(groupedData).map((category, catIndex) => (
          <View key={catIndex} style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{category}</Text>
            <View style={styles.contentContainer}>
              {groupedData[category].map((item, index) => (
                <View key={index} style={styles.itemContainer}>
                  <Text style={styles.subtitle}>{item.title}</Text>
                  <Text style={[styles.value, getValueStyle(item.title, item.value)]}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        
        <Footer pageNumber={3} totalPages={3} />
      </Page>
    </Document>
  );
};

export default MyDocument;