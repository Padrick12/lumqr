import { API_BASE_URL } from '../config';
import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Plus, Calendar, Grid, Edit3, Tag, PackageOpen, ShieldAlert } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import './shared-panels.css';

interface Crew {
  id: number;
  name: string;
  username?: string;
  members: string[];
  created_at: string;
}

interface Batch {
  id: number;
  code_prefix: string;
  total_quantity: number;
  arrival_date: string;
}

interface AdminPanelProps {
  onDataChange: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onDataChange }) => {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  
  // Admin Profile State
  type Admin = { id: number; username: string; password?: string; };
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminMsg, setAdminMsg] = useState({ text: '', isError: false });
  const [editingAdminId, setEditingAdminId] = useState<number | null>(null);
  
  const [crewName, setCrewName] = useState('');
  const [crewUsername, setCrewUsername] = useState('');
  const [crewPassword, setCrewPassword] = useState('');
  const [crewMembers, setCrewMembers] = useState(''); 
  const [editingCrewId, setEditingCrewId] = useState<number | null>(null);

  const [batchPrefix, setBatchPrefix] = useState('LUM-LERDO');
  const [batchQty, setBatchQty] = useState(50);
  const [batchDate, setBatchDate] = useState(new Date().toISOString().split('T')[0]);

  const [crewMsg, setCrewMsg] = useState({ text: '', isError: false });
  const [batchMsg, setBatchMsg] = useState({ text: '', isError: false });
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);

  useEffect(() => {
    fetchCrews();
    fetchBatches();
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admins`);
      if (res.ok) {
        const data = await res.json();
        setAdmins(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching admins:', err);
    }
  };

  const fetchCrews = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/crews`);
      if (res.ok) {
        const data = await res.json();
        setCrews(data);
      }
    } catch (err) {
      console.error('Error fetching crews:', err);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches`);
      if (res.ok) {
        const data = await res.json();
        setBatches(data);
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword.trim()) {
      setAdminMsg({ text: 'Todos los campos son requeridos.', isError: true });
      return;
    }
    
    const url = editingAdminId 
      ? `${API_BASE_URL}/api/admins/${editingAdminId}` 
      : `${API_BASE_URL}/api/admins`;
    const method = editingAdminId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setAdminMsg({ text: data.error || 'Error al guardar.', isError: true });
      } else {
        setAdminMsg({ text: editingAdminId ? 'Administrador actualizado.' : 'Administrador creado.', isError: false });
        setEditingAdminId(null);
        setAdminUsername('');
        setAdminPassword('');
        fetchAdmins();
      }
    } catch (err) {
      setAdminMsg({ text: 'Error de conexión con el servidor.', isError: true });
    }
    setTimeout(() => setAdminMsg({ text: '', isError: false }), 4000);
  };

  const handleEditAdmin = (adm: Admin) => {
    setEditingAdminId(adm.id);
    setAdminUsername(adm.username);
    setAdminPassword('');
  };

  const handleDeleteAdmin = async (id: number) => {
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/admins/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAdmins();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
      }
    } catch (err) {
      alert('Error de red al eliminar');
    }
  };

  const handleCrewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crewName.trim() || !crewUsername.trim() || !crewPassword.trim() || !crewMembers.trim()) {
      setCrewMsg({ text: 'Por favor complete todos los campos.', isError: true });
      return;
    }

    const membersArray = crewMembers
      .split(',')
      .map(m => m.trim())
      .filter(m => m.length > 0);

    const url = editingCrewId 
      ? `${API_BASE_URL}/api/crews/${editingCrewId}` 
      : `${API_BASE_URL}/api/crews`;
    const method = editingCrewId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: crewName, username: crewUsername, password: crewPassword, members: membersArray })
      });

      const data = await res.json();
      if (!res.ok) {
        setCrewMsg({ text: data.error || 'Error al procesar la cuadrilla.', isError: true });
      } else {
        setCrewMsg({ 
          text: editingCrewId ? 'Cuadrilla actualizada con éxito.' : 'Cuadrilla registrada con éxito.', 
          isError: false 
        });
        setCrewName('');
        setCrewUsername('');
        setCrewPassword('');
        setCrewMembers('');
        setEditingCrewId(null);
        fetchCrews();
        onDataChange();
      }
    } catch (err) {
      setCrewMsg({ text: 'Error de conexión con el servidor.', isError: true });
    }
    setTimeout(() => setCrewMsg({ text: '', isError: false }), 4000);
  };

  const handleEditCrew = (crew: any) => {
    setEditingCrewId(crew.id);
    setCrewName(crew.name);
    setCrewUsername(crew.username);
    setCrewPassword(crew.password);
    setCrewMembers(crew.members.join(', '));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCrew = async (id: number) => {
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/crews/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCrewMsg({ text: 'Cuadrilla eliminada.', isError: false });
        fetchCrews();
        onDataChange();
      } else {
        const data = await res.json();
        setCrewMsg({ text: data.error || 'No se pudo eliminar.', isError: true });
      }
    } catch (err) {
      setCrewMsg({ text: 'Error al conectar.', isError: true });
    }
    setTimeout(() => setCrewMsg({ text: '', isError: false }), 4000);
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchPrefix.trim() || batchQty <= 0 || !batchDate) {
      setBatchMsg({ text: 'Campos no válidos.', isError: true });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code_prefix: batchPrefix.trim().toUpperCase(),
          total_quantity: batchQty,
          arrival_date: batchDate
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setBatchMsg({ text: data.error || 'Error al guardar el lote.', isError: true });
      } else {
        setBatchMsg({ text: `Lote ${data.code_prefix} de ${data.total_quantity} luminarias registrado con éxito.`, isError: false });
        setBatchPrefix('LUM-LERDO');
        setBatchQty(50);
        fetchBatches();
        onDataChange();
      }
    } catch (err) {
      setBatchMsg({ text: 'Error al conectar con el servidor.', isError: true });
    }
    setTimeout(() => setBatchMsg({ text: '', isError: false }), 4000);
  };

  const handleDeleteBatch = async (id: number) => {
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBatchMsg({ text: 'Lote eliminado exitosamente.', isError: false });
        fetchBatches();
        onDataChange();
      } else {
        const data = await res.json();
        setBatchMsg({ text: data.error || 'No se pudo eliminar el lote.', isError: true });
      }
    } catch (err) {
      setBatchMsg({ text: 'Error al conectar.', isError: true });
    }
    setTimeout(() => setBatchMsg({ text: '', isError: false }), 4000);
  };

  return (
    <div className="panel-container" style={{ gridTemplateColumns: '1fr' }}>
      <style>{`
        @media (min-width: 1024px) {
          .admin-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
      
      
      <div className="admin-grid" style={{ display: 'grid', gap: '32px', gridTemplateColumns: '1fr' }}>
      {/* SECCIÓN ADMINISTRADORES */}
      <div className="panel-section">
        <div className="glass-panel" style={{ marginBottom: '24px' }}>
          <h2 className="panel-header" style={{ color: 'var(--neon-purple)' }}>
            <ShieldAlert color="var(--neon-purple)" />
            <span>Gestión de Administradores</span>
          </h2>
          
          <form onSubmit={handleAdminSubmit} className="form-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Usuario</label>
              <input 
                type="text" 
                placeholder="Ej. admin" 
                value={adminUsername} 
                onChange={(e) => setAdminUsername(e.target.value)} 
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Contraseña</label>
              <input 
                type="text" 
                placeholder="Ej. secreto123" 
                value={adminPassword} 
                onChange={(e) => setAdminPassword(e.target.value)} 
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              {editingAdminId && (
                <button 
                  type="button" 
                  onClick={() => { setEditingAdminId(null); setAdminUsername(''); setAdminPassword(''); }}
                  className="secondary-btn"
                >
                  Cancelar
                </button>
              )}
              <button type="submit" className="gradient-border-btn" style={{ padding: '12px 24px' }}>
                <UserPlus size={18} />
                <span>{editingAdminId ? 'Actualizar' : 'Crear Admin'}</span>
              </button>
            </div>
          </form>
          {adminMsg.text && (
            <p style={{ fontSize: '13px', color: adminMsg.isError ? 'var(--neon-rose)' : 'var(--neon-green)', marginTop: '8px' }}>
              {adminMsg.text}
            </p>
          )}
        </div>

        <div className="glass-panel" style={{ marginBottom: '24px' }}>
          <h3 className="panel-header" style={{ fontSize: '16px' }}>
            <Grid color="var(--text-muted)" />
            <span>Lista de Administradores</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
            {admins.length === 0 ? (
              <p className="empty-state">No hay administradores registrados.</p>
            ) : (
              admins.map(adm => (
                <div key={adm.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{adm.username}</h4>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '0' }}>
                      ID Interno: {adm.id}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => handleEditAdmin(adm)} className="icon-btn" title="Editar admin">
                      <Edit3 size={16} />
                    </button>
                    {admins.length > 1 && (
                      <button onClick={() => setConfirmDialog({ isOpen: true, message: '¿Estás seguro de eliminar a este administrador?', onConfirm: () => handleDeleteAdmin(adm.id) })} className="icon-btn" style={{ color: 'var(--neon-rose)' }} title="Eliminar admin">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SECCIÓN CUADRILLAS */}
        <div className="panel-section">
          <div className="glass-panel">
            <h2 className="panel-header">
              <Users color="var(--neon-purple)" />
              <span>{editingCrewId ? 'Editar Cuadrilla' : 'Registrar Nueva Cuadrilla'}</span>
            </h2>
            
            <form onSubmit={handleCrewSubmit} className="form-group">
              <div className="form-group">
                <label>Nombre de la Cuadrilla</label>
                <input 
                  type="text" 
                  placeholder="Ej. Cuadrilla Centro-Sur" 
                  value={crewName} 
                  onChange={(e) => setCrewName(e.target.value)} 
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Usuario (Login)</label>
                  <input 
                    type="text" 
                    placeholder="Ej. centrosur" 
                    value={crewUsername} 
                    onChange={(e) => setCrewUsername(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Contraseña</label>
                  <input 
                    type="text" 
                    placeholder="Ej. secreto123" 
                    value={crewPassword} 
                    onChange={(e) => setCrewPassword(e.target.value)} 
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Integrantes (separados por comas)</label>
                <textarea 
                  rows={3}
                  placeholder="Ej. Juan Pérez, Luis Gómez, María Solís" 
                  value={crewMembers} 
                  onChange={(e) => setCrewMembers(e.target.value)}
                />
              </div>
              
              {crewMsg.text && (
                <p style={{ fontSize: '13px', color: crewMsg.isError ? 'var(--neon-rose)' : 'var(--neon-green)' }}>
                  {crewMsg.text}
                </p>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {editingCrewId && (
                  <button 
                    type="button" 
                    onClick={() => {
                      setEditingCrewId(null);
                      setCrewName('');
                      setCrewUsername('');
                      setCrewPassword('');
                      setCrewMembers('');
                    }}
                    className="secondary-btn"
                  >
                    Cancelar
                  </button>
                )}
                <button type="submit" className="gradient-border-btn">
                  <UserPlus size={18} />
                  <span>{editingCrewId ? 'Actualizar Cuadrilla' : 'Guardar Cuadrilla'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="glass-panel">
            <h3 className="panel-header" style={{ fontSize: '16px' }}>
              <Grid color="var(--text-muted)" />
              <span>Lista de Cuadrillas Operativas</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
              {crews.length === 0 ? (
                <p className="empty-state">No hay cuadrillas registradas.</p>
              ) : (
                crews.map(crew => (
                  <div key={crew.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{crew.name}</h4>
                      <p style={{ fontSize: '11px', color: 'var(--neon-green)', marginTop: '4px', marginBottom: '2px', fontFamily: 'monospace' }}>
                        Usuario: {crew.username}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                        Integrantes: {crew.members.join(', ')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        onClick={() => handleEditCrew(crew)} 
                        className="icon-btn"
                        title="Editar cuadrilla"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => setConfirmDialog({ isOpen: true, message: '¿Está seguro de eliminar esta cuadrilla? Las luminarias asociadas quedarán sin cuadrilla.', onConfirm: () => handleDeleteCrew(crew.id) })} className="icon-btn" style={{ color: 'var(--neon-rose)' }} title="Eliminar cuadrilla">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SECCIÓN LOTES */}
        <div className="panel-section">
          <div className="glass-panel">
            <h2 className="panel-header">
              <PackageOpen color="var(--neon-green)" />
              <span>Recepción de Material (Lote)</span>
            </h2>
            
            <form onSubmit={handleBatchSubmit} className="form-group">
              <div className="form-group">
                <label>Prefijo del Código (QR / Serial)</label>
                <input 
                  type="text" 
                  placeholder="Ej. LUM-LERDO" 
                  value={batchPrefix} 
                  onChange={(e) => setBatchPrefix(e.target.value.toUpperCase())} 
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Se generarán códigos como: {batchPrefix}-0001 al {batchPrefix}-{String(batchQty).padStart(4, '0')}
                </span>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Cantidad de Lámparas</label>
                  <input 
                    type="number" 
                    min={1}
                    max={10000}
                    placeholder="Ej. 50, 100, 500, 1000..."
                    value={batchQty} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setBatchQty('' as any);
                      } else {
                        const parsed = parseInt(val, 10);
                        setBatchQty(isNaN(parsed) ? '' as any : parsed);
                      }
                    }} 
                  />
                </div>
                <div className="form-group">
                  <label>Fecha de Llegada</label>
                  <input 
                    type="date" 
                    value={batchDate} 
                    onChange={(e) => setBatchDate(e.target.value)} 
                  />
                </div>
              </div>

              {batchMsg.text && (
                <p style={{ fontSize: '13px', color: batchMsg.isError ? 'var(--neon-rose)' : 'var(--neon-green)' }}>
                  {batchMsg.text}
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="submit" className="gradient-border-btn">
                  <Plus size={18} />
                  <span>Registrar Entrada de Lote</span>
                </button>
              </div>
            </form>
          </div>

          <div className="glass-panel">
            <h3 className="panel-header" style={{ fontSize: '16px' }}>
              <Tag color="var(--text-muted)" />
              <span>Historial de Lotes Ingresados</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
              {batches.length === 0 ? (
                <p className="empty-state">No hay lotes registrados.</p>
              ) : (
                batches.map(batch => (
                  <div key={batch.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--neon-blue)' }}>{batch.code_prefix}</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span>Total: <strong>{batch.total_quantity} piezas</strong></span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}><Calendar size={12}/> {batch.arrival_date}</span>
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, padding: '4px 8px', background: 'rgba(0, 242, 254, 0.1)', color: 'var(--neon-blue)', borderRadius: '4px' }}>
                        Lote #{batch.id}
                      </div>
                      <button onClick={() => setConfirmDialog({ isOpen: true, message: '¿Está seguro de eliminar este lote? SE ELIMINARÁN TAMBIÉN TODAS LAS LUMINARIAS ASOCIADAS Y SU HISTORIAL.', onConfirm: () => handleDeleteBatch(batch.id) })} className="icon-btn" style={{ color: 'var(--neon-rose)' }} title="Eliminar lote">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
            {confirmDialog && (
        <ConfirmModal
          isOpen={confirmDialog.isOpen}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          title="Atención"
          confirmText="Sí, eliminar"
          cancelText="Cancelar"
        />
      )}
    </div>
  </div>
);
};