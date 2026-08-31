import { useState, useEffect } from 'react';

export const getDemoMode = (): boolean => {
  const saved = localStorage.getItem('stg_demo_mode');
  // Default to true (Demo Presentation Mode) as requested by user
  return saved === null ? true : saved === 'true';
};

export const setDemoMode = (enabled: boolean): void => {
  localStorage.setItem('stg_demo_mode', enabled ? 'true' : 'false');
  window.dispatchEvent(new Event('stg_demo_mode_changed'));
};

export const useDemoMode = () => {
  const [isDemo, setIsDemoState] = useState<boolean>(getDemoMode);

  useEffect(() => {
    const handleUpdate = () => setIsDemoState(getDemoMode());
    window.addEventListener('stg_demo_mode_changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('stg_demo_mode_changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const toggleDemoMode = (enabled: boolean) => {
    setDemoMode(enabled);
  };

  return [isDemo, toggleDemoMode] as const;
};
