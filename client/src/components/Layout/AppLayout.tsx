import React from 'react';
import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
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
  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userData={userData} />
      
      <main className="app-main">
        <header className="top-bar">
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
