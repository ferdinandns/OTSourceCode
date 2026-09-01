import { FC, useState, useEffect, ReactNode } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { setupInterceptors } from './services/api';
import { useInactivityLogout } from './hooks/auth/useInactivityLogout';
import AppRoutes from './routes';

const queryClient = new QueryClient();

const InactivityGuard: FC<{ children: ReactNode }> = ({ children }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setupInterceptors(logout, navigate);
  }, [logout, navigate]);

  useInactivityLogout();
  return <>{children}</>;
};


const App: FC = () => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date: Date): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]
      } ${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')
      }:${String(date.getMinutes()).padStart(2, '0')
      }:${String(date.getSeconds()).padStart(2, '0')
      }`;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        < AuthProvider>
          <InactivityGuard>
            <div style={{ minHeight: '100vh', margin: 0, background: '#e8f5e9 0%' }}>

              {/* Header */}
              <header
                style={{
                  background: 'rgba(200, 230, 201, 0.8)',
                  padding: '3px 0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
                }}
              >
                <div className="container">
                  <div className="d-flex justify-content-between align-items-center">
                    <img
                      src="/src/assets/Bintang_Toedjoe_logo.png"
                      alt="Bintang Toedjoe Logo"
                      style={{ height: '40px', objectFit: 'contain' }}
                    />
                    <div style={{ fontSize: '18px', fontWeight: '400', color: '#888' }}>
                      {formatDateTime(currentTime)}
                    </div>
                  </div>
                </div>
              </header>

              {/* Content */}
              <div className="container-fluid px-0">
                <AppRoutes />
              </div>

            </div>
          </InactivityGuard>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
