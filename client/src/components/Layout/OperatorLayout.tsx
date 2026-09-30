import React, { useState } from 'react';
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
  const [showLogoutModal, setShowLogoutModal] = useState<boolean>(false);

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
          <button onClick={() => setShowLogoutModal(true)} className="logout-btn" title="Cerrar Sesión">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="operator-content">
        {children}
      </main>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid var(--neon-rose)',
            boxShadow: '0 10px 40px rgba(244, 63, 94, 0.35)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            animation: 'fadeIn 0.2s ease'
          }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              ⚠️ Confirmar Cierre de Sesión
            </div>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
              ¿Está seguro de que desea cerrar la sesión actual de la cuadrilla? Deberá volver a ingresar su usuario y contraseña.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                onClick={() => setShowLogoutModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={() => { setShowLogoutModal(false); onLogout(); }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  background: 'var(--neon-rose)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(244, 63, 94, 0.4)'
                }}
              >
                Sí, Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
