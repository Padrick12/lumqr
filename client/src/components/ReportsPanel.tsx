import { API_BASE_URL } from '../config';
import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Printer, Search, RefreshCcw } from 'lucide-react';
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

  useEffect(() => {
    fetchReportData();
  }, []);

  const [incidents, setIncidents] = useState<any[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [poles, setPoles] = useState<any[]>([]);

  // Advanced Filters for PDF Reports
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'qr' | 'poles' | 'incidents'>('all');

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

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const normCrewFilter = crewFilter.trim().toLowerCase();
    const searchLower = searchTerm.toLowerCase().trim();

    // Filter installations (Luminarias QR)
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

    // Filter poles (Censo de Postes)
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

    // Filter incidents
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

    let totalWatts = 0;
    filteredInstallations.forEach(i => {
      if (i.wattage) totalWatts += Number(i.wattage);
    });

    const showQR = recordTypeFilter === 'all' || recordTypeFilter === 'qr';
    const showPoles = recordTypeFilter === 'all' || recordTypeFilter === 'poles';
    const showIncidents = recordTypeFilter === 'all' || recordTypeFilter === 'incidents';

    const origin = window.location.origin;
    const getPhotoUrl = (url: string | null) => {
      if (!url) return null;
      if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url;
      return origin + (url.startsWith('/') ? url : '/' + url);
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte Membretado Oficial — STG-AP Lerdo</title>
          <style>
            @page { size: A4; margin: 10mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 10px; font-size: 11px; }
            
            .header-letterhead { width: 100%; text-align: center; margin-bottom: 10px; }
            .header-letterhead img { width: 100%; max-width: 100%; height: auto; max-height: 110px; object-fit: contain; }

            .report-title-box { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #0284c7; padding-bottom: 8px; }
            .report-title-box h1 { margin: 0; font-size: 16px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
            .report-title-box h2 { margin: 4px 0 0 0; font-size: 12px; color: #0284c7; font-weight: 700; text-transform: uppercase; }

            .meta-bar { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; font-size: 10px; margin-bottom: 14px; }
            .meta-bar strong { color: #0f172a; }

            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
            .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; text-align: center; }
            .kpi-card h3 { margin: 0; font-size: 18px; color: #0284c7; font-weight: 800; }
            .kpi-card p { margin: 2px 0 0 0; font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; }

            .section-header { font-size: 12px; font-weight: 800; color: #0284c7; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; margin: 20px 0 10px 0; }

            /* Tabla General de Entregables */
            .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 10px; }
            .summary-table th { background: #0284c7; color: #fff; padding: 6px 8px; text-align: left; font-weight: 700; font-size: 9px; text-transform: uppercase; }
            .summary-table td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
            .summary-table tr:nth-child(even) { background: #f8fafc; }

            /* Fichas Técnicas en Cuadrícula */
            .cards-container { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .item-card { background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; page-break-inside: avoid; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
            .card-top { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
            .card-code { font-family: monospace; font-size: 13px; font-weight: 800; color: #0f172a; }
            .card-badge { background: #d1fae5; color: #065f46; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0; }
            .card-badge-pole { background: #e0f2fe; color: #0369a1; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; border: 1px solid #bae6fd; }
            .card-badge-inc { background: #fef3c7; color: #92400e; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; border: 1px solid #fde68a; }

            .info-list { display: flex; flex-direction: column; gap: 3px; font-size: 9.5px; color: #334155; }
            .info-list span { color: #0f172a; font-weight: 600; }
            .watts-highlight { color: #d97706; font-weight: 800; }

            .photos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 4px; }
            .photo-box { width: 100%; height: 95px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; }
            .photo-label { font-size: 8px; color: #475569; font-weight: 700; margin-bottom: 2px; }

            .footer-sig { margin-top: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; page-break-inside: avoid; }
            .sig-line { border-top: 1px solid #0f172a; padding-top: 6px; font-size: 9.5px; font-weight: bold; color: #334155; }

            .footer-letterhead { margin-top: 20px; width: 100%; text-align: center; page-break-inside: avoid; }
            .footer-letterhead img { width: 100%; max-width: 100%; height: auto; max-height: 70px; object-fit: contain; }
            
            .no-data-box { background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; padding: 14px; border-radius: 8px; text-align: center; font-size: 11px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header-letterhead">
            <img src="${origin}/letterhead/letterhead_header_trimmed.png" alt="Membrete Presidencia Municipal Lerdo" />
          </div>

          <div class="report-title-box">
            <h1>DIRECCIÓN DE SERVICIOS PÚBLICOS MUNICIPALES</h1>
            <h2>DICTAMEN Y REPORTE OFICIAL DE CUSTODIA Y ENTREGABLES — ALUMBRADO PÚBLICO</h2>
          </div>

          <div class="meta-bar">
            <div>📅 <strong>Fecha de Emisión:</strong> ${new Date().toLocaleString('es-MX')}</div>
            <div>👷‍♂️ <strong>Cuadrilla Evaluada:</strong> ${crewFilter === 'todos' ? 'Todas las Cuadrillas' : crewFilter}</div>
            <div>🗓️ <strong>Período Auditado:</strong> ${startDate || 'Inicio'} al ${endDate || 'Hoy'}</div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <h3>${filteredInstallations.length}</h3>
              <p>Luminarias QR Registradas</p>
            </div>
            <div class="kpi-card">
              <h3>${filteredPoles.length}</h3>
              <p>Postes Censados</p>
            </div>
            <div class="kpi-card">
              <h3>${totalWatts.toLocaleString()} W</h3>
              <p>Potencia LED Instalada</p>
            </div>
            <div class="kpi-card">
              <h3>${filteredIncidents.length}</h3>
              <p>Incidencias Atendidas</p>
            </div>
          </div>

          ${(filteredInstallations.length === 0 && filteredPoles.length === 0 && filteredIncidents.length === 0) ? `
            <div class="no-data-box">
              ⚠️ <strong>Sin Registros en el Período:</strong> No se encontraron registros de instalaciones, censo ni incidencias para los filtros seleccionados (Cuadrilla: <em>${crewFilter}</em>, Período: <em>${startDate || 'Inicio'} al ${endDate || 'Hoy'}</em>).
            </div>
          ` : ''}

          <!-- TABLA RESUMEN CONSOLIDADA DE ENTREGABLES -->
          ${(filteredInstallations.length > 0 || filteredPoles.length > 0 || filteredIncidents.length > 0) ? `
            <div class="section-header">📊 Resumen Tabular de Operativa y Entregables</div>
            <table class="summary-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Código / Identificador</th>
                  <th>Tipo Registro</th>
                  <th>Cuadrilla</th>
                  <th>Responsable en Turno</th>
                  <th>Potencia / Tipo</th>
                  <th>Fecha y Hora</th>
                </tr>
              </thead>
              <tbody>
                ${filteredInstallations.map((inst, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${inst.fixture_code}</strong></td>
                    <td><span style="color:#059669; font-weight:bold;">💡 Luminaria QR</span></td>
                    <td>${inst.crew_name || 'N/A'}</td>
                    <td>${inst.operator_name || 'Sin asignar'}</td>
                    <td><strong style="color:#d97706;">${inst.wattage || 70}W LED</strong></td>
                    <td>${new Date(inst.installed_at).toLocaleString('es-MX')}</td>
                  </tr>
                `).join('')}
                ${filteredPoles.map((p, idx) => `
                  <tr>
                    <td>${filteredInstallations.length + idx + 1}</td>
                    <td><strong>${p.pole_code}</strong></td>
                    <td><span style="color:#0284c7; font-weight:bold;">📍 Censo Poste</span></td>
                    <td>${p.crew_name || 'N/A'}</td>
                    <td>${p.operator_name || 'Sin asignar'}</td>
                    <td>${p.lamp_type || p.pole_type || 'Poste'}</td>
                    <td>${new Date(p.created_at || p.installed_at || Date.now()).toLocaleString('es-MX')}</td>
                  </tr>
                `).join('')}
                ${filteredIncidents.map((inc, idx) => `
                  <tr>
                    <td>${filteredInstallations.length + filteredPoles.length + idx + 1}</td>
                    <td><strong>${inc.incident_type}</strong></td>
                    <td><span style="color:#d97706; font-weight:bold;">🛠️ Incidencia</span></td>
                    <td>${inc.crew_name || 'N/A'}</td>
                    <td>${inc.operator_name || 'Sin asignar'}</td>
                    <td>Reparada / Resuelta</td>
                    <td>${new Date(inc.created_at).toLocaleString('es-MX')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <!-- FICHAS TÉCNICAS DE LUMINARIAS QR -->
          ${showQR && filteredInstallations.length > 0 ? `
            <div class="section-header">💡 Fichas Técnicas de Registro de Luminarias QR (${filteredInstallations.length})</div>
            <div class="cards-container">
              ${filteredInstallations.map(inst => {
                const photoB = getPhotoUrl(inst.photo_before);
                const photoA = getPhotoUrl(inst.photo_after);

                return `
                  <div class="item-card">
                    <div class="card-top">
                      <span class="card-code">${inst.fixture_code}</span>
                      <span class="card-badge">${inst.current_status || inst.status || 'Instalada'}</span>
                    </div>
                    <div class="info-list">
                      <div>👷‍♂️ <strong>Cuadrilla:</strong> <span>${inst.crew_name || 'N/A'}</span></div>
                      ${inst.operator_name ? `<div>👤 <strong>Responsable en Turno:</strong> <span>${inst.operator_name}</span></div>` : ''}
                      <div>⚡ <strong>Potencia / Tipo:</strong> <span class="watts-highlight">${inst.wattage || 70} Watts LED</span></div>
                      <div>📅 <strong>Fecha/Hora Instalación:</strong> <span>${new Date(inst.installed_at).toLocaleString('es-MX')}</span></div>
                      <div>📍 <strong>Ubicación GPS:</strong> <a href="https://maps.google.com/?q=${inst.lat},${inst.lng}" target="_blank" style="color:#0284c7; text-decoration:none;">📍 Ver Mapa (${inst.lat?.toFixed(5)}, ${inst.lng?.toFixed(5)})</a></div>
                      ${inst.notes ? `<div>📝 <strong>Observaciones:</strong> <em>"${inst.notes}"</em></div>` : ''}
                    </div>

                    <div class="photos-grid">
                      <div>
                        <div class="photo-label">📸 1. ESTADO ANTES / POSTE:</div>
                        ${photoB ? `<img src="${photoB}" class="photo-box" />` : '<div style="height:95px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:9px;">Sin foto adjunta</div>'}
                      </div>
                      <div>
                        <div class="photo-label">📸 2. LÁMPARA LED ENCENDIDA:</div>
                        ${photoA ? `<img src="${photoA}" class="photo-box" />` : '<div style="height:95px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:9px;">Sin foto adjunta</div>'}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- FICHAS TÉCNICAS DE POSTES CENSADOS -->
          ${showPoles && filteredPoles.length > 0 ? `
            <div class="section-header" style="color:#0369a1; border-color:#bae6fd;">📍 Fichas Técnicas de Censo de Postes (${filteredPoles.length})</div>
            <div class="cards-container">
              ${filteredPoles.map(p => {
                const photoB = getPhotoUrl(p.photo_before);
                const photoA = getPhotoUrl(p.photo_after);

                return `
                  <div class="item-card">
                    <div class="card-top">
                      <span class="card-code">${p.pole_code}</span>
                      <span class="card-badge-pole">Poste Censado</span>
                    </div>
                    <div class="info-list">
                      <div>👷‍♂️ <strong>Cuadrilla Censadora:</strong> <span>${p.crew_name || 'N/A'}</span></div>
                      ${p.operator_name ? `<div>👤 <strong>Responsable en Turno:</strong> <span>${p.operator_name}</span></div>` : ''}
                      <div>🏗️ <strong>Estructura / Lámpara:</strong> <span>${p.pole_type || 'Poste'} — ${p.lamp_type || 'Sin especificar'}</span></div>
                      <div>📅 <strong>Fecha/Hora Censo:</strong> <span>${new Date(p.created_at || p.installed_at || Date.now()).toLocaleString('es-MX')}</span></div>
                      <div>📍 <strong>Ubicación GPS:</strong> <a href="https://maps.google.com/?q=${p.lat},${p.lng}" target="_blank" style="color:#0284c7; text-decoration:none;">📍 Ver Mapa (${p.lat?.toFixed(5)}, ${p.lng?.toFixed(5)})</a></div>
                      ${p.notes ? `<div>📝 <strong>Notas:</strong> <em>"${p.notes}"</em></div>` : ''}
                    </div>

                    <div class="photos-grid">
                      <div>
                        <div class="photo-label">📸 1. EVIDENCIA POSTE:</div>
                        ${photoB ? `<img src="${photoB}" class="photo-box" />` : '<div style="height:95px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:9px;">Sin foto adjunta</div>'}
                      </div>
                      <div>
                        <div class="photo-label">📸 2. EVIDENCIA ENCENDIDO:</div>
                        ${photoA ? `<img src="${photoA}" class="photo-box" />` : '<div style="height:95px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:9px;">Sin foto adjunta</div>'}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- FICHAS TÉCNICAS DE INCIDENCIAS ATENDIDAS -->
          ${showIncidents && filteredIncidents.length > 0 ? `
            <div class="section-header" style="color:#d97706; border-color:#fef3c7;">🛠️ Atención de Cortos Circuitos e Incidencias (${filteredIncidents.length})</div>
            <div class="cards-container">
              ${filteredIncidents.map(inc => {
                const photoB = getPhotoUrl(inc.photo_before);
                const photoA = getPhotoUrl(inc.photo_after);

                return `
                  <div class="item-card">
                    <div class="card-top">
                      <span class="card-code">${inc.incident_type}</span>
                      <span class="card-badge-inc">Atendida / Resuelta</span>
                    </div>
                    <div class="info-list">
                      <div>👷‍♂️ <strong>Cuadrilla:</strong> <span>${inc.crew_name || 'N/A'}</span></div>
                      ${inc.operator_name ? `<div>👤 <strong>Responsable en Turno:</strong> <span>${inc.operator_name}</span></div>` : ''}
                      <div>📅 <strong>Fecha/Hora Atención:</strong> <span>${new Date(inc.created_at).toLocaleString('es-MX')}</span></div>
                      <div>📍 <strong>Ubicación GPS:</strong> <a href="https://maps.google.com/?q=${inc.lat},${inc.lng}" target="_blank" style="color:#0284c7; text-decoration:none;">📍 Ver Mapa (${inc.lat?.toFixed(5)}, ${inc.lng?.toFixed(5)})</a></div>
                      <div>📝 <strong>Trabajo Realizado:</strong> <em>"${inc.notes}"</em></div>
                    </div>

                    <div class="photos-grid">
                      <div>
                        <div class="photo-label">📸 1. EVIDENCIA ANTES / FALLA:</div>
                        ${photoB ? `<img src="${photoB}" class="photo-box" />` : '<div style="height:95px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:9px;">Sin foto adjunta</div>'}
                      </div>
                      <div>
                        <div class="photo-label">📸 2. REPARACIÓN / SOLUCIÓN:</div>
                        ${photoA ? `<img src="${photoA}" class="photo-box" />` : '<div style="height:95px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:9px;">Sin foto adjunta</div>'}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <div class="footer-sig">
            <div>
              <div style="height: 40px;"></div>
              <div class="sig-line">
                RESPONSABLE DE CUADRILLA DE CAMPO<br/>
                ${crewFilter === 'todos' ? 'Supervisión General' : crewFilter}
              </div>
            </div>
            <div>
              <div style="height: 40px;"></div>
              <div class="sig-line">
                DIRECCIÓN DE SERVICIOS PÚBLICOS MUNICIPALES<br/>
                Municipio de Lerdo, Durango
              </div>
            </div>
          </div>

          <div class="footer-letterhead">
            <img src="${origin}/letterhead/letterhead_footer_trimmed.png" alt="Pie de Página Presidencia Municipal Lerdo" loading="eager" onerror="this.style.display='none'" />
          </div>

          <!-- BOTÓN FLOTANTE PARA RE-DISPARAR IMPRESIÓN SI CHROME HACE PAUSA -->
          <div class="no-print" style="position: fixed; top: 12px; right: 16px; z-index: 999999; display: flex; gap: 10px; background: rgba(15, 23, 42, 0.92); padding: 8px 14px; border-radius: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2);">
            <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 7px 14px; border-radius: 16px; font-weight: bold; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 6px;">🖨️ Imprimir / Guardar PDF</button>
            <button onclick="window.close()" style="background: #475569; color: white; border: none; padding: 7px 12px; border-radius: 16px; font-weight: bold; cursor: pointer; font-size: 11px;">❌ Cerrar</button>
          </div>

          <style>
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Trigger print safely once DOM is ready
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
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
              <span className="metric-label">Total Postes Censo</span>
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

          {/* CLASIFICACIÓN DE ZONAS & TRAYECTOS SEGUROS */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 className="panel-header" style={{ margin: '0 0 16px 0', fontSize: '15px', color: 'var(--neon-blue)' }}>
              🌐 Cobertura por Clasificación de Zona (Urbana / Rural / Trayectos Seguros)
            </h3>
            <div className="metrics-grid">
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span className="metric-label">Zona Urbana</span>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--neon-blue)', marginTop: '4px' }}>
                  {summary.poles_by_zone?.Urbana || 0} Postes
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <span className="metric-label">Zona Rural</span>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--neon-green)', marginTop: '4px' }}>
                  {summary.poles_by_zone?.Rural || 0} Postes
                </div>
              </div>

              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.3)', textAlign: 'center' }}>
                <span className="metric-label" style={{ color: 'var(--neon-blue)' }}>🛡️ Trayectos Seguros</span>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#60a5fa', marginTop: '4px' }}>
                  {summary.poles_by_zone?.['Trayectos Seguros'] || 0} Postes
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
                    <th>Postes Censados</th>
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
              onClick={handlePrintReport}
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
              <option value="poles">📍 Solo Censo de Postes</option>
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

      <ImageModal
        isOpen={!!selectedImageModal}
        imageUrl={selectedImageModal?.url || null}
        title={selectedImageModal?.title}
        onClose={() => setSelectedImageModal(null)}
      />
    </div>
  );
};
