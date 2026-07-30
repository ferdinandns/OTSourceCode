import DarkMode from "./DarkMode/DarkMode";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useEffect, useState, useRef } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import store from '../app/store.js'; // pastikan ini mengarah ke redux store-mu

// Guard flag to prevent endless 401 loops when token is expired
let isHandling401 = false;

function Header()  {
    const userGlobal = useSelector((state) => state.user.user);
    const navigate = useNavigate();
    const [darkMode, setDarkMode] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

    // useEffect(() => {
    //   if (darkMode) {
    //     document.documentElement.classList.add('dark');
    //   } else {
    //     document.documentElement.classList.remove('dark');
    //   }
    // }, [darkMode]);


  // if (userGlobal.imagePath) {
  //   imageData = `http://10.126.15.197:8002${userGlobal.imagePath}`;
  // } else {
  //   imageData =
  //     "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";
  // }

  // ini gw nyoba kalau token abis tanpa menekan tombol logout 
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      async error => {
        if (error.response && error.response.status === 401) {
          if (isHandling401) {
            return Promise.reject(error);
          }
          isHandling401 = true;
          try {
            const token = localStorage.getItem("user_token");
            if (token) {
              await axios.post('http://10.126.15.197:8002/part/LogoutData', {}, {
                headers: {
                  Authorization: `Bearer ${token}`
                },
                validateStatus: () => true // avoid interceptor loop on this call
              });
            }
          } catch (err) {
            console.log("Logout tracking failed:", err);
          } finally {
            localStorage.removeItem("user_token");
            window.location.href = "/login";
            isHandling401 = false;
          }
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  let isLoggingOut = false;

  const logOut = async () => {
    if (isLoggingOut) return;
    isLoggingOut = true;
    try {
      const token = localStorage.getItem("user_token");
      if (token) {
        await axios.post('http://10.126.15.197:8002/part/LogoutData', {}, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }
      toast.success("You have successfully logged out!");
      localStorage.removeItem("user_token");
      navigate("/login");
      navigate(0);
    } catch (err) {
      console.log("Logout tracking failed:", err);
    } finally {
      isLoggingOut = false;
    }
  };

  // const logOut = async () => {
  //   try {
  //   await axios.post('http://10.126.15.197:8002/part/LogoutData', {
  //     id_char: userGlobal.id,
  //     logout_time: new Date().toLocaleString(), // atau format apapun yg kamu mau
  //   });
    
  //   } catch (err) {
  //   // Optional: handle error
  //   }
  //     toast.success("You have successfully logged out!"); // Add the toast
  //     localStorage.removeItem("user_token");
  //     navigate("/login");
  //     navigate(0);
  // };

  // console.log("userRedux", userRedux);
  // console.log("userGlobal", userGlobal);

  const [currentDateTimeString, setCurrentDateTimeString] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      const currentDateTime = new Date();
      const day = currentDateTime.getDate().toString().padStart(2, "0");
      const monthIndex = currentDateTime.getMonth();
      const year = currentDateTime.getFullYear().toString();
      const hours = currentDateTime.getHours().toString().padStart(2, "0");
      const minutes = currentDateTime.getMinutes().toString().padStart(2, "0");
      const seconds = currentDateTime.getSeconds().toString().padStart(2, "0");

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const month = monthNames[monthIndex];

      const updatedDateTimeString = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

      setCurrentDateTimeString(updatedDateTimeString);
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {}, []);
   

  const imageData = userGlobal.imagePath
  ? `http://10.126.15.197:8002${userGlobal.imagePath}`
  : "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";

    
  return (
    <header className="sticky top-0 z-50 flex w-full drop-shadow-1 px-0 dark:drop-shadow-none bg-background border-b-2 border-border">
      <div className="flex flex-grow items-center justify-between px-4 py-4 shadow-2 md:px-6 2xl:px-11 ">
        <div className="hidden sm:block">
          <form action="https://formbold.com/s/unique_form_id" method="POST">
            <div className="relative">
              <button className="absolute left-0 top-1/2 -translate-y-1/2">
                <SearchIcon />
              </button>
              <input
                type="text"
                placeholder="Type to search..."
                className="w-full bg-transparent pl-9 pr-4 focus:outline-none xl:w-125 text-text"/>
            </div>
          </form>
        </div>
        <div className="flex items-center gap-3 ">
          <div>
            <p className="text-text mr-4 my-0">{currentDateTimeString}</p>
          </div>
          <DarkMode />  
          <div className="relative">
            <a onClick={toggleDropdown} className="flex items-center gap-4 cursor-pointer">
              <span className="hidden text-right lg:block">
                <span className="block text-sm font-medium text-text">{userGlobal.name}</span>
                {/* <span className="block text-sm font-medium text-text">User</span> */}
                {/* <span className="block text-xs font-medium text-text">UX Designer</span> */}
              </span>
              <span className="h-8 w-8 rounded-full z-10">
                <img className="block h-8 w-8 justify-center rounded-full ring-2 ring-red" src={imageData} alt=""/>
                  
              </span>
              <KeyboardArrowDownIcon sx={{ fontSize: 25 }} alt="Dropdown" className={`w-6 h-6 flex-shrink-0 cursor-pointer transform transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </a>
            {isDropdownOpen && (
            <div  className="absolute right-0 mt-[17px] flex w-48 flex-col rounded-sm border border-border bg-background">
              <ul className="flex flex-col gap-5 border-b px-6 pt-2 pb-0 mb-0 bg-background">
                <li>
                <a className="flex items-center gap-3.5 mb-2 text-sm font-medium duration-300 ease-in-out lg:text-base cursor-pointer"
                 onClick={() => {
                  navigate(`/editprofile`);
                }}>
                  <PersonIcon sx={{ fontsize: 26 }} />
                  <span className="hover:underline">My Profile</span>
                </a>
                {/* nyalain kondisinya biar fitur admin setting cuma buat admin doang bisa nyala dan kepake */}
                {userGlobal.isAdmin === 1 && (
                  <a className="flex items-center gap-3.5 mb-1 text-sm font-medium duration-300 ease-in-out lg:text-base cursor-pointer "
                   onClick={() => {
                    navigate(`/admin`);
                  }}>
                    <SettingsIcon sx={{ fontSize: 25 }}/>
                    <span className="hover:underline">Admin</span>
                  </a>
                )}
                </li> 
              </ul>
              <button className="flex items-center gap-3.5 px-6 py-2 my- text-sm font-medium duration-300 ease-in-out lg:text-base cursor-pointer border-none focus:outline-none"
              onClick={logOut}
              >
                <LogoutIcon alt="keluar"  />
                <span className="hover:underline">Logout</span>
              </button>
            </div>
              )}
          </div>

        </div>
      </div>
      <ToastContainer position="top-center" draggable/>
    </header>
  );
}

export default Header;
