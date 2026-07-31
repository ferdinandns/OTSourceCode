// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { Eye, EyeOff } from "lucide-react"; // 1. Import Icon
import { API_BASE_URL } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Tambahkan state showPassword
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        Cookies.set("token", data.token, { expires: 1 });
        Cookies.set("username", data.user.username, { expires: 1 });
        Cookies.set("nama", data.user.nama, { expires: 1 });
        Cookies.set("level", data.user.level, { expires: 1 });
        Cookies.set("area", data.user.area, { expires: 1 });
        Cookies.set("detailArea", data.user.detail_area ?? "", { expires: 1 });
        Cookies.set("id", data.user.id, { expires: 1 });

        router.push("/home");
      } else {
        setErrorMsg(data.message || "Gagal login, periksa username dan password.");
      }
    } catch (error) {
      setErrorMsg("Tidak dapat terhubung ke server backend Go.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = () => {
    Cookies.set("token", "guest-token", { expires: 1/24 });
    Cookies.set("nama", "Guest Account", { expires: 1/24 });
    Cookies.set("level", "guest", { expires: 1/24 });
    Cookies.set("area", "View Only", { expires: 1/24 });
    
    router.push("/home");
  };

  return (
    <div className="h-screen flex font-sans bg-[#FFFFFF]">
      {/* Sisi Kiri */}
      <div 
        className="hidden md:flex flex-1 bg-cover bg-center items-center justify-center"
        style={{ backgroundImage: "url('/image/office-team.jpg')" }}
      >
        <div className="text-center mx-auto">
          <img 
            src="/image/Bintang-Toedjo-removebg-preview (1).png" 
            alt="Logo Bintang Toedjoe" 
            className="w-[300px]"
          />
        </div>
      </div>

      {/* Sisi Kanan */}
      <div 
        className="flex-1 flex items-center justify-center"
        style={{ backgroundImage: "linear-gradient(180deg, white, rgb(196, 217, 156))" }}
      >
        {/* Kotak Login */}
        <div className="w-full max-w-[380px] p-8 bg-white rounded-[10px] shadow-[0px_4px_15px_rgba(0,0,0,0.1)] mx-4">
          
          <div className="text-center mb-4"></div>
          
          <h2 className="text-center font-medium text-[30px] mb-4 mt-5 text-[#333]">
            Login
          </h2>

          {/* Alert Error */}
          {errorMsg && (
            <div className="bg-[#f2dede] border border-[#ebccd1] text-[#a94442] p-[15px] mb-5 rounded shadow-sm text-sm">
              <b className="font-bold">Opps!</b> {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin}>
            {/* Input Username */}
            <div className="mb-4">
              <label 
                htmlFor="username" 
                className="inline-block font-bold mb-1.5 text-sm text-[#333]"
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                className="block w-full h-[34px] px-3 py-1.5 text-sm text-[#555] bg-white border border-[#ccc] rounded shadow-[inset_0_1px_1px_rgba(0,0,0,0.075)] focus:border-[#66afe9] focus:outline-none focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.075),0_0_8px_rgba(102,175,233,0.6)] transition-all duration-150 ease-in-out"
              />
            </div>

            {/* Input Password dengan Toggle Mata */}
            <div className="mb-4">
              <label 
                htmlFor="password" 
                className="inline-block font-bold mb-1.5 text-sm text-[#333]"
              >
                Password
              </label>
              {/* Wrapper Relative untuk Input dan Button Mata */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="block w-full h-[34px] px-3 py-1.5 pr-10 text-sm text-[#555] bg-white border border-[#ccc] rounded shadow-[inset_0_1px_1px_rgba(0,0,0,0.075)] focus:border-[#66afe9] focus:outline-none focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.075),0_0_8px_rgba(102,175,233,0.6)] transition-all duration-150 ease-in-out"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none flex items-center justify-center cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Tombol Login */}
            <button
              type="submit"
              disabled={isLoading}
              className="block w-full text-center px-3 py-1.5 text-sm font-medium text-white bg-[#c7d6ab] rounded hover:bg-[#b5c599] transition-colors mb-2 disabled:opacity-70 disabled:cursor-not-allowed border border-transparent mt-5 cursor-pointer"
            >
              {isLoading ? "Memproses..." : "Log In"}
            </button>
          </form>

          {/* Tombol Guest */}
          <button
            type="button"
            onClick={handleGuestLogin}
            className="block w-full text-center px-3 py-1.5 text-sm font-medium text-white bg-[#777] rounded hover:bg-[#5e5e5e] transition-colors border border-transparent cursor-pointer"
          >
            Login as Guest
          </button>
          
        </div>
      </div>
    </div>
  );
}