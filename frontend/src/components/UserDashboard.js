import React, { useState, useEffect } from 'react';
import QRScanner from './QRScanner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function UserDashboard({ user, onLogout }) {
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [companyInfo, setCompanyInfo] = useState(null);

  useEffect(() => {
    fetchCompanyInfo();
  }, []);

  const fetchCompanyInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/company/info`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCompanyInfo(data);
      }
    } catch (error) {
      console.error('Błąd pobierania informacji o firmie:', error);
    }
  };

  const handleQRScan = async (qrData) => {
    setLoading(true);
    setScanResult(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${BACKEND_URL}/api/time/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ qr_data: qrData }),
      });

      const data = await response.json();

      if (response.ok) {
        setScanResult({
          success: true,
          action: data.action,
          employee: data.employee,
          time: data.time,
          message: data.message,
          cooldown_seconds: data.cooldown_seconds
        });
      } else {
        // Handle specific error codes
        if (response.status === 429) {
          setScanResult({
            success: false,
            message: data.detail || 'Poczekaj przed kolejnym skanowaniem',
            isCooldown: true
          });
        } else if (response.status === 403) {
          setScanResult({
            success: false,
            message: 'QR kod nie należy do Twojej firmy',
            isUnauthorized: true
          });
        } else {
          setScanResult({
            success: false,
            message: data.detail || 'Błąd skanowania QR kodu'
          });
        }
      }
    } catch (error) {
      setScanResult({
        success: false,
        message: 'Błąd połączenia z serwerem'
      });
    }

    setLoading(false);
  };

  const clearResult = () => {
    setScanResult(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">Skaner QR</h1>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Witaj, {user.username}</p>
                {companyInfo && (
                  <p>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      🏢 {companyInfo.name}
                    </span>
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onLogout}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Wyloguj
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Company Security Notice */}
        {companyInfo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-green-800 mb-2">
              🔒 Zabezpieczenie Firmy
            </h2>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• Możesz skanować tylko kody QR z Twojej firmy</li>
              <li>• Dane firm są całkowicie oddzielone</li>
              <li>• Twoja firma: <strong>{companyInfo.name}</strong></li>
            </ul>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">
            Instrukcja użycia
          </h2>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Zeskanuj kod QR pracownika z Twojej firmy</li>
            <li>• Pierwsze skanowanie = rozpoczęcie pracy</li>
            <li>• Drugie skanowanie = zakończenie pracy</li>
            <li>• ⏰ Ograniczenie: 5 sekund między skanowaniami</li>
            <li>• 🔄 Możliwość przełączania kamery przód/tył</li>
          </ul>
        </div>

        {/* QR Scanner */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Skanuj kod QR
          </h3>
          <QRScanner 
            onScan={handleQRScan} 
            loading={loading}
            disabled={loading}
          />
        </div>

        {/* Scan Result */}
        {scanResult && (
          <div className={`rounded-lg p-4 mb-6 ${
            scanResult.success 
              ? 'bg-green-50 border border-green-200' 
              : scanResult.isCooldown
              ? 'bg-orange-50 border border-orange-200'
              : scanResult.isUnauthorized
              ? 'bg-red-50 border border-red-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                {scanResult.success ? (
                  <div>
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <h3 className="text-lg font-semibold text-green-800">
                        {scanResult.action === 'check_in' ? 'Rozpoczęto pracę' : 'Zakończono pracę'}
                      </h3>
                    </div>
                    <div className="text-green-700 space-y-1">
                      <p><strong>Pracownik:</strong> {scanResult.employee}</p>
                      <p><strong>Czas:</strong> {scanResult.time}</p>
                      <p className="text-sm">{scanResult.message}</p>
                    </div>
                  </div>
                ) : scanResult.isCooldown ? (
                  <div>
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-orange-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 011.414 0L10 8.586l.879-.879a1 1 0 111.414 1.414l-1.293 1.293a1 1 0 01-1.414 0l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      <h3 className="text-lg font-semibold text-orange-800">Zbyt szybko!</h3>
                    </div>
                    <p className="text-orange-700">{scanResult.message}</p>
                    <p className="text-sm text-orange-600 mt-1">Poczekaj przed kolejnym skanowaniem tego samego kodu.</p>
                  </div>
                ) : scanResult.isUnauthorized ? (
                  <div>
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <h3 className="text-lg font-semibold text-red-800">Brak dostępu</h3>
                    </div>
                    <p className="text-red-700">{scanResult.message}</p>
                    <p className="text-sm text-red-600 mt-1">Możesz skanować tylko kody QR pracowników z Twojej firmy.</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <h3 className="text-lg font-semibold text-red-800">Błąd</h3>
                    </div>
                    <p className="text-red-700">{scanResult.message}</p>
                  </div>
                )}
              </div>
              <button
                onClick={clearResult}
                className="ml-4 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Help */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Pomoc</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• Upewnij się, że kamera ma dostęp do urządzenia</p>
            <p>• Trzymaj kod QR w centrum kamery</p>
            <p>• Poczekaj na automatyczne rozpoznanie</p>
            <p>• Kod QR musi należeć do Twojej firmy</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserDashboard;