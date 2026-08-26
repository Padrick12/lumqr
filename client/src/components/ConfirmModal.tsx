import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = 'Confirmar Acción',
  message,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  isDanger = true
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: 'var(--panel-bg, #1a1b26)',
        border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
        borderRadius: '16px',
        padding: '24px',
        width: '90%',
        maxWidth: '400px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.2s ease-out'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '40px', height: '40px',
            borderRadius: '50%',
            background: isDanger ? 'rgba(255, 51, 102, 0.1)' : 'rgba(0, 242, 254, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isDanger ? 'var(--neon-rose, #ff3366)' : 'var(--neon-blue, #00f2fe)'
          }}>
            <AlertTriangle size={20} />
          </div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>{title}</h3>
        </div>
        
        <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'var(--text-muted, #a0a0b0)', lineHeight: '1.5' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button 
            onClick={onCancel}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              background: 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '14px'
            }}
          >
            {cancelText}
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onCancel(); // Close after confirming
            }}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: isDanger ? 'var(--neon-rose, #ff3366)' : 'var(--neon-blue, #00f2fe)',
              color: isDanger ? '#fff' : '#000',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              boxShadow: isDanger ? '0 4px 12px rgba(255, 51, 102, 0.3)' : '0 4px 12px rgba(0, 242, 254, 0.3)'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
