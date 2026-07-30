import React, { useEffect, useState } from "react";
import { ReactComponent as Sun } from "./Sun.svg";
import { ReactComponent as Moon } from "./Moon.svg";
import "./DarkMode.css";

const DarkMode = () => {
    // State to track theme
    const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem("selectedTheme") === "dark");

    // Toggle theme function
    const toggleTheme = () => {
        if (isDarkMode) {
            document.documentElement.classList.remove("dark"); // Remove dark mode class
            document.documentElement.setAttribute("data-theme", "light");
            localStorage.setItem("selectedTheme", "light");
            setIsDarkMode(false);
        } else {
            document.documentElement.classList.add("dark"); // Add dark mode class
            document.documentElement.setAttribute("data-theme", "dark");
            localStorage.setItem("selectedTheme", "dark");
            setIsDarkMode(true);
        }
    };

    // Apply saved theme on initial load
    useEffect(() => {
        const savedTheme = localStorage.getItem("selectedTheme");
        if (savedTheme === "dark") {
            document.documentElement.classList.add("dark");
            document.documentElement.setAttribute("data-theme", "dark");
        } else {
            document.documentElement.classList.remove("dark");
            document.documentElement.setAttribute("data-theme", "light");
        }
    }, []);

    return (
        <div className="dark_mode">
            <input
                className="dark_mode_input"
                type="checkbox"
                id="darkmode-toggle"
                onChange={toggleTheme}
                checked={isDarkMode}
            />
            <label className="dark_mode_label" htmlFor="darkmode-toggle">
                <Sun />
                <Moon />
            </label>
        </div>
    );
};

export default DarkMode;
