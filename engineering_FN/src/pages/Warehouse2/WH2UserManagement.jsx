import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const WH2UserManagement = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- 1. Fetch Users ---
    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('user_token');
            const response = await axios.get("http://localhost:8002/part/getWarehouseUsers", {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.success) {
                setUsers(response.data.users);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
            alert("Failed to load users. You may not have permission.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // --- 2. Handle Level Change ---
    const handleLevelChange = async (userId, userName, newLevel) => {
        // Prevent accidental misclicks with a confirmation prompt
        if (!window.confirm(`Are you sure you want to change ${userName}'s level to ${newLevel}?`)) {
            // If they cancel, re-fetch the data to reset the dropdown to its original state
            fetchUsers();
            return;
        }

        try {
            const token = localStorage.getItem('user_token');
            await axios.put("http://localhost:8002/part/updateUserLevel", 
                {
                    target_user_id: userId,
                    new_level: newLevel
                },
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );

            alert("User level updated successfully.");
            fetchUsers(); // Refresh the table to guarantee synchronization with the database
            
        } catch (error) {
            console.error("Error updating user:", error);
            alert("Failed to update user level.");
            fetchUsers(); // Reset UI on failure
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans">
            
            {/* --- BACK BUTTON --- */}
            <div className="mb-6">
                <button 
                    onClick={() => navigate(-1)} 
                    className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    BACK TO DASHBOARD
                </button>
            </div>

            {/* --- HEADER --- */}
            <div className="mb-8">
                <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Warehouse Access Management</h1>
                <p className="text-sm text-slate-500 mt-1">Assign system privileges to warehouse personnel.</p>
            </div>

            {/* --- TABLE SECTION --- */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Username</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                                <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Access Level</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="py-12 text-center text-slate-400 font-medium">Loading users...</td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-12 text-center text-slate-400 font-medium">No warehouse users found.</td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id_users} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-6 text-sm font-bold text-slate-400">#{user.id_users}</td>
                                        <td className="py-4 px-6 text-sm font-extrabold text-slate-800">{user.name}</td>
                                        <td className="py-4 px-6 text-sm text-slate-500">@{user.username}</td>
                                        <td className="py-4 px-6 text-sm text-slate-500">{user.email || '-'}</td>
                                        <td className="py-4 px-6">
                                            {/* --- THE INLINE UPDATE DROPDOWN --- */}
                                            <select 
                                            value={user.level} 
                                            onChange={(e) => handleLevelChange(user.id_users, user.name, e.target.value)}
                                            className={`border rounded-md px-3 py-1.5 text-sm font-bold outline-none transition-colors cursor-pointer
                                                ${user.level == 2 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'}`}
                                        >
                                            {/* 1. The Safety Fallback: Only shows up if they aren't Level 2 or 3 yet (like new registrations) */}
                                            {user.level != 2 && user.level != 3 && (
                                                <option value={user.level} disabled>
                                                    Select Role... (Current: Level {user.level})
                                                </option>
                                            )}
                                            
                                            {/* 2. The Only Allowed Warehouse Options */}
                                            <option value="3">Warehouse Manager/Supervisor</option>
                                            <option value="2">Warehouse Staff/Operator</option>
                                        </select>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default WH2UserManagement;