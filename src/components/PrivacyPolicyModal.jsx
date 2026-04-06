import React from 'react';

const PrivacyPolicyModal = ({ onClose }) => {
    return (
        <div className="glass-overlay" onClick={onClose}>
            <div className="glass-modal" style={{ maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="glass-header left-aligned" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        European Privacy Policy & Data Consent
                    </h2>
                    <button 
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-main)', cursor: 'pointer', padding: '4px' }}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Body scrollable area */}
                <div className="glass-body">
                    <div style={{ color: 'var(--color-text-dim)', fontSize: '15px', lineHeight: '1.6' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--color-text-main)', fontSize: '18px' }}>1. Introduction</h3>
                        <p>We are committed to protecting your privacy and ensuring that your personal information is collected and processed transparently and lawfully, in compliance with the General Data Protection Regulation (GDPR) and the ePrivacy Directive.</p>
                        
                        <h3 style={{ marginTop: '24px', color: 'var(--color-text-main)', fontSize: '18px' }}>2. Data Architecture (Client-Side First)</h3>
                        <p>By using this diagramming tool, all data manipulation and diagram rendering happen <strong>locally in your browser</strong>. We do not transmit or store your diagram content (nodes, edges, text) on our servers. Your intellectual property remains locally on your device at all times.</p>
                        
                        <h3 style={{ marginTop: '24px', color: 'var(--color-text-main)', fontSize: '18px' }}>3. What storage do we use?</h3>
                        <p>We use the following types of storage:</p>
                        <ul style={{ paddingLeft: '24px' }}>
                            <li style={{ marginBottom: '8px' }}><strong>Strictly Necessary LocalStorage:</strong> These are essential for the operation of our application. They include storing your diagram configurations, user interface theme preferences (Light/Dark mode), and local layout calculations.</li>
                            <li><strong>Zero Analytics:</strong> We currently employ absolutely zero tracking cookies, advertising scripts, or behavior analysis tools.</li>
                        </ul>

                        <h3 style={{ marginTop: '24px', color: 'var(--color-text-main)', fontSize: '18px' }}>4. Your GDPR Rights</h3>
                        <p>Under the GDPR, you have the right to access, rectify, port, and erase your data. Since our core application is fully client-side relying entirely on browser LocalStorage, you can exercise your right to erasure simply by clearing your browser site data.</p>
                        
                        <p style={{ marginTop: '32px', fontSize: '13px', color: 'var(--color-text-dim)' }}>Last Updated: Q2 2026</p>
                    </div>
                </div>
                
                {/* Footer */}
                <div className="glass-footer">
                    <button className="glass-btn-primary" onClick={onClose} style={{ width: '100%' }}>
                        I Understand
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyModal;
