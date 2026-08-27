import { API_BASE_URL } from '../config';
import React, { useState, useEffect } from 'react';
import { Wifi, RefreshCw, AlertTriangle, CloudOff } from 'lucide-react';
import { getQueue } from '../utils/offlineStore';

interface OfflineIndicatorProps {
  isSimulatedOffline?: boolean;
  setIsSimulatedOffline?: (sim: boolean) => void;
  onSyncComplete: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  isSimulatedOffline = false,
  onSyncComplete
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');

  const effectiveOnline = isOnline && !isSimulatedOffline;

  // Listen to browser network changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update queue count periodically
  const updateQueueCount = async () => {
    try {
      const q = await getQueue();
      setQueueCount(q.length);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    updateQueueCount();
    const interval = setInterval(updateQueueCount, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto sync when back online
  useEffect(() => {
    if (effectiveOnline && queueCount > 0 && !isSyncing) {
      triggerSync();
    }
  }, [effectiveOnline, queueCount]);

  const triggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatusMsg('Sincronizando...');

    try {
      const queue = await getQueue();
      if (queue.length === 0) {
        setIsSyncing(false);
        setSyncStatusMsg('');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/installations/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue })
      });

      if (!response.ok) {
        throw new Error('Error al sincronizar con el servidor.');
      }

      const data = await response.json();
      
      const { succeeded } = data.results;
      const { removeFromQueue } = await import('../utils/offlineStore');
      
      for (const code of succeeded) {
        await removeFromQueue(code);
      }

      setSyncStatusMsg(`¡Éxito! ${succeeded.length} registros cargados.`);
      setTimeout(() => setSyncStatusMsg(''), 4000);
      await updateQueueCount();
      onSyncComplete();
    } catch (error: any) {
      console.error('Sync failed:', error);
      setSyncStatusMsg('Reintento pendiente.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      background: 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      borderRadius: '12px',
      padding: '12px 16px',
      minWidth: '220px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
    }}>
      <style>{`
        /* Toggle Switch CSS */
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }
        .toggle-switch input { 
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(255, 255, 255, 0.1);
          transition: .3s;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 2px;
          bottom: 2px;
          background-color: var(--text-muted);
          transition: .3s;
          border-radius: 50%;
        }
        input:checked + .toggle-slider {
          background-color: rgba(244, 63, 94, 0.3);
          border-color: var(--neon-rose);
        }
        input:checked + .toggle-slider:before {
          transform: translateX(16px);
          background-color: var(--neon-rose);
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {effectiveOnline ? (
            <>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--neon-green)', boxShadow: '0 0 8px var(--neon-green)' }}></div>
              <Wifi size={16} color="var(--neon-green)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>En Línea</span>
            </>
          ) : (
            <>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--neon-rose)', boxShadow: '0 0 8px var(--neon-rose)', animation: 'pulse 2s infinite' }}></div>
              <CloudOff size={16} color="var(--neon-rose)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Sin Conexión (Offline)</span>
            </>
          )}
        </div>
      </div>

      {queueCount > 0 && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--neon-amber)' }}>
              <AlertTriangle size={14} />
              {queueCount} lectura(s) pendientes
            </span>
            {effectiveOnline && (
              <button 
                onClick={triggerSync}
                disabled={isSyncing}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-main)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  cursor: isSyncing ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={12} style={isSyncing ? { animation: 'spin 1s linear infinite' } : {}} />
                {isSyncing ? 'Syncing...' : 'Sincronizar'}
              </button>
            )}
          </div>
          {syncStatusMsg && (
            <p style={{ fontSize: '10px', color: 'var(--neon-blue)', margin: 0, fontStyle: 'italic' }}>{syncStatusMsg}</p>
          )}
        </div>
      )}

      {/* BANNER FLOTANTE PERMANENTE INFERIOR AL HABER PENDIENTES OFFLINE */}
      {queueCount > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--neon-amber)',
          boxShadow: '0 8px 30px rgba(245, 158, 11, 0.3)',
          borderRadius: '16px',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          backdropFilter: 'blur(12px)',
          maxWidth: '90vw',
          width: '520px',
          animation: 'pulse 2s infinite'
        }}>
          <AlertTriangle color="var(--neon-amber)" size={24} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--neon-amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚠️ {queueCount} REGISTROS GUARDADOS EN MEMORIA DEL CELULAR
            </div>
            <p style={{ fontSize: '11px', color: '#cbd5e1', margin: '2px 0 0 0' }}>
              Se sincronizarán automáticamente al detectar señal 4G/WiFi. <strong style={{ color: '#fff' }}>No cierres el navegador.</strong>
            </p>
          </div>
          {effectiveOnline && (
            <button
              onClick={triggerSync}
              disabled={isSyncing}
              style={{
                background: 'var(--neon-amber)',
                color: '#000',
                fontWeight: 800,
                fontSize: '12px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} style={isSyncing ? { animation: 'spin 1s linear infinite' } : {}} />
              {isSyncing ? 'Enviando...' : 'Sincronizar'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
