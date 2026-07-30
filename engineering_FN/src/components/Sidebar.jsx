import { useEffect, useState } from "react";
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
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import MenuOpenSharpIcon from '@mui/icons-material/MenuOpenSharp';
import TableViewIcon from '@mui/icons-material/TableView';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import { ShoppingBag, ShoppingCart, ShoppingCartRounded } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import '../index.css'
import { AssignmentInd, Description, Storage } from "@mui/icons-material";

// --- NavItem moved OUTSIDE Sidebar to fix 'no-undef' errors ---
const NavItem = ({ 
  item, 
  open, 
  dropdownStates, 
  toggleDropdown, 
  navigate, 
  isSidebarMinimized 
}) => {
  const hasSubMenu = item.subMenu && item.subMenu.length > 0;
  const isOpen = dropdownStates[item.name];

  const handleAction = () => {
    if (hasSubMenu) {
      toggleDropdown(item.name);
    } else {
      navigate(item.path);
    }
  };

  return (
    <li>
      <button
        className={`flex items-center text-left w-full gap-[12px] rounded-md p-[10px] border-none cursor-pointer bg-none focus:outline-none transition-all duration-200
          hover:bg-[#87BD40] hover:text-white group`}
        // Changed from 'height' to 'minHeight' to allow vertical expansion for long text
        style={{ minHeight: "42px" }} 
        onClick={handleAction}
      >
        <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
          {item.icon}
        </span>
        
        {open && (
          <span className="no-underline flex-grow text-[13.5px] font-medium leading-tight py-1"> 
            {/* Added leading-tight and padding to handle multi-line text cleanly */}
            {item.name}
          </span>
        )}

        {hasSubMenu && open && (
          <ArrowDropDownIcon
            className={`w-5 h-5 flex-shrink-0 transform transition-transform duration-300 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {hasSubMenu && (
        <ul
          className="pl-[14px] flex flex-col gap-0.5 mt-1 overflow-hidden transition-[max-height] duration-500 ease-in-out border-l border-gray-200 ml-4"
          style={{
            maxHeight: isOpen && !isSidebarMinimized ? "1000px" : "0px",
          }}
        >
          {item.subMenu.map((subItem) => (
            <NavItem
              key={subItem.name}
              item={subItem}
              open={open}
              dropdownStates={dropdownStates}
              toggleDropdown={toggleDropdown}
              navigate={navigate}
              isSidebarMinimized={isSidebarMinimized}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

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
      setDropdownStates({});
    }
    setOpen(!open);
  };

  const toggleDropdown = (menuKey) => {
    setDropdownStates((prevState) => ({
      ...prevState,
      [menuKey]: !prevState[menuKey],
    }));
  };
  
  useEffect(() => {
    const checkTheme = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(currentTheme === 'dark');
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const getNavigationItems = () => {
    const navigation = [];
    if(userGlobal.level < 1 ){
      navigation.push(
        { name: "Dashboard", icon: <DashboardOutlinedIcon />, path: "/dashboard" }
      );
    }
    if (userGlobal.level == 1) {
      navigation.push({
        name: "Dashboard",
        icon: <DashboardOutlinedIcon sx={{ fontSize: 21 }} className="flex-shrink-0 m-1 "/>,
        path: "/dashboard",
      },{
        name: "Maintenance",
        icon: <EngineeringIcon />,
        path: "/maintenance",
        subMenu: [
          { name: "Maintenance Breakdown Report", path: "/maintenance?tab=maintenance-breakdown", visible: userGlobal.level < 2 },
          { name: "Maintenance Report", path: "/maintenance?tab=handover" },
          { name: "Data Report", path: "/maintenance?tab=data-report" },
          { name: "Historical Machine", path: "/maintenance?tab=historical" },
        ],
      });
    }
if (userGlobal.level == 2) {
      navigation.push(

      {
        name: "Warehouse Dashboard",
        icon: <WarehouseIcon size={21} className="flex-shrink-0 m-1"/>,
        path: "/WH2Dashboard",
      }
    );
    }

    if (userGlobal.level == 3) {
      navigation.push(
      {
        name: "Batch Record",
        icon: <AssignmentIcon size={21} className="flex-shrink-0 m-[2px] gap-y-1"/>,
        path: "/granulation-batch-record",
        
      }
      
    );
    }

    

    if (userGlobal.level == 4) {
      navigation.push({
        name: "Dashboard",
        icon: <DashboardOutlinedIcon sx={{ fontSize: 21 }} className="flex-shrink-0 m-1 "/>,
        path: "/dashboard",
      },{
        name: "Maintenance",
        icon: <EngineeringIcon />,
        path: "/maintenance",
        subMenu: [
          { name: "Maintenance Breakdown Report", path: "/maintenance?tab=maintenance-breakdown", visible: userGlobal.level < 2 },
          { name: "Maintenance Report", path: "/maintenance?tab=handover" },
          { name: "Data Report", path: "/maintenance?tab=data-report" },
          { name: "Historical Machine", path: "/maintenance?tab=historical" },
        ],
      },{
        name: "Instrument",
        icon: <LuPill size={21} className="flex-shrink-0 m-1"/>,
        path: "/Instrument",
      },{
        name: "Utility",
        icon: <FaScrewdriverWrench size={20} />,
        path: "/utility",
        subMenu: [
          { name: "Power Management", path: "/utility?tab=power-management" },
          { name: "Water Management", path: "/utility?tab=water-management" },
          { name: "Waste Water Management", path: "/utility?tab=waste-water-management" },
          { name: "Heating Ventilating & Air Control", path: "/utility?tab=HVAC" },
          { name: "Steam Control", path: "/utility?tab=steam-control" },
          { name: "Solar Management", path: "/utility?tab=solar-management" },
          { name: "Loopo", path: "/utility?tab=loopo" },
          { name: "Osmotron", path: "/utility?tab=osmotron" },
          { name: "Alarm List", path: "/utility?tab=alarm-list" },
          { name: "Motor Vibration", path: "/utility?tab=motor-vibration" },
        ],
      },{
        name: "Production",
        icon: <FactoryIcon sx={{ fontSize: 22 }} className="flex-shrink-0" />,
        path: "/production",
        subMenu: [
          { name: "Input Data", path: "/production?tab=Input", visible: userGlobal.level < 5 },
          { name: "OEE CM", path: "/production?tab=Prod" },
          {
            name: "Fette",
            path: "#",
                subMenu: [
                  { name: "Live OEE", path: "/OeeDashboard" },
                  { name: "OEE", path: "/FetteOeeDashboard" },
                  { name: "Downtime", path: "/HybridDowntime" },
                  { name: "Logs", path: "/ETLManager" },
                  { name: "Override", path: "/DayOverrideManager" },
                  { name: "Audit View", path: "/OverrideAuditView" },
                ],
              },
            ],
          
      },{
        name: "Building",
        icon: <BsBuildingsFill size={20} />,
        path: "/building",
        subMenu: [
          { name: "Environment Monitoring Process", path: "/building?tab=EMS" },
          { name: "Building Management System", path: "/building?tab=BAS" },
          { name: "RnD Laboratorium Monitoring", path: "/building?tab=RnD" },
          { name: "Warehouse 1 Monitoring", path: "/building?tab=WH1" },
          { name: "Warehouse 2 Monitoring", path: "/WH2Dashboard" },
          { name: "Vibration", path: "/CMVibration", visible: userGlobal.level > 4 },          
        ],
      },
      
      {
        name: "Spare Part",
        icon: <ShoppingCartRounded size={21} className="flex-shrink-0 m-1"/>,
        path: "/sparepartdashboard",
      },
      
      {
        name: "OPE",
        icon: <FaChartPie size={21} className="flex-shrink-0 m-1 gap-y-4"/>,
        path: "/OPE",
      },{
        name: "Batch Record",
        icon: <AssignmentIcon size={21} className="flex-shrink-0 m-[2px] gap-y-1"/>,
        path: "/BatchRecord",
        subMenu: [
          { name: "Batch Record - CMT", path: "/BatchRecord" },
          { name: "Batch Record - Node-RED", path: "/granulation-batch-record"},
        ],
      },{
        name: "History Tabel",
        icon: <TableViewIcon size={21} className="flex-shrink-0 m-[2px] gap-y-1"/>,
        path: "/HistoryTabel",
      },{
        name: "PMP",
        icon: <AssignmentInd size={21}/>,
        path: "/PWOInput",
        subMenu: [
          /* { name: "PMP Uploader", path: "/PMPUploader", visible: userGlobal.level > 4 },
          { name: "Assign PMP", path: "/assign-jobs", visible: userGlobal.level > 4 },
          { name: "Technician", path: "/TechnicianPage", visible: userGlobal.level <= 5 },
          { name: "Supervisor Approval", path: "/supervisor-approval", visible: userGlobal.level > 4 },
          { name: "Completed PWO", path: "/CompletedJobs",visible: userGlobal.level > 4 }, */
          { name: "Work Order Uploader", path: "/WorkOrderUploader", visible: userGlobal.level > 4 },
          { name: "Work Order Dashboard", path: "/workorderdashboard", visible: userGlobal.level > 4 },
        ],
      },

      /* {
        name: "Work Order",
        icon: <Description size={21} className="flex-shrink-0 m-1"/>,
        path: "/work-orders",
      }, */
      
      {
        name: "Database",
        icon: <Storage size={21} className="flex-shrink-0 m-1 gap-y-4"/>,
        path: "/DataMonitor",
         subMenu: [
          { name: "Database", path: "/DataMonitor", visible: userGlobal.level > 4 },
          { name: "Tabel Integrity", path: "/DataIntegrity", visible: userGlobal.level > 4 },
        ],
      },
      {
        name: "Form",
        icon: <Description size={21} className="flex-shrink-0 m-1"/>,
        path: "/BatchPage",
      },
    
    );
    }

    // ... Levels 2, 3, 4 shortened for brevity in this response but kept in your logic ...
    if (userGlobal.level == 5) {
      navigation.push({
        name: "Dashboard",
        icon: <DashboardOutlinedIcon sx={{ fontSize: 21 }} className="flex-shrink-0 m-1 "/>,
        path: "/dashboard",
      },{
        name: "Maintenance",
        icon: <EngineeringIcon />,
        path: "/maintenance",
        subMenu: [
          { name: "Maintenance Breakdown Report", path: "/maintenance?tab=maintenance-breakdown", visible: userGlobal.level < 2 },
          { name: "Maintenance Report", path: "/maintenance?tab=handover" },
          { name: "Data Report", path: "/maintenance?tab=data-report" },
          { name: "Historical Machine", path: "/maintenance?tab=historical" },
        ],
      },{
        name: "Instrument",
        icon: <LuPill size={21} className="flex-shrink-0 m-1"/>,
        path: "/Instrument",
      },{
        name: "Utility",
        icon: <FaScrewdriverWrench size={20} />,
        path: "/utility",
        subMenu: [
          { name: "Power Management", path: "/utility?tab=power-management" },
          { name: "Water Management", path: "/utility?tab=water-management" },
          { name: "Waste Water Management", path: "/utility?tab=waste-water-management" },
          { name: "Heating Ventilating & Air Control", path: "/utility?tab=HVAC" },
          { name: "Steam Control", path: "/utility?tab=steam-control" },
          { name: "Solar Management", path: "/utility?tab=solar-management" },
          { name: "Loopo", path: "/utility?tab=loopo" },
          { name: "Osmotron", path: "/utility?tab=osmotron" },
          { name: "Alarm List", path: "/utility?tab=alarm-list" },
          { name: "Motor Vibration", path: "/utility?tab=motor-vibration" },
        ],
      },{
        name: "Production",
        icon: <FactoryIcon sx={{ fontSize: 22 }} className="flex-shrink-0" />,
        path: "/production",
        subMenu: [
          { name: "PMA Vibration", path: "/pmaDashboard", visible: userGlobal.level < 5 },
          { name: "Input Data", path: "/production?tab=Input", visible: userGlobal.level < 5 },
          { name: "OEE CM", path: "/production?tab=Prod" },
          {
            name: "Fette",
            path: "#",
                subMenu: [
                  { name: "Live OEE", path: "/OeeDashboard" },
                  { name: "OEE", path: "/FetteOeeDashboard" },
                  { name: "Downtime", path: "/HybridDowntime" },
                  { name: "Logs", path: "/ETLManager" },
                  { name: "Override", path: "/DayOverrideManager" },
                  { name: "Audit View", path: "/OverrideAuditView" },
                ],
              },
            ],
          
      },{
        name: "Building",
        icon: <BsBuildingsFill size={20} />,
        path: "/building",
        subMenu: [
          { name: "Environment Monitoring Process", path: "/building?tab=EMS" },
          { name: "Building Management System", path: "/building?tab=BAS" },
          { name: "RnD Laboratorium Monitoring", path: "/building?tab=RnD" },
          { name: "Warehouse 1 Monitoring", path: "/building?tab=WH1" },
          { name: "Warehouse 2 Monitoring", path: "/WH2Dashboard" },
          { name: "Vibration", path: "/CMVibration", visible: userGlobal.level > 4 },          
        ],
      },
      
      {
        name: "Spare Part",
        icon: <ShoppingCartRounded size={21} className="flex-shrink-0 m-1"/>,
        path: "/sparepartdashboard",
      },
      
      {
        name: "OPE",
        icon: <FaChartPie size={21} className="flex-shrink-0 m-1 gap-y-4"/>,
        path: "/OPE",
      },{
        name: "Batch Record",
        icon: <AssignmentIcon size={21} className="flex-shrink-0 m-[2px] gap-y-1"/>,
        path: "/BatchRecord",
        subMenu: [
          { name: "Batch Record - CMT", path: "/BatchRecord" },
          { name: "Batch Record - Node-RED", path: "/granulation-batch-record"},
        ],
      },{
        name: "History Tabel",
        icon: <TableViewIcon size={21} className="flex-shrink-0 m-[2px] gap-y-1"/>,
        path: "/HistoryTabel",
      },{
        name: "PMP",
        icon: <AssignmentInd size={21}/>,
        path: "/PWOInput",
        subMenu: [
          /* { name: "PMP Uploader", path: "/PMPUploader", visible: userGlobal.level > 4 },
          { name: "Assign PMP", path: "/assign-jobs", visible: userGlobal.level > 4 },
          { name: "Technician", path: "/TechnicianPage", visible: userGlobal.level <= 5 },
          { name: "Supervisor Approval", path: "/supervisor-approval", visible: userGlobal.level > 4 },
          { name: "Completed PWO", path: "/CompletedJobs",visible: userGlobal.level > 4 }, */
          { name: "Work Order Uploader", path: "/WorkOrderUploader", visible: userGlobal.level > 4 },
          { name: "Work Order Dashboard", path: "/workorderdashboard", visible: userGlobal.level > 4 },
        ],
      },

      /* {
        name: "Work Order",
        icon: <Description size={21} className="flex-shrink-0 m-1"/>,
        path: "/work-orders",
      }, */
      
      {
        name: "Database",
        icon: <Storage size={21} className="flex-shrink-0 m-1 gap-y-4"/>,
        path: "/DataMonitor",
         subMenu: [
          { name: "Database", path: "/DataMonitor", visible: userGlobal.level > 4 },
          { name: "Tabel Integrity", path: "/DataIntegrity", visible: userGlobal.level > 4 },
        ],
      },
      {
        name: "Form",
        icon: <Description size={21} className="flex-shrink-0 m-1"/>,
        path: "/BatchPage",
      },
    
    );
    }

    

    return navigation;
  };

  const navigation = getNavigationItems();
  
  return (
    <nav
      className={`box-border bg-background border-border min-h-screen ${
        open ? "w-[250px]" : "w-[88px]"
      } sticky left-0 self-start overflow-hidden top-0 transition-all duration-500 ease-in-out py-[5px]`}
      style={{ paddingInline: "1em" }}
    >
      <ul className="list-none space-y-1">
        <li className="flex justify-end mb-[16px] pt-[2px]" style={{ height: "65.54px" }}>
          {open && <img className="h-[54px] flex-shrink-0" src={isDarkMode ? LogoIcon : LogoIconn2} alt="logo" />}
          <button
            className={`ml-auto p-[10px] pr-[5px] border-none rounded-md bg-none cursor-pointer focus:outline-none hover:bg-hvrr ${
              !open ? "justify-center w-full" : ""
            }`}
          >
            <MenuOpenSharpIcon
              sx={{ fontSize: 40 }}
              onClick={handleSidebarToggle}
              className="flex-shrink-0 w-6 h-6"
            />
          </button>
        </li>

        {navigation.map((item) => (
          <NavItem 
            key={item.name}
            item={item}
            open={open}
            dropdownStates={dropdownStates}
            toggleDropdown={toggleDropdown}
            navigate={navigate}
            isSidebarMinimized={isSidebarMinimized}
          />
        ))}
      </ul>
    </nav>
  );
}

export default Sidebar;