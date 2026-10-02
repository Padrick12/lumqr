import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { LogOut, Clock, Calendar } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { OfflineIndicator } from '../OfflineIndicator';
import './layout.css';

interface AppLayoutProps {
  userData?: { id: number; name: string } | null;
  children: ReactNode;
  activeTab: 'map' | 'operator' | 'warehouse' | 'admin' | 'reports';
  setActiveTab: (tab: 'map' | 'operator' | 'warehouse' | 'admin' | 'reports') => void;
  isSimulatedOffline: boolean;
  setIsSimulatedOffline: (val: boolean) => void;
  onSyncComplete: () => void;
  onLogout: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab,
  isSimulatedOffline,
  setIsSimulatedOffline,
  onSyncComplete,
  onLogout,
  userData
}) => {
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const formattedTime = currentDateTime.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userData={userData} />
      
      <main className="app-main">
        <header className="top-bar">
          {/* Live Admin Clock Widget */}
          <div className="admin-live-clock" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(13, 20, 38, 0.7)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '6px 14px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--neon-blue)', fontSize: '12px', fontWeight: 600 }}>
              <Calendar size={14} />
              <span style={{ textTransform: 'capitalize' }}>{formattedDate}</span>
            </div>
            <div style={{ width: '1px', height: '16px', background: 'var(--border-color)' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--neon-green)', fontSize: '13px', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.5px' }}>
              <Clock size={14} />
              <span>{formattedTime}</span>
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <OfflineIndicator 
              isSimulatedOffline={isSimulatedOffline} 
              setIsSimulatedOffline={setIsSimulatedOffline} 
              onSyncComplete={onSyncComplete}
            />
            <button 
              onClick={onLogout} 
              style={{
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: 'var(--neon-rose)',
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
              title="Cerrar Sesión / Cambiar Rol"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        
        <div className="content-area">
          {children}
        </div>
      </main>
    </div>
  );
};
