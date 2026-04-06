import React, { useState, useEffect } from 'react';

export default function DialogModal({
  type = 'alert', // 'alert' | 'confirm' | 'prompt'
  title,
  message,
  defaultValue = '',
  onConfirm,
  onCancel,
}) {
  const [inputValue, setInputValue] = useState(defaultValue);

  useEffect(() => {
    if (type === 'prompt') {
      const input = document.getElementById('dialog-prompt-input');
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [type]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (type === 'prompt' && !inputValue.trim()) return;
    if (onConfirm) onConfirm(type === 'prompt' ? inputValue : undefined);
  };

  return (
    <div className="glass-overlay" onClick={onCancel}>
      <div className="glass-modal sm" onClick={e => e.stopPropagation()}>
        <div className="glass-header left-aligned" style={{ flexDirection: 'row', justifyContent: 'space-between', padding: '24px' }}>
          <h2 style={{ fontSize: '18px' }}>{title}</h2>
          <button className="modal-close" onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-dim)', cursor: 'pointer', padding: '4px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="glass-body" style={{ padding: '24px' }}>
            {message && (
              <p style={{ margin: 0, color: 'var(--color-text-dim)' }}>{message}</p>
            )}
            
            {type === 'prompt' && (
              <input 
                id="dialog-prompt-input"
                type="text" 
                className="glass-textarea" 
                value={inputValue} 
                onChange={e => setInputValue(e.target.value)} 
                placeholder="Enter value..."
                autoComplete="off"
                style={{ minHeight: '40px', resize: 'none', marginTop: '12px', padding: '12px' }}
              />
            )}
          </div>

          <div className="glass-footer">
            {type !== 'alert' && (
              <button type="button" className="glass-btn-secondary" onClick={onCancel} style={{ padding: '12px 24px' }}>Cancel</button>
            )}
            <button 
              type="submit" 
              className={type === 'alert' ? 'glass-btn-secondary' : 'glass-btn-primary'}
              disabled={type === 'prompt' && !inputValue.trim()}
              style={{ padding: '12px 24px', opacity: (type === 'prompt' && !inputValue.trim()) ? 0.5 : 1 }}
            >
              {type === 'alert' ? 'OK' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
