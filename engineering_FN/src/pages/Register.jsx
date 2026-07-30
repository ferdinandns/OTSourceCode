import logoIcon from '../assets/kalbe CH-logo-putih.png';
import imageIcon from '../assets/gambar.jpg';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import React from "react";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import { registerData } from "../features/part/userSlice";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false); // State to toggle password visibility

  const [fullName, setFullName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const fullNameHendeler = (event) => {
    setFullName(event.target.value);
  };
  const userNameHendeler = (event) => {
    setUserName(event.target.value);
  };
  const emailHendeler = (event) => {
    setEmail(event.target.value);
  };
  const passwordHendeler = (event) => {
    setPassword(event.target.value);
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleRegister = () => {
    if (!fullName || !userName || !email || !password) {
      toast.error("All fields are required!");
      return;
    }

    const userData = {
      name: fullName,
      username: userName,
      email,
      password,
    };

    dispatch(registerData(userData));

    setTimeout(() => {
      navigate("/login"); // Redirect to login page after registration
    }, 2000);
  };

  return (
    <div className="min-h-screen flex justify-end">
    <div
    className="w-1/2 min-h-screen bg-no-repeat bg-left bg-cover"
    style={{ backgroundImage: `url(${imageIcon})` }}
  ></div>
    
      
      <div className="bg-hitam2 min-h-screen w-1/2 flex justify-center items-center">
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
              <label className="block text-md mb-2 text-white" htmlFor="email">Full Name</label>
              <input
                onChange={fullNameHendeler}
                value={fullName}
                className="px-4 w-full border-2 border-white bg-hitam2 py-3 rounded-md text-sm outline-none text-white focus:z-10"
                id="fullname"
                name="fullname"
                type="text"
                autoComplete="fullname"
                required
                placeholder="Enter Full Name"
              />
            </div>
            <div className="mt-2">
              <label className="block text-md mb-2 text-white" htmlFor="email">Username</label>
              <input
                onChange={userNameHendeler}
                value={userName}
                className="px-4 w-full border-2 border-white bg-hitam2 py-3 rounded-md text-sm outline-none text-white focus:z-10"
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Enter Username"
              />
            </div>
            <div className="mt-2">
              <label className="block text-md mb-2 text-white" htmlFor="email">Email</label>
              <input
                onChange={emailHendeler}
                value={email}
                className="px-4 w-full border-2 border-white bg-hitam2 py-3 rounded-md text-sm outline-none text-white focus:z-10"
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter Email"
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
              />
              {/* Eye icon inside password field */}
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-4 top-[42px] w-5 cursor-pointer text-white focus:outline-none">
                {showPassword ? <VisibilityIcon /> : <VisibilityOffIcon />}
              </button>
            </div>

            {/* Register Button */}
            <div className="">
              <button className="mt-4 mb-3 w-full bg-hijau hover:bg-hijau2 text-white py-2 rounded-md transition-all duration-300"
              onClick={handleRegister} type="button">
                Sign Up
              </button>
            </div>
          </form>

          <ToastContainer position="top-center" draggable />

          {/* Sign Up Link */}
        </div>
      </div>
    </div>
  );
}

export default Register;
