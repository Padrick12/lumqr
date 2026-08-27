import { API_BASE_URL } from '../config';
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, Calendar, History, ShieldCheck, AlertCircle, Save, WifiOff, UserCheck, MessageCircle, Image as ImageIcon, Navigation, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { addToQueue } from '../utils/offlineStore';
import { formatFixtureCode } from '../utils/codeFormatter';
import './shared-panels.css';

interface FixtureHistory {
  id: number;
  fixture_code: string;
  crew_name: string;
  operator_name?: string;
  lat: number;
  lng: number;
  installed_at: string;
  status_at_install: string;
  notes: string;
  photo_before?: string;
  photo_after?: string;
}

interface FixtureDetails {
  code: string;
  status: 'Nueva' | 'Reparada' | 'Rehabilitada' | 'Robo';
  crew_id: number | null;
  crew_name: string | null;
  arrival_date: string;
}

interface OperatorPanelProps {
  isSimulatedOffline: boolean;
  onSyncComplete: () => void;
  crewId: number;
  crewName: string;
}

export const OperatorPanel: React.FC<OperatorPanelProps> = ({
  isSimulatedOffline,
  onSyncComplete,
  crewId,
  crewName
}) => {
  const [panelMode, setPanelMode] = useState<'qr' | 'census'>('qr');
  
  // GPS Accuracy State
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isFetchingGps, setIsFetchingGps] = useState<boolean>(false);

  // Operator Shift State
  const [operatorName, setOperatorName] = useState<string>(() => {
    return localStorage.getItem('lumqr_operator_name') || '';
  });

  // Photo Evidence State
  const [photoBefore, setPhotoBefore] = useState<string | null>(null);
  const [photoAfter, setPhotoAfter] = useState<string | null>(null);

  // Submission Locks
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingPole, setIsSubmittingPole] = useState(false);

  // Success State for WhatsApp Share
  const [lastSuccessData, setLastSuccessData] = useState<{
    type: 'installation' | 'pole';
    code: string;
    status: string;
    lat: number;
    lng: number;
    date: string;
  } | null>(null);

  const [fixtureCode, setFixtureCode] = useState('');
  const [fixtureDetails, setFixtureDetails] = useState<FixtureDetails | null>(null);
  const [historyLog, setHistoryLog] = useState<FixtureHistory[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [newStatus, setNewStatus] = useState<'Nueva' | 'Reparada' | 'Rehabilitada' | 'Robo'>('Nueva');
  const [installNotes, setInstallNotes] = useState('');
  const [submitMsg, setSubmitMsg] = useState({ text: '', isError: false });

  // Census States
  const [poleType, setPoleType] = useState<'Concreto' | 'Metálico' | 'Madera' | 'Brazo en Fachada'>('Concreto');
  const [lampType, setLampType] = useState<'Vapor de Sodio' | 'LED Antiguo' | 'LED Nueva (Sin QR)' | 'Sin Lámpara'>('Vapor de Sodio');
  const [zoneType, setZoneType] = useState<'Urbana' | 'Rural' | 'Trayectos Seguros'>('Urbana');
  const [operatingStatus, setOperatingStatus] = useState<'Funcionando' | 'Prendida 24/7' | 'No Funciona / Apagada'>('Funcionando');
  const [wattage, setWattage] = useState<string>('100');
  const [poleNotes, setPoleNotes] = useState('');
  const [poleSubmitMsg, setPoleSubmitMsg] = useState({ text: '', isError: false });
  const [loadingPole, setLoadingPole] = useState(false);

  const handleModeChange = (mode: 'qr' | 'census') => {
    setPanelMode(mode);
    setPhotoBefore(null);
    setPhotoAfter(null);
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/crews`)
      .then(res => res.json())
      .then(crews => {
        const currentCrew = Array.isArray(crews) ? crews.find((c: any) => c.id === crewId) : null;
        if (currentCrew && currentCrew.active_operator) {
          setOperatorName(currentCrew.active_operator);
        }
      })
      .catch(err => console.error("Error loading crew active operator:", err));
  }, [crewId]);

  const isSinLamp = lampType === 'Sin Lámpara';

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScannerActive, setIsScannerActive] = useState(false);

  // Compression helper to keep photos < 150KB for fast uploads
  const compressImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoBeforeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await compressImageFile(e.target.files[0]);
        setPhotoBefore(base64);
      } catch (err) {
        console.error("Error processing Photo Before:", err);
      }
    }
  };

  const handlePhotoAfterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await compressImageFile(e.target.files[0]);
        setPhotoAfter(base64);
      } catch (err) {
        console.error("Error processing Photo After:", err);
      }
    }
  };

  const shareOnWhatsApp = () => {
    if (!lastSuccessData) return;
    const isPole = lastSuccessData.type === 'pole';
    const formattedDate = new Date(lastSuccessData.date).toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const text = `💡 *REPORTE DE ALUMBRADO PÚBLICO - LERDO, DGO.*
----------------------------------------------
🆔 *${isPole ? 'Poste Censado' : 'Luminaria QR'}:* ${lastSuccessData.code}
👷‍♂️ *Cuadrilla:* ${crewName}
👤 *Responsable en Turno:* ${operatorName.trim() || 'No especificado'}
🌐 *Estado / Tipo:* ${lastSuccessData.status}
📅 *Fecha/Hora:* ${formattedDate}
📍 *Ubicación GPS:* https://maps.google.com/?q=${lastSuccessData.lat},${lastSuccessData.lng}

📸 *Evidencia fotográfica respaldada en sistema LUMQR*`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const refreshGpsAccuracy = () => {
    setIsFetchingGps(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsAccuracy(Math.round(pos.coords.accuracy));
          setIsFetchingGps(false);
        },
        (err) => {
          console.warn("GPS Accuracy Error:", err);
          setIsFetchingGps(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setIsFetchingGps(false);
    }
  };

  useEffect(() => {
    refreshGpsAccuracy();
  }, []);

  const handleRegisterPole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingPole || loadingPole) return;

    // VALIDACIÓN DE JUSTIFICACIÓN OBLIGATORIA
    if ((operatingStatus === 'No Funciona / Apagada' || lampType === 'Sin Lámpara') && poleNotes.trim().length < 5) {
      setPoleSubmitMsg({
        text: '⚠️ Justificación obligatoria: Por favor detalle la causa en "Observaciones" (ej. Cable cortado, sin brazo, vandalismo).',
        isError: true
      });
      return;
    }

    setIsSubmittingPole(true);
    setLoadingPole(true);
    setPoleSubmitMsg({ text: 'Obteniendo coordenadas GPS de alta precisión...', isError: false });

    let lat: number;
    let lng: number;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
      setGpsAccuracy(Math.round(position.coords.accuracy));
    } catch (err: any) {
      console.warn("Geolocation error, fallback center:", err);
      lat = 25.539;
      lng = -103.524;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/poles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crew_id: crewId,
          operator_name: operatorName.trim() || null,
          lat,
          lng,
          pole_type: poleType,
          lamp_type: lampType,
          zone_type: zoneType,
          wattage: wattage ? Number(wattage) : null,
          operating_status: operatingStatus,
          notes: poleNotes,
          photo_before: photoBefore,
          photo_after: photoAfter
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setPoleSubmitMsg({ text: data.error || 'Error al censar poste.', isError: true });
      } else {
        setPoleSubmitMsg({ text: `¡Poste ${data.pole_code} censado con éxito en ${zoneType}!`, isError: false });
        setLastSuccessData({
          type: 'pole',
          code: data.pole_code,
          status: `${lampType} | ${wattage || '?'}W | ${operatingStatus}`,
          lat,
          lng,
          date: new Date().toISOString()
        });
        setPoleNotes('');
        setPhotoBefore(null);
        setPhotoAfter(null);
        onSyncComplete();
      }
    } catch (err) {
      setPoleSubmitMsg({ text: 'Error de conexión con el servidor.', isError: true });
    } finally {
      setLoadingPole(false);
      setIsSubmittingPole(false);
    }
  };

  const stopScannerSafely = () => {
    if (scannerRef.current) {
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (instance.isScanning) {
        instance.stop().then(() => instance.clear()).catch(() => {});
      } else {
        instance.clear();
      }
    }
  };

  useEffect(() => {
    let html5Qrcode: Html5Qrcode | null = null;

    if (isScannerActive) {
      const timer = setTimeout(() => {
        try {
          html5Qrcode = new Html5Qrcode("qr-reader-target");
          scannerRef.current = html5Qrcode;

          const config = { fps: 10, qrbox: { width: 250, height: 250 } };

          // Prefer rear/environment camera automatically for mobile field scanning
          html5Qrcode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              onScanSuccess(decodedText);
            },
            () => {}
          ).catch(err => {
            console.warn("Rear camera not available, falling back to front/user camera:", err);
            html5Qrcode?.start(
              { facingMode: "user" },
              config,
              (decodedText) => {
                onScanSuccess(decodedText);
              },
              () => {}
            ).catch(e => console.error("Error starting fallback camera:", e));
          });
        } catch (e) {
          console.error("Scanner initialization error:", e);
        }
      }, 150);

      return () => {
        clearTimeout(timer);
        stopScannerSafely();
      };
    } else {
      stopScannerSafely();
    }
  }, [isScannerActive]);

  const onScanSuccess = (decodedText: string) => {
    setFixtureCode(decodedText);
    setIsScannerActive(false);
    handleLookup(decodedText);
  };

  const handleLookupClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixtureCode.trim()) return;
    const formatted = formatFixtureCode(fixtureCode);
    setFixtureCode(formatted);
    handleLookup(formatted);
  };

  const handleLookup = async (rawCode: string) => {
    const code = formatFixtureCode(rawCode);
    setLoadingSearch(true);
    setSearchError(null);
    setFixtureDetails(null);
    setHistoryLog([]);

    const isOnline = navigator.onLine && !isSimulatedOffline;
    if (!isOnline) {
      setFixtureDetails({
        code,
        status: 'Nueva',
        crew_id: crewId,
        crew_name: crewName,
        arrival_date: new Date().toISOString().split('T')[0]
      });
      setSearchError('Modo Offline: No se puede obtener el historial. Puede registrar la instalación y se sincronizará más tarde.');
      setLoadingSearch(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/fixtures/${code}/history`);
      const data = await res.json();

      if (!res.ok) {
        setSearchError(data.error || 'Código no encontrado en el sistema.');
      } else {
        setFixtureDetails({
          code: data.fixture.code,
          status: data.fixture.status,
          crew_id: crewId,
          crew_name: crewName,
          arrival_date: data.fixture.arrival_date
        });
        setHistoryLog(data.history);
        setNewStatus(data.history.length > 0 ? 'Reparada' : 'Nueva');
      }
    } catch (err) {
      setSearchError('Error de red al consultar el código.');
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleRegisterInstallation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!fixtureDetails) {
      setSubmitMsg({ text: 'Por favor cargue una luminaria.', isError: true });
      return;
    }

    // VALIDACIÓN OBLIGATORIA DE NOTAS PARA ROBO
    if (newStatus === 'Robo' && installNotes.trim().length < 5) {
      setSubmitMsg({
        text: '⚠️ Justificación obligatoria: Por favor detalle la causa del reporte de Robo en "Notas de Campo" (ej. Cable cortado, falta de brazo).',
        isError: true
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitMsg({ text: 'Obteniendo geolocalización GPS de alta precisión...', isError: false });

    let lat: number;
    let lng: number;

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        });
      });
      lat = position.coords.latitude;
      lng = position.coords.longitude;
      setGpsAccuracy(Math.round(position.coords.accuracy));
    } catch (err) {
      console.error('Geolocation error:', err);
      setSubmitMsg({ text: 'Error al obtener su ubicación GPS. Asegúrese de tener el GPS activado y los permisos concedidos en el navegador.', isError: true });
      setIsSubmitting(false);
      return;
    }

    const payload = {
      code: fixtureDetails.code,
      crew_id: crewId,
      operator_name: operatorName.trim() || null,
      lat,
      lng,
      status: newStatus,
      notes: installNotes,
      photo_before: photoBefore,
      photo_after: photoAfter,
      installed_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };

    const isOnline = navigator.onLine && !isSimulatedOffline;

    if (!isOnline) {
      try {
        await addToQueue(payload);
        setSubmitMsg({
          text: `Lectura guardada localmente en IndexedDB. Se sincronizará silenciosamente cuando haya señal celular.`,
          isError: false
        });
        setLastSuccessData({
          type: 'installation',
          code: payload.code,
          status: newStatus,
          lat,
          lng,
          date: new Date().toISOString()
        });
        setFixtureDetails(null);
        setFixtureCode('');
        setInstallNotes('');
        setPhotoBefore(null);
        setPhotoAfter(null);
      } catch (err) {
        setSubmitMsg({ text: 'Error al guardar la lectura localmente.', isError: true });
      }
    } else {
      try {
        const res = await fetch(`${API_BASE_URL}/api/installations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          setSubmitMsg({ text: data.error || 'Error al registrar instalación.', isError: true });
        } else {
          setSubmitMsg({ text: `Instalación registrada con éxito. Luminaria ${payload.code} actualizada a ${newStatus}.`, isError: false });
          setLastSuccessData({
            type: 'installation',
            code: payload.code,
            status: newStatus,
            lat,
            lng,
            date: new Date().toISOString()
          });
          setFixtureDetails(null);
          setFixtureCode('');
          setInstallNotes('');
          setPhotoBefore(null);
          setPhotoAfter(null);
          onSyncComplete(); 
        }
      } catch (err) {
        try {
          await addToQueue(payload);
          setSubmitMsg({
            text: 'Fallo de conexión. Lectura respaldada localmente en IndexedDB.',
            isError: false
          });
          setLastSuccessData({
            type: 'installation',
            code: payload.code,
            status: newStatus,
            lat,
            lng,
            date: new Date().toISOString()
          });
          setFixtureDetails(null);
          setFixtureCode('');
          setInstallNotes('');
          setPhotoBefore(null);
          setPhotoAfter(null);
        } catch (localErr) {
          setSubmitMsg({ text: 'Error de red y fallo al guardar de forma local.', isError: true });
        }
      }
    }

    setIsSubmitting(false);
    setTimeout(() => setSubmitMsg({ text: '', isError: false }), 7000);
  };

  const getStatusClass = (status: string) => {
    switch(status) {
      case 'Nueva': return 'status-nueva';
      case 'Reparada': return 'status-reparada';
      case 'Rehabilitada': return 'status-rehabilitada';
      case 'Robo': return 'status-robo';
      default: return '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* TARJETA DE RESPONSABLE EN TURNO Y SEMÁFORO GPS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid rgba(5, 243, 162, 0.3)', background: 'rgba(5, 243, 162, 0.04)' }}>
          <UserCheck color="var(--neon-green)" size={22} />
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
              Responsable en Turno / Operador ({crewName}):
            </label>
            <input 
              type="text" 
              placeholder="Ej. Juan Pérez (Jefe) / Carlos Gómez (Interino)..."
              value={operatorName}
              onChange={(e) => {
                setOperatorName(e.target.value);
                localStorage.setItem('lumqr_operator_name', e.target.value);
              }}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)', 
                color: '#fff', 
                width: '100%', 
                fontSize: '14px', 
                fontWeight: 600, 
                padding: '4px 0',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* SEMÁFORO DE PRECISIÓN GPS */}
        <div className="glass-panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', minWidth: '160px', border: gpsAccuracy === null ? '1px solid var(--border-color)' : gpsAccuracy <= 15 ? '1px solid var(--neon-green)' : gpsAccuracy <= 50 ? '1px solid var(--neon-amber)' : '1px solid var(--neon-rose)', background: gpsAccuracy === null ? 'rgba(0,0,0,0.2)' : gpsAccuracy <= 15 ? 'rgba(5,243,162,0.08)' : gpsAccuracy <= 50 ? 'rgba(245,158,11,0.08)' : 'rgba(244,63,94,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800 }}>
            <Navigation size={14} color={gpsAccuracy === null ? 'var(--text-muted)' : gpsAccuracy <= 15 ? 'var(--neon-green)' : gpsAccuracy <= 50 ? 'var(--neon-amber)' : 'var(--neon-rose)'} />
            <span>GPS: {gpsAccuracy === null ? 'Midiendo...' : `± ${gpsAccuracy} m`}</span>
          </div>
          <span style={{ fontSize: '10px', color: gpsAccuracy === null ? 'var(--text-muted)' : gpsAccuracy <= 15 ? 'var(--neon-green)' : gpsAccuracy <= 50 ? 'var(--neon-amber)' : 'var(--neon-rose)', fontWeight: 600 }}>
            {gpsAccuracy === null ? 'Lectura satelital' : gpsAccuracy <= 15 ? '🟢 Precisión Óptima' : gpsAccuracy <= 50 ? '🟡 Precisión Aceptable' : '🔴 GPS Desplazado (>50m)'}
          </span>
          <button 
            onClick={refreshGpsAccuracy}
            disabled={isFetchingGps}
            style={{ border: 'none', background: 'transparent', color: 'var(--neon-blue)', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}
          >
            <RefreshCw size={10} style={isFetchingGps ? { animation: 'spin 1s linear infinite' } : {}} />
            {isFetchingGps ? 'Leyendo...' : 'Re-obtener GPS'}
          </button>
        </div>
      </div>

      {/* TARJETA DE WHATSAPP AL COMPLETAR REGISTRO */}
      {lastSuccessData && (
        <div style={{ background: 'rgba(37, 211, 102, 0.1)', border: '1px solid rgba(37, 211, 102, 0.4)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', animation: 'fadeIn 0.3s ease' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#25D366', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={18} /> ¡Registro guardado exitosamente en sistema!
          </span>
          <button
            onClick={shareOnWhatsApp}
            style={{
              background: '#25D366',
              color: '#000',
              fontWeight: 800,
              fontSize: '14px',
              padding: '12px 20px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(37, 211, 102, 0.3)'
            }}
          >
            <MessageCircle size={20} />
            <span>Compartir Evidencia por WhatsApp (1 Clic)</span>
          </button>
        </div>
      )}

      {/* Selector de Modo: Registro QR vs Censo de Postes */}
      <div style={{ display: 'flex', gap: '12px', background: 'rgba(13, 20, 38, 0.8)', padding: '6px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <button
          onClick={() => handleModeChange('qr')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            background: panelMode === 'qr' ? 'rgba(5, 243, 162, 0.15)' : 'transparent',
            color: panelMode === 'qr' ? 'var(--neon-green)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Camera size={18} />
          <span>Registrar Luminaria QR</span>
        </button>

        <button
          onClick={() => handleModeChange('census')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            background: panelMode === 'census' ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
            color: panelMode === 'census' ? 'var(--neon-blue)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Save size={18} />
          <span>Censar Poste de Infraestructura</span>
        </button>
      </div>

      {panelMode === 'census' ? (
        /* MÓDULO DE CENSO DE POSTES */
        <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
          <h2 className="panel-header" style={{ color: 'var(--neon-blue)' }}>
            <Save color="var(--neon-blue)" />
            <span>Levantamiento de Censo de Poste</span>
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Registre cualquier poste de la red municipal indicando tecnología, potencia y estado operativo actual.
          </p>

          <form onSubmit={handleRegisterPole} className="form-group">
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                TECNOLOGÍA DE LÁMPARA EN POSTE:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setLampType('Vapor de Sodio')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid ' + (lampType === 'Vapor de Sodio' ? 'var(--neon-amber)' : 'var(--border-color)'),
                    background: lampType === 'Vapor de Sodio' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0,0,0,0.2)',
                    color: lampType === 'Vapor de Sodio' ? 'var(--neon-amber)' : 'var(--text-main)',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  🟡 Vapor de Sodio
                </button>

                <button
                  type="button"
                  onClick={() => setLampType('LED Antiguo')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid ' + (lampType === 'LED Antiguo' ? 'var(--neon-blue)' : 'var(--border-color)'),
                    background: lampType === 'LED Antiguo' ? 'rgba(0, 242, 254, 0.15)' : 'rgba(0,0,0,0.2)',
                    color: lampType === 'LED Antiguo' ? 'var(--neon-blue)' : 'var(--text-main)',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ⚪ LED Antiguo
                </button>

                <button
                  type="button"
                  onClick={() => setLampType('LED Nueva (Sin QR)')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid ' + (lampType === 'LED Nueva (Sin QR)' ? 'var(--neon-emerald)' : 'var(--border-color)'),
                    background: lampType === 'LED Nueva (Sin QR)' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.2)',
                    color: lampType === 'LED Nueva (Sin QR)' ? 'var(--neon-emerald)' : 'var(--text-main)',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  🟢 LED Nueva (Sin QR)
                </button>

                <button
                  type="button"
                  onClick={() => setLampType('Sin Lámpara')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid ' + (lampType === 'Sin Lámpara' ? 'var(--neon-rose)' : 'var(--border-color)'),
                    background: lampType === 'Sin Lámpara' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(0,0,0,0.2)',
                    color: lampType === 'Sin Lámpara' ? 'var(--neon-rose)' : 'var(--text-main)',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ❌ Sin Lámpara / Vacío
                </button>
              </div>
            </div>

            {/* ESTADO OPERATIVO ACTUAL & POTENCIA WATTS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', opacity: isSinLamp ? 0.4 : 1 }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Estado Operativo Actual:
                </label>
                <select
                  disabled={isSinLamp}
                  value={isSinLamp ? 'Sin Lámpara (No Aplica)' : operatingStatus}
                  onChange={(e: any) => setOperatingStatus(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: isSinLamp ? 'not-allowed' : 'pointer' }}
                >
                  {isSinLamp ? (
                    <option value="Sin Lámpara (No Aplica)">❌ No Aplica (Sin Lámpara / Vacío)</option>
                  ) : (
                    <>
                      <option value="Funcionando">🟢 Funcionando Normal</option>
                      <option value="Prendida 24/7">⚡ Prendida 24/7 (Fallo Fotocelda)</option>
                      <option value="No Funciona / Apagada">🔴 No Funciona / Apagada</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Potencia / Watts (W):
                </label>
                <input 
                  type="number"
                  disabled={isSinLamp}
                  placeholder={isSinLamp ? '0 Watts' : 'Ej. 50, 70, 100, 150, 200...'}
                  value={isSinLamp ? '0' : wattage}
                  onChange={(e) => setWattage(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px', cursor: isSinLamp ? 'not-allowed' : 'text' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Tipo de Zona / Clasificación:
                </label>
                <select
                  value={zoneType}
                  onChange={(e: any) => setZoneType(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="Urbana">Urbana</option>
                  <option value="Rural">Rural</option>
                  <option value="Trayectos Seguros">Trayectos Seguros</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Estructura / Soporte:
                </label>
                <select
                  value={poleType}
                  onChange={(e: any) => setPoleType(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="Concreto">Poste de Concreto</option>
                  <option value="Metálico">Poste Metálico / Cónica</option>
                  <option value="Madera">Poste de Madera</option>
                  <option value="Brazo en Fachada">Brazo en Fachada</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Observaciones de Postura:
              </label>
              <textarea
                value={poleNotes}
                onChange={(e) => setPoleNotes(e.target.value)}
                placeholder="Ej. Poste con transformador, requiere brazo nuevo..."
                rows={2}
                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', color: '#fff', fontSize: '13px' }}
              />
            </div>

            {/* SECCIÓN EVIDENCIA FOTOGRÁFICA (Doble Captura Opcional) */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--neon-blue)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                <ImageIcon size={14} /> Evidencia Fotográfica en Campo
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    📸 1. Estado / Poste
                  </label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    onChange={handlePhotoBeforeUpload}
                    style={{ fontSize: '11px', width: '100%' }}
                  />
                  {photoBefore && (
                    <img src={photoBefore} alt="Antes" style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '6px', marginTop: '4px', border: '1px solid var(--neon-blue)' }} />
                  )}
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    📸 2. Lámpara Encendida
                  </label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    onChange={handlePhotoAfterUpload}
                    style={{ fontSize: '11px', width: '100%' }}
                  />
                  {photoAfter && (
                    <img src={photoAfter} alt="Después" style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '6px', marginTop: '4px', border: '1px solid var(--neon-green)' }} />
                  )}
                </div>
              </div>
            </div>

            {poleSubmitMsg.text && (
              <div style={{ padding: '12px', background: poleSubmitMsg.isError ? 'rgba(244,63,94,0.1)' : 'rgba(5,243,162,0.1)', color: poleSubmitMsg.isError ? 'var(--neon-rose)' : 'var(--neon-green)', borderRadius: '8px', fontSize: '13px', marginTop: '8px' }}>
                {poleSubmitMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loadingPole}
              style={{
                marginTop: '12px',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, var(--neon-blue), var(--neon-purple))',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {loadingPole ? 'Capturando GPS y Guardando...' : '📍 Registrar Poste en Censo (Captura GPS)'}
            </button>
          </form>
        </div>
      ) : (
        <div className="panel-container two-columns">
          {/* SECCIÓN ESCANEO Y BÚSQUEDA */}
          <div className="panel-section">
            <div className="glass-panel">
              <h2 className="panel-header">
                <Camera color="var(--neon-blue)" />
                <span>Escaneo de Custodia</span>
              </h2>

          <div className="form-group">
            <button 
              onClick={() => setIsScannerActive(!isScannerActive)}
              className="gradient-border-btn"
              style={{ justifyContent: 'center', background: isScannerActive ? 'rgba(244, 63, 94, 0.1)' : '', borderColor: isScannerActive ? 'var(--neon-rose)' : '', color: isScannerActive ? 'var(--neon-rose)' : '' }}
            >
              <Camera size={18} />
              <span>{isScannerActive ? 'Detener Cámara' : 'Escanear Código QR'}</span>
            </button>

            {isScannerActive && (
              <div id="qr-reader-target" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', marginTop: '8px' }} />
            )}

            <div className="divider">
              <div className="divider-line"></div>
              <span className="divider-text">O Ingreso Manual</span>
              <div className="divider-line"></div>
            </div>

            <form onSubmit={handleLookupClick} style={{ display: 'flex', gap: '8px' }}>
              <div className="input-with-icon">
                <Search size={16} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Código de Luminaria (Ej. LUM-LERDO-0001)" 
                  value={fixtureCode} 
                  onChange={(e) => setFixtureCode(e.target.value.toUpperCase())}
                  style={{ width: '100%' }}
                />
              </div>
              <button type="submit" className="gradient-border-btn">
                Cargar
              </button>
            </form>

            {searchError && (
              <div style={{ padding: '12px', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--neon-rose)', borderRadius: '8px', fontSize: '13px', display: 'flex', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{searchError}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN ACCIÓN Y DETALLE */}
      <div className="panel-section">
        {loadingSearch ? (
          <div className="glass-panel empty-state">
            Buscando luminaria...
          </div>
        ) : fixtureDetails ? (
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--neon-blue)', textTransform: 'uppercase' }}>Código Escaneado</span>
                <h3 style={{ fontSize: '24px', margin: '4px 0 0 0', fontFamily: 'monospace' }}>{fixtureDetails.code}</h3>
              </div>
              <div>
                <span className={`status-badge ${getStatusClass(fixtureDetails.status)}`}>
                  Estado: {fixtureDetails.status}
                </span>
              </div>
            </div>

            {/* ALERTA DE REGISTRO DUPLICADO EN LAS ÚLTIMAS 12 HORAS */}
            {(() => {
              const recentInstall = historyLog.find(h => {
                const diffMs = Date.now() - new Date(h.installed_at).getTime();
                return diffMs > 0 && diffMs <= 12 * 60 * 60 * 1000;
              });
              if (!recentInstall) return null;
              const timeFormatted = new Date(recentInstall.installed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid var(--neon-amber)', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--neon-amber)', fontSize: '12px', fontWeight: 600, animation: 'pulse 2s infinite' }}>
                  <AlertCircle size={22} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>⚠️ ALERTA DE REGISTRO DUPLICADO RECIENTE:</strong>
                    <div style={{ fontSize: '11px', marginTop: '2px', color: '#fef08a', fontWeight: 500 }}>
                      Esta luminaria ya fue registrada hoy a las <strong>{timeFormatted}</strong> por la <strong>{recentInstall.crew_name}</strong> {recentInstall.operator_name ? `(Responsable: ${recentInstall.operator_name})` : ''}.
                    </div>
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleRegisterInstallation} className="form-group">
              <div className="form-row">
                <div className="form-group">
                  <label>Cuadrilla Asignada</label>
                  <input 
                    type="text" 
                    value={crewName} 
                    disabled 
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', cursor: 'not-allowed', borderColor: 'transparent' }}
                  />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Autenticado como operario</span>
                </div>

                <div className="form-group">
                  <label>Tipo de Evento / Estado</label>
                  <select 
                    value={newStatus} 
                    onChange={(e) => setNewStatus(e.target.value as any)}
                  >
                    <option value="Nueva">Nueva (Instalación o Reemplazo Nuevo)</option>
                    {historyLog.length > 0 && (
                      <>
                        <option value="Reparada">Reparada (Mantenimiento Correctivo)</option>
                        <option value="Rehabilitada">Rehabilitada (Cambio/Pintura/Ajustes)</option>
                        <option value="Robo">Robo / Pérdida total</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Notas de Campo / Observaciones</label>
                <textarea 
                  rows={2} 
                  placeholder="Ej. Poste dañado, luminaria instalada a 6 metros..." 
                  value={installNotes}
                  onChange={(e) => setInstallNotes(e.target.value)}
                />
              </div>

              {/* SECCIÓN EVIDENCIA FOTOGRÁFICA (Doble Captura Opcional) */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--neon-green)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                  <ImageIcon size={14} /> Evidencia Fotográfica en Campo
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      📸 1. Estado / Poste / Código
                    </label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      onChange={handlePhotoBeforeUpload}
                      style={{ fontSize: '11px', width: '100%' }}
                    />
                    {photoBefore && (
                      <img src={photoBefore} alt="Antes" style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '6px', marginTop: '4px', border: '1px solid var(--neon-blue)' }} />
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      📸 2. Lámpara Encendida
                    </label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      onChange={handlePhotoAfterUpload}
                      style={{ fontSize: '11px', width: '100%' }}
                    />
                    {photoAfter && (
                      <img src={photoAfter} alt="Después" style={{ width: '100%', height: '70px', objectFit: 'cover', borderRadius: '6px', marginTop: '4px', border: '1px solid var(--neon-green)' }} />
                    )}
                  </div>
                </div>
              </div>

              {submitMsg.text && (
                <div style={{ padding: '12px', background: submitMsg.isError ? 'rgba(244, 63, 94, 0.1)' : 'rgba(5, 243, 162, 0.1)', color: submitMsg.isError ? 'var(--neon-rose)' : 'var(--neon-green)', borderRadius: '8px', fontSize: '13px', display: 'flex', gap: '8px' }}>
                  {isSimulatedOffline ? <WifiOff size={16} /> : <ShieldCheck size={16} />}
                  <span>{submitMsg.text}</span>
                </div>
              )}

              <button type="submit" className="gradient-border-btn" style={{ justifyContent: 'center', marginTop: '8px' }}>
                <Save size={18} />
                <span>Registrar Instalación / Reporte</span>
              </button>
            </form>

            {historyLog.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={16} /> Historial de la Luminaria
                </h4>
                <div className="history-list">
                  {historyLog.map((hist, idx) => (
                    <div key={idx} className="history-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <strong style={{ color: 'var(--neon-blue)' }}>{hist.crew_name}</strong>
                        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> {new Date(hist.installed_at).toLocaleString()}
                        </span>
                      </div>
                      <p>Estado: <strong>{hist.status_at_install}</strong> {hist.notes && ` — "${hist.notes}"`}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel empty-state">
            <Camera size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
            <strong style={{ color: 'var(--text-main)', fontSize: '16px' }}>Esperando Lectura</strong>
            <p>Escanee un código QR o ingrese manualmente el código alfanumérico para registrar la instalación o realizar mantenimiento.</p>
          </div>
        )}
      </div>
    </div>
    )}
    </div>
  );
};
