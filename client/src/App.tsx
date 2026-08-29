import { useState } from 'react';
import { MapDashboard } from './components/MapDashboard';
import { OperatorPanel } from './components/OperatorPanel';
import { WarehousePanel } from './components/WarehousePanel';
import { AdminPanel } from './components/AdminPanel';
import { ReportsPanel } from './components/ReportsPanel';
import { AppLayout } from './components/Layout/AppLayout';
import { OperatorLayout } from './components/Layout/OperatorLayout';
import { RoleSelector } from './components/RoleSelector';
import { OfflineIndicator } from './components/OfflineIndicator';

function App() {
  const [role, setRole] = useState<'admin' | 'operator' | null>(() => {
    const savedAdmin = localStorage.getItem('lumqr_admin_session');
    if (savedAdmin) return 'admin';
    return null;
  });

  const [userData, setUserData] = useState<{ id: number; name: string } | null>(() => {
    const savedAdmin = localStorage.getItem('lumqr_admin_session');
    if (savedAdmin) {
      try {
        return JSON.parse(savedAdmin);
      } catch (e) {}
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<'map' | 'operator' | 'warehouse' | 'admin' | 'reports'>('map');
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLogout = () => {
    localStorage.removeItem('lumqr_admin_session');
    setRole(null);
    setUserData(null);
    setActiveTab('map');
  };

  const handleRoleSelection = (selectedRole: 'admin' | 'operator', data?: { id: number; name: string }) => {
    setRole(selectedRole);
    if (data) {
      setUserData(data);
    }
    if (selectedRole === 'admin') {
      localStorage.setItem('lumqr_admin_session', JSON.stringify(data || { id: 1, name: 'Administrador' }));
    }
  };

  // 1. Role Selection Screen
  if (!role) {
    return <RoleSelector onSelectRole={handleRoleSelection} />;
  }

  // 2. Operator Mobile Application
  if (role === 'operator') {
    return (
      <OperatorLayout 
        onLogout={handleLogout}
        offlineIndicator={
          <OfflineIndicator 
            isSimulatedOffline={isSimulatedOffline}
            setIsSimulatedOffline={setIsSimulatedOffline}
            onSyncComplete={triggerRefresh}
          />
        }
      >
        <OperatorPanel 
          isSimulatedOffline={isSimulatedOffline} 
          onSyncComplete={triggerRefresh}
          crewId={userData?.id || 0}
          crewName={userData?.name || ''}
        />
      </OperatorLayout>
    );
  }

  // 3. Admin / Dashboard Application
  return (
    <AppLayout userData={userData}  activeTab={activeTab} 
      setActiveTab={setActiveTab}
      isSimulatedOffline={isSimulatedOffline}
      setIsSimulatedOffline={setIsSimulatedOffline}
      onSyncComplete={triggerRefresh}
      onLogout={handleLogout}
    >
      {activeTab === 'map' && <MapDashboard refreshTrigger={refreshTrigger} />}
      {activeTab === 'warehouse' && <WarehousePanel onDataChange={triggerRefresh} />}
      {activeTab === 'admin' && <AdminPanel onDataChange={triggerRefresh} />}
      {activeTab === 'reports' && <ReportsPanel />}
    </AppLayout>
  );
}

export default App;
