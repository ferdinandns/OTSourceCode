import React, { useEffect, useState } from "react";
import LogoIcon from '../assets/kalbe CH-logo-putih.png';
import LogoIconn2 from '../assets/logo-kalbe CH-black.png';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { LuPill } from "react-icons/lu";
import { FaScrewdriverWrench } from "react-icons/fa6";
import FactoryIcon from '@mui/icons-material/Factory';
import { BsBuildingsFill } from "react-icons/bs";
import { FaChartPie } from "react-icons/fa";
import AssignmentIcon from '@mui/icons-material/Assignment';
import EngineeringIcon from '@mui/icons-material/Engineering';
import EngineeringOutlinedIcon from '@mui/icons-material/EngineeringOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import MenuOpenSharpIcon from '@mui/icons-material/MenuOpenSharp';
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";
import '../index.css'
import { PieChart } from "@mui/icons-material";

function Sidebar() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [open, setOpen] = useState(true);
  const [dropdownStates, setDropdownStates] = useState({});
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const userGlobal = useSelector((state) => state.user.user);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleSidebarToggle = () => {
    setIsSidebarMinimized(!isSidebarMinimized);
    if (!isSidebarMinimized) {
      setDropdownStates({}); // Close all dropdowns when minimizing
    }
    setOpen(!open);
  };

  const toggleDropdown = (menuKey) => {
    setDropdownStates((prevState) => ({
      ...prevState,
      [menuKey]: !prevState[menuKey], // Toggle the specific dropdown
    }));
  };
  
  useEffect(() => {
    // Define a function to check the `data-theme` attribute on the `<html>` element
    const checkTheme = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(currentTheme === 'dark');
    };

    // Initial check
    checkTheme();

    // Listen for changes in the theme attribute
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <nav className={`box-border min-h-screen ${open ? "w-[250px]" : "w-[88px]"} sticky left-0 self-start overflow-hidden top-0 transition-all duration-500 ease-in-out py-[5px]`} style={{ paddingInline: "1em" }}>
      <ul className="list-none space-y-1" >
        <li className="flex justify-end mb-[16px] pt-[2px] " style={{ height: "65.54px" }}>
        {open && (
          <img className="h-[54px] flex-shrink-0 "  src={isDarkMode ? LogoIcon : LogoIconn2} alt="logo" />
        )}
          <button className={`ml-auto p-[10px] pr-[5px] border-none rounded-md bg-none cursor-pointer focus:outline-none hover:bg-hvrr ${!open ? "justify-center w-full" : ""}`}>
            <MenuOpenSharpIcon sx={{ fontSize: 40 }} onClick={handleSidebarToggle} className="flex-shrink-0 w-6 h-6" />
          </button>
        </li>
        <li style={{ height: "51.18px" }}>
          <a 
          className="flex items-center gap-[22px] rounded-md p-[14px] hover:bg-hvrr no-underline hover:underline cursor-pointer" 
          style={{ height: "51.18px" }} 
          onClick={() => {
                    navigate(`/dashboard`);
                  }}>
            <DashboardOutlinedIcon sx={{ fontSize: 24 }} className="flex-shrink-0 m-1 "/>
            {open && <span className="no-underline flex-grow ">Dashboard</span>}
          </a>    
        </li>
        <li>
          {/* Button for dropdown toggle */}
          <button
            className="flex items-center text-left w-full gap-[22px] rounded-md p-[14px] border-none hover:bg-hvrr no-underline hover:no-underline cursor-pointer bg-none focus:outline-none" style={{ height: "51.18px" }}
            onClick={() => toggleDropdown("maintenance")}
            >
            <EngineeringIcon alt="Maintenance" className="w-6 h-6 m-[4px] flex-shrink-0" />
            {open && <span className="no-underline flex-grow ">Maintenance</span>}
            <ArrowDropDownIcon alt="Dropdown" className={`w-6 h-6 flex-shrink-0 transform transition-transform duration-300 ${dropdownStates["maintenance"] ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown menu */}
          
          <ul
          className="sub-menu pl-[32px] grid gap-1 mt-2 overflow-hidden transition-[max-height] duration-500 ease-in-out"
          style={{
            maxHeight: dropdownStates["maintenance"] && !isSidebarMinimized ? "500px" : "0px",
          }}>
          {userGlobal.level < 2 ? (
            <>      
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate(`/maintenance?tab=maintenance-breakdown`)}>Maintenance Breakdown Report</a></li>
            </>
             ) : null}
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate(`/maintenance?tab=handover`)}>Maintenance Report</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate('/maintenance?tab=data-report')}>Data Report</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate('/maintenance?tab=historical')}>Historical Machine</a></li>

         </ul> 
        </li>
        <li style={{ height: "51.18px" }}>
          <a className="flex items-center w-full gap-[22px] rounded-md p-[14px] hover:bg-hvrr no-underline hover:underline cursor-pointer" 
          style={{ height: "51.18px" }} 
          onClick={() => {
                    navigate(`/Instrument`);
                  }}>
            <LuPill alt="Instrument" className="w-6 h-6 m-1 flex-shrink-0" />
            {open && <span className="no-underline flex-grow">Instrument</span>}
          </a>    
        </li>
        <li>
          {/* Button for dropdown toggle */}
          <button
            className="flex items-center text-left w-full gap-[22px] rounded-md p-[14px] border-none hover:bg-hvrr no-underline hover:no-underline cursor-pointer bg-none focus:outline-none" style={{ height: "51.18px" }}
            onClick={() => toggleDropdown("utility")}
            >
            <FaScrewdriverWrench alt="Utility" className="w-6 h-6 m-[4px] flex-shrink-0" />
            {open && <span className="no-underline flex-grow ">Utility</span>}
            <ArrowDropDownIcon alt="Dropdown" className={`w-6 h-6 flex-shrink-0 transform transition-transform duration-300 ${dropdownStates["utility"] ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown menu */}
          
          <ul
          className="sub-menu pl-[32px] grid gap-1 mt-2 overflow-hidden transition-[max-height] duration-500 ease-in-out"
          style={{
            maxHeight: dropdownStates["utility"] && !isSidebarMinimized ? "500px" : "0px",
          }}>   
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate(`/maintenance?tab=power-management`)}>Power Management</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate(`/maintenance?tab=water-management`)}>Water Management</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate('/maintenance?tab=waste-water-management')}>Waste Water Management</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate('/maintenance?tab=HVAC')}>Heating Ventilating & Air Control</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate('/maintenance?tab=steam-control')}>Steam Control</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate('/maintenance?tab=solar-management')}>Solar Management</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate('/maintenance?tab=loopo')}>Loopo</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate('/maintenance?tab=osmotron')}>Osmotron</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate('/maintenance?tab=alarm-list')}>Alarm List</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate('/maintenance?tab=motor-vibration')}>Motor Vibration</a></li>
         </ul> 
        </li>
        <li style={{ height: "51.18px" }}>
          <a className="flex items-center w-full gap-[22px] rounded-md p-[14px] hover:bg-hvrr no-underline hover:underline cursor-pointer" 
          style={{ height: "51.18px" }} 
          onClick={() => {
                    navigate(`/Production`);
                  }}>
            <FactoryIcon alt="Production" className="w-6 h-6 m-1 flex-shrink-0" />
            {open && <span className="no-underline flex-grow">Production</span>}
          </a>    
        </li>
        <li>
          {/* Button for dropdown toggle */}
          <button
            className="flex items-center text-left w-full gap-[22px] rounded-md p-[14px] border-none hover:bg-hvrr no-underline hover:no-underline cursor-pointer bg-none focus:outline-none" style={{ height: "51.18px" }}
            onClick={() => toggleDropdown("building")}
            alt="building">
            <BsBuildingsFill alt="Building" className="w-6 h-6 m-[4px] flex-shrink-0" />
            {open && <span className="no-underline flex-grow ">Building</span>}
            <ArrowDropDownIcon alt="Dropdown" className={`w-6 h-6 flex-shrink-0 transform transition-transform duration-300 ${dropdownStates["building"] ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown menu */}
          
          <ul
          className="sub-menu pl-[32px] grid gap-1 mt-2 overflow-hidden transition-[max-height] duration-500 ease-in-out"
          style={{
            maxHeight: dropdownStates["building"] && !isSidebarMinimized ? "500px" : "0px",
          }}
        >
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate(`/building?tab=EMS`)}>Environment Monitoring Process</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate(`/building?tab=BAS`)}>Building Management System</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate('/building?tab=RnD')}>RnD Laboratorium Monitoring</a></li>
            <li><a className="block p-2 text-sm cursor-pointer hover:bg-hvrr rounded-md hover:no-underline no-underline" onClick={() => navigate('/building?tab=WH1')}>Warehouse 1 Monitoring</a></li>
         </ul> 
        </li>
        <li style={{ height: "51.18px" }}>
          <a className="flex items-center w-full gap-[22px] rounded-md p-[14px] hover:bg-hvrr no-underline hover:underline cursor-pointer" 
          style={{ height: "51.18px" }} 
          onClick={() => {
                    navigate(`/OPE`);
                  }}>
            <FaChartPie alt="OPE" className="w-6 h-6 m-1 flex-shrink-0" />
            {open && <span className="no-underline flex-grow">OPE</span>}
          </a>    
        </li>
        <li style={{ height: "51.18px" }}>
          <a className="flex items-center w-full gap-[22px] rounded-md p-[14px] hover:bg-hvrr no-underline hover:underline cursor-pointer" 
          style={{ height: "51.18px" }} 
          onClick={() => {
                    navigate(`/BatchRecord`);
                  }}>
            <AssignmentIcon alt="Batch Record" className="w-6 h-6 m-1 flex-shrink-0" />
            {open && <span className="no-underline flex-grow">Batch Record</span>}
          </a>    
        </li>
      </ul>       
    </nav>
  );
}

export default Sidebar;
