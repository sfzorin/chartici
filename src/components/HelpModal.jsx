import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import docsContent from '../assets/user_guide.md?raw';

export default function HelpModal({ onClose }) {
  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleDownload = () => {
    const blob = new Blob([docsContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'chartici_implementation_guide.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-overlay" onClick={onClose}>
      <div 
        className="glass-modal"
        style={{ height: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="glass-header left-aligned" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            CHARTICI Documentation
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="glass-btn-primary" onClick={handleDownload} style={{ padding: '8px 16px', fontSize: '14px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', marginBottom: '-2px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download .md
            </button>
            <button 
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text-main)', cursor: 'pointer', padding: '4px' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        {/* Body Area */}
        <div className="glass-body" style={{ flex: 1, padding: '32px 48px' }}>
          <div className="markdown-content" style={{ color: 'var(--color-text-main)' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {docsContent}
            </ReactMarkdown>
          </div>
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          .markdown-content h1 { font-size: 28px; margin-top: 0; color: var(--color-text-main); }
          .markdown-content h2 { font-size: 22px; margin-top: 32px; border-bottom: 1px solid var(--border-color-soft); padding-bottom: 8px; color: var(--color-text-main); }
          .markdown-content h3 { font-size: 18px; margin-top: 24px; color: var(--color-text-main); }
          .markdown-content p { line-height: 1.6; color: var(--color-text-dim); }
          .markdown-content code { background: var(--glass-input-bg); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; color: var(--color-text-main); border: 1px solid var(--glass-border); }
          .markdown-content pre { background: var(--glass-input-bg); padding: 16px; border-radius: 8px; overflow-x: auto; border: 1px solid var(--glass-border); }
          .markdown-content pre code { background: transparent; padding: 0; border: none; color: var(--color-brand); }
          .markdown-content ul, .markdown-content ol { padding-left: 24px; color: var(--color-text-dim); line-height: 1.6; }
          .markdown-content li { margin-bottom: 8px; }
          .markdown-content blockquote { border-left: 4px solid var(--color-brand); margin: 0; padding-left: 16px; color: var(--color-text-dim); font-style: italic; background: rgba(189,53,93,0.05); padding: 12px 16px; border-radius: 0 8px 8px 0; }
          .markdown-content table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          .markdown-content th, .markdown-content td { border: 1px solid var(--border-color-soft); padding: 8px 12px; text-align: left; }
          .markdown-content th { background: var(--ui-bg-surface); color: var(--color-text-main); }
        `}} />
      </div>
    </div>
  );
}
