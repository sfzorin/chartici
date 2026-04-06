import React, { useState, useImperativeHandle, forwardRef } from 'react';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import { parseCharticiFile } from '../utils/charticiFormat';
import docsContent from '../assets/user_guide.md?raw';
import sampleERD from '../assets/samples/erd_2_medium.cci?raw';
import sampleFlowchart from '../assets/samples/flowchart_2_medium.cci?raw';
import sampleMatrix from '../assets/samples/matrix_2_medium.cci?raw';
import sampleRadial from '../assets/samples/radial_2_medium.cci?raw';
import sampleSequence from '../assets/samples/sequence_2_medium.cci?raw';
import sampleTimeline from '../assets/samples/timeline_2_medium.cci?raw';
import sampleTree from '../assets/samples/tree_2_medium.cci?raw';
import charticiLogo from '../assets/chartici-logo.svg';
import mcpGuideContent from '../assets/mcp_setup_guide.md?raw';
import { promptExamples } from '../assets/prompts';

const WelcomeScreenModal = forwardRef(({ onDataLoaded }, ref) => {
    const [isVisible, setIsVisible] = useState(true);
    const [showPolicy, setShowPolicy] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [randomPrompt] = useState(() => promptExamples[Math.floor(Math.random() * promptExamples.length)]);

    useImperativeHandle(ref, () => ({
        show: () => setIsVisible(true)
    }));

    const processJson = (rawContent) => {
        try {
            const parsed = parseCharticiFile(rawContent);
            if (parsed && parsed.nodes) {
                localStorage.setItem('cookie_consent_accepted', 'true');
                setIsVisible(false);
                onDataLoaded(parsed);
                return true;
            }
        } catch (e) {
            setErrorMsg('Invalid Chartici JSON format.');
            return false;
        }
    };

    const handleLoadJson = () => {
        if (!jsonInput.trim()) {
            setErrorMsg('Please paste JSON data first.');
            return;
        }
        processJson(jsonInput);
    };

    const handleClose = () => {
        localStorage.setItem('cookie_consent_accepted', 'true');
        setIsVisible(false);
    };

    const handleDownloadDocs = (e) => {
        e.preventDefault();
        const blob = new Blob([docsContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'making-a-chart.md';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadMcpGuide = (e) => {
        e.preventDefault();
        const blob = new Blob([mcpGuideContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'chartici-mcp-setup.md';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (!isVisible) return null;

    const dim = { color: 'var(--color-text-dim)' };
    const bright = { color: 'var(--color-text-main)' };
    const stepNum = { 
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
        background: 'var(--color-bg-hover)', border: '1px solid var(--border-color-soft)', color: 'var(--color-text-main)', fontSize: '12px', fontWeight: 700
    };
    const stepRow = { display: 'flex', gap: '12px', alignItems: 'flex-start' };

    return (
        <>
        <div className="glass-overlay">
            <div className="glass-modal" style={{ position: 'relative', maxWidth: '860px' }}>
                {/* Top bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={charticiLogo} alt="Chartici" style={{ width: '28px', height: '28px', opacity: 0.8 }} />
                        <span style={{ fontSize: '14px', fontWeight: 700, ...dim, letterSpacing: '1px', textTransform: 'uppercase' }}>Chartici</span>
                    </div>
                    <button onClick={handleClose} style={{
                        background: 'none', border: 'none', ...dim, fontSize: '20px', 
                        cursor: 'pointer', lineHeight: 1, padding: '4px 8px'
                    }} data-tooltip="Close">✕</button>
                </div>

                {/* Hero */}
                <div style={{ padding: '28px 32px 20px', textAlign: 'center' }}>
                    <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, ...bright, lineHeight: 1.2 }}>
                        Describe what you need — AI builds the diagram
                    </h1>
                </div>

                {/* Body */}
                <div className="glass-body welcome-body" style={{ paddingTop: '16px' }}>
                    
                    {/* Left: Step by step */}
                    <div className="welcome-left" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: '0 0 18px 0', fontSize: '16px', fontWeight: 700, ...bright }}>Three simple steps</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div style={stepRow}>
                                <span style={stepNum}>1</span>
                                <p style={{ margin: 0, fontSize: '14px', ...dim, lineHeight: 1.5 }}>
                                    <a href="#" onClick={handleDownloadDocs} style={{ color: 'var(--color-primary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>Download this file</a> — it has everything your AI needs to build diagrams.
                                </p>
                            </div>
                            
                            <div style={stepRow}>
                                <span style={stepNum}>2</span>
                                <p style={{ margin: 0, fontSize: '14px', ...dim, lineHeight: 1.5 }}>
                                    Upload this file to ChatGPT, Deepseek, or Gemini chat.
                                </p>
                            </div>
                            
                            <div style={stepRow}>
                                <span style={stepNum}>3</span>
                                <p style={{ margin: 0, fontSize: '14px', ...dim, lineHeight: 1.5 }}>
                                    Ask: <span style={{ fontStyle: 'italic', ...dim }}>"{randomPrompt}"</span>
                                </p>
                            </div>

                        </div>


                    </div>

                    {/* Right: Paste JSON */}
                    <div className="welcome-right" style={{ display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 700, ...bright }}>Paste the result</h3>


                        
                        <textarea
                            className="glass-textarea"
                            value={jsonInput}
                            onChange={(e) => { setJsonInput(e.target.value); setErrorMsg(''); }}
                            placeholder='Paste the JSON from your AI chat here...'
                            style={{ flex: 1, minHeight: '140px' }}
                        />
                        {errorMsg && <div style={{ color: '#f87171', marginTop: '8px', fontSize: '13px', fontWeight: 500 }}>{errorMsg}</div>}
                        
                        <div style={{ marginTop: '14px' }}>
                            <button onClick={handleLoadJson} className="glass-btn-primary" style={{ 
                                width: '100%', padding: '14px 24px', fontSize: '16px', fontWeight: 700,
                                letterSpacing: '0.3px'
                            }}>
                                Render Diagram
                            </button>
                        </div>
                    </div>
                </div>

                {/* Templates Row */}
                <div style={{ padding: '0 32px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', ...dim, marginRight: '2px' }}>Examples:</span>
                    {[
                        { label: 'Flowchart', data: sampleFlowchart },
                        { label: 'Tree / Org', data: sampleTree },
                        { label: 'Sequence', data: sampleSequence },
                        { label: 'ERD', data: sampleERD },
                        { label: 'Matrix', data: sampleMatrix },
                        { label: 'Radial', data: sampleRadial },
                        { label: 'Timeline', data: sampleTimeline }
                    ].map(s => (
                        <button key={s.label} onClick={() => processJson(s.data)} style={{
                            padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                            background: 'var(--color-bg-hover)', border: '1px solid var(--border-color-soft)',
                            color: 'var(--color-text-main)', cursor: 'pointer', transition: 'all 0.15s'
                        }}>{s.label}</button>
                    ))}
                    <span style={{ marginLeft: 'auto' }}>
                        <a href="#" onClick={handleDownloadMcpGuide} style={{ fontSize: '11px', color: 'var(--color-text-dim)', textDecoration: 'underline', opacity: 0.7 }}>Download MCP Setup Guide</a>
                    </span>
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 32px', borderTop: '1px solid var(--border-color-soft)', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '11px', ...dim }}>
                        Created by <a href="https://www.linkedin.com/in/sfzorin/" target="_blank" rel="noopener noreferrer" style={{ ...bright, textDecoration: 'none', fontWeight: 600 }}>Sergey Zorin</a>
                        <span style={{ margin: '0 6px' }}>·</span>
                        <span onClick={(e) => { e.preventDefault(); setShowPolicy(true); }} style={{ textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>
                    </p>
                </div>
            </div>

            {showPolicy && <PrivacyPolicyModal onClose={() => setShowPolicy(false)} />}
        </div>
        </>
    );
});

export default WelcomeScreenModal;
