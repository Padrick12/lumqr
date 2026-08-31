import React from 'react';
import { LogOut } from 'lucide-react';
import './OperatorLayout.css';

interface OperatorLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  offlineIndicator: React.ReactNode;
}

export const OperatorLayout: React.FC<OperatorLayoutProps> = ({ 
  children, 
  onLogout, 
  offlineIndicator 
}) => {
  return (
    <div className="operator-layout">
      <header className="operator-header">
        <div className="operator-brand">
          <div className="logo-badge-small">STG</div>
          <div className="brand-text">
            <h2>STG-AP <span className="badge">Lerdo</span></h2>
            <p>Sistema Total de Gestión de Alumbrado Público</p>
          </div>
        </div>

        <div className="operator-actions">
          {offlineIndicator}
          <button onClick={onLogout} className="logout-btn" title="Cerrar Sesión">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="operator-content">
        {children}
      </main>
    </div>
  );
};
