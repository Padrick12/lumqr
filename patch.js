const fs = require('fs');
let code = fs.readFileSync('c:/Users/adric/Desktop/lumqr/client/src/components/MapDashboard.tsx', 'utf8');

code = code.replace(/import \{ ShieldAlert, Sliders, Sparkles, Filter, RefreshCw, Clock \} from 'lucide-react';/, 
  'import { ShieldAlert, Sliders, Sparkles, Filter, RefreshCw, Clock, Search, ChevronDown, MapPin } from \'lucide-react\';');

const statesCode = '  const [isHeatmapMode, setIsHeatmapMode] = useState<boolean>(false);';
const newStatesCode = `  const [isHeatmapMode, setIsHeatmapMode] = useState<boolean>(false);
  const [coloniaSearch, setColoniaSearch] = useState('');
  const [coloniaDropdownOpen, setColoniaDropdownOpen] = useState(false);
  const [zoneTypeFilter, setZoneTypeFilter] = useState<'Todas' | 'Urbana' | 'Rural'>('Todas');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
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
    const isRural = !c.name.match(/Colonia|Ampliaci|Villa|Centro|Fraccionamiento|Jardines|Magisterial|Samaniego|Rosales|Altas|Sarabia/i);
    const matchesType = zoneTypeFilter === 'Todas' || 
                        (zoneTypeFilter === 'Urbana' && !isRural) || 
                        (zoneTypeFilter === 'Rural' && isRural);
    const matchesSearch = c.name.toLowerCase().includes(coloniaSearch.toLowerCase());
    return matchesType && matchesSearch;
  });`;
code = code.replace(statesCode, newStatesCode);

const oldSelect = `            <select 
              value={selectedColonia} 
              onChange={handleColoniaChange}
              className="filter-select"
            >
              <option value="todas">Todas las Colonias (Municipio Lerdo)</option>
              {COLONIAS.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
              <option value="Fuera de Sector">Fuera de Sector</option>
            </select>`;

const newDropdown = `            <div className="custom-dropdown" ref={dropdownRef}>
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
                  </div>
                  <div className="dropdown-list">
                    <div 
                      className={\`dropdown-item \${selectedColonia === 'todas' ? 'selected' : ''}\`}
                      onClick={() => { handleColoniaChange({target: {value: 'todas'}} as any); setColoniaDropdownOpen(false); }}
                    >
                      Todas las Zonas
                    </div>
                    {filteredColoniasList.map(c => (
                      <div 
                        key={c.name}
                        className={\`dropdown-item \${selectedColonia === c.name ? 'selected' : ''}\`}
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
                      className={\`dropdown-item \${selectedColonia === 'Fuera de Sector' ? 'selected' : ''}\`}
                      onClick={() => { handleColoniaChange({target: {value: 'Fuera de Sector'}} as any); setColoniaDropdownOpen(false); }}
                    >
                      Fuera de Sector
                    </div>
                  </div>
                </div>
              )}
            </div>`;

code = code.replace(oldSelect, newDropdown);

fs.writeFileSync('c:/Users/adric/Desktop/lumqr/client/src/components/MapDashboard.tsx', code);
