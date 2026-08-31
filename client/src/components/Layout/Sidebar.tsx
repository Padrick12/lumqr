import React from 'react';
import { Map, Truck, Users, BarChart3, HelpCircle } from 'lucide-react';
import { useDemoMode } from '../../utils/demoMode';
import './layout.css';

interface SidebarProps {
  userData?: { id: number; name: string } | null;
  activeTab: string;
  setActiveTab: (tab: 'map' | 'operator' | 'warehouse' | 'admin' | 'reports') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userData }) => {
  const [isDemoMode] = useDemoMode();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span>STG</span>
        </div>
        <div className="sidebar-title">
          <h1>
            <span className="gradient-text">STG-AP</span>
            <span className="badge">Lerdo, Dgo.</span>
          </h1>
          <p className="sidebar-subtitle">Gestión Alumbrado Público</p>
          {userData && <p style={{ fontSize: '12px', marginTop: '4px', color: 'var(--neon-green)' }}>Bienvenido, {userData.name}</p>}
        </div>
      </div>

      <nav className="sidebar-nav">
        <button 
          onClick={() => setActiveTab('map')}
          className={`nav-item ${activeTab === 'map' ? 'active' : ''}`}
        >
          <Map size={20} />
          <span>Mapa de control</span>
        </button>

        <button 
          onClick={() => setActiveTab('warehouse')}
          className={`nav-item ${activeTab === 'warehouse' ? 'active' : ''}`}
        >
          <Truck size={20} />
          <span>Despacho (Almacén)</span>
        </button>

        <button 
          onClick={() => setActiveTab('admin')}
          className={`nav-item ${activeTab === 'admin' ? 'active-admin' : ''}`}
        >
          <Users size={20} />
          <span>Configuración (Admin)</span>
        </button>

        {!isDemoMode && (
          <button 
            onClick={() => setActiveTab('reports')}
            className={`nav-item ${activeTab === 'reports' ? 'active-operator' : ''}`}
          >
            <BarChart3 size={20} />
            <span>Reportes & Auditoría</span>
          </button>
        )}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
          <HelpCircle size={14} />
          <span>PWA Offline-First v2.0</span>
        </div>
        <p>© 2026 STG-AP Lerdo</p>
      </div>
    </aside>
  );
};

