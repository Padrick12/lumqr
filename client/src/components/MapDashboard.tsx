import { API_BASE_URL } from '../config';
// Updated sectors: Colonia La Lomita added and urban filter updated
import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ShieldAlert, Sparkles, Filter, RefreshCw, Clock, Search, ChevronDown, MapPin } from 'lucide-react';
import sectoresData from '../data/sectores-lerdo.json';
import './MapDashboard.css';

interface Installation {
  id: number;
  fixture_code: string;
  crew_id: number;
  crew_name: string;
  lat: number;
  lng: number;
  installed_at: string;
  status_at_install: string;
  notes: string;
  current_status: 'Nueva' | 'Reparada' | 'Rehabilitada' | 'Robo';
  arrival_date: string;
}

interface InstallationWithUsage extends Installation {
  usedHours: number;
  lifePercentage: number;
}

interface CensusPole {
  id: number;
  pole_code: string;
  lat: number;
  lng: number;
  pole_type: string;
  lamp_type: 'Vapor de Sodio' | 'LED Antiguo' | 'LED Nueva (Sin QR)' | 'Sin Lámpara';
  zone_type: 'Urbana' | 'Rural' | 'Trayectos Seguros';
  notes: string;
  crew_name: string;
  created_at: string;
}

interface MapDashboardProps {
  refreshTrigger: number;
}

function formatLocalDateTime(dateStr: string): string {
  if (!dateStr) return '';
  let safeStr = dateStr;
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    safeStr = dateStr.replace(' ', 'T') + 'Z';
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    safeStr = dateStr + 'Z';
  }
  const date = new Date(safeStr);
  return isNaN(date.getTime()) ? dateStr : date.toLocaleString();
}

