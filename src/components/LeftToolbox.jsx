import React, { useState, useRef, useEffect } from 'react';
import { PALETTES } from '../utils/constants';
import { useNodeGroup } from '../hooks/useNodeGroup';
import { getGroupId } from '../utils/groupUtils';
import Icon from './Icons';

// --- Popover helper component ---
function PopoverMenu({ isOpen, onClose, anchorRef, children, side = 'right' }) {
  const popoverRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        isOpen && 
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
  onAddNode
}) {
  const { groupId: nodeGroupId, group: nodeGroup } = useNodeGroup(selectedNode, groupsList);

  const [activePopover, setActivePopover] = useState(null); // 'add', 'shape', 'color', 'size', 'label', 'edge-style', 'edge-type', 'group'
  
  // Refs for anchors
  const addBtnRef = useRef(null);
  const shapeBtnRef = useRef(null);
  const sizeBtnRef = useRef(null);
  const colorBtnRef = useRef(null);
  const labelBtnRef = useRef(null);
  const lockBtnRef = useRef(null);
  const edgeStyleBtnRef = useRef(null);
  const edgeArrowBtnRef = useRef(null);

  const togglePopover = (id) => {
    setActivePopover(prev => prev === id ? null : id);
  };

  const getShapeIcon = (type) => {
    switch (type) {
      case 'circle': return 'shape-circle';
      case 'oval': return 'shape-oval';
      case 'rhombus': return 'shape-diamond';
      case 'text': return 'layers'; // Or something corresponding to text
      default: return 'shape-rect'; // includes 'process'
    }
  };

  return (
    <div className="left-toolbox">
      
      {/* Global Actions */}
      <div className="toolbox-section">
        <button 
          ref={addBtnRef}
          className="toolbox-btn primary" 
          onClick={() => togglePopover('add')}
          data-tooltip="Add New Element"
        >
          <Icon name="plus" size={24} />
        </button>

        <PopoverMenu isOpen={activePopover === 'add'} onClose={() => setActivePopover(null)} anchorRef={addBtnRef}>
          <div className="popover-title">Create Node</div>
          <div className="popover-grid">
             <button onClick={() => { onAddNode('process'); setActivePopover(null); }}><Icon name="shape-rect" /> Block</button>
             <button onClick={() => { onAddNode('circle'); setActivePopover(null); }}><Icon name="shape-circle" /> Circle</button>
             <button onClick={() => { onAddNode('oval'); setActivePopover(null); }}><Icon name="shape-oval" /> Oval</button>
             <button onClick={() => { onAddNode('rhombus'); setActivePopover(null); }}><Icon name="shape-diamond" /> Rhombus</button>
             <button onClick={() => { onAddNode('text'); setActivePopover(null); }}><Icon name="layers" /> Text</button>
          </div>
        </PopoverMenu>
      </div>

      <div className="toolbox-divider" />

      {/* Selected Element Context */}
      {selectedNode && (
        <div className="toolbox-section">
          {diagramType !== 'radial' && selectedNode.id !== '__SYSTEM_TITLE__' && (
            <>
              {/* Shape Selection */}
              <button ref={shapeBtnRef} className="toolbox-btn" onClick={() => togglePopover('shape')} data-tooltip="Change Shape">
                <Icon name={getShapeIcon(selectedNode.type)} size={24} />
              </button>
              
              <PopoverMenu isOpen={activePopover === 'shape'} onClose={() => setActivePopover(null)} anchorRef={shapeBtnRef}>
                <div className="popover-title">Shape Type</div>
                <div className="popover-list">
                   <button className={selectedNode.type === 'process' ? 'active' : ''} onClick={() => { updateSelectedNode('type', 'process'); setActivePopover(null); }}><Icon name="shape-rect" /> Block</button>
                   <button className={selectedNode.type === 'circle' ? 'active' : ''} onClick={() => { updateSelectedNode('type', 'circle'); setActivePopover(null); }}><Icon name="shape-circle" /> Circle</button>
                   <button className={selectedNode.type === 'oval' ? 'active' : ''} onClick={() => { updateSelectedNode('type', 'oval'); setActivePopover(null); }}><Icon name="shape-oval" /> Oval</button>
                   <button className={selectedNode.type === 'rhombus' ? 'active' : ''} onClick={() => { updateSelectedNode('type', 'rhombus'); setActivePopover(null); }}><Icon name="shape-diamond" /> Rhombus</button>
                   <button className={selectedNode.type === 'text' ? 'active' : ''} onClick={() => { updateSelectedNode('type', 'text'); setActivePopover(null); }}><Icon name="layers" /> Text</button>
                </div>
              </PopoverMenu>

              {/* Size Selection */}
              <button ref={sizeBtnRef} className="toolbox-btn" onClick={() => togglePopover('size')} data-tooltip="Change Size">
                <span className="text-icon">{selectedNode.size || 'M'}</span>
              </button>
              
              <PopoverMenu isOpen={activePopover === 'size'} onClose={() => setActivePopover(null)} anchorRef={sizeBtnRef}>
                <div className="popover-title">Wait</div>
                <div className="popover-list">
                  {['S', 'M', 'L', 'XL', 'AUTO'].map(s => (
                    <button key={s} className={selectedNode.size === s ? 'active' : ''} onClick={() => { updateSelectedNode('size', s); setActivePopover(null); }}>
                      {s === 'AUTO' ? 'Auto Size' : `Size: ${s}`}
                    </button>
                  ))}
                </div>
              </PopoverMenu>

              {/* Color Selection */}
              <button ref={colorBtnRef} className="toolbox-btn" onClick={() => togglePopover('color')} data-tooltip="Change Color">
                <div className="color-indicator" style={{ background: currentPaletteInfo?.colors[selectedNode.color - 1 || 0] }} />
              </button>

              <PopoverMenu isOpen={activePopover === 'color'} onClose={() => setActivePopover(null)} anchorRef={colorBtnRef}>
                <div className="popover-title">Color Palette</div>
                <div className="popover-color-grid">
                  {[1,2,3,4,5,6,7,8,9].map(t => (
                      <button 
                         key={`color-${t}`}
                         className={`color-swatch ${selectedNode.color === t ? 'selected' : ''}`}
                         style={{ background: currentPaletteInfo?.colors[t-1] }}
                         onClick={() => { updateSelectedNode('color', t); setActivePopover(null); }}
                      />
                  ))}
                </div>
              </PopoverMenu>
            </>
          )}

          {/* Label Editing */}
          <button ref={labelBtnRef} className="toolbox-btn" onClick={() => togglePopover('label')} data-tooltip="Edit Label">
            <span className="text-icon">A</span>
          </button>
          
          <PopoverMenu isOpen={activePopover === 'label'} onClose={() => setActivePopover(null)} anchorRef={labelBtnRef}>
            <div className="popover-title">Label</div>
            <div className="popover-content">
              <input 
                  autoFocus
                  className="popover-input" 
                  type="text" 
                  placeholder={selectedNode.id === '__SYSTEM_TITLE__' ? "Diagram Header" : "Node Name"} 
                  value={selectedNode.id === '__SYSTEM_TITLE__' ? diagramTitle : (selectedNode.label || '')} 
                  onChange={e => {
                     if (selectedNode.id === '__SYSTEM_TITLE__') setDiagramTitle(e.target.value);
                     else updateSelectedNode('label', e.target.value);
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') setActivePopover(null); }}
               />
            </div>
          </PopoverMenu>

          {/* Lock Positioning */}
          {selectedNode.type !== 'text' && selectedNode.id !== '__SYSTEM_TITLE__' && (
            <button 
               className={`toolbox-btn ${selectedNode.lockPos ? 'locked' : ''}`} 
               onClick={() => updateSelectedNode('lockPos', !selectedNode.lockPos)}
               data-tooltip={selectedNode.lockPos ? "Unlock Position" : "Lock Auto-Layout"}
            >
              <Icon name={selectedNode.lockPos ? 'lock' : 'unlock'} size={20} />
            </button>
          )}
          
          <div className="toolbox-divider" />
          
          {/* Delete Element */}
          <button className="toolbox-btn danger" onClick={deleteSelectedElement} data-tooltip="Delete Node">
            <Icon name="trash" size={20} />
          </button>
        </div>
      )}

      {selectedEdge && (
         <div className="toolbox-section">
            {/* Label Editing */}
            <button ref={labelBtnRef} className="toolbox-btn" onClick={() => togglePopover('label')} data-tooltip="Edit Edge Label">
              <span className="text-icon">A</span>
            </button>
            <PopoverMenu isOpen={activePopover === 'label'} onClose={() => setActivePopover(null)} anchorRef={labelBtnRef}>
              <div className="popover-title">Edge Label</div>
              <div className="popover-content">
                <input 
                    autoFocus
                    className="popover-input" 
                    type="text" 
                    placeholder="Label..." 
                    value={selectedEdge.label || ''} 
                    onChange={e => updateSelectedEdge('label', e.target.value)} 
                    onKeyDown={e => { if (e.key === 'Enter') setActivePopover(null); }}
                 />
              </div>
            </PopoverMenu>
            
            <button ref={edgeStyleBtnRef} className="toolbox-btn" onClick={() => togglePopover('edgestyle')} data-tooltip="Line Style">
              <Icon name="hamburger" size={24} />
            </button>
            <PopoverMenu isOpen={activePopover === 'edgestyle'} onClose={() => setActivePopover(null)} anchorRef={edgeStyleBtnRef}>
              <div className="popover-title">Line Style</div>
              <div className="popover-list">
                 {['solid', 'bold', 'dashed', 'bold-dashed', 'none'].map(style => (
                   <button key={style} className={selectedEdge.lineStyle === style ? 'active' : ''} onClick={() => { updateSelectedEdge('lineStyle', style); setActivePopover(null); }}>
                      {style}
                   </button>
                 ))}
              </div>
            </PopoverMenu>

            <button ref={edgeArrowBtnRef} className="toolbox-btn" onClick={() => togglePopover('edgearrow')} data-tooltip="Connection Arrows">
              <span className="text-icon">{'→'}</span>
            </button>
            <PopoverMenu isOpen={activePopover === 'edgearrow'} onClose={() => setActivePopover(null)} anchorRef={edgeArrowBtnRef}>
              <div className="popover-title">Arrows</div>
              <div className="popover-list">
                 {[
                   {val: 'target', label: '→ Arrow'},
                   {val: 'reverse', label: '← Reverse'},
                   {val: 'both', label: '↔ Both'},
                   {val: 'none', label: '— No Arrow'},
                 ].map(arrow => (
                   <button key={arrow.val} className={(selectedEdge.connectionType || 'target') === arrow.val ? 'active' : ''} onClick={() => { 
                      if(arrow.val === 'reverse') reverseSelectedEdge();
                      else updateSelectedEdge('connectionType', arrow.val); 
                      setActivePopover(null); 
                   }}>
                      {arrow.label}
                   </button>
                 ))}
              </div>
            </PopoverMenu>

            <div className="toolbox-divider" />
            <button className="toolbox-btn danger" onClick={deleteSelectedElement} data-tooltip="Delete Edge">
              <Icon name="trash" size={20} />
            </button>
         </div>
      )}
    </div>
  );
}
