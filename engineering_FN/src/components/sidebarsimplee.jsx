import React from "react";
import { Link } from "react-router-dom";

function Sidebar() {
  return (
    <div className="w-[250px] h-full bg-baseclr text-white p-4">
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <nav>
        <ul className="space-y-10">
          <li>
            <Link to="/mail" className="hover:text-highlight">
              Check Mail
            </Link>
          </li>
          <li>
            <Link to="/Stopwatch" className="hover:text-highlight">
              Stopwatch
            </Link>
          </li>
          <li>
            <Link to="/maintenance" className="hover:text-highlight">
              Maintenance
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

export default Sidebar;