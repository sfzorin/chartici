import React from 'react';
import { PALETTES, DIAGRAM_TYPES } from '../utils/constants';
import { useNodeGroup } from '../hooks/useNodeGroup';
import { getGroupId } from '../utils/groupUtils';
import Icon from './Icons';

const TOKENS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function HUD({ 
  selectedNode, 
  selectedEdge, 
  updateSelectedNode, 
  updateSelectedEdge, 
  reverseSelectedEdge,
  updateGroupFromSelection,
  connectToNode, 
  deleteSelectedElement,
  nodesList,
  edgesList = [],
  groupsList = [],
  removeEdge,
  currentPaletteInfo,
  diagramTitle,
  setDiagramTitle,
  aspect,
  setAspect,
  paletteTheme,
  setPaletteTheme,
  diagramType,
  setDiagramType,
  bgColor,
  setBgColor
}) {
  const { groupId: nodeGroupId, group: nodeGroup } = useNodeGroup(selectedNode, groupsList);

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="properties-panel">
        <div className="properties-header">
          <span>Diagram Properties</span>
        </div>
        
        <div className="properties-section">
          <span className="properties-section-title">Diagram Header</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              className="properties-input" 
              type="text" 
              placeholder="Diagram Header..." 
              value={diagramTitle || ''} 
              onChange={e => setDiagramTitle(e.target.value)} 
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className="properties-section">
          <span className="properties-section-title">Aspect Ratio</span>
          <select 
            className="form-select" 
            value={aspect} 
            onChange={(e) => setAspect(e.target.value)}
          >
             <option value="16:9">16:9 Landscape</option>
             <option value="4:3">4:3 Landscape</option>
             <option value="1:1">1:1 Square</option>
          </select>
        </div>

        <div className="properties-section">
          <span className="properties-section-title">Background Color</span>
          <select 
            className="form-select" 
            value={bgColor} 
            onChange={(e) => setBgColor(e.target.value)}
          >
             <option value="transparent-dark">Transparent (Dark Ink)</option>
             <option value="transparent-light">Transparent (Light Ink)</option>
             <option value="white">Solid White</option>
             <option value="black">Solid Dark</option>
          </select>
        </div>

        <div className="properties-section">
          <span className="properties-section-title">Palette Theme</span>
          <select 
            className="form-select" 
            value={paletteTheme} 
            onChange={(e) => setPaletteTheme(e.target.value)}
          >
             {Object.entries(PALETTES).map(([key, val]) => (
               <option key={key} value={key}>{val.name}</option>
             ))}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '6px', marginTop: '12px' }}>
            {TOKENS.map(idx => {
              const cObj = currentPaletteInfo.colors[idx];
              return (
                <div 
                  key={idx}
                  className="color-swatch-sm"
                  style={{ 
                    backgroundColor: cObj.bg,
                    border: cObj.border ? `2px solid ${cObj.border}` : 'none',
                    boxSizing: 'border-box',
                    cursor: 'default'
                  }}
                  data-tooltip={`Color ${idx}`}
                />
              );
            })}
          </div>
        </div>

        <div className="properties-section">
          <span className="properties-section-title">Diagram Logic</span>
          <select 
            className="form-select" 
            value={diagramType} 
            onChange={(e) => setDiagramType(e.target.value)}
          >
             {DIAGRAM_TYPES.map(dt => (
               <option key={dt.id} value={dt.id}>{dt.name}</option>
             ))}
          </select>
        </div>
      </div>
    );
  }

  const renderColorMatrix = (activeValue, onChange, isOutlined = false) => {
    return (
      <div className="color-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '6px' }}>
        {TOKENS.map(idx => {
          const cObj = currentPaletteInfo.colors[idx];
          return (
            <div 
              key={idx}
              className="color-swatch-sm"
              style={{ 
                backgroundColor: isOutlined ? 'transparent' : cObj.bg,
                border: isOutlined ? `2px solid ${cObj.bg}` : (cObj.border ? `2px solid ${cObj.border}` : 'none'),
                boxSizing: 'border-box',
                outline: (!String(activeValue).startsWith('#') && Number(activeValue) === Number(idx)) ? `2px solid var(--color-text-dim)` : 'none',
                outlineOffset: '1px'
              }}
              onClick={() => onChange(idx)}
              data-tooltip={`Color ${idx}`}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="properties-panel">
      {selectedNode && (
        <>
          <div className="properties-header">
            <span>{selectedNode.id === '__SYSTEM_TITLE__' ? "Header Properties" : "Node Properties"}</span>
            <button className="btn" style={{ width: '28px', height: '28px', padding: 0, color: '#ff3b30', border: 'none', background: 'transparent' }} onClick={selectedNode.id === '__SYSTEM_TITLE__' ? () => updateSelectedNode('label', '') : deleteSelectedElement} data-tooltip={selectedNode.id === '__SYSTEM_TITLE__' ? "Clear Diagram Header" : "Delete Node"}>
              <Icon name="trash" size={16} />
            </button>
          </div>

          <div className="properties-section">
            <span className="properties-section-title">
               {selectedNode.id === '__SYSTEM_TITLE__' ? 'Diagram Header' : 'Label'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                className="properties-input" 
                type="text" 
                placeholder={selectedNode.id === '__SYSTEM_TITLE__' ? "Diagram Header..." : "Node Label"} 
                value={selectedNode.label || ''} 
                onChange={e => updateSelectedNode('label', e.target.value)} 
                style={{ width: '100%' }}
              />
            </div>
            <div className="properties-row" style={{ justifyContent: selectedNode.id === '__SYSTEM_TITLE__' ? 'flex-start' : 'space-between' }}>
              {selectedNode.id !== '__SYSTEM_TITLE__' && (
                <select className="form-select" value={selectedNode.type} onChange={(e) => updateSelectedNode('type', e.target.value)} style={{ flex: 1, minWidth: '90px' }}>
                  <option value="process">Block</option>
                  <option value="circle">Circle</option>
                  <option value="oval">Oval</option>
                  <option value="rhombus">Rhombus</option>
                  <option value="text">Text</option>
                </select>
              )}
              <select className="form-select" value={selectedNode.size || (selectedNode.id === '__SYSTEM_TITLE__' ? 'AUTO' : 'M')} onChange={(e) => updateSelectedNode('size', e.target.value)} style={{ width: '105px', flexShrink: 0 }}>
                <option value="AUTO">Auto</option>
                <option value="S">Small</option>
                <option value="M">Medium</option>
                <option value="L">Large</option>
                <option value="XL">Extra Large</option>
              </select>
              {selectedNode.type !== 'text' && (
                  <button 
                      style={{
                         background: 'transparent',
                         color: selectedNode.lockPos ? 'var(--color-text-dim)' : 'var(--color-neutral-text)',
                         border: 'none',
                         width: '28px',
                         padding: 0,
                         cursor: 'pointer',
                         height: '28px',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center'
                      }}
                      onClick={() => updateSelectedNode('lockPos', !selectedNode.lockPos)}
                      data-tooltip={selectedNode.lockPos ? "Unlock Auto-Layout" : "Lock Position (Save Coords)"}
                  >
                      {selectedNode.lockPos ? <Icon name="lock" size={16} /> : <Icon name="unlock" size={16} />}
                  </button>
              )}
            </div>
          </div>

          {selectedNode.type !== 'text' && selectedNode.type !== 'title' && (
            <div className="properties-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="properties-section-title" style={{ margin: 0 }}>Color</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button 
                        style={{
                            background: 'transparent',
                            color: nodeGroup?.outlined ? 'var(--color-text-dim)' : 'var(--color-neutral-text)',
                            border: 'none',
                            width: '28px',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: nodeGroupId ? 1 : 0.3
                        }}
                        onClick={() => {
                            updateGroupFromSelection('outlined', !nodeGroup?.outlined);
                        }}
                        data-tooltip={nodeGroup?.outlined ? "Outline Mode: On" : "Outline Mode: Off"}
                    >
                        {nodeGroup?.outlined ? (
                            <Icon name="outlined-square" size={16} />
                        ) : (
                            <Icon name="filled-square" size={16} />
                        )}
                    </button>
                    <div style={{ position: 'relative', width: '50px', height: '28px' }}>
                        {(() => {
                           const activeC = (nodeGroup && nodeGroup.color !== undefined && nodeGroup.color !== '') ? nodeGroup.color : 1;
                           const activeHex = String(activeC).startsWith('#') ? activeC : (currentPaletteInfo.colors[activeC]?.bg || '#ffffff');
                           const isHollow = nodeGroup?.outlined;
                           return (
                               <>
                                 <div style={{
                                     position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                     borderRadius: 'var(--radius-sm)',
                                     backgroundColor: isHollow ? 'transparent' : activeHex,
                                     border: isHollow ? `2px solid ${activeHex}` : 'none',
                                     pointerEvents: 'none',
                                     boxSizing: 'border-box'
                                 }} />
                                 <input 
                                     className="hud-color-picker"
                                     type="color"
                                     value={activeHex}
                                     onChange={(e) => {
                                         updateGroupFromSelection('color', e.target.value);
                                         updateGroupFromSelection('lockColor', true);
                                     }}
                                     style={{ width: '100%', height: '100%', padding: 0, border: 'none', cursor: 'pointer', opacity: 0 }}
                                     data-tooltip="Custom Hex"
                                 />
                               </>
                           );
                        })()}
                    </div>
                    <button 
                        style={{
                            background: 'transparent',
                            color: nodeGroup?.lockColor ? 'var(--color-text-dim)' : 'var(--color-neutral-text)',
                            border: 'none',
                            width: '28px',
                            padding: 0,
                            cursor: 'pointer',
                            height: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onClick={() => {
                            const isLocking = !(nodeGroup?.lockColor);
                            if (isLocking && !String(nodeGroup?.color).startsWith('#')) {
                                const resolvedHex = currentPaletteInfo.colors[nodeGroup?.color || 1]?.bg || '#ffffff';
                                updateGroupFromSelection('color', resolvedHex);
                            } else if (!isLocking && String(nodeGroup?.color).startsWith('#')) {
                                updateGroupFromSelection('color', 5);
                            }
                            updateGroupFromSelection('lockColor', isLocking);
                        }}
                        data-tooltip={nodeGroup?.lockColor ? "Unlock Automatic Palette Sync" : "Lock Color (Save Hex explicitly)"}
                    >
                        {nodeGroup?.lockColor ? <Icon name="lock" size={16} /> : <Icon name="unlock" size={16} />}
                    </button>
                </div>
            </div>
            {renderColorMatrix(
               nodeGroup?.color || 1, 
               val => { 
                  updateGroupFromSelection('color', val); 
                  updateGroupFromSelection('lockColor', false); 
               }, 
               nodeGroup?.outlined
            )}
          </div>
          )}

          {selectedNode.type !== 'text' && selectedNode.type !== 'title' && (
          <div className="properties-section">
            <span className="properties-section-title">Group</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <select 
                className="form-select" 
                value={nodeGroupId || ""}
                onChange={(e) => {
                  if (e.target.value === '___NEW___') {
                     const newId = prompt("New group Label:");
                     if (newId) {
                         const trimmedId = newId.trim();
                         updateSelectedNode('groupId', trimmedId);
                         setTimeout(() => updateSelectedNode('group', trimmedId), 0);
                     }
                  } else {
                     updateSelectedNode('groupId', e.target.value);
                     setTimeout(() => updateSelectedNode('group', e.target.value), 0);
                  }
                }}
                style={{ width: '100%' }}
              >
                 <option value="" disabled>Select Group...</option>
                 {Array.from(new Set([...groupsList.map(g => g.id), ...nodesList.map(n => getGroupId(n)).filter(Boolean)])).map(g => {
                     const gObj = groupsList.find(gx => gx.id === g);
                     const gLabel = gObj?.label || g;
                     return <option key={g} value={g}>{gLabel}</option>;
                 })}
                 <option value="___NEW___">+ Create New Group...</option>
              </select>
            </div>
          </div>
          )}
          {selectedNode.type === 'title' ? null : selectedNode.type === 'text' ? (
          <div className="properties-section">
            <span className="properties-section-title">Paired With</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedNode.bindTo ? (
                <div className="edge-list-item">
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                    Node: {nodesList.find(n => n.id === selectedNode.bindTo)?.label || selectedNode.bindTo}
                  </span>
                  <button 
                    style={{ background: 'transparent', border: 'none', color: '#ff3b30', cursor: 'pointer', padding: '4px', display: 'flex' }} 
                    onClick={() => updateSelectedNode('bindTo', null)}
                    data-tooltip="Unbind"
                  >
                    <Icon name="x" size={16} />
                  </button>
                </div>
              ) : (
                <select className="form-select" value="" onChange={(e) => connectToNode(e.target.value)}>
                  <option value="" disabled>+ Pair with block...</option>
                  {nodesList.filter(n => n.id !== selectedNode.id).map(n => (
                    <option key={n.id} value={n.id}>{n.label || n.id}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          ) : (
          <div className="properties-section">
            <span className="properties-section-title">Outgoing Links</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {edgesList.filter(e => e.from === selectedNode.id).map(edge => {
                const targetNode = nodesList.find(n => n.id === edge.to);
                return (
                  <div key={edge.id} className="edge-list-item">
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                      To: {targetNode ? (targetNode.label || targetNode.id) : edge.to}
                    </span>
                    <button style={{ background: 'transparent', border: 'none', color: '#ff3b30', cursor: 'pointer', padding: '4px', display: 'flex' }} onClick={() => removeEdge && removeEdge(edge.id)}>
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                );
              })}
              <select className="form-select" value="" onChange={(e) => connectToNode(e.target.value)}>
                <option value="" disabled>+ Add Link to...</option>
                {nodesList.filter(n => n.id !== selectedNode.id).map(n => (
                  <option key={n.id} value={n.id}>{n.label || n.id}</option>
                ))}
              </select>
            </div>
          </div>
          )}
        </>
      )}

      {selectedEdge && (
        <>
          <div className="properties-header">
            <span>Line Properties</span>
            <button className="btn" style={{ width: '28px', height: '28px', padding: 0, color: '#ff3b30', border: 'none', background: 'transparent' }} onClick={deleteSelectedElement} data-tooltip="Delete Edge">
              <Icon name="trash" size={16} />
            </button>
          </div>

          <div className="properties-section">
            <span className="properties-section-title">Label</span>
            {diagramType !== 'radial' && (
            <input 
              className="properties-input" 
              type="text" 
              placeholder="Edge Label" 
              value={selectedEdge.label || ''} 
              onChange={e => updateSelectedEdge('label', e.target.value)} 
            />
            )}
            <select className="form-select" value={selectedEdge.lineStyle || 'solid'} onChange={(e) => updateSelectedEdge('lineStyle', e.target.value)}>
              <option value="solid">Thin Line</option>
              <option value="bold">Thick Line</option>
              <option value="dashed">Thin Dashed</option>
              <option value="bold-dashed">Thick Dashed</option>
              <option value="none">Hidden (Logical)</option>
            </select>
            <select className="form-select" 
              value={selectedEdge.connectionType || selectedEdge.cardinality || selectedEdge.arrowType || 'target'} 
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'reverse') {
                  reverseSelectedEdge();
                  return;
                }
                updateSelectedEdge('connectionType', v);
                // Clear legacy fields
                updateSelectedEdge('arrowType', undefined);
                updateSelectedEdge('cardinality', undefined);
              }}>
              <option value="target">→ Arrow</option>
              <option value="reverse">← Reverse</option>
              <option value="both">↔ Both</option>
              <option value="none">— No Arrow</option>
              {diagramType === 'erd' && <>
                <option value="1:1">│─│ One to One</option>
                <option value="1:N">│─&lt; One to Many</option>
                <option value="N:1">&gt;─│ Many to One</option>
                <option value="N:M">&gt;─&lt; Many to Many</option>
              </>}
            </select>
          </div>

        </>
      )}
    </div>
  );
}
