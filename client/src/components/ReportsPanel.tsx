import { API_BASE_URL } from '../config';
import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Printer, Search, RefreshCcw, Zap } from 'lucide-react';
import { ImageModal } from './ImageModal';
import './shared-panels.css';

interface Fixture {
  code: string;
  status: 'Nueva' | 'Reparada' | 'Rehabilitada' | 'Robo';
  crew_name: string | null;
  code_prefix: string;
  arrival_date: string;
}

interface SummaryStats {
  total: number;
  assigned: number;
  unassigned: number;
  installed: number;
  statuses: {
    Nueva: number;
    Reparada: number;
    Rehabilitada: number;
    Robo: number;
  };
  total_poles?: number;
  poles_by_lamp?: {
    'Vapor de Sodio': number;
    'LED Antiguo': number;
    'LED Nueva (Sin QR)': number;
    'Sin Lámpara': number;
  };
  poles_by_zone?: {
    Urbana: number;
    Rural: number;
    'Trayectos Seguros': number;
  };
}

interface CrewPerformance {
  id: number;
  crew_name: string;
  active_operator: string | null;
  total_installations: number;
  total_poles: number;
}

export const ReportsPanel: React.FC = () => {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [crewPerformance, setCrewPerformance] = useState<CrewPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageModal, setSelectedImageModal] = useState<{ url: string; title: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [crewFilter, setCrewFilter] = useState('todos');
  const [uniqueCrews, setUniqueCrews] = useState<string[]>([]);

  const [incidents, setIncidents] = useState<any[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [poles, setPoles] = useState<any[]>([]);

  // Advanced Filters for PDF Reports & Modal Preview
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'qr' | 'poles' | 'incidents'>('all');
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const crewsSet = new Set<string>();

      const res = await fetch(`${API_BASE_URL}/api/reports`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setFixtures(data.fixtures);
        setCrewPerformance(data.crew_performance || []);

        data.fixtures.forEach((f: Fixture) => {
          if (f.crew_name && f.crew_name.trim()) crewsSet.add(f.crew_name.trim());
        });
      }

      const resIncidents = await fetch(`${API_BASE_URL}/api/incidents`);
      if (resIncidents.ok) {
        const incData = await resIncidents.json();
        setIncidents(incData);
        incData.forEach((i: any) => {
          if (i.crew_name && i.crew_name.trim()) crewsSet.add(i.crew_name.trim());
        });
      }

      const resInst = await fetch(`${API_BASE_URL}/api/installations`);
      if (resInst.ok) {
        const instData = await resInst.json();
        setInstallations(instData);
        instData.forEach((i: any) => {
          if (i.crew_name && i.crew_name.trim()) crewsSet.add(i.crew_name.trim());
        });
      }

      const resPoles = await fetch(`${API_BASE_URL}/api/poles`);
      if (resPoles.ok) {
        const polesData = await resPoles.json();
        setPoles(polesData);
        polesData.forEach((p: any) => {
          if (p.crew_name && p.crew_name.trim()) crewsSet.add(p.crew_name.trim());
        });
      }

      setUniqueCrews(Array.from(crewsSet));
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredFixtures = fixtures.filter(f => {
    const matchesSearch = f.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || f.status === statusFilter;
    
    let matchesCrew = true;
    if (crewFilter === 'libres') {
      matchesCrew = f.crew_name === null;
    } else if (crewFilter !== 'todos') {
      matchesCrew = f.crew_name?.trim().toLowerCase() === crewFilter.trim().toLowerCase();
    }

    return matchesSearch && matchesStatus && matchesCrew;
  });

  const handleExportCSV = () => {
    if (filteredFixtures.length === 0) return;
    
    const headers = ['Codigo', 'Estado Actual', 'Cuadrilla Custodia', 'Prefijo Lote', 'Fecha Ingreso Lote'];
    const rows = filteredFixtures.map(f => [
      f.code,
      f.status,
      f.crew_name || 'En Almacen',
      f.code_prefix,
      f.arrival_date
    ]);

    const csvContent = 
      'data:text/csv;charset=utf-8,\uFEFF' + 
      [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_inventario_luminarias_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter items for report
  const normCrewFilter = crewFilter.trim().toLowerCase();
  const searchLower = searchTerm.toLowerCase().trim();

  const filteredInstallations = installations.filter(inst => {
    const matchSearch = !searchLower || 
      (inst.fixture_code && inst.fixture_code.toLowerCase().includes(searchLower)) ||
      (inst.notes && inst.notes.toLowerCase().includes(searchLower));
    
    const instCrew = (inst.crew_name || '').trim().toLowerCase();
    const matchCrew = crewFilter === 'todos' || instCrew === normCrewFilter;
    const matchStatus = statusFilter === 'todos' || inst.current_status === statusFilter || inst.status === statusFilter;
    
    let matchDate = true;
    if (startDate && inst.installed_at) {
      matchDate = matchDate && new Date(inst.installed_at) >= new Date(startDate);
    }
    if (endDate && inst.installed_at) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59);
      matchDate = matchDate && new Date(inst.installed_at) <= endDateTime;
    }

    return matchSearch && matchCrew && matchStatus && matchDate;
  });

  const filteredPoles = poles.filter(p => {
    const matchSearch = !searchLower || 
      (p.pole_code && p.pole_code.toLowerCase().includes(searchLower)) ||
      (p.pole_type && p.pole_type.toLowerCase().includes(searchLower)) ||
      (p.lamp_type && p.lamp_type.toLowerCase().includes(searchLower)) ||
      (p.notes && p.notes.toLowerCase().includes(searchLower));
    
    const poleCrew = (p.crew_name || '').trim().toLowerCase();
    const matchCrew = crewFilter === 'todos' || poleCrew === normCrewFilter;
    
    let matchDate = true;
    const poleDate = p.created_at || p.installed_at;
    if (startDate && poleDate) {
      matchDate = matchDate && new Date(poleDate) >= new Date(startDate);
    }
    if (endDate && poleDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59);
      matchDate = matchDate && new Date(poleDate) <= endDateTime;
    }

    return matchSearch && matchCrew && matchDate;
  });

  const filteredIncidents = incidents.filter(inc => {
    const matchSearch = !searchLower || 
      (inc.incident_type && inc.incident_type.toLowerCase().includes(searchLower)) || 
      (inc.notes && inc.notes.toLowerCase().includes(searchLower));
    
    const incCrew = (inc.crew_name || '').trim().toLowerCase();
    const matchCrew = crewFilter === 'todos' || incCrew === normCrewFilter;
    
    let matchDate = true;
    if (startDate && inc.created_at) {
      matchDate = matchDate && new Date(inc.created_at) >= new Date(startDate);
    }
    if (endDate && inc.created_at) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59);
      matchDate = matchDate && new Date(inc.created_at) <= endDateTime;
    }

    return matchSearch && matchCrew && matchDate;
  });

  // Calculate Energy Consumption & CFE DAP Audit Metrics
  let totalWattsQR = 0;
  filteredInstallations.forEach(i => {
    if (i.wattage && Number(i.wattage) > 0) totalWattsQR += Number(i.wattage);
    else totalWattsQR += 70; // Default LED wattage
  });

  let totalWattsPoles = 0;
  filteredPoles.forEach(p => {
    if (p.wattage && Number(p.wattage) > 0) {
      totalWattsPoles += Number(p.wattage);
    } else if (p.lamp_type === 'Vapor de Sodio') {
      totalWattsPoles += 150; // Default Sodio wattage
    } else if (p.lamp_type === 'LED Antiguo' || p.lamp_type === 'LED Nueva (Sin QR)') {
      totalWattsPoles += 70;
    } else {
      totalWattsPoles += 100;
    }
  });

  const totalWattsCombined = totalWattsQR + totalWattsPoles;
  const totalKwCombined = (totalWattsCombined / 1000).toFixed(2);
  const dailyKwh = ((totalWattsCombined * 12) / 1000).toFixed(2); // 12 hrs night schedule
  const monthlyKwh = (((totalWattsCombined * 12) / 1000) * 30).toFixed(2); // 30 days billing period

  const showQR = recordTypeFilter === 'all' || recordTypeFilter === 'qr';
  const showPoles = recordTypeFilter === 'all' || recordTypeFilter === 'poles';
  const showIncidents = recordTypeFilter === 'all' || recordTypeFilter === 'incidents';

  const origin = window.location.origin;
  const getPhotoUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url;
    return origin + (url.startsWith('/') ? url : '/' + url);
  };

  const getStatusClass = (status: string) => {
    switch(status) {
      case 'Nueva': return 'status-nueva';
      case 'Reparada': return 'status-reparada';
      case 'Rehabilitada': return 'status-rehabilitada';
      case 'Robo': return 'status-robo';
      default: return '';
    }
  };

  const handleTriggerPrint = () => {
    const content = document.getElementById('printable-executive-report');
    if (!content) return;

    let iframe = document.getElementById('pdf-print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'pdf-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dictamen y Reporte Oficial — STG-AP Lerdo</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            @media print {
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
              tr, .card-item-box { page-break-inside: avoid; }
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 0;
              font-size: 11px;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            a {
              color: #0284c7;
              text-decoration: none;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            .no-print {
              display: none !important;
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 200);
  };

  return (
    <div className="panel-section">
      <style>{`
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 16px;
        }
        .metric-card {
          padding: 16px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .metric-label {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 700;
          text-transform: uppercase;
        }
        .metric-value {
          font-size: 28px;
          font-weight: 800;
        }
        .reports-table-container {
          width: 100%;
          overflow-x: auto;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          max-height: 450px;
        }
        .reports-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }
        .reports-table th {
          background: rgba(0,0,0,0.4);
          padding: 16px;
          color: var(--text-muted);
          font-weight: 600;
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .reports-table td {
          padding: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          color: var(--text-main);
        }
        .reports-table tr:hover {
          background: rgba(255,255,255,0.02);
        }

        /* PRINT MODAL & STYLES */
        @media print {
          body > *:not(.pdf-print-modal-overlay) {
            display: none !important;
          }
          .panel-section, .navbar, .top-bar, .no-print {
            display: none !important;
          }
          .pdf-print-modal-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            z-index: 9999999 !important;
            padding: 0 !important;
          }
          .pdf-print-modal-content {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* TARJETAS RESUMEN DE MÉTRICAS */}
      {summary && (
        <>
          <div className="metrics-grid">
            <div className="glass-panel metric-card">
              <span className="metric-label">Lámparas QR Total</span>
              <span className="metric-value" style={{ color: 'var(--neon-blue)' }}>{summary.total}</span>
            </div>
            <div className="glass-panel metric-card">
              <span className="metric-label">QR Instaladas</span>
              <span className="metric-value" style={{ color: 'var(--neon-green)' }}>{summary.installed}</span>
            </div>
            <div className="glass-panel metric-card">
              <span className="metric-label">Total Puntos de Iluminación</span>
              <span className="metric-value" style={{ color: 'var(--neon-purple)' }}>{summary.total_poles || 0}</span>
            </div>
            <div className="glass-panel metric-card" style={{ borderColor: 'var(--neon-emerald)' }}>
              <span className="metric-label">LED Nueva Sin QR</span>
              <span className="metric-value" style={{ color: 'var(--neon-emerald)' }}>{summary.poles_by_lamp?.['LED Nueva (Sin QR)'] || 0}</span>
            </div>
            <div className="glass-panel metric-card" style={{ borderColor: 'var(--neon-amber)' }}>
              <span className="metric-label">Vapor de Sodio</span>
              <span className="metric-value" style={{ color: 'var(--neon-amber)' }}>{summary.poles_by_lamp?.['Vapor de Sodio'] || 0}</span>
            </div>
            <div className="glass-panel metric-card" style={{ borderColor: 'rgba(244, 63, 94, 0.4)' }}>
              <span className="metric-label">Reporte Robo</span>
              <span className="metric-value" style={{ color: 'var(--neon-rose)' }}>{summary.statuses.Robo}</span>
            </div>
          </div>

          {/* CFE DAP AUDIT SUMMARY BOX IN DASHBOARD */}
          <div className="glass-panel" style={{ padding: '20px', border: '1px solid rgba(56, 189, 248, 0.4)', background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(13, 20, 38, 0.8) 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--neon-blue)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={20} color="var(--neon-amber)" />
                <span>Auditoría de Consumo Energético CFE (DAP Municipal)</span>
              </h3>
              <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 700 }}>
                Base de Cálculo Auditada para CFE
              </span>
            </div>

            <div className="metrics-grid">
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span className="metric-label" style={{ color: 'var(--neon-amber)' }}>Carga Conectada Total</span>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--neon-amber)', marginTop: '4px' }}>
                  {totalWattsCombined.toLocaleString()} W
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({totalKwCombined} kW combinados)</span>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span className="metric-label" style={{ color: 'var(--neon-green)' }}>Consumo Diario Estimado</span>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--neon-green)', marginTop: '4px' }}>
                  {dailyKwh} kWh / día
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(operación 12 hrs/noche)</span>
              </div>

              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.3)', textAlign: 'center' }}>
                <span className="metric-label" style={{ color: 'var(--neon-blue)' }}>Consumo Mensual Facturable</span>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#60a5fa', marginTop: '4px' }}>
                  {monthlyKwh} kWh / mes
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(período 30 días CFE)</span>
              </div>
            </div>

            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap', gap: '10px' }}>
              <div>💡 <strong>Luminarias QR LED:</strong> {filteredInstallations.length} unidades ({totalWattsQR.toLocaleString()} W)</div>
              <div>📍 <strong>Puntos de Iluminación:</strong> {filteredPoles.length} censados ({totalWattsPoles.toLocaleString()} W)</div>
              <div>📋 <strong>Fórmula CFE:</strong> DAP = (Total Watts × 12 hrs × 30 días) ÷ 1,000</div>
            </div>
          </div>

          {/* CLASIFICACIÓN DE ZONAS & TRAYECTOS SEGUROS */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 className="panel-header" style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--neon-blue)' }}>
              🌐 Cobertura por Clasificación de Zona (Urbana / Rural / Trayectos Seguros)
            </h3>
            <div className="metrics-grid">
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span className="metric-label">Zona Urbana</span>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--neon-blue)', marginTop: '4px' }}>
                  {summary.poles_by_zone?.Urbana || 0} Puntos
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span className="metric-label">Zona Rural</span>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--neon-green)', marginTop: '4px' }}>
                  {summary.poles_by_zone?.Rural || 0} Puntos
                </div>
              </div>

              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.3)', textAlign: 'center' }}>
                <span className="metric-label" style={{ color: 'var(--neon-blue)' }}>🛡️ Trayectos Seguros</span>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa', marginTop: '4px' }}>
                  {summary.poles_by_zone?.['Trayectos Seguros'] || 0} Puntos
                </div>
              </div>
            </div>
          </div>

          {/* DESEMPEÑO Y RENDIMIENTO POR CUADRILLAS */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 className="panel-header" style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--neon-green)' }}>
              🏆 Desempeño y Rendimiento por Cuadrilla (Luminarias QR + Censo)
            </h3>
            <div className="reports-table-container">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Cuadrilla</th>
                    <th>Responsable en Turno (Admin)</th>
                    <th>Luminarias QR Instaladas</th>
                    <th>Puntos de Iluminación Censados</th>
                    <th>Avance Total</th>
                  </tr>
                </thead>
                <tbody>
                  {crewPerformance.map(cp => {
                    const totalWork = cp.total_installations + cp.total_poles;
                    return (
                      <tr key={cp.id}>
                        <td style={{ fontWeight: 'bold', color: '#fff' }}>{cp.crew_name}</td>
                        <td style={{ color: 'var(--neon-green)', fontWeight: 600 }}>{cp.active_operator || 'Sin asignar en Admin'}</td>
                        <td style={{ color: 'var(--neon-blue)', fontWeight: 'bold' }}>{cp.total_installations}</td>
                        <td style={{ color: 'var(--neon-purple)', fontWeight: 'bold' }}>{cp.total_poles}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--neon-amber)' }}>{totalWork} ops</span>
                            <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(totalWork * 5, 100)}%`, background: 'linear-gradient(90deg, var(--neon-green), var(--neon-blue))', height: '100%' }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {crewPerformance.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay datos de avance registrados aún.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* FILTROS Y TABLA */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <h2 className="panel-header" style={{ margin: 0 }}>
            <FileSpreadsheet color="var(--neon-green)" />
            <span>Auditoría y Reportes de Inventario</span>
          </h2>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={fetchReportData} 
              className="icon-btn"
              title="Actualizar datos"
            >
              <RefreshCcw size={16} />
            </button>
            <button 
              onClick={handleExportCSV}
              disabled={filteredFixtures.length === 0}
              className="gradient-border-btn"
            >
              Descargar CSV
            </button>
            <button 
              onClick={() => setShowPdfModal(true)}
              className="secondary-btn"
              style={{ background: 'linear-gradient(135deg, var(--neon-blue), var(--neon-purple))', color: '#fff', fontWeight: 800 }}
            >
              <Printer size={16} />
              📄 Generar PDF Ejecutivo (Con Fotos)
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="form-row" style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="form-group" style={{ gap: '8px' }}>
            <label style={{ fontSize: '11px' }}>Buscar Código / Observación</label>
            <div className="input-with-icon">
              <Search size={14} className="input-icon" />
              <input 
                type="text" 
                placeholder="Buscar por código..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ gap: '8px' }}>
            <label style={{ fontSize: '11px' }}>Estado</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="todos">Todos los Estados</option>
              <option value="Nueva">Nueva</option>
              <option value="Reparada">Reparada</option>
              <option value="Rehabilitada">Rehabilitada</option>
              <option value="Robo">Robo</option>
            </select>
          </div>

          <div className="form-group" style={{ gap: '8px' }}>
            <label style={{ fontSize: '11px' }}>Cuadrilla Responsable</label>
            <select 
              value={crewFilter} 
              onChange={(e) => setCrewFilter(e.target.value)}
            >
              <option value="todos">Todas las Cuadrillas</option>
              <option value="libres">Sin Asignar / En Almacén</option>
              {uniqueCrews.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ gap: '8px' }}>
            <label style={{ fontSize: '11px' }}>Tipo de Entregable</label>
            <select 
              value={recordTypeFilter} 
              onChange={(e) => setRecordTypeFilter(e.target.value as any)}
            >
              <option value="all">Todos los Registros (QR, Censo e Incidencias)</option>
              <option value="qr">💡 Solo Luminarias QR</option>
              <option value="poles">📍 Solo Censo de Puntos de Iluminación</option>
              <option value="incidents">🛠️ Solo Incidencias / Cortos</option>
            </select>
          </div>

          <div className="form-group" style={{ gap: '8px' }}>
            <label style={{ fontSize: '11px' }}>Fecha Inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', padding: '8px', fontSize: '12px' }}
            />
          </div>

          <div className="form-group" style={{ gap: '8px' }}>
            <label style={{ fontSize: '11px' }}>Fecha Fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#fff', padding: '8px', fontSize: '12px' }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="reports-table-container">
          {loading ? (
            <div className="empty-state">Cargando reporte de inventario...</div>
          ) : filteredFixtures.length === 0 ? (
            <div className="empty-state">No se encontraron registros con los filtros seleccionados.</div>
          ) : (
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Código / Serial</th>
                  <th>Estado Actual</th>
                  <th>Cuadrilla en Custodia</th>
                  <th>Lote Origen</th>
                  <th>Fecha de Lote</th>
                </tr>
              </thead>
              <tbody>
                {filteredFixtures.map(f => (
                  <tr key={f.code}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{f.code}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(f.status)}`}>
                        {f.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {f.crew_name ? f.crew_name : <span style={{ fontStyle: 'italic' }}>En Almacén</span>}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{f.code_prefix}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{f.arrival_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SECCIÓN AUDITORÍA DE TRABAJOS ESPECIALES / CORTOS / INCIDENCIAS */}
      <div className="glass-panel" style={{ border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--neon-amber)' }}>
              🛠️ Auditoría de Incidencias y Cortos Circuito Atendidos
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Historial de respaldos de trabajos especiales, reparaciones de fotoceldas y emergencias de campo.
            </p>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--neon-amber)', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
            {incidents.length} Incidencias Registradas
          </span>
        </div>

        <div className="reports-table-container">
          {incidents.length === 0 ? (
            <div className="empty-state">No hay incidencias o trabajos especiales registrados aún.</div>
          ) : (
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Tipo de Trabajo</th>
                  <th>Cuadrilla Responsable</th>
                  <th>Operador en Turno</th>
                  <th>Detalle / Observaciones</th>
                  <th>Evidencia Fotográfica</th>
                  <th>Ubicación GPS</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(inc => (
                  <tr key={inc.id}>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(inc.created_at).toLocaleString()}
                    </td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: 'var(--neon-amber)', fontWeight: 700, fontSize: '11px' }}>
                        {inc.incident_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{inc.crew_name || 'Desconocida'}</td>
                    <td style={{ color: 'var(--neon-green)', fontWeight: 600 }}>{inc.operator_name || 'N/A'}</td>
                    <td style={{ fontSize: '12px', fontStyle: 'italic', maxWidth: '250px' }}>"{inc.notes}"</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {inc.photo_before && (
                          <button
                            onClick={() => setSelectedImageModal({ url: inc.photo_before, title: `Foto Antes - ${inc.incident_type}` })}
                            style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', color: 'var(--neon-blue)', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            🖼️ Foto Antes
                          </button>
                        )}
                        {inc.photo_after && (
                          <button
                            onClick={() => setSelectedImageModal({ url: inc.photo_after, title: `Foto Después - ${inc.incident_type}` })}
                            style={{ background: 'rgba(5, 243, 162, 0.1)', border: '1px solid rgba(5, 243, 162, 0.3)', color: 'var(--neon-green)', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', cursor: 'pointer', fontWeight: 600 }}
                          >
                            🖼️ Foto Después
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <a
                        href={`https://maps.google.com/?q=${inc.lat},${inc.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--neon-blue)', fontSize: '11px', textDecoration: 'none', fontWeight: 700 }}
                      >
                        📍 Ver en Mapa
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* VISTA PREVIA Y MODAL DE IMPRESIÓN PDF EN LÍNEA */}
      {showPdfModal && (
        <div className="pdf-print-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999999, background: 'rgba(15, 23, 42, 0.95)', overflowY: 'auto', padding: '20px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          {/* FLOATING ACTION BAR FOR USER */}
          <div className="no-print" style={{ position: 'sticky', top: '10px', zIndex: 1000000, display: 'flex', gap: '12px', background: '#0f172a', padding: '12px 24px', borderRadius: '30px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', border: '1px solid #0284c7', marginBottom: '20px' }}>
            <button 
              onClick={handleTriggerPrint}
              style={{ background: '#0284c7', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)' }}
            >
              🖨️ Imprimir / Guardar en PDF
            </button>
            <button 
              onClick={() => setShowPdfModal(false)}
              style={{ background: '#475569', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
            >
              ❌ Cerrar Vista Previa
            </button>
          </div>

          {/* PRINTABLE DOCUMENT BODY */}
          <div id="printable-executive-report" className="pdf-print-modal-content" style={{ background: '#ffffff', color: '#0f172a', width: '100%', maxWidth: '850px', padding: '20px', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: '11px' }}>
            
            {/* ESTRUCTURA DE TABLA CON THEAD Y TFOOT PARA REPETIR MEMBRETE Y PIE EN CADA PÁGINA */}
            <table style={{ width: '100%', borderCollapse: 'collapse', margin: 0, padding: 0 }}>
              <thead>
                <tr>
                  <th style={{ fontWeight: 'normal', textAlign: 'center', paddingBottom: '10px' }}>
                    <img 
                      src={`${origin}/letterhead/letterhead_header_trimmed.png`} 
                      alt="Membrete Presidencia Municipal Lerdo" 
                      width="800" 
                      height="110" 
                      decoding="sync"
                      style={{ width: '100%', maxHeight: '95px', objectFit: 'contain', display: 'block', margin: '0 auto' }} 
                      onError={(e: any) => e.target.style.display='none'} 
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div style={{ textAlign: 'center', marginBottom: '14px', borderBottom: '2px solid #0284c7', paddingBottom: '8px' }}>
                      <h1 style={{ margin: 0, fontSize: '16px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DIRECCIÓN DE SERVICIOS PÚBLICOS MUNICIPALES</h1>
                      <h2 style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#0284c7', fontWeight: 700, textTransform: 'uppercase' }}>DICTAMEN Y REPORTE OFICIAL DE CUSTODIA Y ENTREGABLES — ALUMBRADO PÚBLICO</h2>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 12px', fontSize: '10px', marginBottom: '14px' }}>
                      <div>📅 <strong>Fecha de Emisión:</strong> {new Date().toLocaleString('es-MX')}</div>
                      <div>👷‍♂️ <strong>Cuadrilla Evaluada:</strong> {crewFilter === 'todos' ? 'Todas las Cuadrillas' : crewFilter}</div>
                      <div>🗓️ <strong>Período Auditado:</strong> {startDate || 'Inicio'} al {endDate || 'Hoy'}</div>
                    </div>

                    {/* SECCIÓN AUDITORÍA ENERGÉTICA CFE (DAP) */}
                    <div style={{ background: '#f0f9ff', border: '1.5px solid #0284c7', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                      <div style={{ fontWeight: 800, fontSize: '12px', color: '#0369a1', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #bae6fd', paddingBottom: '4px' }}>
                        <span>⚡ AUDITORÍA DE CONSUMO ENERGÉTICO CFE (DAP MUNICIPAL)</span>
                        <span>Dictamen Técnico Alumbrado</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
                        <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '6px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>CARGA CONECTADA COMBINADA</div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>{totalWattsCombined.toLocaleString()} Watts</div>
                          <div style={{ fontSize: '8px', color: '#94a3b8' }}>({totalKwCombined} kW)</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '6px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>CONSUMO DIARIO (12 HRS/NOCHE)</div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>{dailyKwh} kWh / día</div>
                          <div style={{ fontSize: '8px', color: '#94a3b8' }}>Operación Nocturna Regular</div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '6px', borderRadius: '6px' }}>
                          <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700 }}>CONSUMO MENSUAL FACTURABLE CFE</div>
                          <div style={{ fontSize: '15px', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>{monthlyKwh} kWh / mes</div>
                          <div style={{ fontSize: '8px', color: '#94a3b8' }}>Período 30 días lectivos</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '9px', color: '#475569', marginTop: '8px', fontStyle: 'italic' }}>
                        * Nota para trámite de Bonificación CFE: Cálculo exacto basado en {filteredInstallations.length} luminarias QR LED registradas ({totalWattsQR.toLocaleString()}W) + {filteredPoles.length} puntos de iluminación censados ({totalWattsPoles.toLocaleString()}W).
                      </div>
                    </div>

                    {/* KPI METRICS GRID */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#0284c7', fontWeight: 800 }}>{filteredInstallations.length}</h3>
                        <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Luminarias QR Registradas</p>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#0284c7', fontWeight: 800 }}>{filteredPoles.length}</h3>
                        <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Puntos de Iluminación Censados</p>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#0284c7', fontWeight: 800 }}>{totalWattsCombined.toLocaleString()} W</h3>
                        <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Carga Potencia Instalada</p>
                      </div>
                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#0284c7', fontWeight: 800 }}>{filteredIncidents.length}</h3>
                        <p style={{ margin: '2px 0 0 0', fontSize: '9px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Incidencias Atendidas</p>
                      </div>
                    </div>

                    {/* TABLA RESUMEN DE ENTREGABLES */}
                    {(filteredInstallations.length > 0 || filteredPoles.length > 0 || filteredIncidents.length > 0) && (
                      <>
                        <div style={{ fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #0284c7', paddingBottom: '4px', marginTop: '16px', marginBottom: '8px', fontSize: '12px' }}>
                          📊 Resumen Tabular de Operativa y Entregables
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginBottom: '20px' }}>
                          <thead>
                            <tr style={{ background: '#e2e8f0', color: '#0f172a', textAlign: 'left' }}>
                              <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>#</th>
                              <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Código / Identificador</th>
                              <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Tipo Registro</th>
                              <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Cuadrilla</th>
                              <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Responsable en Turno</th>
                              <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Potencia / Tecnología</th>
                              <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Fecha y Hora</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInstallations.map((inst, idx) => (
                              <tr key={`inst-${idx}`} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{idx + 1}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{inst.fixture_code}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1', color: '#059669', fontWeight: 'bold' }}>💡 Luminaria QR</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{inst.crew_name || 'N/A'}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{inst.operator_name || 'Sin asignar'}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1', color: '#d97706', fontWeight: 'bold' }}>{inst.wattage || 70}W LED</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{new Date(inst.installed_at).toLocaleString('es-MX')}</td>
                              </tr>
                            ))}
                            {filteredPoles.map((p, idx) => (
                              <tr key={`pole-${idx}`} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{filteredInstallations.length + idx + 1}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{p.pole_code}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1', color: '#0284c7', fontWeight: 'bold' }}>📍 Punto Iluminación</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{p.crew_name || 'N/A'}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{p.operator_name || 'Sin asignar'}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{p.lamp_type || p.pole_type || 'Punto Iluminación'}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{new Date(p.created_at || p.installed_at || Date.now()).toLocaleString('es-MX')}</td>
                              </tr>
                            ))}
                            {filteredIncidents.map((inc, idx) => (
                              <tr key={`inc-${idx}`} style={{ borderBottom: '1px solid #cbd5e1' }}>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{filteredInstallations.length + filteredPoles.length + idx + 1}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{inc.incident_type}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1', color: '#d97706', fontWeight: 'bold' }}>🛠️ Incidencia</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{inc.crew_name || 'N/A'}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{inc.operator_name || 'Sin asignar'}</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>Reparada / Resuelta</td>
                                <td style={{ padding: '5px', border: '1px solid #cbd5e1' }}>{new Date(inc.created_at).toLocaleString('es-MX')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}

                    {/* FICHAS TÉCNICAS CON FOTOS DE LUMINARIAS QR */}
                    {showQR && filteredInstallations.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #059669', paddingBottom: '4px', marginTop: '20px', marginBottom: '12px', fontSize: '12px' }}>
                          💡 Fichas Técnicas de Registro de Luminarias QR ({filteredInstallations.length})
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {filteredInstallations.map((inst, idx) => {
                            const photoB = getPhotoUrl(inst.photo_before);
                            const photoA = getPhotoUrl(inst.photo_after);

                            return (
                              <div key={`inst-card-${idx}`} className="card-item-box" style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', background: '#ffffff', pageBreakInside: 'avoid' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '6px' }}>
                                  <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '13px', color: '#0f172a' }}>{inst.fixture_code}</span>
                                  <span style={{ background: '#d1fae5', color: '#047857', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '9px' }}>{inst.current_status || inst.status || 'Instalada'}</span>
                                </div>
                                <div style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px' }}>
                                  <div>👷‍♂️ <strong>Cuadrilla:</strong> {inst.crew_name || 'N/A'}</div>
                                  {inst.operator_name && <div>👤 <strong>Responsable en Turno:</strong> {inst.operator_name}</div>}
                                  <div>⚡ <strong>Potencia:</strong> <strong style={{ color: '#d97706' }}>{inst.wattage || 70} Watts LED</strong></div>
                                  <div>📅 <strong>Fecha/Hora:</strong> {new Date(inst.installed_at).toLocaleString('es-MX')}</div>
                                  <div>📍 <strong>Ubicación GPS:</strong> <a href={`https://maps.google.com/?q=${inst.lat},${inst.lng}`} target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'none' }}>📍 Ver Mapa ({inst.lat?.toFixed(5)}, {inst.lng?.toFixed(5)})</a></div>
                                  {inst.notes && <div>📝 <strong>Notas:</strong> <em>"{inst.notes}"</em></div>}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                  <div>
                                    <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#64748b', marginBottom: '2px' }}>📸 1. EVIDENCIA PUNTO:</div>
                                    {photoB ? <img src={photoB} alt="Evidencia Antes" width="350" height="180" decoding="sync" style={{ width: '100%', height: '95px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} /> : <div style={{ height: '95px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '9px' }}>Sin foto adjunta</div>}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#64748b', marginBottom: '2px' }}>📸 2. LÁMPARA LED ENCENDIDA:</div>
                                    {photoA ? <img src={photoA} alt="Evidencia Encendida" width="350" height="180" decoding="sync" style={{ width: '100%', height: '95px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} /> : <div style={{ height: '95px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '9px' }}>Sin foto adjunta</div>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* FICHAS TÉCNICAS CON FOTOS DE PUNTOS DE ILUMINACIÓN CENSADOS */}
                    {showPoles && filteredPoles.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #0284c7', paddingBottom: '4px', marginTop: '20px', marginBottom: '12px', fontSize: '12px' }}>
                          📍 Fichas Técnicas de Censo de Puntos de Iluminación ({filteredPoles.length})
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {filteredPoles.map((p, idx) => {
                            const photoB = getPhotoUrl(p.photo_before);
                            const photoA = getPhotoUrl(p.photo_after);

                            return (
                              <div key={`pole-card-${idx}`} className="card-item-box" style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', background: '#ffffff', pageBreakInside: 'avoid' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '6px' }}>
                                  <span style={{ fontWeight: 'bold', fontFamily: 'monospace', fontSize: '13px', color: '#0f172a' }}>{p.pole_code}</span>
                                  <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '9px' }}>Punto de Iluminación</span>
                                </div>
                                <div style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px' }}>
                                  <div>👷‍♂️ <strong>Cuadrilla:</strong> {p.crew_name || 'N/A'}</div>
                                  {p.operator_name && <div>👤 <strong>Responsable en Turno:</strong> {p.operator_name}</div>}
                                  <div>🏗️ <strong>Estructura / Lámpara:</strong> {p.pole_type || 'Punto'} — {p.lamp_type || 'Sin especificar'}</div>
                                  <div>📅 <strong>Fecha/Hora:</strong> {new Date(p.created_at || p.installed_at || Date.now()).toLocaleString('es-MX')}</div>
                                  <div>📍 <strong>Ubicación GPS:</strong> <a href={`https://maps.google.com/?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'none' }}>📍 Ver Mapa ({p.lat?.toFixed(5)}, {p.lng?.toFixed(5)})</a></div>
                                  {p.notes && <div>📝 <strong>Notas:</strong> <em>"{p.notes}"</em></div>}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                  <div>
                                    <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#64748b', marginBottom: '2px' }}>📸 1. EVIDENCIA PUNTO:</div>
                                    {photoB ? <img src={photoB} alt="Evidencia Punto" width="350" height="180" decoding="sync" style={{ width: '100%', height: '95px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} /> : <div style={{ height: '95px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '9px' }}>Sin foto adjunta</div>}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#64748b', marginBottom: '2px' }}>📸 2. EVIDENCIA ENCENDIDO:</div>
                                    {photoA ? <img src={photoA} alt="Evidencia Encendido" width="350" height="180" decoding="sync" style={{ width: '100%', height: '95px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} /> : <div style={{ height: '95px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '9px' }}>Sin foto adjunta</div>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* FICHAS TÉCNICAS CON FOTOS DE INCIDENCIAS ATENDIDAS */}
                    {showIncidents && filteredIncidents.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, color: '#0f172a', borderBottom: '2px solid #d97706', paddingBottom: '4px', marginTop: '20px', marginBottom: '12px', fontSize: '12px' }}>
                          🛠️ Atención de Cortos Circuitos e Incidencias ({filteredIncidents.length})
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {filteredIncidents.map((inc, idx) => {
                            const photoB = getPhotoUrl(inc.photo_before);
                            const photoA = getPhotoUrl(inc.photo_after);

                            return (
                              <div key={`inc-card-${idx}`} className="card-item-box" style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', background: '#ffffff', pageBreakInside: 'avoid' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '6px' }}>
                                  <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#d97706' }}>{inc.incident_type}</span>
                                  <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '9px' }}>Atendida / Resuelta</span>
                                </div>
                                <div style={{ fontSize: '10px', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px' }}>
                                  <div>👷‍♂️ <strong>Cuadrilla:</strong> {inc.crew_name || 'N/A'}</div>
                                  {inc.operator_name && <div>👤 <strong>Responsable en Turno:</strong> {inc.operator_name}</div>}
                                  <div>📅 <strong>Fecha/Hora Atención:</strong> {new Date(inc.created_at).toLocaleString('es-MX')}</div>
                                  <div>📍 <strong>Ubicación GPS:</strong> <a href={`https://maps.google.com/?q=${inc.lat},${inc.lng}`} target="_blank" rel="noreferrer" style={{ color: '#0284c7', textDecoration: 'none' }}>📍 Ver Mapa ({inc.lat?.toFixed(5)}, {inc.lng?.toFixed(5)})</a></div>
                                  <div>📝 <strong>Trabajo Realizado:</strong> <em>"{inc.notes}"</em></div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                  <div>
                                    <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#64748b', marginBottom: '2px' }}>📸 1. EVIDENCIA ANTES / FALLA:</div>
                                    {photoB ? <img src={photoB} alt="Antes Falla" width="350" height="180" decoding="sync" style={{ width: '100%', height: '95px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} /> : <div style={{ height: '95px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '9px' }}>Sin foto adjunta</div>}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#64748b', marginBottom: '2px' }}>📸 2. REPARACIÓN / SOLUCIÓN:</div>
                                    {photoA ? <img src={photoA} alt="Solucion" width="350" height="180" decoding="sync" style={{ width: '100%', height: '95px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} /> : <div style={{ height: '95px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '9px' }}>Sin foto adjunta</div>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* SECCIÓN FIRMAS */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '30px', textAlign: 'center', pageBreakInside: 'avoid' }}>
                      <div>
                        <div style={{ height: '35px' }}></div>
                        <div style={{ borderTop: '1px solid #0f172a', paddingTop: '6px', fontWeight: 'bold', fontSize: '10px' }}>
                          RESPONSABLE DE CUADRILLA DE CAMPO<br/>
                          {crewFilter === 'todos' ? 'Supervisión General' : crewFilter}
                        </div>
                      </div>
                      <div>
                        <div style={{ height: '35px' }}></div>
                        <div style={{ borderTop: '1px solid #0f172a', paddingTop: '6px', fontWeight: 'bold', fontSize: '10px' }}>
                          DIRECCIÓN DE SERVICIOS PÚBLICOS MUNICIPALES<br/>
                          Municipio de Lerdo, Durango
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ paddingTop: '10px', textAlign: 'center' }}>
                    <img 
                      src={`${origin}/letterhead/letterhead_footer_trimmed.png`} 
                      alt="Pie de Página Presidencia Municipal Lerdo" 
                      width="800" 
                      height="60" 
                      decoding="sync"
                      style={{ width: '100%', maxHeight: '55px', objectFit: 'contain', display: 'block', margin: '0 auto' }} 
                      onError={(e: any) => e.target.style.display='none'} 
                    />
                  </td>
                </tr>
              </tfoot>
            </table>

          </div>
        </div>
      )}

      <ImageModal
        isOpen={!!selectedImageModal}
        imageUrl={selectedImageModal?.url || null}
        title={selectedImageModal?.title}
        onClose={() => setSelectedImageModal(null)}
      />
    </div>
  );
};
