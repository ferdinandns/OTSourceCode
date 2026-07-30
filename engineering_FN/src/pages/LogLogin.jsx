import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';

const mockLoginLogs = [
  {
    id: 1,
    userId: '001',
    username: 'admin@example.com',
    name: 'Administrator',
    level: 1,
    imagePath: '/api/uploads/admin-avatar.jpg',
    loginTime: '2024-06-04T08:30:00Z',
    logoutTime: '2024-06-04T17:45:00Z',
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome 125.0.0.0',
    status: 'completed'
  },
  {
    id: 2,
    userId: '002',
    username: 'manager@example.com',
    name: 'Manager User',
    level: 2,
    imagePath: '/api/uploads/manager-avatar.jpg',
    loginTime: '2024-06-04T09:15:00Z',
    logoutTime: null,
    ipAddress: '192.168.1.101',
    userAgent: 'Firefox 126.0',
    status: 'active'
  },
  {
    id: 3,
    userId: '003',
    username: 'user@example.com',
    name: 'Regular User',
    level: 3,
    imagePath: '/api/uploads/user-avatar.jpg',
    loginTime: '2024-06-04T10:20:00Z',
    logoutTime: '2024-06-04T12:30:00Z',
    ipAddress: '192.168.1.102',
    userAgent: 'Safari 17.0',
    status: 'completed'
  },
  {
    id: 4,
    userId: '004',
    username: 'operator@example.com',
    name: 'Operator',
    level: 4,
    imagePath: '/api/uploads/operator-avatar.jpg',
    loginTime: '2024-06-03T14:00:00Z',
    logoutTime: '2024-06-03T18:00:00Z',
    ipAddress: '192.168.1.103',
    userAgent: 'Edge 125.0.0.0',
    status: 'completed'
  },
  {
    id: 5,
    userId: '005',
    username: 'guest@example.com',
    name: 'Guest User',
    level: 5,
    imagePath: null,
    loginTime: '2024-06-04T11:45:00Z',
    logoutTime: null,
    ipAddress: '192.168.1.104',
    userAgent: 'Chrome Mobile',
    status: 'active'
  },
  {
    id: 6,
    userId: '006',
    username: 'guest@example.com',
    name: 'Guest User',
    level: 5,
    imagePath: null,
    loginTime: '2024-06-04T11:45:00Z',
    logoutTime: null,
    ipAddress: '192.168.1.104',
    userAgent: 'Chrome Mobile',
    status: 'active'
  },
        {
    id: 7,
    userId: '007',
    username: 'guest@example.com',
    name: 'Guest User',
    level: 5,
    imagePath: null,
    loginTime: '2024-06-04T11:45:00Z',
    logoutTime: null,
    ipAddress: '192.168.1.104',
    userAgent: 'Chrome Mobile',
    status: 'active'
  },
  {
    id: 8,
    userId: '008',
    username: 'guest@example.com',
    name: 'Guest User',
    level: 5,
    imagePath: null,
    loginTime: '2024-06-04T11:45:00Z',
    logoutTime: null,
    ipAddress: '192.168.1.104',
    userAgent: 'Chrome Mobile',
    status: 'active'
  },
  {
    id: 9,
    userId: '009',
    username: 'guest@example.com',
    name: 'Guest User',
    level: 5,
    imagePath: null,
    loginTime: '2024-06-04T11:45:00Z',
    logoutTime: null,
    ipAddress: '192.168.1.104',
    userAgent: 'Chrome Mobile',
    status: 'active'
  },
  {
    id: 10,
    userId: '010',
    username: 'guest@example.com',
    name: 'Guest User',
    level: 5,
    imagePath: null,
    loginTime: '2024-06-04T11:45:00Z',
    logoutTime: null,
    ipAddress: '192.168.1.104',
    userAgent: 'Chrome Mobile',
    status: 'active'
  },
  {
    id: 11,
    userId: '011',
    username: 'guest@example.com',
    name: 'Guest User',
    level: 5,
    imagePath: null,
    loginTime: '2024-06-04T11:45:00Z',
    logoutTime: null,
    ipAddress: '192.168.1.104',
    userAgent: 'Chrome Mobile',
    status: 'active'
  },
];

