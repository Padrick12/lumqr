import { API_BASE_URL } from '../config';
import React, { useState, useEffect } from 'react';
import { Truck, CheckCircle2, QrCode, Printer, Download, Search, AlertCircle, Archive } from 'lucide-react';
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
}

interface WarehousePanelProps {
  onDataChange: () => void;
}

export const WarehousePanel: React.FC<WarehousePanelProps> = ({ onDataChange }) => {
  const [crews, setCrews] = useState<Crew[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  
  const [selectedBatchId, setSelectedBatchId] = useState<number | ''>('');
  const [selectedCrewId, setSelectedCrewId] = useState<number | ''>('');
  const [quantityToAssign, setQuantityToAssign] = useState<number>(10);
  const [assignMsg, setAssignMsg] = useState({ text: '', isError: false });

  const [qrBatchId, setQrBatchId] = useState<number | ''>('');
  const [fixturesForQr, setFixturesForQr] = useState<Fixture[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCrewFilter, setSelectedCrewFilter] = useState<string>('todos');
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
        const filtered = data.fixtures.filter((f: any) => {
          return f.batch_id === batchId;
        });
        setFixturesForQr(filtered);
        
        const urls: Record<string, string> = {};
        for (const item of filtered.slice(0, 100)) { 
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
    }
  }, [qrBatchId, batches]);

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !selectedCrewId || quantityToAssign <= 0) {
      setAssignMsg({ text: 'Por favor complete todos los campos.', isError: true });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/batches/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crew_id: Number(selectedCrewId),
          batch_id: Number(selectedBatchId),
          quantity: quantityToAssign
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setAssignMsg({ text: data.error || 'Error al asignar luminarias.', isError: true });
      } else {
        setAssignMsg({ 
          text: `¡Asignación exitosa! ${data.assigned_count} luminarias asociadas. Rango: ${data.range.startCode} - ${data.range.endCode}`, 
          isError: false 
        });
        setQuantityToAssign(10);
        onDataChange();
        if (qrBatchId) fetchFixturesForQr(Number(qrBatchId));
      }
    } catch (err) {
      setAssignMsg({ text: 'Error al conectar con el servidor.', isError: true });
    }
    setTimeout(() => setAssignMsg({ text: '', isError: false }), 6000);
  };

  const filteredFixtures = fixturesForQr.filter(f => {
    const formattedTerm = formatFixtureCode(searchTerm);
    const matchesSearch = f.code.toLowerCase().includes(searchTerm.toLowerCase()) || (formattedTerm.length > 0 && f.code.includes(formattedTerm));
    
    let matchesCrew = true;
    if (selectedCrewFilter === 'asignadas') {
      matchesCrew = f.crew_name !== null;
    } else if (selectedCrewFilter === 'libres') {
      matchesCrew = f.crew_name === null;
    } else if (selectedCrewFilter !== 'todos') {
      matchesCrew = f.crew_name === selectedCrewFilter;
    }

    return matchesSearch && matchesCrew;
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
            .crew { font-size: 11px; color: #666; margin-top: 4px; }
            img { width: 130px; height: 130px; }
            @media print {
              body { padding: 0; }
              .card { border: 1px solid #000; }
            }
          </style>
        </head>
        <body>
          <h2 style="text-align:center; margin-bottom: 20px;">Etiquetas de Inventario y Custodia - Lerdo, Dgo.</h2>
          <div class="grid">
            ${filteredFixtures.map(f => `
              <div class="card">
                <img src="${qrImages[f.code] || ''}" alt="QR" />
                <div class="code">${f.code}</div>
                <div class="crew">${f.crew_name ? `Asignada a: ${f.crew_name}` : 'En Almacén / Sin Asignar'}</div>
              </div>
            `).join('')}
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
      
      // We might need to generate all QRs if they aren't loaded (we only load 100 max)
      // but let's just generate them on the fly for the zip
      for (const f of filteredFixtures) {
        const dataUrl = qrImages[f.code] || await generateLabelDataURL(f.code);
        // dataUrl looks like "data:image/png;base64,iVBORw0KGgo..."
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

  return (
    <div className="panel-container" style={{ gridTemplateColumns: '1fr' }}>
      <style>{`
        @media (min-width: 1024px) {
          .warehouse-grid { grid-template-columns: 1fr 2fr; }
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

            <form onSubmit={handleAssignSubmit} className="form-group">
              <div className="form-group">
                <label>Seleccionar Lote de Origen</label>
                <select 
                  value={selectedBatchId} 
                  onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                >
                  <option value="" disabled>-- Seleccione un Lote --</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.code_prefix} (Lote #{b.id} - {b.total_quantity} pzas)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Cuadrilla Destino (Responsable)</label>
                <select 
                  value={selectedCrewId} 
                  onChange={(e) => setSelectedCrewId(Number(e.target.value))}
                >
                  <option value="" disabled>-- Seleccione una Cuadrilla --</option>
                  {crews.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Cantidad de Lámparas a Asignar</label>
                <input 
                  type="number" 
                  min={1} 
                  max={10000}
                  placeholder="Ej. 10, 50, 100, 500..."
                  value={quantityToAssign}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setQuantityToAssign('' as any);
                    } else {
                      const parsed = parseInt(val, 10);
                      setQuantityToAssign(isNaN(parsed) ? '' as any : parsed);
                    }
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Se seleccionarán automáticamente las primeras piezas libres del lote seleccionado.
                </span>
              </div>

              {assignMsg.text && (
                <div style={{ padding: '12px', background: assignMsg.isError ? 'rgba(244, 63, 94, 0.1)' : 'rgba(5, 243, 162, 0.1)', color: assignMsg.isError ? 'var(--neon-rose)' : 'var(--neon-green)', borderRadius: '8px', fontSize: '13px', display: 'flex', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>{assignMsg.text}</span>
                </div>
              )}

              <button type="submit" className="gradient-border-btn" style={{ justifyContent: 'center' }}>
                <CheckCircle2 size={18} />
                <span>Transferir Custodia</span>
              </button>
            </form>
          </div>
        </div>

        {/* DETALLE DEL LOTE Y EXPORTACIÓN QR */}
        <div className="panel-section">
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <h2 className="panel-header" style={{ margin: 0 }}>
                <QrCode color="var(--neon-green)" />
                <span>Etiquetas QR y Alfanuméricas</span>
              </h2>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={handleDownloadZip}
                  disabled={filteredFixtures.length === 0 || loadingQrs}
                  className="secondary-btn"
                  style={{ color: 'var(--neon-blue)', borderColor: 'var(--neon-blue)' }}
                >
                  <Archive size={16} />
                  <span>Descargar Todos (ZIP)</span>
                </button>
                <button 
                  onClick={handlePrintCodes}
                  disabled={filteredFixtures.length === 0 || loadingQrs}
                  className="secondary-btn"
                >
                  <Printer size={16} />
                  <span>Imprimir / PDF</span>
                </button>
              </div>
            </div>

            <div className="form-row" style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <div className="form-group" style={{ gap: '8px' }}>
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

              <div className="form-group" style={{ gap: '8px' }}>
                <label style={{ fontSize: '11px' }}>Filtrar por Responsable</label>
                <select 
                  value={selectedCrewFilter} 
                  onChange={(e) => setSelectedCrewFilter(e.target.value)}
                >
                  <option value="todos">Todos</option>
                  <option value="libres">En Almacén (Sin Asignar)</option>
                  <option value="asignadas">Asignados a Cuadrilla</option>
                  {crews.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ gap: '8px' }}>
                <label style={{ fontSize: '11px' }}>Buscar Código</label>
                <div className="input-with-icon">
                  <Search size={14} className="input-icon" />
                  <input 
                    type="text" 
                    placeholder="Buscar..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '500px', paddingRight: '8px' }}>
              {loadingQrs ? (
                <div className="empty-state">Generando códigos QR...</div>
              ) : filteredFixtures.length === 0 ? (
                <div className="empty-state">No se encontraron luminarias con los filtros aplicados.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                  {filteredFixtures.map(f => (
                    <div key={f.code} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', transition: 'var(--transition)' }}>
                      {qrImages[f.code] ? (
                        <img 
                          src={qrImages[f.code]} 
                          alt={f.code} 
                          style={{ width: '100px', height: '100px', background: '#fff', padding: '4px', borderRadius: '8px', marginBottom: '12px' }}
                        />
                      ) : (
                        <div style={{ width: '100px', height: '100px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', marginBottom: '12px' }} />
                      )}
                      <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-main)' }}>{f.code}</span>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '12px', marginTop: '8px', background: f.crew_name ? 'rgba(139, 92, 246, 0.15)' : 'rgba(5, 243, 162, 0.15)', color: f.crew_name ? 'var(--neon-purple)' : 'var(--neon-green)' }}>
                        {f.crew_name ? f.crew_name : 'Almacén'}
                      </span>
                      
                      {qrImages[f.code] && (
                        <a 
                          href={qrImages[f.code]} 
                          download={`${f.code}.png`}
                          style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '12px' }}
                        >
                          <Download size={12} /> Descargar
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
