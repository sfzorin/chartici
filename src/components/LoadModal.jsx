import { useState } from 'react';

export default function LoadModal({ onClose, onLoad, setDialogConfig }) {
  const [projects, setProjects] = useState(() => {
    try {
      const stored = localStorage.getItem('diagram_projects');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load projects", e);
      return [];
    }
  });

  const handleDelete = (id) => {
    if (setDialogConfig) {
      setDialogConfig({
        type: 'confirm',
        title: 'Delete Project',
        message: 'Are you sure you want to delete this cached project?',
        onConfirm: () => {
          const updated = projects.filter(p => p.id !== id);
          setProjects(updated);
          localStorage.setItem('diagram_projects', JSON.stringify(updated));
          setDialogConfig(null);
        },
        onCancel: () => setDialogConfig(null)
      });
    } else {
      // Fallback
      if (window.confirm("Are you sure you want to delete this cached project?")) {
        const updated = projects.filter(p => p.id !== id);
        setProjects(updated);
        localStorage.setItem('diagram_projects', JSON.stringify(updated));
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Load from Cache</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          {projects.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--color-secondary)', padding: '24px 0' }}>
              <p>No diagrams saved in browser cache.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {projects.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border-color-soft)', borderRadius: '4px', backgroundColor: 'var(--ui-bg-surface)' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>{p.name}</h3>
                    <div style={{ fontSize: '11px', color: 'var(--color-secondary)' }}>
                      Saved: {new Date(p.timestamp).toLocaleString()} • Nodes: {p.data.nodes?.length || 0}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary" style={{ padding: '4px 12px', height: '28px', fontSize: '12px' }} onClick={() => { onLoad(p.data); onClose(); }}>
                      Load
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '4px 12px', height: '28px', fontSize: '12px', color: '#ff3b30' }} onClick={() => handleDelete(p.id)} data-tooltip="Delete Cache">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
