import logoIcon from '../assets/kalbe CH-logo-putih.png';
import imageIcon from '../assets/gambar.jpg';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { loginData } from "../features/part/userSlice";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function Login () {
  const [showPassword, setShowPassword] = useState(false); // State to toggle password visibility
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const toastDisplayed = useRef(false);

  const userRedux = useSelector(state => state.user);

  // ganti dengan endpoint backend milikmu
  const LOG_ENDPOINT = 'http://10.126.15.197:8002/part/LoginData';

  const loginTriggered = useRef(false);

  const emailHendeler = (event) => {
    setEmail(event.target.value);
  };
  const passwordHendeler = (event) => {
    setPassword(event.target.value);
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      addLogin();
    }
  };
  const handleRememberMe = (event) => {
    setRememberMe(event.target.checked);
  };

  const checkConnection = async () => {
    try {
      const response = await axios.get('http://10.126.15.197:8002/api/connection');
      const { db1, db2, db3, db4, postgresql } = response.data;

      const errors = [];
      if (db1 !== "YOMAN") errors.push("DB1");
      if (db2 !== "YOMAN") errors.push("DB2");
      if (db3 !== "YOMAN") errors.push("DB3");
      if (db4 !== "YOMAN") errors.push("DB4");
      if (postgresql !== "YOMAN") errors.push("PostgreSQL");

      if (errors.length === 0) {
        setConnectionStatus('success');
        if (!toastDisplayed.current) {
          toast.success("All connections are successful!");
          toastDisplayed.current = true;
        }
      } else {
        setConnectionStatus('error');
        if (!toastDisplayed.current) {
          toast.error(`Error: Connection to ${errors.join(', ')} failed.`);
          toastDisplayed.current = true;
        }
      }
    } catch (error) {
      setConnectionStatus('error');
      if (!toastDisplayed.current) {
        toast.error("Error: Unable to connect to the server. Please check your connection and try again.");
        toastDisplayed.current = true;
      }
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const addLogin = async () => {
    if (!email || !password) {
      toast.error("Email and password are required!");
      return;
    }
     
    const loginResult = await dispatch(loginData({ email, password }));

    // Ambil level user dari hasil login atau dari redux state sebagai fallback
    const detectedLevel =
      loginResult?.level ??
      loginResult?.user?.level ??
      userRedux?.user?.level;

      const detectedDepartment =
      loginResult?.department ??
      loginResult?.user?.department ??
      userRedux?.user?.department;

    const isSuccess = !!loginResult;
    if (isSuccess) {
      loginTriggered.current = true;
      const levelNum = Number(detectedLevel);
      localStorage.setItem("user_level", levelNum);
      
      // 1. Set a default fallback path (e.g., for Level 1 New Users or Level 5 Admins)
      let targetPath = '/dashboard'; 
      
      // 2. Route based on specific levels
      if (levelNum === 4) {
          targetPath = '/workorderdashboard';
      } else if (levelNum === 2) {
          // Warehouse Operator and Warehouse Manager get sent to WH2
          targetPath = '/WH2Dashboard'; 
      } else if (levelNum === 3) {
          // Production Operator and Production Manager get sent to Granulation Batch Record
          targetPath = '/granulation-batch-record'; 
      }

      if (detectedDepartment === 'Sparepart') {
          targetPath = '/sparepartdashboard'; // Change this if your route name is different!
      }

      console.log('Login success. Detected level:', detectedLevel, '→ redirect to', targetPath);
      
      setTimeout(() => {
        navigate(targetPath);
      }, 2000);
    }
    console.log('Login action result:', loginResult);

  };

  // useEffect(() => {
  //   if (
  //     loginTriggered.current &&
  //     userRedux &&
  //     userRedux.name &&
  //     userRedux.id_users // pastikan field tidak undefined
  //   ) {
  //     logLoginActivity(userRedux);
  //     loginTriggered.current = false; // reset agar tidak double-call
  //   }
  // }, [userRedux]); // listen perubahan userRedux

  // const logLoginActivity = async (user) => {
  // console.log('Logging to backend 2:', user); // cek data yang dikirim
  //   try {
  //     await axios.post(LOG_ENDPOINT, {
  //       name: user.name,
  //       id: user.id_users, // atau user.id_users, sesuaikan dengan struktur userRedux
  //       isAdmin: user.isAdmin,
  //       level: user.level,
  //       imagePath: user.imagePath,
  //     });
  //   } catch (err) {
  //     console.log("Log login failed: ", err);
  //   }
  // };


  // const logLoginActivity = async (user) => {
  //   try {
  //     console.log('Logging to backend 2:', user); // cek data yang dikirim
  //     await axios.post(LOG_ENDPOINT, {
  //       name: user.name,
  //       id: user.id_users,
  //       isAdmin: user.isAdmin,
  //       level: user.level,
  //       imagePath: user.imagePath,
  //     });
  //   } catch (err) {
  //     // Optional: handle error log login
  //     console.log("Log login failed: ", err);
  //   }
  // };

  const handleLoginButton = async () => {
    // 1. Log aktivitas login ke backend (kirim email/password atau data lain yang kamu mau)
    

    // 2. Proses login seperti biasa
    addLogin();
    // logLoginActivity();
  };

  return (
    <div className="min-h-screen flex justify-end">
    <div className="hidden md:block md:w-1/2 min-h-screen bg-no-repeat bg-left bg-cover" style={{ backgroundImage: `url(${imageIcon})` }}></div>   
      
      <div className="bg-hitam2 min-h-screen w-full md:w-1/2 flex justify-center items-center">
        <div>
          <form onSubmit={(e) => e.preventDefault()}>
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img src={logoIcon} alt="Logo" className="w-[180px]" />
            </div>

            {/* Welcome text */}
            <div>
              <span className="text-sm text-white">Welcome Back!</span>
              <h1 className="text-2xl font-bold mt-1 text-white">Login to your account</h1>
            </div>

            {/* Email Input */}
            <div className="mt-5">
              <label className="block text-md mb-2 text-white" htmlFor="email">Email</label>
              <input
                className="px-4 w-full border-2 border-white bg-hitam2 py-3 rounded-md text-sm outline-none text-white"
                type="email"
                id="email-address"
                name="email"
                autoComplete="email"
                  required
                onChange={emailHendeler}
                placeholder="Enter Email"
                onKeyDown={handleKeyDown}
              />
            </div>

            {/* Password Input */}
            <div className="my-3 relative">
              <label className="block text-md mb-2 text-white" htmlFor="password">Password</label>
              <input
                className="px-4 w-full border-2 border-white bg-hitam2 py-3 rounded-md text-sm outline-none text-white"
                type={showPassword ? "text" : "password"} // Toggle between text and password
                name="password"
                id="password"
                value={password}
                autoComplete="current-password"
                  required
                onChange={passwordHendeler}
                placeholder="Enter Password"
                onKeyDown={handleKeyDown}
              />
              {/* Eye icon inside password field */}
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-4 top-[42px] w-5 cursor-pointer text-white focus:outline-none">
                {showPassword ? <VisibilityIcon /> : <VisibilityOffIcon />}
              </button>
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex justify-between">
              <div>
                <input className="cursor-pointer" type="checkbox" name="rememberme"  onChange={handleRememberMe} />
                <span className="text-sm text-white"> Remember Me</span>
              </div>
              <span className="text-sm text-blue-700 hover:underline cursor-pointer" 
              onClick={() => {navigate(`/resetpass`);
            }}>Forgot password?</span>
            </div>

            {/* Login Button */}
            <div className="">
              <button className={`mt-4 mb-3 w-full text-white py-2 rounded-md transition duration-100 ${connectionStatus === 'success' ? 'bg-hijau hover:bg-hijau2' 
              : connectionStatus === 'error' ? 'bg-kotakMerah hover:bg-bdrMerah' : 'bg-blue-500 cursor-not-allowed opacity-60'}`}
              onClick={addLogin} type="button">
                Login now
              </button>
            </div>
          </form>

          <ToastContainer position="top-center" draggable />

          {/* Sign Up Link */}
          <p className="mt-8 text-white">
            Don't have an account? <span className="font-bold text-white"> Register</span> <span className="cursor-pointer text-blue-600 underline" onClick={() => {
              navigate(`/register`);
            }}> Here!</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