function isPointInPolygon(lat: number, lng: number, vs: [number, number][]) {
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > lng) !== (yj > lng))
        && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export const MapDashboard: React.FC<MapDashboardProps> = ({ refreshTrigger }) => {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [poles, setPoles] = useState<CensusPole[]>([]);
  const [loading, setLoading] = useState(true);

  // Bounding polygons for Lerdo Colonias (Loaded dynamically from GeoJSON)
  const COLONIAS = useMemo(() => {
    return (sectoresData.features || []).map((feature: any) => {
      const rawCoords = feature.geometry.coordinates[0];
      const coords = rawCoords.map((coord: number[]) => [coord[1], coord[0]]) as [number, number][];
      return {
        name: feature.properties.name || 'Desconocido',
        color: feature.properties.color || '#00f2fe',
        coords
      };
    });
  }, []);

  // Map settings
  const [selectedColonia, setSelectedColonia] = useState<string>('todas');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [isHeatmapMode, setIsHeatmapMode] = useState<boolean>(false);
  const [coloniaSearch, setColoniaSearch] = useState('');
  const [coloniaDropdownOpen, setColoniaDropdownOpen] = useState(false);
  const [zoneTypeFilter, setZoneTypeFilter] = useState<'Todas' | 'Urbana' | 'Rural' | 'Trayectos Seguros'>('Todas');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    fetchInstallations();
    fetchPoles();
  }, [refreshTrigger]);

  const fetchPoles = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/poles`);
      if (res.ok) {
        const data = await res.json();
        setPoles(data);
      }
    } catch (err) {
      console.error('Error fetching poles:', err);
    }
  };

  const fetchInstallations = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/installations`);
      if (res.ok) {
        const data = await res.json();
        setInstallations(data);
      }
    } catch (err) {
      console.error('Error fetching installations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setColoniaDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredColoniasList = COLONIAS.filter(c => {
    const isRural = /Villa Ju[áa]rez|^Francisco Villa$/i.test(c.name) || !c.name.match(/Colonia|Ampliaci|Villa|Centro|Fraccionamiento|Jardines|Magisterial|Samaniego|Rosales|Altas|Sarabia|Brisas|Sacramento|Rueda|Fierro|Quintas|Cerrada|Residencial|Valle|Laureles|Sauces|Reina|Jerusalem|Ed[ée]n|Cambio|Constituci[óo]n|Mayagoitia|Parque|Lomita/i);
    const matchesType = zoneTypeFilter === 'Todas' || 
                        (zoneTypeFilter === 'Urbana' && !isRural) || 
                        (zoneTypeFilter === 'Rural' && isRural);
    const matchesSearch = c.name.toLowerCase().includes(coloniaSearch.toLowerCase());
    return matchesType && matchesSearch;
  });
  const [mapCenter, setMapCenter] = useState<[number, number]>([25.539, -103.524]); // Lerdo Centro
  const [mapZoom, setMapZoom] = useState<number>(14);

  // Predictive maintenance states
  const [maintenanceStats, setMaintenanceStats] = useState<InstallationWithUsage[]>([]);
  const [alerts, setAlerts] = useState<InstallationWithUsage[]>([]);

  // Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const polygonsGroupRef = useRef<L.LayerGroup | null>(null);

  const getColoniaName = (lat: number, lng: number): string => {
    for (const col of COLONIAS) {
      if (isPointInPolygon(lat, lng, col.coords)) {
        return col.name;
      }
    }
    return 'Fuera de Sector';
  };

  // Run predictive maintenance calculations (30,000 hours lifespan)
  useEffect(() => {
    const currentDate = new Date();
    const MAX_HOURS = 30000;
    const WARNING_HOURS = 27000; // 90%

    const withUsage: InstallationWithUsage[] = installations.map(inst => {
      const installDate = new Date(inst.installed_at);
      const diffDays = Math.max(0, (currentDate.getTime() - installDate.getTime()) / (1000 * 60 * 60 * 24));
      // Assume 12 hours of usage per day (night time)
      const usedHours = Math.round(diffDays * 12);
      const lifePercentage = Math.min((usedHours / MAX_HOURS) * 100, 100);
      
      return { ...inst, usedHours, lifePercentage };
    }).filter(inst => inst.current_status !== 'Robo'); // Skip stolen

    withUsage.sort((a, b) => b.usedHours - a.usedHours);
    setMaintenanceStats(withUsage);

    // Alerts for fixtures over 90% life used
    setAlerts(withUsage.filter(inst => inst.usedHours >= WARNING_HOURS));
  }, [installations]);

  const handleColoniaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedColonia(val);
    if (val === 'todas') {
      setMapCenter([25.539, -103.524]);
      setMapZoom(14);
    } else {
      const col = COLONIAS.find(c => c.name === val);
      if (col) {
        const lats = col.coords.map(c => c[0]);
        const lngs = col.coords.map(c => c[1]);
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
        setMapCenter([centerLat, centerLng]);
        setMapZoom(15);
      }
    }
  };

  const filteredInstallations = installations.filter(inst => {
    const matchesStatus = statusFilter === 'todos' || inst.current_status === statusFilter;
    
    let matchesColonia = true;
    if (selectedColonia !== 'todas') {
      const col = COLONIAS.find(c => c.name === selectedColonia);
      if (col) {
        matchesColonia = isPointInPolygon(inst.lat, inst.lng, col.coords);
      } else {
        matchesColonia = !COLONIAS.some(c => isPointInPolygon(inst.lat, inst.lng, c.coords));
      }
    }

    return matchesStatus && matchesColonia;
  });

  const createCustomIcon = (status: string, isAlert: boolean) => {
    let color = 'var(--neon-emerald)';
    let animateClass = '';

    if (status === 'Reparada') color = 'var(--neon-blue)';
    else if (status === 'Rehabilitada') color = 'var(--neon-purple)';
    else if (status === 'Robo') {
      color = 'var(--neon-rose)';
      animateClass = 'animate-ping';
    }

    if (isAlert) {
      color = 'var(--neon-amber)';
      animateClass = 'animate-pulse';
    }

    const htmlString = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px;">
        <div style="position: absolute; width: 20px; height: 20px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 4px 6px rgba(0,0,0,0.3); background-color: ${color}; opacity: 0.85;"></div>
        <div style="position: absolute; width: 20px; height: 20px; border-radius: 50%; border: 2px solid ${color}; opacity: 0.6; transform: scale(1.3);" class="${animateClass}"></div>
        <div style="width: 6px; height: 6px; border-radius: 50%; background-color: #ffffff; z-index: 10;"></div>
      </div>
    `;

    return L.divIcon({
      html: htmlString,
      className: 'custom-div-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  };

  const createPoleIcon = (lampType: string) => {
    let color = '#f59e0b'; // Vapor de Sodio default (Amber)
    let symbol = '🟡';
    if (lampType === 'LED Antiguo') { color = '#94a3b8'; symbol = '⚪'; }
    else if (lampType === 'LED Nueva (Sin QR)') { color = '#10b981'; symbol = '🟢'; }
    else if (lampType === 'Sin Lámpara') { color = '#f43f5e'; symbol = '❌'; }

    const htmlString = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px;">
        <div style="position: absolute; width: 18px; height: 18px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.3); background-color: ${color}; opacity: 0.9; box-shadow: 0 0 8px ${color};"></div>
        <span style="font-size: 8px; z-index: 10;">${symbol}</span>
      </div>
    `;

    return L.divIcon({
      html: htmlString,
      className: 'custom-div-icon',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const container = mapContainerRef.current;
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = null;
    }

    // High performance GPU accelerated canvas renderer
    const map = L.map(container, { preferCanvas: true }).setView(mapCenter, mapZoom);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'map-tiles-dark'
    }).addTo(map);

    polygonsGroupRef.current = L.layerGroup().addTo(map);
    markersGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); 

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(mapCenter, mapZoom);
    }
  }, [mapCenter, mapZoom]);

  useEffect(() => {
    const group = polygonsGroupRef.current;
    if (!group) return;

    group.clearLayers();

    COLONIAS.forEach(col => {
      const polygon = L.polygon(col.coords, {
        color: col.color,
        fillColor: col.color,
        fillOpacity: 0.05,
        weight: selectedColonia === col.name ? 3 : 1.5,
        dashArray: selectedColonia === col.name ? '5, 5' : ''
      });

      polygon.bindPopup(`
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; color: #fff; min-width: 120px;">
          <h4 style="font-weight: bold; margin: 0; color: ${col.color}">${col.name}</h4>
          <p style="font-size: 10px; color: #94a3b8; margin: 4px 0 0 0;">Sector Municipal Lerdo</p>
        </div>
      `);
      
      polygon.addTo(group);
    });
  }, [selectedColonia]);

  useEffect(() => {
    const group = markersGroupRef.current;
    if (!group) return;

    group.clearLayers();

    filteredInstallations.forEach(inst => {
      const isAlert = alerts.some(a => a.fixture_code === inst.fixture_code);

      if (isHeatmapMode) {
        let heatColor = '#05f3a2';
        if (inst.current_status === 'Reparada') heatColor = '#00f2fe';
        else if (inst.current_status === 'Rehabilitada') heatColor = '#8b5cf6';
        else if (inst.current_status === 'Robo') heatColor = '#f43f5e';
        if (isAlert) heatColor = '#f59e0b';

        const circle = L.circleMarker([inst.lat, inst.lng], {
          radius: 20,
          fillColor: heatColor,
          fillOpacity: 0.22,
          color: heatColor,
          weight: 1,
          opacity: 0.4
        });
        
        circle.addTo(group);
      } else {
        const icon = createCustomIcon(inst.current_status, isAlert);
        const marker = L.marker([inst.lat, inst.lng], { icon });

        let badgeClassStyle = 'background-color: #065f46; color: #34d399;';
        if (inst.current_status === 'Reparada') badgeClassStyle = 'background-color: #1e40af; color: #60a5fa;';
        else if (inst.current_status === 'Rehabilitada') badgeClassStyle = 'background-color: #5b21b6; color: #c084fc;';
        else if (inst.current_status === 'Robo') badgeClassStyle = 'background-color: #991b1b; color: #f87171;';

        const alertHTML = isAlert ? `
          <div style="display: flex; align-items: center; gap: 4px; color: #f59e0b; font-weight: bold; margin-top: 8px; background: rgba(245, 158, 11, 0.1); padding: 6px; border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 10px;">
            <span>⚠️ Mantenimiento Recomendado (Vida Útil > 90%)</span>
          </div>
        ` : '';

        const usageStat = maintenanceStats.find(m => m.fixture_code === inst.fixture_code);
        const usageHTML = usageStat ? `
          <div style="margin-top: 6px;">
            <div style="display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; margin-bottom: 2px;">
              <span>Vida Útil (30k hrs)</span>
              <span>${usageStat.usedHours.toLocaleString()} hrs (${usageStat.lifePercentage.toFixed(1)}%)</span>
            </div>
            <div style="width: 100%; background: rgba(255,255,255,0.1); border-radius: 2px; height: 4px;">
              <div style="width: ${usageStat.lifePercentage}%; background: ${usageStat.lifePercentage > 90 ? '#f59e0b' : '#05f3a2'}; height: 100%; border-radius: 2px;"></div>
            </div>
          </div>
        ` : '';

        const popupHTML = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; color: #f1f5f9; min-width: 200px; padding: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 6px; margin-bottom: 6px;">
              <span style="font-family: monospace; font-weight: bold; font-size: 13px; color: #fff;">${inst.fixture_code}</span>
              <span style="padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 10px; ${badgeClassStyle}">${inst.current_status}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <p style="margin: 2px 0;"><strong>Cuadrilla:</strong> ${inst.crew_name}</p>
              <p style="margin: 2px 0;"><strong>Ubicación:</strong> ${getColoniaName(inst.lat, inst.lng)}</p>
              <p style="margin: 2px 0;"><strong>Instalada:</strong> ${formatLocalDateTime(inst.installed_at)}</p>
              ${inst.notes ? `<p style="margin: 6px 0 0 0; font-style: italic; background: rgba(255,255,255,0.04); padding: 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.04);">"${inst.notes}"</p>` : ''}
              ${usageHTML}
              ${alertHTML}
              <div style="display: flex; gap: 6px; margin-top: 10px; border-top: 1px solid #334155; padding-top: 8px;">
                <a href="https://www.google.com/maps/dir/?api=1&destination=${inst.lat},${inst.lng}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); padding: 5px 8px; border-radius: 6px; font-weight: 600; font-size: 10px;">
                  📍 Google Maps
                </a>
                <a href="https://waze.com/ul?ll=${inst.lat},${inst.lng}&navigate=yes" target="_blank" rel="noopener noreferrer" style="flex: 1; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px; background: rgba(5, 243, 162, 0.15); color: #05f3a2; border: 1px solid rgba(5, 243, 162, 0.4); padding: 5px 8px; border-radius: 6px; font-weight: 600; font-size: 10px;">
                  🚙 Waze
                </a>
              </div>
            </div>
          </div>
        `;

        marker.bindPopup(popupHTML);
        marker.addTo(group);
      }
    });

    // RENDER CENSORED POLES ON MAP
    poles.forEach(p => {
      let matchesColonia = true;
      if (selectedColonia !== 'todas') {
        const col = COLONIAS.find(c => c.name === selectedColonia);
        if (col) {
          matchesColonia = isPointInPolygon(p.lat, p.lng, col.coords);
        }
      }
      let matchesZone = zoneTypeFilter === 'Todas' || p.zone_type === zoneTypeFilter;

      if (matchesColonia && matchesZone) {
        const icon = createPoleIcon(p.lamp_type);
        const marker = L.marker([p.lat, p.lng], { icon });

        const polePopupHTML = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; color: #f1f5f9; min-width: 210px; padding: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 6px; margin-bottom: 6px;">
              <span style="font-family: monospace; font-weight: bold; font-size: 13px; color: #38bdf8;">${p.pole_code}</span>
              <span style="padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 10px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">Poste Censado</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <p style="margin: 2px 0;"><strong>Cuadrilla Censadora:</strong> ${p.crew_name || 'Almacén / Sistema'}</p>
              <p style="margin: 2px 0;"><strong>Estructura:</strong> ${p.pole_type}</p>
              <p style="margin: 2px 0;"><strong>Tecnología Lámpara:</strong> ${p.lamp_type}</p>
              <p style="margin: 2px 0;"><strong>Clasificación Zona:</strong> ${p.zone_type}</p>
              <p style="margin: 2px 0;"><strong>Fecha Censo:</strong> ${formatLocalDateTime(p.created_at)}</p>
              ${p.notes ? `<p style="margin: 6px 0 0 0; font-style: italic; background: rgba(255,255,255,0.04); padding: 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.04);">"${p.notes}"</p>` : ''}
              <div style="display: flex; gap: 6px; margin-top: 10px; border-top: 1px solid #334155; padding-top: 8px;">
                <a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); padding: 5px 8px; border-radius: 6px; font-weight: 600; font-size: 10px;">
                  📍 Google Maps
                </a>
                <a href="https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes" target="_blank" rel="noopener noreferrer" style="flex: 1; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px; background: rgba(5, 243, 162, 0.15); color: #05f3a2; border: 1px solid rgba(5, 243, 162, 0.4); padding: 5px 8px; border-radius: 6px; font-weight: 600; font-size: 10px;">
                  🚙 Waze
                </a>
              </div>
            </div>
          </div>
        `;

        marker.bindPopup(polePopupHTML);
        marker.addTo(group);
      }
    });
  }, [filteredInstallations, poles, isHeatmapMode, alerts, maintenanceStats, selectedColonia, zoneTypeFilter]);

  return (
    <div className="map-dashboard-container">
      {/* MAP AND FILTERS SECTION */}
      <div className="map-main-section">
        {/* Quick Filters */}
        <div className="glass-panel map-filters">
          <div className="filters-group">
            <span className="filter-label">
              <Filter size={16} /> FILTRAR CARTOGRAFÍA:
            </span>
            
            <div className="custom-dropdown" ref={dropdownRef}>
              <div 
                className="dropdown-trigger" 
                onClick={() => setColoniaDropdownOpen(!coloniaDropdownOpen)}
              >
                <MapPin size={14} />
                <span className="truncate-text">{selectedColonia === 'todas' ? 'Todas las Zonas' : selectedColonia}</span>
                <ChevronDown size={14} />
              </div>

              {coloniaDropdownOpen && (
                <div className="dropdown-menu">
                  <div className="dropdown-search">
                    <Search size={14} color="#94a3b8" />
                    <input 
                      type="text" 
                      placeholder="Buscar zona..." 
                      value={coloniaSearch}
                      onChange={(e) => setColoniaSearch(e.target.value)}
                    />
                  </div>
                  <div className="dropdown-tabs">
                    <button className={zoneTypeFilter === 'Todas' ? 'active' : ''} onClick={() => setZoneTypeFilter('Todas')}>Todas</button>
                    <button className={zoneTypeFilter === 'Urbana' ? 'active' : ''} onClick={() => setZoneTypeFilter('Urbana')}>Urbana</button>
                    <button className={zoneTypeFilter === 'Rural' ? 'active' : ''} onClick={() => setZoneTypeFilter('Rural')}>Rural</button>
                    <button className={zoneTypeFilter === 'Trayectos Seguros' ? 'active' : ''} onClick={() => setZoneTypeFilter('Trayectos Seguros')}>Trayectos</button>
                  </div>
                  <div className="dropdown-list">
                    <div 
                      className={`dropdown-item ${selectedColonia === 'todas' ? 'selected' : ''}`}
                      onClick={() => { handleColoniaChange({target: {value: 'todas'}} as any); setColoniaDropdownOpen(false); }}
                    >
                      Todas las Zonas
                    </div>
                    {filteredColoniasList.map(c => (
                      <div 
                        key={c.name}
                        className={`dropdown-item ${selectedColonia === c.name ? 'selected' : ''}`}
                        onClick={() => { handleColoniaChange({target: {value: c.name}} as any); setColoniaDropdownOpen(false); }}
                      >
                        <span className="color-dot" style={{ backgroundColor: c.color }}></span>
                        {c.name}
                      </div>
                    ))}
                    {filteredColoniasList.length === 0 && (
                      <div className="dropdown-empty">No se encontraron resultados.</div>
                    )}
                    <div 
                      className={`dropdown-item ${selectedColonia === 'Fuera de Sector' ? 'selected' : ''}`}
                      onClick={() => { handleColoniaChange({target: {value: 'Fuera de Sector'}} as any); setColoniaDropdownOpen(false); }}
                    >
                      Fuera de Sector
                    </div>
                  </div>
                </div>
              )}
            </div>

            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="todos">Todos los Estados</option>
              <option value="Nueva">Nueva</option>
              <option value="Reparada">Reparada</option>
              <option value="Rehabilitada">Rehabilitada</option>
              <option value="Robo">Robo</option>
            </select>
          </div>

          <div className="map-actions">
            <button 
              onClick={() => setIsHeatmapMode(!isHeatmapMode)}
              className={`heatmap-btn ${isHeatmapMode ? 'active' : ''}`}
            >
              <Sparkles size={16} />
              <span>{isHeatmapMode ? 'Desactivar Mapa de Calor' : 'Ver Mapa de Calor'}</span>
            </button>
            
            <button 
              onClick={fetchInstallations} 
              className="icon-btn"
              title="Refrescar mapa"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        {/* MAP CONTAINER */}
        <div className="map-wrapper">
          {loading && (
            <div className="map-loading-overlay">
              <div className="map-loading-content">
                <RefreshCw size={40} color="var(--neon-blue)" style={{ animation: 'spin 1s linear infinite' }} />
                <span className="map-loading-text">Actualizando cartografía Smart City...</span>
              </div>
            </div>
          )}

          <div 
            ref={mapContainerRef} 
            style={{ width: '100%', height: '100%', zIndex: 1 }}
          />
        </div>
      </div>

      {/* PREDICTIVE ALERTS SIDEBAR */}
      <div className="map-sidebar">
        <div className="glass-panel alerts-panel">
          <h3 className="panel-header" style={{ marginBottom: '16px' }}>
            <Clock color="var(--neon-blue)" />
            <span>Desgaste de Luminarias (Top 5)</span>
          </h3>

          <div className="alerts-list">
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Basado en una vida útil estándar de 30,000 horas (aprox. 12h/día de uso).
            </p>
            {maintenanceStats.slice(0, 5).map(stat => (
              <div key={stat.fixture_code} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-main)' }}>{stat.fixture_code}</strong>
                  <span style={{ fontSize: '11px', color: stat.lifePercentage > 90 ? 'var(--neon-amber)' : 'var(--neon-blue)', fontWeight: 600 }}>
                    {stat.usedHours.toLocaleString()} hrs
                  </span>
                </div>
                <div style={{ width: '100%', background: 'rgba(0,0,0,0.5)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${stat.lifePercentage}%`, 
                    background: stat.lifePercentage > 90 ? 'var(--neon-amber)' : 'linear-gradient(90deg, var(--neon-blue), var(--neon-emerald))', 
                    height: '100%', 
                    borderRadius: '3px' 
                  }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '9px', color: 'var(--text-muted)' }}>
                  <span>{stat.lifePercentage.toFixed(1)}% consumido</span>
                  <span>Max: 30k hrs</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel alerts-panel" style={{ flexGrow: 1 }}>
          <h3 className="panel-header">
            <ShieldAlert color="var(--neon-amber)" />
            <span>Sectores en Alerta ({alerts.length})</span>
          </h3>

          <div className="alerts-list">
            {alerts.length === 0 ? (
              <div className="alert-empty">
                <Sparkles size={40} color="var(--neon-emerald)" opacity={0.5} />
                <h4>Sin Mantenimiento Urgente</h4>
                <p>Ninguna luminaria ha superado el 90% de su vida útil (27,000 horas).</p>
              </div>
            ) : (
              alerts.map(al => (
                <div key={al.fixture_code} className="alert-card" style={{ borderColor: 'var(--neon-amber)', background: 'rgba(245, 158, 11, 0.05)' }}>
                  <div className="alert-card-header">
                    <strong className="alert-code">{al.fixture_code}</strong>
                    <span className="alert-badge" style={{ background: 'var(--neon-amber)', color: '#000' }}>Excede 90%</span>
                  </div>
                  <div className="alert-details">
                    <p>Ubicación: <strong>{getColoniaName(al.lat, al.lng)}</strong></p>
                    <p>Horas uso: {al.usedHours.toLocaleString()} / 30,000</p>
                    <p>Responsable: {al.crew_name}</p>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${al.lat},${al.lng}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '4px 6px', borderRadius: '6px', fontWeight: 600, fontSize: '10px' }}>
                        📍 Google Maps
                      </a>
                      <a href={`https://waze.com/ul?ll=${al.lat},${al.lng}&navigate=yes`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'rgba(5, 243, 162, 0.15)', color: '#05f3a2', border: '1px solid rgba(5, 243, 162, 0.4)', padding: '4px 6px', borderRadius: '6px', fontWeight: 600, fontSize: '10px' }}>
                        🚙 Waze
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
