import React, { useState, useRef, useEffect } from 'react';
import { PALETTES } from '../diagram/colors.js';
import { LINE_STYLE_REGISTRY, ARROW_TYPE_REGISTRY } from '../diagram/edges.js';
import { NODE_REGISTRY } from '../diagram/nodes.jsx';
import { DIAGRAM_TYPES, DIAGRAM_SCHEMAS } from '../utils/diagramSchemas';
import { useNodeGroup } from '../hooks/useNodeGroup';
import { getGroupId } from '../utils/groupUtils';
import Icon from './Icons';

// --- Popover helper component ---
function PopoverMenu({ isOpen, onClose, anchorRef, children, side = 'right' }) {
  const popoverRef = useRef(null);
  const [topPos, setTopPos] = useState(0);

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      let top = anchorRef.current.offsetTop;
      setTopPos(top);

      setTimeout(() => {
         if (popoverRef.current) {
             const rect = popoverRef.current.getBoundingClientRect();
             const overflow = rect.bottom - window.innerHeight;
             if (overflow > 0) {
                 setTopPos(prev => prev - overflow - 12);
             }
         }
      }, 0);
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(e.target) &&
        anchorRef.current && 
        !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className={`toolbox-popover popover-${side}`}
      style={{ top: topPos + 'px' }}
    >
      {children}
    </div>
  );
}

