import { API_BASE_URL } from '../config';
import React, { useState } from 'react';
import { ShieldAlert, HardHat, LogIn, ChevronLeft, AlertCircle, EyeOff } from 'lucide-react';
import { setDemoMode } from '../utils/demoMode';
import './RoleSelector.css';

interface RoleSelectorProps {
  onSelectRole: (role: 'admin' | 'operator', crewData?: { id: number; name: string }) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelectRole }) => {
  const [selectedType, setSelectedType] = useState<'admin' | 'operator' | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Ingrese usuario y contraseña.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType, username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Credenciales incorrectas.');
      } else {
        setDemoMode(false); // Official login activates Full Mode
        if (selectedType === 'admin') {
          onSelectRole('admin', { 
            id: data.admin_id || data.admin?.id || 1, 
            name: data.admin_name || data.admin?.username || 'Administrador' 
          });
        } else {
          onSelectRole('operator', { 
            id: data.crew_id || data.crew?.id || 1, 
            name: data.crew_name || data.crew?.name || username 
          });
        }
      }
    } catch (err) {
      setErrorMsg('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  if (selectedType) {
    return (
      <div className="role-selector-container">
        <div className="role-selector-content login-mode">
          <button className="back-btn" onClick={() => setSelectedType(null)}>
            <ChevronLeft size={20} />
            <span>Volver</span>
          </button>
          
          <div className="login-box">
            <div className="role-icon-wrapper" style={{ margin: '0 auto 24px auto', background: selectedType === 'admin' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(5, 243, 162, 0.1)', color: selectedType === 'admin' ? 'var(--neon-purple)' : 'var(--neon-green)' }}>
              {selectedType === 'admin' ? <ShieldAlert size={36} /> : <HardHat size={36} />}
            </div>
            
            <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>
              {selectedType === 'admin' ? 'Centro de Control' : 'Acceso de Cuadrilla'}
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '32px' }}>
              Ingrese sus credenciales de acceso seguro.
            </p>

            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label>Usuario</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="Ej. admin o nombre de cuadrilla"
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••"
                />
              </div>

              {errorMsg && (
                <div className="login-error">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button type="submit" className="login-submit-btn" disabled={loading} style={{ background: selectedType === 'admin' ? 'var(--neon-purple)' : 'var(--neon-green)', color: '#000' }}>
                {loading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="role-selector-container">
      <div className="role-selector-content">
        <div className="role-selector-header">
          <div className="logo-badge">
            STG
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
            STG-AP <span className="highlight" style={{ color: 'var(--neon-green)' }}>Lerdo</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            Sistema Total de Gestión de Alumbrado Público — Lerdo, Dgo.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', width: '100%' }}>
          <button 
            className="role-card admin-card"
            onClick={() => setSelectedType('admin')}
            style={{ margin: 0, height: '100%' }}
          >
            <div className="role-icon-wrapper">
              <ShieldAlert size={22} />
            </div>
            <h2>Centro de Control</h2>
            <p>Acceso oficial a métricas, mapas, inventario y reportes de auditoría.</p>
            <div className="role-action">
              <span>Ingresar</span>
              <LogIn size={14} />
            </div>
          </button>

          <button 
            className="role-card operator-card"
            onClick={() => setSelectedType('operator')}
            style={{ margin: 0, height: '100%' }}
          >
            <div className="role-icon-wrapper">
              <HardHat size={22} />
            </div>
            <h2>Cuadrilla en Campo</h2>
            <p>Acceso móvil oficial para instalación, mantenimiento y lectura QR.</p>
            <div className="role-action">
              <span>Ingresar</span>
              <LogIn size={14} />
            </div>
          </button>

          <button 
            className="role-card"
            onClick={() => {
              setDemoMode(true);
              onSelectRole('admin', { id: 888, name: 'Admin Demo (Presentación)' });
            }}
            style={{
              margin: 0,
              height: '100%',
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(245, 158, 11, 0.03) 100%)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              boxShadow: '0 4px 16px rgba(234, 179, 8, 0.12)'
            }}
          >
            <div className="role-icon-wrapper" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#eab308' }}>
              <EyeOff size={22} />
            </div>
            <h2 style={{ color: '#eab308' }}>Admin Demo</h2>
            <p>Vista previa del mapa, despacho y configuración (sin métricas ni respaldos).</p>
            <div className="role-action" style={{ color: '#eab308' }}>
              <span>Entrar Admin Demo</span>
              <LogIn size={14} />
            </div>
          </button>

          <button 
            className="role-card"
            onClick={() => {
              setDemoMode(true);
              onSelectRole('operator', { id: 999, name: 'Cuadrilla Demo (Presentación)' });
            }}
            style={{
              margin: 0,
              height: '100%',
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(245, 158, 11, 0.03) 100%)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              boxShadow: '0 4px 16px rgba(234, 179, 8, 0.12)'
            }}
          >
            <div className="role-icon-wrapper" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#eab308' }}>
              <EyeOff size={22} />
            </div>
            <h2 style={{ color: '#eab308' }}>Cuadrilla Demo</h2>
            <p>Vista previa básica de escaneo QR y censo (sin WhatsApp ni fotos).</p>
            <div className="role-action" style={{ color: '#eab308' }}>
              <span>Entrar Cuadrilla Demo</span>
              <LogIn size={14} />
            </div>
          </button>
        </div>

        <div className="role-selector-footer">
          <p>STG-AP — Sistema Total de Gestión de Alumbrado Público © 2026</p>
        </div>
      </div>
    </div>
  );
};

