import { API_BASE_URL } from '../config';
﻿import React, { useState } from 'react';
import { ShieldAlert, HardHat, LogIn, ChevronLeft, AlertCircle } from 'lucide-react';
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
        body: JSON.stringify({ username, password, type: selectedType })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setErrorMsg(data.error || 'Credenciales incorrectas.');
      } else {
        if (data.role === 'admin') {
          onSelectRole('admin', { id: data.admin_id, name: data.admin_name });
        } else if (data.role === 'operator') {
          onSelectRole('operator', { id: data.crew_id, name: data.crew_name });
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
          <div className="logo-badge">LQ</div>
          <h1>LUMQR <span className="highlight">Access</span></h1>
          <p>Seleccione su entorno de trabajo para iniciar sesión.</p>
        </div>

        <div className="roles-grid">
          <button 
            className="role-card admin-card"
            onClick={() => setSelectedType('admin')}
          >
            <div className="role-icon-wrapper">
              <ShieldAlert size={32} />
            </div>
            <h2>Centro de Control</h2>
            <p>Acceso a métricas, mapas, inventario y reportes de auditoría.</p>
            <div className="role-action">
              <span>Ingresar</span>
              <LogIn size={16} />
            </div>
          </button>

          <button 
            className="role-card operator-card"
            onClick={() => setSelectedType('operator')}
          >
            <div className="role-icon-wrapper">
              <HardHat size={32} />
            </div>
            <h2>Cuadrilla en Campo</h2>
            <p>Acceso móvil para instalación, mantenimiento y lectura QR.</p>
            <div className="role-action">
              <span>Ingresar</span>
              <LogIn size={16} />
            </div>
          </button>
        </div>

        <div className="role-selector-footer">
          <p>LUMQR - Sistema de Control Interno © 2026</p>
        </div>
      </div>
    </div>
  );
};

