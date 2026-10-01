import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  private handleReload = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (const reg of regs) {
          reg.unregister();
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then(names => {
        for (const name of names) caches.delete(name);
      });
    }
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#060913',
          color: '#fff',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            maxWidth: '460px',
            width: '100%',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: '#ef4444'
            }}>
              <AlertTriangle size={32} />
            </div>

            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 800 }}>
              Actualización de Sistema
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
              Se ha detectado una nueva versión del sistema en el servidor. Por favor presione el botón para sincronizar los cambios.
            </p>

            <button
              onClick={this.handleReload}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                border: 'none',
                borderRadius: '10px',
                color: '#060913',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)'
              }}
            >
              <RefreshCw size={18} />
              Actualizar y Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
