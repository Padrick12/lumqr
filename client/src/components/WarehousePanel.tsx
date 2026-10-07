import { API_BASE_URL } from '../config';
import React, { useState, useEffect } from 'react';
import { 
  Truck, CheckCircle2, QrCode, Printer, Download, Search, 
  AlertCircle, Archive, Sparkles, Layers, Hash, List, 
  CheckSquare, Square, ArrowRight
} from 'lucide-react';
import { generateLabelDataURL } from '../utils/qr';
import { formatFixtureCode } from '../utils/codeFormatter';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import './shared-panels.css';

interface Crew {
  id: number;
  name: string;
}

interface Batch {
  id: number;
  code_prefix: string;
  total_quantity: number;
  arrival_date: string;
}

interface Fixture {
  code: string;
  status: string;
  crew_name: string | null;
  code_prefix: string;
  batch_id: number;
  crew_id?: number | null;
  installation_id?: number | null;
  installed_at?: string | null;
  installed_by_operator?: string | null;
  installed_by_crew?: string | null;
  internal_folio?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface WarehousePanelProps {
  onDataChange: () => void;
}

type AssignMode = 'all' | 'range' | 'quantity' | 'codes';

export const WarehousePanel: React.FC<WarehousePanelProps> = ({ onDataChange }) => {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  
  // Assignment form state
  const [selectedBatchId, setSelectedBatchId] = useState<number | ''>('');
  const [selectedCrewId, setSelectedCrewId] = useState<number | ''>('');
  const [assignMode, setAssignMode] = useState<AssignMode>('all');
  const [quantityToAssign, setQuantityToAssign] = useState<number | ''>(10);
  const [startNum, setStartNum] = useState<string>('');
  const [endNum, setEndNum] = useState<string>('');
  const [customCodesInput, setCustomCodesInput] = useState<string>('');
  const [assignMsg, setAssignMsg] = useState({ text: '', isError: false });
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // Multi-select state
  const [selectedCardCodes, setSelectedCardCodes] = useState<string[]>([]);
  const [bulkCrewId, setBulkCrewId] = useState<number | ''>('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  // Single card quick action state
  const [updatingCode, setUpdatingCode] = useState<string | null>(null);

  // Inventory & QR view state
  const [qrBatchId, setQrBatchId] = useState<number | ''>('');
  const [fixturesForQr, setFixturesForQr] = useState<Fixture[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCrewFilter, setSelectedCrewFilter] = useState<string>('todos');
  const [installationStatusFilter, setInstallationStatusFilter] = useState<'todos' | 'instaladas' | 'en_camion' | 'en_almacen'>('todos');
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [loadingQrs, setLoadingQrs] = useState(false);

  useEffect(() => {
    fetchCrews();
    fetchBatches();
  }, []);

  const fetchCrews = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/crews`);
      if (res.ok) setCrews(await res.json());
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
        if (data.length > 0) {
          setSelectedBatchId(data[0].id);
          setQrBatchId(data[0].id);
          fetchFixturesForQr(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
    }
  };

  const fetchFixturesForQr = async (batchId: number) => {
    setLoadingQrs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports`);
      if (res.ok) {
        const data = await res.json();
        const filtered = (data.fixtures || []).filter((f: any) => {
          return Number(f.batch_id) === Number(batchId);
        });
        setFixturesForQr(filtered);
        
        const urls: Record<string, string> = {};
        for (const item of filtered.slice(0, 150)) { 
          urls[item.code] = await generateLabelDataURL(item.code);
        }
        setQrImages(urls);
      }
    } catch (err) {
      console.error('Error fetching fixtures:', err);
    } finally {
      setLoadingQrs(false);
    }
  };

  useEffect(() => {
    if (qrBatchId) {
      fetchFixturesForQr(Number(qrBatchId));
      setSelectedCardCodes([]);
    }
  }, [qrBatchId, batches]);

  // Handle Strategic Assignment Form Submission
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCrewId) {
      setAssignMsg({ text: 'Por favor seleccione la cuadrilla destino.', isError: true });
      return;
    }

    let payload: any = {
      crew_id: Number(selectedCrewId),
      batch_id: selectedBatchId ? Number(selectedBatchId) : undefined,
      mode: assignMode
    };

    if (assignMode === 'all') {
      if (!selectedBatchId) {
        setAssignMsg({ text: 'Por favor seleccione el lote de origen.', isError: true });
        return;
      }
      payload.quantity = 'all';
    } else if (assignMode === 'range') {
      if (!selectedBatchId || !startNum || !endNum) {
        setAssignMsg({ text: 'Por favor ingrese el número inicial y final del rango.', isError: true });
        return;
      }
      payload.start_num = parseInt(startNum, 10);
      payload.end_num = parseInt(endNum, 10);
    } else if (assignMode === 'quantity') {
      if (!selectedBatchId || !quantityToAssign || Number(quantityToAssign) <= 0) {
        setAssignMsg({ text: 'Por favor ingrese una cantidad válida mayor a 0.', isError: true });
        return;
      }
      payload.quantity = Number(quantityToAssign);
    } else if (assignMode === 'codes') {
      const rawCodes = customCodesInput
        .split(/[\n,; \t]+/)
        .map(c => formatFixtureCode(c.trim()))
        .filter(Boolean);

      if (rawCodes.length === 0) {
        setAssignMsg({ text: 'Por favor ingrese al menos un código válido.', isError: true });
        return;
      }
      payload.codes = rawCodes;
    }

    setIsSubmittingAssign(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setAssignMsg({ text: data.error || 'Error al asignar luminarias.', isError: true });
      } else {
        const rangeText = data.range?.startCode && data.range?.endCode 
          ? ` (Rango: ${data.range.startCode} al ${data.range.endCode})` 
          : '';
        setAssignMsg({ 
          text: `✅ ¡Asignación exitosa! ${data.assigned_count} luminarias asignadas a la cuadrilla.${rangeText}`, 
          isError: false 
        });
        setCustomCodesInput('');
        setStartNum('');
        setEndNum('');
        onDataChange();
        if (qrBatchId) fetchFixturesForQr(Number(qrBatchId));
      }
    } catch (err) {
      setAssignMsg({ text: 'Error al conectar con el servidor.', isError: true });
    } finally {
      setIsSubmittingAssign(false);
    }
    setTimeout(() => setAssignMsg({ text: '', isError: false }), 7000);
  };

  // Handle single card crew custody change
  const handleSingleCardCrewChange = async (code: string, newCrewId: number | '') => {
    setUpdatingCode(code);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fixtures/${code}/crew`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crew_id: newCrewId ? Number(newCrewId) : null })
      });
      if (res.ok) {
        const data = await res.json();
        // Update local state instantly
        setFixturesForQr(prev => prev.map(f => {
          if (f.code === code) {
            return {
              ...f,
              crew_id: data.crew_id,
              crew_name: data.crew_name
            };
          }
          return f;
        }));
        onDataChange();
      }
    } catch (err) {
      console.error('Error updating fixture crew:', err);
    } finally {
      setUpdatingCode(null);
    }
  };

  // Handle bulk assign of selected cards
  const handleBulkCardAssign = async (targetCrewId: number | '') => {
    if (selectedCardCodes.length === 0) return;
    setIsBulkAssigning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fixtures/bulk-crew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codes: selectedCardCodes,
          crew_id: targetCrewId ? Number(targetCrewId) : null
        })
      });

      if (res.ok) {
        const crewName = targetCrewId ? crews.find(c => c.id === Number(targetCrewId))?.name || null : null;
        setFixturesForQr(prev => prev.map(f => {
          if (selectedCardCodes.includes(f.code)) {
            return {
              ...f,
              crew_id: targetCrewId ? Number(targetCrewId) : null,
              crew_name: crewName
            };
          }
          return f;
        }));
        setSelectedCardCodes([]);
        onDataChange();
      }
    } catch (err) {
      console.error('Error bulk assigning fixtures:', err);
    } finally {
      setIsBulkAssigning(false);
    }
  };

  // Toggle single card selection
  const toggleSelectCard = (code: string) => {
    setSelectedCardCodes(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Select/Deselect all visible cards
  const toggleSelectAllVisible = () => {
    const uninstalledVisible = filteredFixtures.filter(f => !f.installation_id).map(f => f.code);
    if (uninstalledVisible.every(c => selectedCardCodes.includes(c))) {
      setSelectedCardCodes(prev => prev.filter(c => !uninstalledVisible.includes(c)));
    } else {
      setSelectedCardCodes(prev => Array.from(new Set([...prev, ...uninstalledVisible])));
    }
  };

  // Metrics for the batch
  const totalInBatch = fixturesForQr.length;
  const installedInBatch = fixturesForQr.filter(f => Boolean(f.installation_id)).length;
  const onTruckInBatch = fixturesForQr.filter(f => Boolean(f.crew_name) && !f.installation_id).length;
  const inWarehouseInBatch = fixturesForQr.filter(f => !f.crew_name && !f.installation_id).length;

  // Selected crew metrics
  const isSpecificCrew = selectedCrewFilter !== 'todos' && selectedCrewFilter !== 'libres' && selectedCrewFilter !== 'asignadas';
  const crewAssignedFixtures = isSpecificCrew ? fixturesForQr.filter(f => f.crew_name === selectedCrewFilter) : [];
  const crewInstalledCount = isSpecificCrew ? crewAssignedFixtures.filter(f => Boolean(f.installation_id)).length : 0;
  const crewPendingCount = isSpecificCrew ? crewAssignedFixtures.filter(f => !f.installation_id).length : 0;

  const filteredFixtures = fixturesForQr.filter(f => {
    const formattedTerm = formatFixtureCode(searchTerm);
    const termLower = searchTerm.toLowerCase().trim();
    const matchesSearch = !termLower || 
      f.code.toLowerCase().includes(termLower) || 
      (formattedTerm.length > 0 && f.code.includes(formattedTerm)) ||
      (f.internal_folio && f.internal_folio.toLowerCase().includes(termLower)) ||
      (f.installed_by_operator && f.installed_by_operator.toLowerCase().includes(termLower));
    
    let matchesCrew = true;
    if (selectedCrewFilter === 'asignadas') {
      matchesCrew = f.crew_name !== null;
    } else if (selectedCrewFilter === 'libres') {
      matchesCrew = f.crew_name === null;
    } else if (selectedCrewFilter !== 'todos') {
      matchesCrew = f.crew_name === selectedCrewFilter;
    }

    let matchesStatus = true;
    if (installationStatusFilter === 'instaladas') {
      matchesStatus = Boolean(f.installation_id);
    } else if (installationStatusFilter === 'en_camion') {
      matchesStatus = !f.installation_id && Boolean(f.crew_name);
    } else if (installationStatusFilter === 'en_almacen') {
      matchesStatus = !f.installation_id && !f.crew_name;
    }

    return matchesSearch && matchesCrew && matchesStatus;
  });

  const handlePrintCodes = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <html>
        <head>
          <title>Impresión de Etiquetas QR — STG-AP</title>
          <style>
            body { font-family: sans-serif; background: #fff; margin: 0; padding: 20px; color: #000; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .card { border: 1px solid #ccc; padding: 15px; text-align: center; border-radius: 8px; page-break-inside: avoid; }
            .code { font-weight: bold; font-size: 16px; margin-top: 8px; font-family: monospace; letter-spacing: 1px; }
            .status { font-size: 11px; font-weight: bold; margin-top: 4px; }
            .crew { font-size: 11px; color: #444; margin-top: 2px; }
            img { width: 130px; height: 130px; }
            @media print {
              body { padding: 0; }
              .card { border: 1px solid #000; }
            }
          </style>
        </head>
        <body>
          <h2 style="text-align:center; margin-bottom: 20px;">Etiquetas de Inventario, Trazabilidad y Custodia - Lerdo, Dgo.</h2>
          <div class="grid">
            ${filteredFixtures.map(f => {
              const isInstalled = Boolean(f.installation_id);
              const statusText = isInstalled 
                ? '✅ INSTALADA EN CAMPO' 
                : (f.crew_name ? '🚚 EN CAMIÓN / PENDIENTE' : '🏢 EN ALMACÉN');
              const crewText = isInstalled 
                ? `Instalada por: ${f.installed_by_crew || f.crew_name || 'Cuadrilla'}${f.internal_folio ? ` • Folio: ${f.internal_folio}` : ''}`
                : (f.crew_name ? `Custodia: ${f.crew_name}` : 'Disponible para asignación');

              return `
                <div class="card">
                  <img src="${qrImages[f.code] || ''}" alt="QR" />
                  <div class="code">${f.code}</div>
                  <div class="status" style="color: ${isInstalled ? '#059669' : (f.crew_name ? '#7c3aed' : '#475569')}">${statusText}</div>
                  <div class="crew">${crewText}</div>
                </div>
              `;
            }).join('')}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleDownloadZip = async () => {
    if (filteredFixtures.length === 0) return;
    setLoadingQrs(true);
    try {
      const zip = new JSZip();
      
      for (const f of filteredFixtures) {
        const dataUrl = qrImages[f.code] || await generateLabelDataURL(f.code);
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        zip.file(`${f.code}.png`, base64Data, { base64: true });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const batchName = batches.find(b => b.id === qrBatchId)?.code_prefix || 'Lote';
      saveAs(content, `QRs_${batchName}.zip`);
    } catch (err) {
      console.error('Error generating zip:', err);
    } finally {
      setLoadingQrs(false);
    }
  };

  const selectedBatchObj = batches.find(b => b.id === selectedBatchId);

  return (
    <div className="panel-container" style={{ gridTemplateColumns: '1fr' }}>
      <style>{`
        @media (min-width: 1024px) {
          .warehouse-grid { grid-template-columns: 380px 1fr; }
        }
        .assign-tab-btn {
          flex: 1;
          padding: 8px 6px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: rgba(0,0,0,0.3);
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.2s ease;
        }
        .assign-tab-btn.active {
          background: rgba(56, 189, 248, 0.15);
          border-color: var(--neon-blue);
          color: #fff;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
        }
      `}</style>
      <div className="panel-container warehouse-grid">
        {/* PANEL ASIGNACIÓN ESTRATÉGICA */}
        <div className="panel-section">
          <div className="glass-panel" style={{ height: 'fit-content' }}>
            <h2 className="panel-header">
              <Truck color="var(--neon-blue)" />
              <span>Asignación de Custodia</span>
            </h2>

            <form onSubmit={handleAssignSubmit} className="form-group" style={{ gap: '14px' }}>
              <div className="form-group">
                <label>1. Cuadrilla Destino (Responsable)</label>
                <select 
                  value={selectedCrewId} 
                  onChange={(e) => setSelectedCrewId(Number(e.target.value))}
                  required
                >
                  <option value="" disabled>-- Seleccione una Cuadrilla --</option>
                  {crews.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* TABS DE MODALIDAD DE ASIGNACIÓN */}
              <div className="form-group">
                <label>2. Método de Asignación</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  <button 
                    type="button" 
                    className={`assign-tab-btn ${assignMode === 'all' ? 'active' : ''}`}
                    onClick={() => setAssignMode('all')}
                  >
                    <Layers size={13} />
                    <span>Lote Completo</span>
                  </button>
                  <button 
                    type="button" 
                    className={`assign-tab-btn ${assignMode === 'range' ? 'active' : ''}`}
                    onClick={() => setAssignMode('range')}
                  >
                    <Hash size={13} />
                    <span>Por Rango</span>
                  </button>
                  <button 
                    type="button" 
                    className={`assign-tab-btn ${assignMode === 'quantity' ? 'active' : ''}`}
                    onClick={() => setAssignMode('quantity')}
                  >
                    <Sparkles size={13} />
                    <span>Por Cantidad</span>
                  </button>
                  <button 
                    type="button" 
                    className={`assign-tab-btn ${assignMode === 'codes' ? 'active' : ''}`}
                    onClick={() => setAssignMode('codes')}
                  >
                    <List size={13} />
                    <span>Por Lista</span>
                  </button>
                </div>
              </div>

              {/* SELECTOR DE LOTE (Para modos all, range, quantity) */}
              {assignMode !== 'codes' && (
                <div className="form-group">
                  <label>3. Seleccionar Lote de Origen</label>
                  <select 
                    value={selectedBatchId} 
                    onChange={(e) => {
                      const bId = Number(e.target.value);
                      setSelectedBatchId(bId);
                      setQrBatchId(bId);
                    }}
                    required
                  >
                    <option value="" disabled>-- Seleccione un Lote --</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.code_prefix} (Lote #{b.id} - {b.total_quantity} pzas)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* MODO 1: LOTE COMPLETO */}
              {assignMode === 'all' && (
                <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--neon-blue)', marginBottom: '4px' }}>
                    📦 Asignar Todo el Lote en 1 Clic
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Todas las luminarias sin asignar del lote <strong>{selectedBatchObj?.code_prefix || ''}</strong> se vincularán de inmediato a la cuadrilla seleccionada.
                  </div>
                </div>
              )}

              {/* MODO 2: POR RANGO */}
              {assignMode === 'range' && (
                <div className="form-group" style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--neon-purple)', marginBottom: '8px' }}>
                    🔢 Rango Numérico de Luminarias
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px' }}>Desde el Número (#)</label>
                      <input 
                        type="number" 
                        min={1} 
                        placeholder="Ej. 1" 
                        value={startNum} 
                        onChange={(e) => setStartNum(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px' }}>Hasta el Número (#)</label>
                      <input 
                        type="number" 
                        min={1} 
                        placeholder="Ej. 50" 
                        value={endNum} 
                        onChange={(e) => setEndNum(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  {startNum && endNum && selectedBatchObj && (
                    <div style={{ fontSize: '11px', color: '#c084fc', marginTop: '8px', fontFamily: 'monospace' }}>
                      Rango: {selectedBatchObj.code_prefix}-{String(startNum).padStart(4, '0')} al {selectedBatchObj.code_prefix}-{String(endNum).padStart(4, '0')}
                    </div>
                  )}
                </div>
              )}

              {/* MODO 3: POR CANTIDAD */}
              {assignMode === 'quantity' && (
                <div className="form-group">
                  <label>Cantidad de Piezas a Asignar</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={10000}
                    placeholder="Ej. 10, 50, 100..."
                    value={quantityToAssign}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') setQuantityToAssign('');
                      else {
                        const parsed = parseInt(val, 10);
                        setQuantityToAssign(isNaN(parsed) ? '' : parsed);
                      }
                    }}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Se asignarán las primeras piezas libres disponibles del lote.
                  </span>
                </div>
              )}

              {/* MODO 4: POR LISTA DE CÓDIGOS */}
              {assignMode === 'codes' && (
                <div className="form-group">
                  <label>Pegar o Escanear Códigos Específicos</label>
                  <textarea 
                    rows={4}
                    placeholder="Ej. LUM-LERDO-0017, LUM-LERDO-0021, LUM-LERDO-0022 o separados por salto de línea"
                    value={customCodesInput}
                    onChange={(e) => setCustomCodesInput(e.target.value)}
                    style={{ width: '100%', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical' }}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Puede pegar códigos separados por coma, espacio o salto de línea.
                  </span>
                </div>
              )}

              {assignMsg.text && (
                <div style={{ padding: '12px', background: assignMsg.isError ? 'rgba(244, 63, 94, 0.12)' : 'rgba(5, 243, 162, 0.12)', color: assignMsg.isError ? 'var(--neon-rose)' : 'var(--neon-green)', borderRadius: '8px', fontSize: '13px', display: 'flex', gap: '8px', border: `1px solid ${assignMsg.isError ? 'rgba(244, 63, 94, 0.3)' : 'rgba(5, 243, 162, 0.3)'}` }}>
                  <AlertCircle size={16} />
                  <span>{assignMsg.text}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSubmittingAssign}
                className="gradient-border-btn" 
                style={{ justifyContent: 'center', opacity: isSubmittingAssign ? 0.7 : 1 }}
              >
                <CheckCircle2 size={18} />
                <span>{isSubmittingAssign ? 'Asignando...' : 'Transferir Custodia a Cuadrilla'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* DETALLE DEL LOTE Y EXPORTACIÓN QR */}
        <div className="panel-section">
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <h2 className="panel-header" style={{ margin: 0 }}>
                <QrCode color="var(--neon-green)" />
                <span>Control de Inventario y Códigos QR</span>
              </h2>
              
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  onClick={toggleSelectAllVisible}
                  className="secondary-btn"
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >
                  <CheckSquare size={14} />
                  <span>{selectedCardCodes.length > 0 ? 'Deseleccionar' : 'Seleccionar Todo'}</span>
                </button>
                <button 
                  onClick={handleDownloadZip}
                  disabled={filteredFixtures.length === 0 || loadingQrs}
                  className="secondary-btn"
                  style={{ color: 'var(--neon-blue)', borderColor: 'var(--neon-blue)', fontSize: '11px', padding: '6px 10px' }}
                >
                  <Archive size={14} />
                  <span>Descargar ZIP</span>
                </button>
                <button 
                  onClick={handlePrintCodes}
                  disabled={filteredFixtures.length === 0 || loadingQrs}
                  className="secondary-btn"
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >
                  <Printer size={14} />
                  <span>Imprimir / PDF</span>
                </button>
              </div>
            </div>

            {/* LIVE KPI METRICS FOR SELECTED BATCH */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total en Lote</span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--neon-blue)', marginTop: '2px' }}>{totalInBatch}</div>
              </div>
              <div style={{ background: 'rgba(5, 243, 162, 0.08)', border: '1px solid rgba(5, 243, 162, 0.3)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>✅ Ya Instaladas</span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--neon-green)', marginTop: '2px' }}>{installedInBatch}</div>
              </div>
              <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: 700, textTransform: 'uppercase' }}>🚚 En Camión (Pendientes)</span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--neon-purple)', marginTop: '2px' }}>{onTruckInBatch}</div>
              </div>
              <div style={{ background: 'rgba(148, 163, 184, 0.08)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>🏢 En Almacén Central</span>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#f1f5f9', marginTop: '2px' }}>{inWarehouseInBatch}</div>
              </div>
            </div>

            {/* BARRA DE ASIGNACIÓN MASIVA PARA ELEMENTOS SELECCIONADOS */}
            {selectedCardCodes.length > 0 && (
              <div style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(139, 92, 246, 0.2))', border: '1.5px solid var(--neon-blue)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckSquare color="var(--neon-blue)" size={18} />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>
                    {selectedCardCodes.length} luminarias seleccionadas
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <select 
                    value={bulkCrewId} 
                    onChange={(e) => setBulkCrewId(e.target.value ? Number(e.target.value) : '')}
                    style={{ fontSize: '12px', padding: '6px 10px', minWidth: '170px' }}
                  >
                    <option value="">-- Asignar a... / Liberar --</option>
                    <option value="0">🏢 Devolver a Almacén Central</option>
                    {crews.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => handleBulkCardAssign(bulkCrewId === 0 ? '' : bulkCrewId)}
                    disabled={isBulkAssigning}
                    className="gradient-border-btn"
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                  >
                    <ArrowRight size={14} />
                    <span>{isBulkAssigning ? 'Aplicando...' : 'Aplicar Custodia'}</span>
                  </button>
                  <button 
                    onClick={() => setSelectedCardCodes([])}
                    className="secondary-btn"
                    style={{ padding: '6px 10px', fontSize: '11px' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* CREW OPERATIONAL BALANCE BANNER */}
            {isSpecificCrew && (
              <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(5, 243, 162, 0.08))', border: '1px solid rgba(139, 92, 246, 0.4)', borderRadius: '10px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="var(--neon-green)" />
                    <span>Balance Operativo de Custodia: <span style={{ color: 'var(--neon-purple)' }}>{selectedCrewFilter}</span></span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Total Asignadas: <strong style={{ color: '#fff' }}>{crewAssignedFixtures.length}</strong> | 
                    Ya Instaladas en Campo: <strong style={{ color: 'var(--neon-green)' }}>{crewInstalledCount}</strong> | 
                    Restantes en Camión: <strong style={{ color: 'var(--neon-amber)' }}>{crewPendingCount}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--neon-green)' }}>
                    {crewAssignedFixtures.length > 0 ? Math.round((crewInstalledCount / crewAssignedFixtures.length) * 100) : 0}% Instaladas
                  </span>
                  <div style={{ width: '100px', height: '8px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${crewAssignedFixtures.length > 0 ? (crewInstalledCount / crewAssignedFixtures.length) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, var(--neon-purple), var(--neon-green))' }} />
                  </div>
                </div>
              </div>
            )}

            {/* FILTERS ROW */}
            <div className="form-row" style={{ background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              <div className="form-group" style={{ gap: '6px' }}>
                <label style={{ fontSize: '11px' }}>Ver Lote</label>
                <select 
                  value={qrBatchId} 
                  onChange={(e) => setQrBatchId(Number(e.target.value))}
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.code_prefix} (Lote #{b.id})</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gap: '6px' }}>
                <label style={{ fontSize: '11px' }}>Filtrar por Responsable</label>
                <select 
                  value={selectedCrewFilter} 
                  onChange={(e) => setSelectedCrewFilter(e.target.value)}
                >
                  <option value="todos">Todos los Responsables</option>
                  <option value="libres">🏢 En Almacén (Sin Asignar)</option>
                  <option value="asignadas">🚚 Asignadas a Cuadrillas</option>
                  {crews.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gap: '6px' }}>
                <label style={{ fontSize: '11px' }}>Estado de Instalación</label>
                <select 
                  value={installationStatusFilter} 
                  onChange={(e) => setInstallationStatusFilter(e.target.value as any)}
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="instaladas">✅ Ya Instaladas en Campo</option>
                  <option value="en_camion">🚚 En Camión / Custodia (Pendientes)</option>
                  <option value="en_almacen">🏢 En Almacén Central (Libres)</option>
                </select>
              </div>

              <div className="form-group" style={{ gap: '6px' }}>
                <label style={{ fontSize: '11px' }}>Buscar Código / Folio / Operador</label>
                <div className="input-with-icon">
                  <Search size={14} className="input-icon" />
                  <input 
                    type="text" 
                    placeholder="Buscar (LUM-..., SPF-..., etc.)..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            {/* QR CARDS GRID */}
            <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '560px', paddingRight: '6px' }}>
              {loadingQrs ? (
                <div className="empty-state">Generando códigos QR...</div>
              ) : filteredFixtures.length === 0 ? (
                <div className="empty-state">No se encontraron luminarias con los filtros aplicados.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '14px' }}>
                  {filteredFixtures.map(f => {
                    const isInstalled = Boolean(f.installation_id);
                    const isAssigned = Boolean(f.crew_name) && !isInstalled;
                    const isSelected = selectedCardCodes.includes(f.code);
                    const isUpdatingThis = updatingCode === f.code;

                    return (
                      <div 
                        key={f.code} 
                        style={{ 
                          position: 'relative',
                          background: isInstalled 
                            ? 'linear-gradient(180deg, rgba(5, 243, 162, 0.08) 0%, rgba(13, 20, 38, 0.85) 100%)' 
                            : isAssigned 
                            ? 'linear-gradient(180deg, rgba(139, 92, 246, 0.08) 0%, rgba(13, 20, 38, 0.85) 100%)' 
                            : 'rgba(255,255,255,0.03)', 
                          border: isSelected
                            ? '2px solid var(--neon-blue)'
                            : isInstalled 
                            ? '1.5px solid rgba(5, 243, 162, 0.6)' 
                            : isAssigned 
                            ? '1px solid rgba(139, 92, 246, 0.5)' 
                            : '1px solid var(--border-color)', 
                          borderRadius: '12px', 
                          padding: '12px 10px', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          textAlign: 'center', 
                          transition: 'var(--transition)',
                          boxShadow: isSelected ? '0 0 15px rgba(56, 189, 248, 0.3)' : (isInstalled ? '0 0 15px rgba(5, 243, 162, 0.1)' : 'none')
                        }}
                      >
                        {/* SELECT CHECKBOX */}
                        {!isInstalled && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectCard(f.code);
                            }}
                            style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              background: isSelected ? 'var(--neon-blue)' : 'rgba(0,0,0,0.5)',
                              border: `1px solid ${isSelected ? 'var(--neon-blue)' : 'var(--border-color)'}`,
                              borderRadius: '4px',
                              padding: '2px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isSelected ? '#000' : 'var(--text-muted)'
                            }}
                            title="Seleccionar para acción en lote"
                          >
                            {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                          </button>
                        )}

                        {qrImages[f.code] ? (
                          <img 
                            src={qrImages[f.code]} 
                            alt={f.code} 
                            style={{ width: '100px', height: '100px', background: '#fff', padding: '4px', borderRadius: '8px', marginBottom: '8px' }}
                          />
                        ) : (
                          <div style={{ width: '100px', height: '100px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: '8px' }} />
                        )}
                        
                        <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace', color: '#fff', letterSpacing: '0.5px' }}>
                          {f.code}
                        </span>

                        {/* STATUS BADGES & QUICK ASSIGN SELECTOR */}
                        {isInstalled ? (
                          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px', width: '100%' }}>
                            <span style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '6px', background: 'rgba(5, 243, 162, 0.2)', color: '#05f3a2', fontWeight: 800, border: '1px solid rgba(5, 243, 162, 0.4)' }}>
                              ✅ INSTALADA
                            </span>
                            <span style={{ fontSize: '9px', color: '#34d399', fontWeight: 600 }}>
                              👷‍♂️ {f.installed_by_crew || f.crew_name}
                            </span>
                            {f.installed_at && (
                              <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>
                                📅 {new Date(f.installed_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                              </span>
                            )}
                            {f.internal_folio && (
                              <span style={{ fontSize: '8px', fontFamily: 'monospace', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 4px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                📋 {f.internal_folio}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                            {isAssigned ? (
                              <span style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.2)', color: 'var(--neon-purple)', fontWeight: 700, border: '1px solid rgba(139, 92, 246, 0.4)' }}>
                                🚚 EN CAMIÓN: {f.crew_name}
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '6px', background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', fontWeight: 600 }}>
                                🏢 EN ALMACÉN (LIBRE)
                              </span>
                            )}

                            {/* QUICK REASSIGNMENT DROPDOWN ON CARD */}
                            <select
                              value={f.crew_id || ''}
                              onChange={(e) => handleSingleCardCrewChange(f.code, e.target.value ? Number(e.target.value) : '')}
                              disabled={isUpdatingThis}
                              style={{ 
                                fontSize: '10px', 
                                padding: '4px 6px', 
                                background: isAssigned ? 'rgba(139, 92, 246, 0.15)' : 'rgba(0,0,0,0.4)',
                                borderColor: isAssigned ? 'var(--neon-purple)' : 'var(--border-color)',
                                color: '#fff',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                              title="Cambiar custodia directamente"
                            >
                              <option value="">🏢 En Almacén</option>
                              {crews.map(c => (
                                <option key={c.id} value={c.id}>🚚 {c.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        {qrImages[f.code] && (
                          <a 
                            href={qrImages[f.code]} 
                            download={`${f.code}.png`}
                            style={{ fontSize: '10px', color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.04)' }}
                          >
                            <Download size={11} /> Descargar
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
