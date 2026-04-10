import React, { useState, useImperativeHandle, forwardRef } from 'react';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import { parseCharticiFile } from '../utils/charticiFormat';
import { planDiagram, buildDiagram } from '../services/aiGenerate';
import { promptExamples } from '../assets/prompts';
import charticiLogo from '../assets/chartici-logo.svg';

// Sample imports for "Examples" row
import sampleERD from '../assets/samples/erd_1_medium.cci?raw';
import sampleFlowchart from '../assets/samples/flowchart_1_medium.cci?raw';
import sampleMatrix from '../assets/samples/matrix_1_medium.cci?raw';
import sampleRadial from '../assets/samples/radial_1_medium.cci?raw';
import sampleSequence from '../assets/samples/sequence_1_medium.cci?raw';
import sampleTimeline from '../assets/samples/timeline_1_medium.cci?raw';
import sampleTree from '../assets/samples/tree_1_medium.cci?raw';
import samplePiechart from '../assets/samples/piechart_1_medium.cci?raw';

const WelcomeScreenModal = forwardRef(({ onDataLoaded }, ref) => {
    const [isVisible, setIsVisible] = useState(true);
    const [showPolicy, setShowPolicy] = useState(false);
    const [userInput, setUserInput] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [phase1Plan, setPhase1Plan] = useState(null);
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

    const handlePlan = async () => {
        if (!userInput.trim()) {
            setErrorMsg('Describe the diagram you want to create.');
            return;
        }
        setErrorMsg('');
        setIsLoading(true);
        try {
            const result = await planDiagram(userInput.trim());
            if (result.success) {
                setPhase1Plan({
                    title: result.title,
                    diagramType: result.diagramType,
                    extendedPrompt: result.extendedPrompt
                });
            } else {
                setErrorMsg(result.error);
            }
        } catch (e) {
            console.error('Plan error:', e);
            setErrorMsg('Network error — check your connection.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleBuild = async () => {
        setErrorMsg('');
        setIsLoading(true);
        try {
            const result = await buildDiagram(phase1Plan.title, phase1Plan.diagramType, phase1Plan.extendedPrompt);
            if (result.success) {
                processJson(JSON.stringify(result.cci));
            } else {
                setErrorMsg(result.error);
            }
        } catch (e) {
            console.error('Plan error:', e);
            setErrorMsg('Network error — check your connection.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
            e.preventDefault();
            if (phase1Plan) {
                handleBuild();
            } else {
                handlePlan();
            }
        }
    };

    const handleClose = () => {
        localStorage.setItem('cookie_consent_accepted', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    const dim = { color: 'var(--color-text-dim)' };
    const bright = { color: 'var(--color-text-main)' };

    return (
        <>
        <div className="glass-overlay" onClick={handleClose}>
            <div className="glass-modal" style={{ position: 'relative', maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
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
                <div style={{ padding: '28px 32px 8px', textAlign: 'center' }}>
                    <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, ...bright, lineHeight: 1.3 }}>
                        {phase1Plan ? 'Review AI Plan (Debug)' : 'Describe what you need'}
                    </h1>
                    <p style={{ margin: '8px 0 0', fontSize: '14px', ...dim, lineHeight: 1.5 }}>
                        {phase1Plan ? 'Edit the expanded prompt if needed, then confirm to build Diagram.' : 'AI will build the diagram for you'}
                    </p>
                </div>

                {/* Main input area */}
                <div style={{ padding: '20px 32px' }}>
                    {!phase1Plan ? (
                        <>
                            <div style={{ position: 'relative' }}>
                                <textarea
                                    className="glass-textarea"
                                    value={userInput}
                                    onChange={(e) => { setUserInput(e.target.value); setErrorMsg(''); }}
                                    onKeyDown={handleKeyDown}
                                    placeholder={randomPrompt}
                                    disabled={isLoading}
                                    style={{ 
                                        width: '100%', 
                                        minHeight: '100px', 
                                        resize: 'vertical',
                                        fontSize: '15px',
                                        lineHeight: 1.6,
                                        fontFamily: 'var(--font-main)',
                                        opacity: isLoading ? 0.5 : 1,
                                        transition: 'opacity 0.2s'
                                    }}
                                />
                            </div>

                            <button 
                                onClick={handlePlan} 
                                disabled={isLoading}
                                className="glass-btn-primary" 
                                style={{ 
                                    width: '100%', 
                                    padding: '14px 24px', 
                                    fontSize: '16px', 
                                    fontWeight: 700,
                                    marginTop: '14px',
                                    letterSpacing: '0.3px',
                                    opacity: isLoading ? 0.7 : 1,
                                    cursor: isLoading ? 'wait' : 'pointer'
                                }}
                            >
                                {isLoading ? (
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                        <span className="spinner" style={{
                                            display: 'inline-block', width: '16px', height: '16px', 
                                            border: '2px solid transparent', borderTopColor: 'currentColor',
                                            borderRadius: '50%', animation: 'spin 0.8s linear infinite'
                                        }} />
                                        Planning Architecture…
                                    </span>
                                ) : (
                                    'Plan Diagram'
                                )}
                            </button>
                        </>
                    ) : (
                        <>
                            <div style={{ marginBottom: '12px' }}>
                                <div style={{ fontSize: '13px', ...dim, marginBottom: '4px' }}>Title: <strong style={bright}>{phase1Plan.title}</strong></div>
                                <div style={{ fontSize: '13px', ...dim, marginBottom: '8px' }}>Type: <strong style={bright}>{phase1Plan.diagramType}</strong></div>
                                <textarea
                                    className="glass-textarea"
                                    value={phase1Plan.extendedPrompt}
                                    onChange={(e) => setPhase1Plan({...phase1Plan, extendedPrompt: e.target.value})}
                                    disabled={isLoading}
                                    style={{ 
                                        width: '100%', 
                                        minHeight: '200px', 
                                        resize: 'vertical',
                                        fontSize: '13px',
                                        lineHeight: 1.5,
                                        fontFamily: 'monospace',
                                        opacity: isLoading ? 0.5 : 1,
                                        transition: 'opacity 0.2s'
                                    }}
                                />
                            </div>

                            <button 
                                onClick={handleBuild} 
                                disabled={isLoading}
                                className="glass-btn-primary" 
                                style={{ 
                                    width: '100%', 
                                    padding: '14px 24px', 
                                    fontSize: '16px', 
                                    fontWeight: 700,
                                    marginTop: '6px',
                                    letterSpacing: '0.3px',
                                    opacity: isLoading ? 0.7 : 1,
                                    cursor: isLoading ? 'wait' : 'pointer'
                                }}
                            >
                                {isLoading ? (
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                        <span className="spinner" style={{
                                            display: 'inline-block', width: '16px', height: '16px', 
                                            border: '2px solid transparent', borderTopColor: 'currentColor',
                                            borderRadius: '50%', animation: 'spin 0.8s linear infinite'
                                        }} />
                                        Building Structure…
                                    </span>
                                ) : (
                                    'Confirm & Build Diagram'
                                )}
                            </button>

                            <button 
                                onClick={() => setPhase1Plan(null)} 
                                disabled={isLoading} 
                                style={{ 
                                    background: 'none', border: 'none', color: 'var(--color-text-dim)', 
                                    cursor: 'pointer', marginTop: '12px', fontSize: '13px', width: '100%' 
                                }}
                            >
                                ← Back to edit request
                            </button>
                        </>
                    )}

                    {errorMsg && (
                        <div style={{ 
                            color: '#f87171', marginTop: '10px', fontSize: '13px', fontWeight: 500,
                            padding: '8px 12px', background: 'rgba(248, 113, 113, 0.1)', borderRadius: '8px'
                        }}>
                            {errorMsg}
                        </div>
                    )}

                    {isLoading && (
                        <p style={{ margin: '14px 0 0', fontSize: '12px', ...dim, textAlign: 'center' }}>
                            AI is thinking — this may take up to a minute
                        </p>
                    )}
                </div>

                {/* Examples Row */}
                <div style={{ padding: '0 32px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', ...dim, marginRight: '2px' }}>Examples:</span>
                    {[
                        { label: 'Flowchart', data: sampleFlowchart },
                        { label: 'Tree / Org', data: sampleTree },
                        { label: 'Sequence', data: sampleSequence },
                        { label: 'ERD', data: sampleERD },
                        { label: 'Matrix', data: sampleMatrix },
                        { label: 'Radial', data: sampleRadial },
                        { label: 'Timeline', data: sampleTimeline },
                        { label: 'Pie Chart', data: samplePiechart }
                    ].map(s => (
                        <button key={s.label} onClick={() => processJson(s.data)} style={{
                            padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                            background: 'var(--color-bg-hover)', border: '1px solid var(--border-color-soft)',
                            color: 'var(--color-text-main)', cursor: 'pointer', transition: 'all 0.15s'
                        }}>{s.label}</button>
                    ))}
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