export default function LeftToolbox({ 
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
  diagramType,
  bgColor,
  onChangeBgColor,
  aspect,
  onChangeAspect,
  onAddNode,
  paletteTheme,
  onChangeTheme,
  zoomIn,
  zoomOut,
  zoomFit,
  onAutoLayout,
  activeLinkSource,
  toggleConnectionMode,
  setDiagramType
}) {
  const { groupId: nodeGroupId, group: nodeGroup } = useNodeGroup(selectedNode, groupsList);

  const [activePopover, setActivePopover] = useState(null); // 'add', 'shape', 'color', 'size', 'label', 'edge-style', 'edge-type', 'group'
  
  // Refs for anchors
  const addBtnRef = useRef(null);
  const shapeBtnRef = useRef(null);
  const sizeBtnRef = useRef(null);
  const colorBtnRef = useRef(null);
  const groupBtnRef = useRef(null);
  const labelBtnRef = useRef(null);
  const lockBtnRef = useRef(null);
  const edgeStyleBtnRef = useRef(null);
  const edgeArrowBtnRef = useRef(null);
  const layoutBtnRef = useRef(null);
  const bgBtnRef = useRef(null);

  const togglePopover = (id) => {
    setActivePopover(prev => prev === id ? null : id);
  };

  // Иконка формы ноды — берётся из NODE_REGISTRY
  const getShapeIcon = (type) => NODE_REGISTRY[type]?.icon || 'shape-rect';

  const mockNode = { type: 'process', size: 'M', color: 1, lockPos: false, id: '' };
  const mockEdge = { lineStyle: 'solid', connectionType: 'target', label: '' };
  const nContext = selectedNode || mockNode;
  const eContext = selectedEdge || mockEdge;
  
  const currentCt = eContext.connectionType; // ERD cardinality only
  const currentAt = eContext.arrowType || eContext.connectionType || 'target'; // arrow direction

  const isTitle = selectedNode?.type === 'title' || selectedNode?.id === '__SYSTEM_TITLE__';

  const isShapeToolActive  = !!selectedNode && !isTitle;
  const isSizeToolActive   = !!selectedNode;
  const isColorToolActive  = !!selectedNode && !isTitle;
  const diagramSchema = DIAGRAM_SCHEMAS[diagramType] || DIAGRAM_SCHEMAS.flowchart;
  const isEdgeToolActive   = !!selectedEdge && diagramSchema.features.allowConnections;
  const isLabelActive      = !!selectedNode || (!!selectedEdge && eContext.lineStyle !== 'none');
  const isLockActive       = !!selectedNode && selectedNode.type !== 'text' && !isTitle;
  const isConnectActive    = !!selectedNode && !isTitle && diagramSchema.features.allowConnections;
  const isGroupToolActive  = !!selectedNode && !isTitle;
  const isTrashActive      = !!(selectedNode || selectedEdge);

  const enforceMax = diagramSchema?.features?.enforceMaxNodes;
  const isAddDisabled = enforceMax && Array.isArray(nodesList) && nodesList.filter(n => n.id !== '__SYSTEM_TITLE__').length >= enforceMax;

  const matchedGroup = groupsList?.find(g => g.id === getGroupId(nContext));
  const isOutlined = matchedGroup?.outlined || false;

  const getStyle = (isActive) => ({ opacity: isActive ? 1 : 0.3, pointerEvents: isActive ? 'auto' : 'none' });

  const getDiagramIcon = (type) => {
    const t = (type || 'flowchart').toLowerCase();
    switch (t) {
        case 'timeline': return 'layout-timeline';
        case 'piechart': return 'layout-piechart';
        case 'sequence': return 'layout-sequence';
        case 'tree': return 'layout-tree';
        case 'radial': return 'layout-radial';
        case 'matrix': return 'layout-matrix';
        case 'erd': return 'layout-erd';
        case 'array': return 'layout-array';
        default: return 'layout-flowchart';
    }
  };

  return (
    <div className="left-toolbox-container">
      <div className="toolbox-panel" style={{ gap: 8 }}>
        
        {/* --- 0. CREATE NODE --- */}
        <button 
          ref={addBtnRef}
          className="toolbox-btn" 
          style={{ background: isAddDisabled ? '#888' : '#be355d', color: '#ffffff', borderRadius: '50%', border: 'none', opacity: isAddDisabled ? 0.3 : 1, pointerEvents: isAddDisabled ? 'none' : 'auto' }}
          onClick={() => togglePopover('add')}
          data-tooltip={isAddDisabled ? "Max 9 slices reached" : "Add New Element"}
        >
          <Icon name="plus" size={24} />
        </button>

        <PopoverMenu isOpen={activePopover === 'add'} onClose={() => setActivePopover(null)} anchorRef={addBtnRef}>
          <div className="popover-title">Create Node</div>
          <div className="popover-grid">
             {(!diagramTitle || diagramTitle.trim() === '') && <button onClick={() => { setDiagramTitle('Diagram Header'); setActivePopover(null); }}><Icon name="text-shape" /> Header</button>}
             {diagramSchema.allowedNodes.includes('process') && <button onClick={() => { onAddNode('process'); setActivePopover(null); }}><Icon name="shape-rect" /> Block</button>}
             {diagramSchema.allowedNodes.includes('circle') && <button onClick={() => { onAddNode('circle'); setActivePopover(null); }}><Icon name="shape-circle" /> Circle</button>}
             {diagramSchema.allowedNodes.includes('oval') && <button onClick={() => { onAddNode('oval'); setActivePopover(null); }}><Icon name="shape-oval" /> Oval</button>}
             {diagramSchema.allowedNodes.includes('rhombus') && <button onClick={() => { onAddNode('rhombus'); setActivePopover(null); }}><Icon name="shape-diamond" /> Rhombus</button>}
             <button onClick={() => { onAddNode('text'); setActivePopover(null); }}><Icon name="text-shape" /> Text</button>
             {diagramSchema.allowedNodes.includes('chevron') && <button onClick={() => { onAddNode('chevron'); setActivePopover(null); }}><Icon name="shape-chevron" /> Chevron</button>}
             {diagramSchema.allowedNodes.includes('pie_slice') && <button onClick={() => { onAddNode('pie_slice'); setActivePopover(null); }}><Icon name="shape-slice" /> Slice</button>}
          </div>
        </PopoverMenu>

        {/* --- 1. TOP: Context Tools --- */}
        <div className="toolbox-section">
          
          {/* NODE TOOLS (Shape, Size, Color) */}
          <div className="toolbox-section">
            {/* Shape Selection */}
            <div style={{ display: 'inline-block', ...getStyle(isShapeToolActive) }}>
              <button ref={shapeBtnRef} className="toolbox-btn" onClick={() => togglePopover('shape')} data-tooltip="Change Shape">
                <Icon name={getShapeIcon(nContext.type)} size={24} />
              </button>
              <PopoverMenu isOpen={activePopover === 'shape'} onClose={() => setActivePopover(null)} anchorRef={shapeBtnRef}>
                <div className="popover-title">Shape Type</div>
                <div className="popover-list">
                   {diagramSchema.allowedNodes.includes('process') && <button className={nContext.type === 'process' ? 'active' : ''} onClick={() => { updateSelectedNode('type', 'process'); setActivePopover(null); }}><Icon name="shape-rect" /> Block</button>}
                   {diagramSchema.allowedNodes.includes('circle') && <button className={nContext.type === 'circle' ? 'active' : ''} onClick={() => { updateSelectedNode('type', 'circle'); setActivePopover(null); }}><Icon name="shape-circle" /> Circle</button>}
                   {diagramSchema.allowedNodes.includes('oval') && <button className={nContext.type === 'oval' ? 'active' : ''} onClick={() => { updateSelectedNode('type', 'oval'); setActivePopover(null); }}><Icon name="shape-oval" /> Oval</button>}
                   {diagramSchema.allowedNodes.includes('rhombus') && <button className={nContext.type === 'rhombus' ? 'active' : ''} onClick={() => { updateSelectedNode('type', 'rhombus'); setActivePopover(null); }}><Icon name="shape-diamond" /> Rhombus</button>}
                   <button className={nContext.type === 'text' ? 'active' : ''} onClick={() => { updateSelectedNode('type', 'text'); setActivePopover(null); }}><Icon name="text-shape" /> Text</button>
                   {diagramSchema.allowedNodes.includes('chevron') && <button className={nContext.type === 'chevron' ? 'active' : ''} onClick={() => { updateSelectedNode('type', 'chevron'); setActivePopover(null); }}><Icon name="shape-chevron" /> Chevron</button>}
                   {diagramSchema.allowedNodes.includes('pie_slice') && <button className={nContext.type === 'pie_slice' ? 'active' : ''} onClick={() => { updateSelectedNode('type', 'pie_slice'); setActivePopover(null); }}><Icon name="shape-slice" /> Slice</button>}
                </div>
              </PopoverMenu>
            </div>


            {/* Size Selection */}
            <div style={{ display: 'inline-block', ...getStyle(isSizeToolActive) }}>
              <button ref={sizeBtnRef} className="toolbox-btn" onClick={() => togglePopover('size')} data-tooltip="Change Size">
                <Icon name="size" size={20} textValue={nContext.size === 'AUTO' ? 'M' : (nContext.size || 'M')} />
              </button>
              <PopoverMenu isOpen={activePopover === 'size'} onClose={() => setActivePopover(null)} anchorRef={sizeBtnRef}>
                <div className="popover-title">Node Size</div>
                <div className="popover-list">
                  {Object.keys(NODE_REGISTRY[nContext.type]?.sizes || NODE_REGISTRY.process.sizes).map(s => {
                    const labels = { S: 'Small', M: 'Medium', L: 'Large' };
                    return (
                      <button key={s} className={(nContext.size === s || (!nContext.size && s === 'M') || (nContext.size === 'AUTO' && s === 'M')) ? 'active' : ''} onClick={() => { updateSelectedNode('size', s); setActivePopover(null); }}>
                        {labels[s]}
                      </button>
                    );
                  })}
                </div>
              </PopoverMenu>
            </div>

            {/* Color Selection */}
            <div style={{ display: 'inline-block', ...getStyle(isColorToolActive) }}>
              <button ref={colorBtnRef} className="toolbox-btn" onClick={() => togglePopover('color')} data-tooltip="Change Color / Style">
                <div>
                  <Icon name="palette" size={24} />
                </div>
              </button>
            <PopoverMenu isOpen={activePopover === 'color'} onClose={() => setActivePopover(null)} anchorRef={colorBtnRef}>
              <div className="popover-title">Color Palette</div>
              <div className="popover-color-grid">
                {[1,2,3,4,5,6,7,8,9].map(t => (
                    <button 
                       key={`color-${t}`}
                       className={`color-swatch ${nContext.color === t ? 'selected' : ''}`}
                       style={{ 
                          background: isOutlined ? 'transparent' : (currentPaletteInfo?.colors?.[t]?.bg || '#ccc'),
                          border: `2px solid ${currentPaletteInfo?.colors?.[t]?.bg || '#ccc'}`
                       }}
                       onClick={() => updateSelectedNode('color', t)}
                    />
                ))}
              </div>
              <div className="toolbox-divider" style={{ margin: '8px 0' }} />
              
              {/* Custom hex color */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', marginTop: '4px' }}>
                 <input 
                    type="color" 
                    value={typeof nContext.color === 'string' && nContext.color.startsWith('#') ? nContext.color : (currentPaletteInfo?.colors?.[nContext.color]?.bg || '#333333')} 
                    onChange={(e) => updateSelectedNode('color', e.target.value)}
                    style={{ width: '32px', height: '32px', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: 0, outline: 'none', background: 'transparent' }}
                 />
                 <input
                     type="text"
                     value={typeof nContext.color === 'string' ? nContext.color : (currentPaletteInfo?.colors?.[nContext.color]?.bg || '#333333')}
                     onChange={(e) => updateSelectedNode('color', e.target.value)}
                     style={{ 
                         flex: 1, height: '32px', fontSize: '13px', fontFamily: 'monospace', padding: '0 8px', 
                         border: '1px solid var(--border-color-soft)', borderRadius: '6px', 
                         outline: 'none', background: 'var(--bg-panel)', color: 'var(--color-text-main)' 
                     }}
                 />
              </div>

              {/* Outline Style toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '12px', gap: '8px' }} onClick={() => updateGroupFromSelection('outlined', !isOutlined)}>
                 <span style={{ fontSize: '12px', fontWeight: 600, color: isOutlined ? 'var(--color-text-main)' : 'var(--color-secondary)' }}>Outlined</span>
                 <div 
                   style={{
                      width: '36px', height: '20px', borderRadius: '10px', 
                      background: 'transparent',
                      border: '2px solid var(--border-color-soft)',
                      position: 'relative', transition: '0.2s', boxSizing: 'border-box'
                   }}
                 >
                   <div style={{
                      width: '12px', height: '12px', borderRadius: '50%', background: 'var(--color-secondary)',
                      position: 'absolute', top: '2px', left: isOutlined ? '2px' : '18px',
                      transition: '0.2s'
                   }} />
                 </div>
                 <span style={{ fontSize: '12px', fontWeight: 600, color: !isOutlined ? 'var(--color-text-main)' : 'var(--color-secondary)' }}>Filled</span >
              </div>

              <div className="toolbox-divider" style={{ margin: '8px 0' }} />
              
              {/* Theme Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                 <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-secondary)', textTransform: 'uppercase' }}>Color Theme</label>
                 <select 
                    value={paletteTheme} 
                    onChange={e => onChangeTheme(e.target.value)}
                    className="popover-input"
                    style={{ fontSize: '13px', cursor: 'pointer' }}
                 >
                    {Object.keys(PALETTES).map(pKey => (
                       <option key={pKey} value={pKey}>{PALETTES[pKey].name}</option>
                    ))}
                 </select>
              </div>
            </PopoverMenu>
            </div>

            {/* Group Selection */}
            <div style={{ display: 'inline-block', ...getStyle(isGroupToolActive) }}>
              <button ref={groupBtnRef} className="toolbox-btn" onClick={() => togglePopover('group')} data-tooltip="Manage Group">
                <Icon name="layers" size={24} />
              </button>
            <PopoverMenu isOpen={activePopover === 'group'} onClose={() => setActivePopover(null)} anchorRef={groupBtnRef}>
              <div className="popover-title">Group Label</div>
              <div className="popover-list" style={{ width: '220px' }}>
                 
                 {/* Input for Current Group Label */}
                 <div style={{ padding: '0 4px 8px 4px' }}>
                    <input 
                       className="popover-input"
                       type="text" 
                       placeholder="Group Label..."
                       value={nodeGroup?.label || ''} 
                       onChange={(e) => updateGroupFromSelection('label', e.target.value)}
                       style={{ fontSize: '13px', padding: '6px', width: '100%', boxSizing: 'border-box' }}
                    />
                 </div>
                 
                 <div className="toolbox-divider" style={{ margin: '0 0 4px 0' }} />

                 <button onClick={() => { 
                    updateSelectedNode('groupId', `g_${Date.now()}`); 
                    // Do not close popover, so user can immediately type the name in the input above
                 }}>
                    <Icon name="plus" size={14} /> <span style={{fontWeight: 600}}>Detach (New Group)</span>
                 </button>
                 {groupsList.length > 0 && <div className="toolbox-divider" />}
                 
                 <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                     {groupsList.map(g => {
                        const isCurrent = nContext.groupId === g.id;
                        const colorValue = currentPaletteInfo?.colors?.[g.color || 1]?.bg || '#ccc';
                        
                        if (g.type === 'text') {
                           return (
                             <button key={g.id} className={isCurrent ? 'active' : ''} onClick={() => { 
                                 if (!isCurrent) updateSelectedNode('groupId', g.id); 
                                 setActivePopover(null); 
                             }}>
                                <div style={{ width: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                   <span style={{ 
                                      color: 'var(--color-text-main)', fontWeight: 900, fontSize: '14px', lineHeight: 1
                                   }}>T</span>
                                </div>
                                {g.label || 'Unnamed Group'}
                             </button>
                           );
                        }

                        let shapeStyle = { 
                           flexShrink: 0, 
                           display: 'inline-block',
                           boxSizing: 'border-box'
                        };

                        switch (g.type) {
                           case 'circle':
                              shapeStyle.width = '12px'; shapeStyle.height = '12px'; shapeStyle.borderRadius = '50%';
                              break;
                           case 'oval':
                              shapeStyle.width = '16px'; shapeStyle.height = '10px'; shapeStyle.borderRadius = '10px';
                              break;
                           case 'rhombus':
                              shapeStyle.width = '10px'; shapeStyle.height = '10px'; shapeStyle.transform = 'rotate(45deg)'; shapeStyle.margin = '0 2px'; shapeStyle.borderRadius = '2px';
                              break;
                           case 'process':
                           default:
                              shapeStyle.width = '16px'; shapeStyle.height = '12px'; shapeStyle.borderRadius = '2px';
                              break;
                        }

                        if (g.outlined) {
                           shapeStyle.border = `3px solid ${colorValue}`;
                           shapeStyle.background = 'transparent';
                        } else {
                           shapeStyle.background = colorValue;
                           shapeStyle.border = '1px solid var(--color-text-dim)'; // High contrast border adapting to light/dark themes
                        }

                        return (
                          <button key={g.id} className={isCurrent ? 'active' : ''} onClick={() => { 
                              if (!isCurrent) updateSelectedNode('groupId', g.id); 
                              setActivePopover(null); 
                          }}>
                             <div style={{ width: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <span className="color-indicator" style={shapeStyle} />
                             </div>
                             {g.label || 'Unnamed Group'}
                          </button>
                        );
                     })}
                 </div>
              </div>
            </PopoverMenu>
            </div>{/* /isGroupToolActive wrapper */}
          </div>{/* /toolbox-section node tools */}


          {/* EDGE TOOLS (Style & Arrows) */}
          <div className="toolbox-section" style={getStyle(isEdgeToolActive)}>
            <button ref={edgeStyleBtnRef} className="toolbox-btn" onClick={() => togglePopover('edgestyle')} data-tooltip="Line Style & Arrows">
              <Icon name="edge-style" size={24} />
            </button>
            <PopoverMenu isOpen={activePopover === 'edgestyle'} onClose={() => setActivePopover(null)} anchorRef={edgeStyleBtnRef}>
              <div className="popover-title">Line Style</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '0 8px 8px' }}>
                 {(diagramSchema.allowedLineStyles || [])
                    .map(style => {
                    // Параметры отображения — из LINE_STYLE_REGISTRY
                    const lsDef = LINE_STYLE_REGISTRY[style] || {};
                    const dash  = lsDef.dashArray   ?? 'none';
                    const sw    = lsDef.strokeWidth ?? 2;
                    return (
                       <button 
                         key={style} 
                         className={`toolbox-btn ${eContext.lineStyle === style ? 'active' : ''}`}
                         style={{ 
                            width: '100%', height: '32px', padding: 0,
                            background: eContext.lineStyle === style ? 'var(--color-bg-active)' : 'var(--bg-panel)',
                            border: `1px solid ${eContext.lineStyle === style ? 'var(--color-brand)' : 'var(--border-color-soft)'}`
                         }}
                         onClick={() => {
                            updateSelectedEdge('lineStyle', style);
                            if (style === 'none' && (
                                currentCt === 'none' ||
                                currentCt === 'both' ||
                                currentCt.includes(':')
                            )) {
                               updateSelectedEdge('connectionType', 'target');
                               if (eContext.cardinality) updateSelectedEdge('cardinality', null);
                               if (eContext.arrowType) updateSelectedEdge('arrowType', null);
                            }
                         }}
                       >
                          {style === 'none' ? <span style={{fontSize: '11px', fontWeight: 600}}>None</span> : (
                             <svg width="40" height="12" viewBox="0 0 40 12">
                               <line x1="2" y1="6" x2="38" y2="6" stroke="currentColor" strokeWidth={sw} strokeDasharray={dash} strokeLinecap="square" />
                             </svg>
                          )}
                       </button>
                    )
                 })}
              </div>
              <div className="toolbox-divider" style={{ margin: '8px 0' }} />
              <div className="popover-title">Arrows</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '0 8px 8px' }}>
                 {/* Стрелки — порядок из ARROW_TYPE_REGISTRY, фильтр из schema */}
                 {(() => {
                   const ARROW_SVG = {
                     target:  <svg width="40" height="12"><line x1="2" y1="6" x2="36" y2="6" stroke="currentColor" strokeWidth="2"/><polyline points="30 2 36 6 30 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                     reverse: <svg width="40" height="12"><line x1="4" y1="6" x2="38" y2="6" stroke="currentColor" strokeWidth="2"/><polyline points="10 2 4 6 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                     both:    <svg width="40" height="12"><line x1="4" y1="6" x2="36" y2="6" stroke="currentColor" strokeWidth="2"/><polyline points="30 2 36 6 30 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="10 2 4 6 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
                     none:    <svg width="40" height="12"><line x1="2" y1="6" x2="38" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
                   };
                   return Object.entries(ARROW_TYPE_REGISTRY)
                     .filter(([val]) => (diagramSchema.allowedArrowTypes || []).includes(val))
                     .map(([val]) => {
                       const isHiddenLine    = eContext.lineStyle === 'none';
                       const isArrowDisabled = isHiddenLine && (val === 'none' || val === 'both');
                       return (
                         <button
                            key={val}
                            className={`toolbox-btn ${currentAt === val ? 'active' : ''}`}
                            style={{
                               width: '100%', height: '32px', padding: 0,
                               opacity: isArrowDisabled ? 0.3 : 1,
                               pointerEvents: isArrowDisabled ? 'none' : 'auto',
                               background: currentAt === val ? 'var(--color-bg-active)' : 'var(--bg-panel)',
                               border: `1px solid ${currentAt === val ? 'var(--color-brand)' : 'var(--border-color-soft)'}`
                            }}
                            onClick={() => {
                               if (val === 'reverse') reverseSelectedEdge();
                               else {
                                    updateSelectedEdge('connectionType', val);
                                    // Чистим устаревшее поле если было
                                    if (eContext.arrowType) updateSelectedEdge('arrowType', null);
                                }
                            }}
                         >
                            {ARROW_SVG[val]}
                         </button>
                       );
                     });
                 })()}
                 {/* ERD cardinality — shown only when allowedConnectionTypes is non-empty */}
                 {(diagramSchema.allowedConnectionTypes || []).length > 0 && (
                   <>
                     <div className="toolbox-divider" style={{ margin: '8px 0', gridColumn: '1/-1' }} />
                     <div className="popover-title" style={{ gridColumn: '1/-1' }}>Cardinality</div>
                     {(diagramSchema.allowedConnectionTypes || []).map(ct => (
                       <button
                         key={ct}
                         className={`toolbox-btn ${currentCt === ct ? 'active' : ''}`}
                         style={{
                           width: '100%', height: '32px', padding: 0,
                           background: currentCt === ct ? 'var(--color-bg-active)' : 'var(--bg-panel)',
                           border: `1px solid ${currentCt === ct ? 'var(--color-brand)' : 'var(--border-color-soft)'}`
                         }}
                         onClick={() => updateSelectedEdge('connectionType', ct)}
                       >
                         <div style={{fontSize:'12px',fontWeight:600}}>{ct}</div>
                       </button>
                     ))}
                   </>
                 )}
              </div>
            </PopoverMenu>
          </div>

          {/* Label Editing */}
          <div className="toolbox-section" style={getStyle(isLabelActive)}>
            <button ref={labelBtnRef} className="toolbox-btn" onClick={() => togglePopover('label')} data-tooltip="Edit Label">
              <Icon name="tag" size={20} />
            </button>
            <PopoverMenu isOpen={activePopover === 'label'} onClose={() => setActivePopover(null)} anchorRef={labelBtnRef}>
              <div className="popover-title">Label</div>
              <div className="popover-content">
                <input 
                    autoFocus
                    className="popover-input" 
                    type="text" 
                    placeholder={selectedNode && selectedNode.id === '__SYSTEM_TITLE__' ? "Diagram Header" : "Label..."} 
                    value={selectedNode ? (selectedNode.id === '__SYSTEM_TITLE__' ? diagramTitle : (selectedNode.label || '')) : (eContext.label || '')} 
                    onChange={e => {
                       if (selectedNode) {
                         if (selectedNode.id === '__SYSTEM_TITLE__') setDiagramTitle(e.target.value);
                         else updateSelectedNode('label', e.target.value);
                       } else if (selectedEdge) {
                         updateSelectedEdge('label', e.target.value);
                       }
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') setActivePopover(null); }}
                 />
                 
                 {selectedNode && selectedNode.id !== '__SYSTEM_TITLE__' && diagramSchema.features.hasNodeValue && (
                    <div style={{ marginTop: '12px' }}>
                       <div className="popover-title" style={{ padding: '0 0 6px 0' }}>Value (Number)</div>
                       <input 
                          className="popover-input" 
                          type="number" 
                          placeholder="e.g. 25" 
                          value={selectedNode.value !== undefined ? selectedNode.value : ''} 
                          onChange={e => updateSelectedNode('value', e.target.value !== '' ? Number(e.target.value) : undefined)}
                       />
                    </div>
                 )}
              </div>
            </PopoverMenu>
          </div>


          {/* Lock Pos */}
          <div style={getStyle(isLockActive)}>
            <button 
               className={`toolbox-btn ${nContext.lockPos ? 'locked' : ''}`} 
               onClick={() => updateSelectedNode('lockPos', !nContext.lockPos)}
               data-tooltip={nContext.lockPos ? "Unlock Position" : "Lock Auto-Layout"}
            >
              <Icon name={nContext.lockPos ? 'lock' : 'unlock'} size={20} />
            </button>
          </div>

          {/* Connect */}
          <div style={getStyle(isConnectActive)}>
             <button 
                className={`toolbox-btn ${activeLinkSource ? 'locked' : ''}`} 
                style={{ color: activeLinkSource ? 'var(--color-brand)' : '' }}
                onClick={toggleConnectionMode} 
                data-tooltip={activeLinkSource ? "Cancel Connection" : "Connect To..."}
             >
                <Icon name="connect" size={20} />
             </button>
          </div>
          
          {/* Delete Element */}
          <div style={getStyle(isTrashActive)}>
            <button className="toolbox-btn danger" onClick={deleteSelectedElement} data-tooltip="Delete Selection">
              <Icon name="trash" size={20} />
            </button>
          </div>
        </div>

        {/* --- 2. DIAGRAM ACTIONS --- */}
        <div className="toolbox-divider" />

        <button ref={bgBtnRef} className="toolbox-btn" onClick={() => togglePopover('bg')} data-tooltip="Canvas Settings">
           <Icon name="frame" size={24} />
        </button>
        <PopoverMenu isOpen={activePopover === 'bg'} onClose={() => setActivePopover(null)} anchorRef={bgBtnRef}>
          <div className="popover-title">Background</div>
          <div className="popover-list">
             {[
               {id: 'black', label: 'Solid Black'},
               {id: 'white', label: 'Solid White'},
             ].map(bg => (
                <button key={bg.id} className={bgColor === bg.id ? 'active' : ''} onClick={() => {
                   if (onChangeBgColor) onChangeBgColor(bg.id);
                }}>
                  {bg.label}
                </button>
             ))}
          </div>
          
          <div className="toolbox-divider" style={{ margin: '8px 0' }} />
          <div className="popover-title">Aspect Ratio</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '0 8px 8px' }}>
             {[
               {id: '16:9', label: '16:9'},
               {id: '4:3',  label: '4:3'},
               {id: '1:1',  label: '1:1'}
             ].map(ar => (
                <button 
                  key={ar.id} 
                  className={`toolbox-btn ${aspect === ar.id ? 'active' : ''}`}
                  style={{ 
                     width: '100%', height: '32px', padding: 0, fontSize: '12px', fontWeight: 600,
                     background: aspect === ar.id ? 'var(--color-bg-active)' : 'var(--bg-panel)',
                     border: `1px solid ${aspect === ar.id ? 'var(--color-brand)' : 'var(--border-color-soft)'}`
                  }}
                  onClick={() => {
                     if (onChangeAspect) onChangeAspect(ar.id);
                  }}
                >
                  {ar.label}
                </button>
             ))}
          </div>
        </PopoverMenu>

        <button ref={layoutBtnRef} className="toolbox-btn" onClick={() => togglePopover('layout')} data-tooltip="Layout Type">
           <Icon name={getDiagramIcon(diagramType)} size={24} />
        </button>
        <PopoverMenu isOpen={activePopover === 'layout'} onClose={() => setActivePopover(null)} anchorRef={layoutBtnRef}>
          <div className="popover-title">Diagram Type</div>
          <div className="popover-list">
             {DIAGRAM_TYPES.map(layout => (
                <button 
                  key={layout.id} 
                  className={diagramType === layout.id ? 'active' : ''} 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  onClick={() => {
                    if (setDiagramType) setDiagramType(layout.id);
                    setActivePopover(null);
                    setTimeout(onAutoLayout, 50);
                }}>
                  <Icon name={getDiagramIcon(layout.id)} size={16} />
                  {layout.name}
                </button>
             ))}
          </div>
        </PopoverMenu>

        <button className="toolbox-btn" onClick={onAutoLayout} data-tooltip="Auto Layout (Wand)">
           <Icon name="wand" size={20} />
        </button>

      </div>
    </div>
  );
}
