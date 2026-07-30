import React, { useEffect, useState } from "react";
import LogoIcon from '../assets/kalbe CH-logo-putih.png';
import DashboardIcon from '../sdbarsvg/dashboard_.svg'; // Import other icons
import MaintenanceIcon from '../sdbarsvg/maintenance_.svg';
import InstrumenIcon from '../sdbarsvg/side_.svg';
// import UtilIcon from './sdbarsvg/util_.svg';
// import ProdIcon from './sdbarsvg/prod_.svg';
// import BuildIcon from './sdbarsvg/build_.svg';
// import OPEIcon from './sdbarsvg/OPE.svg';
// import BatchIcon from './sdbarsvg/Record_.svg';
import DropIcon from '../sdbarsvg/dropdown.svg';
import ShiftIcon from '../sdbarsvg/arrcircleft_.svg';
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

function Sidebar() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isClosed, setIsClosed] = useState(false); // For sidebar toggle
  const [openSubMenu, setOpenSubMenu] = useState(null); // For dropdown toggle

  // Toggle sidebar open/close
  const toggleSidebar = () => {
    setIsClosed(!isClosed);
    setOpenSubMenu(null); // Close any open submenus
  };

  // Toggle submenu
  const toggleSubMenu = (menu) => {
    setOpenSubMenu(openSubMenu === menu ? null : menu);
  };

  useEffect(() => {}, []);

  return (
    <nav className={`${isClosed ? 'w-16' : 'w-60 p-4'}transition-all duration-300 bg-baseclr h-screen sticky top-0 overflow-hidden box-border`}>
      <ul>
        <li className="flex justify-between items-center mb-4">
          <img className="h-14" src={LogoIcon} alt="Company Logo" />
          <button onClick={toggleSidebar} className="ml-auto p-4 pr-1 border-none rounded-md bg-none cursor-pointer hover:bg-hoverclr">
            {/* SVG for toggle button */}
            <img alt="1" src={ShiftIcon} className="w-6 h-6 flex-shrink-0 fill-current text-textclr" />
          </button>
        </li>

        {/* Dashboard */}
        <li className="mb-4">
          <a href="#" className={`flex items-center p-3 rounded-lg text-textclr hover:bg-hoverclr ${!isClosed ? 'gap-4' : ''} ${isClosed ? 'justify-center' : ''}`}>
            <img className="w-6 h-6" src={DashboardIcon} alt="2" />
            {!isClosed && <span>Dashboard</span>}
          </a>
        </li>

        {/* Maintenance with Submenu */}
        <li className="mb-4">
          <button onClick={() => toggleSubMenu('maintenance')} className="flex items-center p-3 w-full rounded-lg hover:bg-hoverclr text-textclr">
            <img className="w-6 h-6" src={MaintenanceIcon} alt="3" />
            {!isClosed && <span className="flex-grow">Maintenance</span>}
            <img src={DropIcon} className={`transform ${openSubMenu === 'maintenance' ? 'rotate-180' : ''} transition-transform duration-200`} />
          </button>

          <ul className={`${openSubMenu === 'maintenance' ? 'block' : 'hidden'} transition-all duration-300`}>
            <li className="pl-8">
              <a href="#" className="block py-2">Maintenance Report</a>
            </li>
            {/* Add more sub-menu items */}
            <li className="pl-8">
              <a href="#" className="block py-2">Maintenance Breakdown Report</a>
            </li>
            <li className="pl-8">
              <a href="#" className="block py-2">Data Report</a>
            </li>
            <li className="pl-8">
              <a href="#" className="block py-2">Historical Machine</a>
            </li>
          </ul>
        </li>
        {/* Add more sidebar items similarly */}
        <li className="mb-4">
          <a href="#" className={`flex items-center p-3 rounded-lg hover:bg-hoverclr ${!isClosed ? 'gap-4' : ''} ${isClosed ? 'justify-center' : ''}`}>
            <img className="w-6 h-6" src={InstrumenIcon} alt="4" />
            {!isClosed && <span>Instrument</span>}
          </a>
        </li>
      </ul>
    </nav>

  );
}

export default Sidebar;