const LogLogin = () => {
  const [loginLogs, setLoginLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
   const [isLoading, setIsLoading] = useState(false);
  const logsPerPage = 10;

  // Mock data untuk demo - dalam implementasi nyata, data ini akan diambil dari API
  // useEffect(() => {
    //   setLoginLogs(mockLoginLogs);
    //   setFilteredLogs(mockLoginLogs);
  // }, []);


  useEffect(() => {
    axios.get("http://10.126.15.197:8002/part/LogData")
      .then(res => {
        setLoginLogs(res.data);
        setFilteredLogs(res.data);
        setIsLoading(false);
      })
      .catch(err => {
        // Optional: handle error (tampilkan pesan, dsb)
        setLoginLogs(mockLoginLogs);
        setFilteredLogs(mockLoginLogs);
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    let filtered = loginLogs;

    // Filter berdasarkan search term (nama saja)
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } 
    setFilteredLogs(filtered);
    setCurrentPage(1);
  }, [searchTerm, loginLogs]);


  console.log("isi", loginLogs);
  

    // Load data saat komponen dimount
  // useEffect(() => {
  //   getUserIP();
  //   fetchLoginLogs();
  // }, []);

  //   useEffect(() => {
  //   axios.get('http://10.126.15.197:8002/part/LogData/')
  //     .then(res => {
  //       setLoginLogs(res.data);
  //     })
  //     .catch(err => {
  //       console.error("Gagal mengambil data login:", err);
  //     });
  // }, []);

  // console.log("test", loginLogs);


  // Filter logs berdasarkan pencarian dan filter
  // useEffect(() => {
  //   let filtered = loginLogs;

  //   // Filter berdasarkan search term
  //   if (searchTerm) {
  //     filtered = filtered.filter(log => 
  //       log.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //       log.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //       log.ipAddress.includes(searchTerm)
  //     );
  //   }

  

    // Filter berdasarkan level
    // if (filterLevel !== 'all') {
    //   filtered = filtered.filter(log => log.level === parseInt(filterLevel));
    // }

    // Filter berdasarkan tanggal
    // if (dateFilter !== 'all') {
    //   const today = new Date();
    //   const filterDate = new Date();
      
    //   switch(dateFilter) {
    //     case 'today':
    //       filterDate.setHours(0, 0, 0, 0);
    //       filtered = filtered.filter(log => 
    //         new Date(log.loginTime) >= filterDate
    //       );
    //       break;
    //     case 'week':
    //       filterDate.setDate(today.getDate() - 7);
    //       filtered = filtered.filter(log => 
    //         new Date(log.loginTime) >= filterDate
    //       );
    //       break;
    //     case 'month':
    //       filterDate.setMonth(today.getMonth() - 1);
    //       filtered = filtered.filter(log => 
    //         new Date(log.loginTime) >= filterDate
    //       );
    //       break;
    //   }
    // }

  const getLevelText = (level) => {
    switch(level) {
      case 1: return 'Super Admin';
      case 2: return 'Manager';
      case 3: return 'User';
      case 4: return 'Operator';
      case 5: return 'Guest';
      default: return 'Unknown';
    }
  };

  const getLevelColor = (level) => {
    switch(level) {
      case 5: return 'bg-red-100 text-red-800';
      case 4: return 'bg-purple-100 text-purple-800';
      case 3: return 'bg-blue-100 text-blue-800';
      case 2: return 'bg-green-100 text-green-800';
      case 1: return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const calculateDuration = (loginTime, logoutTime) => {
    if (!logoutTime) return 'Sedang aktif';
    
    const login = new Date(loginTime);
    const logout = new Date(logoutTime);
    const duration = logout - login;
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}j ${minutes}m ${seconds}d`;
    } else {
      return `${minutes}m ${seconds}d`;
    }
  };

  // Pagination
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);

  // Cek user punya akses atau kagak (ini gak guna, karna admin tabel-nya ini aja khusus buat yg level 5 doang jir)
  // if (!currentUser || currentUser.level > 2) {
  //   return (
  //     <div className="min-h-screen bg-gray-50 flex items-center justify-center">
  //       <div className="bg-white p-8 rounded-lg shadow-md">
  //         <h2 className="text-2xl font-bold text-red-600 mb-4">Akses Ditolak</h2>
  //         <p className="text-gray-600">Anda tidak memiliki izin untuk mengakses halaman log login.</p>
  //       </div>
  //     </div>
  //   );
  // }

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-card p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text mb-2">Log Login User</h1>
          <p className="text-text2">Monitor aktivitas login dan logout pengguna sistem</p>
        </div>
        {/* <button
            onClick={postLoginData}
            disabled={isLoading || !currentUser}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Mengirim...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span>POST Login Data</span>
              </>
            )}
          </button> */}

        {/* Filters */}
        <div className="bg-cardb rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Pencarian
              </label>
              <input
                type="text"
                placeholder="Cari username, nama, atau IP..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Level User
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
              >
                <option value="all">Semua Level</option>
                <option value="1">Super Admin</option>
                <option value="2">Manager</option>
                <option value="3">User</option>
                <option value="4">Operator</option>
                <option value="5">Guest</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Periode
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">Semua Waktu</option>
                <option value="today">Hari Ini</option>
                <option value="week">7 Hari Terakhir</option>
                <option value="month">30 Hari Terakhir</option>
              </select>
            </div> */}

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterLevel('all');
                  setDateFilter('all');
                }}
                className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Reset Filter
              </button>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-cardb p-6 rounded-lg shadow-lg">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-text">Total Login</p>
                <p className="text-2xl font-semibold text-text">{filteredLogs.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-cardb p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-text">User Aktif</p>
                <p className="text-2xl font-semibold text-text">
                  {filteredLogs.filter(log => log.status === 'active').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-cardb p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-text">Sesi Selesai</p>
                <p className="text-2xl font-semibold text-text">
                  {filteredLogs.filter(log => log.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-cardb p-6 rounded-lg shadow-sm">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-text">Hari Ini</p>
                <p className="text-2xl font-semibold text-text">
                  {filteredLogs.filter(log => {
                    const today = new Date().toDateString();
                    return new Date(log.loginTime).toDateString() === today;
                  }).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-cardb rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-cardc">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
                    Login
                  </th>
                  {/* <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
                    Logout
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
                    Durasi
                  </th> */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-cardb divide-y divide-gray-200">
                {currentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-cta">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {/* <div className="flex-shrink-0 h-10 w-10">
                          {log.imagePath ? (
                            <img
                              className="h-10 w-10 rounded-full object-cover"
                              src={log.imagePath}
                              alt={log.name}
                              onError={(e) => {
                                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iMjAiIGZpbGw9IiNGM0Y0RjYiLz4KPHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeD0iMTAiIHk9IjEwIj4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSIjOTdBM0IzIi8+CjxwYXRoIGQ9Ik0xMiAxNEM5LjMzIDEzIDQgMTQuMzMgNCAzTDAyEg0QzUuMzMgMTMgMTAuNjcgMTMgMTEgMTNaIiBmaWxsPSIjOTdBM0IzIi8+Cjwvc3ZnPgo8L3N2Zz4KPC9zdmc+';
                              }}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                              </svg>
                            </div>
                          )}
                        </div> */}
                        <div className="ml-4">
                          <div className="text-sm font-medium text-text">{log.name}</div>
                          <div className="text-sm text-text">{log.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getLevelColor(log.level)}`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                      {formatDateTime(log.Date)}
                    </td>
                    {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                      {log.logout_time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                      {calculateDuration(log.Date, log.logout_time)}
                    </td> */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                      {log.ip_address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(log.status)}`}>
                        {log.status === 'completed' ? 'Selesai' : 'Aktif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-cardb px-4 py-3 flex items-center justify-between border-t border-border sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-text bg-blue-600 hover:bg-primaryp disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-text bg-blue-600 hover:bg-primaryp disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-text">
                    Menampilkan <span className="font-medium">{indexOfFirstLog + 1}</span> sampai{' '}
                    <span className="font-medium">{Math.min(indexOfLastLog, filteredLogs.length)}</span> dari{' '}
                    <span className="font-medium">{filteredLogs.length}</span> hasil
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {[...Array(totalPages)].map((_, index) => (
                      <button
                        key={index + 1}
                        onClick={() => setCurrentPage(index + 1)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === index + 1
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-blue-200'
                        }`}
                      >
                        {index + 1}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {filteredLogs.length === 0 && (
          <div className="bg-cardb rounded-lg shadow-sm p-12 text-center mt-1">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-text">Tidak ada data log</h3>
            <p className="mt-2 text-text2">Belum ada aktivitas login yang sesuai dengan filter yang dipilih.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogLogin;