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
          <div className="logo-badge-small" style={{ background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)' }}>🌳</div>
          <div className="brand-text">
            <h2>LUMQR <span className="badge" style={{ background: 'rgba(5, 243, 162, 0.15)', color: 'var(--neon-green)' }}>Lerdo</span></h2>
            <p style={{ color: '#cbd5e1' }}>Cuadrilla Operativa — Lerdo, Dgo. 🌿</p>
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
