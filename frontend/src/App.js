import React, { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';
import OwnerDashboard from './components/OwnerDashboard';
import { apiHelper } from './api/helper';

// Komponent strony głównej
const HomePage = () => {
  return (
    <div className="home-page">
      <iframe
        src="/home/index.html"
        title="Strona główna"
        style={{
          width: '100%',
          height: '100vh',
          border: 'none',
          margin: 0,
          padding: 0
        }}
      />
      {/* Przycisk do panelu */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <a
          href="/panel"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-blue-700 transition duration-200 inline-block"
        >
          Zaloguj do panelu
        </a>
      </div>
    </div>
  );
};

// Komponent panelu administracyjnego
const PanelApp = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const response = await apiHelper.makeRequest('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        } else {
          localStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Ładowanie...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Route based on user type
  if (user.type === 'owner') {
    return <OwnerDashboard user={user} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {user.role === 'admin' ? (
        <AdminDashboard user={user} onLogout={handleLogout} />
      ) : (
        <UserDashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/panel/*" element={<PanelApp />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;