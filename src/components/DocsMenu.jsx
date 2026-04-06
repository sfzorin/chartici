import { useState, useRef, useEffect } from 'react';

export default function DocsMenu({ onSelectTab }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAction = (tabName) => {
    setIsOpen(false);
    onSelectTab(tabName);
  };

  return (
    <div className="file-menu-container" ref={menuRef} style={{ position: 'relative' }}>
      <button 
        className="btn btn-secondary file-menu-btn" 
        onClick={() => setIsOpen(!isOpen)}
        style={{ border: 'none', background: isOpen ? 'var(--color-bg-base)' : 'transparent', fontWeight: 'bold', fontSize: '14px', padding: '6px 12px' }}
      >
        Docs
      </button>

      {isOpen && (
        <div className="file-menu-dropdown">
          <div className="file-menu-item" onClick={() => handleAction('about')}>
            <span>ℹ️</span> About CHARTICI
          </div>
          <div className="file-menu-item" onClick={() => handleAction('xml')}>
            <span>📝</span> .cci format
          </div>
        </div>
      )}
    </div>
  );
}
