import React, { useRef, useEffect, useState } from 'react';
import jsQR from 'jsqr';

function QRScanner({ onScan, loading, disabled }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [hasPermission, setHasPermission] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' = back camera, 'user' = front camera
  const [cooldownTime, setCooldownTime] = useState(0);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const intervalRef = useRef(null);
  const cooldownIntervalRef = useRef(null);

  useEffect(() => {
    if (isScanning && !disabled) {
      startScanning();
    } else {
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isScanning, disabled]);

  useEffect(() => {
    if (cooldownTime > 0) {
      cooldownIntervalRef.current = setInterval(() => {
        setCooldownTime(prev => {
          if (prev <= 1) {
            clearInterval(cooldownIntervalRef.current);
            // Restart scanning when cooldown ends
            if (isScanning && !disabled) {
              setTimeout(() => {
                startScanning();
              }, 100);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, [cooldownTime, isScanning, disabled]);

  const startCamera = async (forceFacingMode = null) => {
    try {
      setError('');
      
      // Stop existing stream if any
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      const cameraFacingMode = forceFacingMode || facingMode;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setHasPermission(true);
        setIsScanning(true);
        
        // Update facing mode state if forced
        if (forceFacingMode) {
          setFacingMode(forceFacingMode);
        }
      }
    } catch (err) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Dostęp do kamery został odrzucony. Sprawdź uprawnienia w przeglądarce.');
      } else if (err.name === 'NotFoundError') {
        setError('Nie znaleziono kamery. Sprawdź czy urządzenie ma kamerę.');
      } else if (err.name === 'OverconstrainedError') {
        setError('Nie można uruchomić kamery z wybranymi ustawieniami.');
      } else {
        setError('Nie można uzyskać dostępu do kamery. Sprawdź uprawnienia.');
      }
      setHasPermission(false);
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setHasPermission(false);
    setIsScanning(false);
  };

  const switchCamera = async () => {
    const newFacingMode = facingMode === 'environment' ? 'user' : 'environment';
    
    if (isScanning) {
      setIsSwitchingCamera(true);
      
      // Stop current camera first
      stopCamera();
      
      // Wait for camera to be properly released, then start with new facing mode
      setTimeout(() => {
        startCamera(newFacingMode).finally(() => {
          setIsSwitchingCamera(false);
        });
      }, 300); // Increased delay for better reliability
    } else {
      // Just update the facing mode if not scanning
      setFacingMode(newFacingMode);
    }
  };

  const startScanning = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      scanQRCode();
    }, 100); // Scan every 100ms
  };

  const stopScanning = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || disabled || cooldownTime > 0) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        // Start cooldown immediately
        setCooldownTime(5);
        onScan(code.data);
        
        // Briefly stop scanning to prevent multiple scans
        stopScanning();
        setTimeout(() => {
          if (isScanning && !disabled) {
            startScanning();
          }
        }, 1000);
      }
    }
  };

  const toggleScanning = () => {
    if (isScanning) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const handleScanResult = (result) => {
    if (result && result.cooldown_seconds) {
      setCooldownTime(result.cooldown_seconds);
    }
  };

  const getCameraButtonText = () => {
    return facingMode === 'environment' ? 'Kamera tylna' : 'Kamera przednia';
  };

  const getCameraIcon = () => {
    if (facingMode === 'environment') {
      // Back camera icon
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    } else {
      // Front camera icon (person)
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Camera View */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-64 object-cover"
          playsInline
          muted
          style={{ display: hasPermission ? 'block' : 'none' }}
        />
        
        {!hasPermission && (
          <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-600 text-sm">
                Kamera wyłączona
              </p>
            </div>
          </div>
        )}

        {/* Scanning Overlay */}
        {isScanning && hasPermission && cooldownTime === 0 && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-4 border-2 border-white rounded-lg">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl-lg"></div>
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr-lg"></div>
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl-lg"></div>
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br-lg"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
                Skanowanie...
              </div>
            </div>
          </div>
        )}

        {/* Camera Switch Loading Overlay */}
        {isSwitchingCamera && (
          <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
            <div className="text-center text-white">
              <svg className="w-8 h-8 animate-spin mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2A8.001 8.001 0 0019.418 15m0 0H15" />
              </svg>
              <div className="text-sm">Przełączanie kamery...</div>
            </div>
          </div>
        )}

        {/* Cooldown Overlay */}
        {cooldownTime > 0 && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center pointer-events-none">
            <div className="text-center text-white">
              <div className="text-3xl font-bold mb-2">{cooldownTime}</div>
              <div className="text-sm">Poczekaj przed kolejnym skanowaniem</div>
            </div>
          </div>
        )}

        {/* Camera Switch Button */}
        {isScanning && (
          <button
            onClick={switchCamera}
            disabled={isSwitchingCamera}
            className={`absolute top-4 right-4 text-white p-2 rounded-full transition-all duration-200 ${
              isSwitchingCamera 
                ? 'bg-gray-600 bg-opacity-70 cursor-not-allowed' 
                : 'bg-black bg-opacity-50 hover:bg-opacity-70'
            }`}
            title="Przełącz kamerę"
          >
            {isSwitchingCamera ? (
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2A8.001 8.001 0 0019.418 15m0 0H15" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2A8.001 8.001 0 0019.418 15m0 0H15" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Hidden Canvas for QR Processing */}
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col space-y-3">
        <button
          onClick={toggleScanning}
          disabled={loading || cooldownTime > 0}
          className={`w-full py-3 px-4 rounded-lg font-medium transition duration-200 ${
            isScanning
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-green-600 text-white hover:bg-green-700'
          } ${loading || cooldownTime > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Przetwarzanie...
            </span>
          ) : cooldownTime > 0 ? (
            `Poczekaj ${cooldownTime}s`
          ) : (
            <>
              {isScanning ? (
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v4a1 1 0 11-2 0V7zM12 7a1 1 0 012 0v4a1 1 0 11-2 0V7z" clipRule="evenodd" />
                  </svg>
                  Zatrzymaj skanowanie
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Rozpocznij skanowanie
                </span>
              )}
            </>
          )}
        </button>

        {/* Camera Switch Info */}
        {hasPermission && (
          <div className="flex items-center justify-center text-sm text-gray-600 space-x-2">
            {getCameraIcon()}
            <span>{getCameraButtonText()}</span>
          </div>
        )}

        {/* Status */}
        <div className="text-center text-sm text-gray-600">
          {cooldownTime > 0 ? (
            <span className="text-orange-600 font-medium">
              Oczekiwanie {cooldownTime}s przed kolejnym skanowaniem
            </span>
          ) : isScanning ? (
            <span className="text-green-600 font-medium">Kamera aktywna - skieruj na kod QR</span>
          ) : (
            <span>Naciśnij przycisk aby włączyć kamerę</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default QRScanner;