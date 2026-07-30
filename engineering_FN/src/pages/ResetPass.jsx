import logoIcon from "../assets/kalbe CH-logo-putih.png";
import imageIcon from "../assets/gambar.jpg";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import React from "react";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";

const ResetPass = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false); // State to toggle password visibility

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const emailHendeler = (event) => {
    setEmail(event.target.value);
  };

  const passwordHendeler = (event) => {
    setPassword(event.target.value);
    if (confirmPassword && event.target.value !== confirmPassword) {
      setPasswordError("Passwords do not match");
    } else {
      setPasswordError("");
    }
  };

  const confirmPasswordHandler = (event) => {
    setConfirmPassword(event.target.value);
    if (password && event.target.value !== password) {
      setPasswordError("Passwords do not match");
    } else {
      setPasswordError("");
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleRegister = async () => {
    if (!password || !confirmPassword) {
      toast.error("All fields are required!");

      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match!");
      return;
    }

    const userPass = {
      password,
    };

    try {
      const response = await axios.patch(
        "http://10.126.15.197:8002/part/changePassword",
        {
          email: email,
          newPassword: password,
        }
      );
      console.log(response);

      if (response.status === 200) {
        toast.success("Password reset successfully!");
        setTimeout(() => {
          navigate("/login"); // Redirect to login page after registration
        }, 2000);
      } else {
        toast.error("Failed to reset password. Please try again.");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    }
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
            <div className="flex justify-center mb-6">
              <img src={logoIcon} alt="Logo" className="w-[180px]" />
            </div>
            <div>
              <span className="text-sm text-white"></span>
              <h1 className="text-2xl font-bold mt-1 text-white">
                Create a New Password
              </h1>
            </div>
            {/* Email Input */}
            <div className="mt-3">
              <label className="block text-md mb-2 text-white" htmlFor="email">
                Email
              </label>
              <input
                className="px-4 w-full border-2 border-white bg-hitam2 py-3 rounded-md text-sm outline-none text-white"
                type="email"
                id="email-address"
                name="email"
                autoComplete="email"
                required
                onChange={emailHendeler}
                placeholder="Enter Email"
                // onKeyDown={handleKeyDown}
              />
            </div>
            {/* Password Input */}
            <div className="my-3 relative">
              <label
                className="block text-md mb-2 text-white"
                htmlFor="password"
              >
                Password
              </label>
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
                className="absolute right-4 top-[42px] w-5 cursor-pointer text-white focus:outline-none"
              >
                {showPassword ? <VisibilityIcon /> : <VisibilityOffIcon />}
              </button>
            </div>
            {/* Confirm Password Input */}
            <div className="my-3 relative">
              <label
                className="block text-md mb-2 text-white"
                htmlFor="password"
              >
                Confirm Password
              </label>
              <input
                className="px-4 w-full border-2 border-white bg-hitam2 py-3 rounded-md text-sm outline-none text-white"
                type={showPassword ? "text" : "password"} // Toggle between text and password
                name="password"
                id="password"
                value={confirmPassword}
                autoComplete="current-password"
                required
                onChange={confirmPasswordHandler}
                placeholder="Enter Password"
              />
              {/* Eye icon inside password field */}
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-4 top-[42px] w-5 cursor-pointer text-white focus:outline-none"
              >
                {showPassword ? <VisibilityIcon /> : <VisibilityOffIcon />}
              </button>
            </div>

            {/* Register Button */}
            <div className="">
              <button
                className="mt-4 mb-3 w-full bg-hijau hover:bg-hijau2 text-white py-2 rounded-md transition-all duration-300"
                onClick={handleRegister}
                type="button"
              >
                Sign Up
              </button>
            </div>
          </form>
          <ToastContainer position="top-center" draggable />
        </div>
      </div>
    </div>
  );
};

export default ResetPass;
