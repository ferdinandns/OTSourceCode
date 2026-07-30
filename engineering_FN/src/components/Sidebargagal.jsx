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
import '../'

function Sidebar() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isClosed, setIsClosed] = useState(false); // For sidebar toggle
  const [openSubMenu, setOpenSubMenu] = useState(''); // For dropdown toggle

  // Toggle sidebar open/close
  const toggleSidebar = () => {
    setIsClosed(!isClosed);
  };

  // Toggle submenu
  const toggleSubMenu = (menu) => {
    setOpenSubMenu(openSubMenu === menu ? '' : menu);
  };

  useEffect(() => {}, []);

  return (
    <nav className={`${isClosed ? 'w-16' : 'w-60 p-4'} transition-all duration-300 bg-baseclr h-screen sticky top-0`}>
      <ul>
        <li className="flex justify-between items-center mb-4">
          <img className="h-14" src={LogoIcon} alt="Company Logo" />
          <button onClick={toggleSidebar} className="p-2 hover:bg-hoverclr rounded-lg">
            <img src={ShiftIcon} alt="Toggle Sidebar" className="w-6 h-6" />
          </button>
        </li>

        <li className="mb-4">
          <a href="#" to="/dashboard" className={`flex items-center p-3 rounded-lg text-textclr hover:bg-hoverclr ${isClosed ? 'justify-center' : ''}`}>
            <img src={DashboardIcon} alt="Dashboard" className="w-6 h-6" />
            {!isClosed && <span>Dashboard</span>}
          </a>
        </li>

        {/* Maintenance with Submenu */}
        <li className="mb-4">
          <button onClick={() => toggleSubMenu('maintenance')} className="flex items-center p-3 w-full rounded-lg hover:bg-hoverclr">
            <img src={MaintenanceIcon} alt="Maintenance" className="w-6 h-6" />
            {!isClosed && <span className="flex-grow">Maintenance</span>}
            <img src={DropIcon} alt="Dropdown" className={`transition-transform ${openSubMenu === 'maintenance' ? 'rotate-180' : ''}`} />
          </button>
        </li>

        <li className="mb-4">
          <a href="#" to="/instrument" className={`flex items-center p-3 rounded-lg hover:bg-hoverclr ${isClosed ? 'justify-center' : ''}`}>
            <img src={InstrumenIcon} alt="Instrument" className="w-6 h-6" />
            {!isClosed && <span>Instrument</span>}
          </a>
        </li>
      </ul>
    </nav>
  );

}

export default Sidebar;
