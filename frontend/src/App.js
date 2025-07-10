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
    <div className="home-page" style={{ position: 'relative' }}>
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
      
      {/* Zawartość strony głównej */}
      <div style={{
        width: '100%',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        color: 'white',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h1 style={{
          fontSize: '4rem',
          fontWeight: 'bold',
          marginBottom: '2rem',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
        }}>
          System Ewidencji Czasu Pracy
        </h1>
        <p style={{
          fontSize: '1.5rem',
          marginBottom: '3rem',
          maxWidth: '600px',
          lineHeight: '1.6'
        }}>
          Profesjonalny system zarządzania czasem pracy dla firm. 
          Prosty, bezpieczny i wydajny.
        </p>
        <div style={{
          display: 'flex',
          gap: '2rem',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '2rem',
            borderRadius: '10px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>🏢 Multi-Firm</h3>
            <p>Obsługa wielu firm w jednym systemie</p>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '2rem',
            borderRadius: '10px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>📱 QR Scanner</h3>
            <p>Szybkie logowanie przez kody QR</p>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '2rem',
            borderRadius: '10px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>📊 Raporty</h3>
            <p>Szczegółowe raporty i analiza</p>
          </div>
        </div>
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