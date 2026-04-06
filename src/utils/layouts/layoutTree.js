import { getNodeDim } from '../constants.js';

export function layoutTree(nodes, edges, isHorizontalFlow, layoutRules) {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ ...nodes[0], x: 0, y: 0 }];

  const MIN_GAP_X = layoutRules.MIN_GAP_X;
  const MIN_GAP_Y = layoutRules.MIN_GAP_Y;
  
  // Trees specifically use inverted directional logic.
  // If isHorizontalFlow == false (meaning vertical, like 16:9 screen), Tree flows top-to-bottom.
  // If isHorizontalFlow == true, Tree flows left-to-right.
  const isTB = !isHorizontalFlow;

  const nodeById = new Map(nodes.map(n => [String(n.id), n]));
  const childMap = new Map();
  const inDeg = new Map();
  
  nodes.forEach(n => {
      childMap.set(String(n.id), []);
      inDeg.set(String(n.id), 0);
  });
  
  edges.forEach(e => {
      const u = String(e.from || e.sourceId);
      const v = String(e.to || e.targetId);
      if (childMap.has(u) && inDeg.has(v)) {
          childMap.get(u).push(v);
          inDeg.set(v, inDeg.get(v) + 1);
      }
  });

  const allIds = [...nodeById.keys()];
  const roots = allIds.filter(id => inDeg.get(id) === 0);
  const connectedNodes = new Set();
  
  const getDescendants = (id, set) => {
      if (set.has(id)) return;
      set.add(id);
      for (const kid of childMap.get(id)) getDescendants(kid, set);
  };
  
  roots.forEach(r => getDescendants(r, connectedNodes));
  
  const orphans = [];
  const trueRoots = [];
  roots.forEach(r => {
      if (childMap.get(r).length === 0) orphans.push(r);
      else trueRoots.push(r);
  });

  allIds.forEach(id => {
     if (!connectedNodes.has(id) && !orphans.includes(id)) {
         orphans.push(id);
     }
  });

  const finalPositions = new Map();
  const hiddenNodes = new Set();

  function calcSubTree(nodeId, depth = 0) {
      const node = nodeById.get(nodeId);
      const kids = childMap.get(nodeId);
      
      let data = {
          id: nodeId,
          w: isTB ? node.w : node.h,
          h: isTB ? node.h : node.w,
          nodeInfo: node,
          kids: [],
          leafStack: false,
          secondRowKids: [],
          subW: isTB ? node.w : node.h,
          subH: isTB ? node.h : node.w
      };

      if (kids.length === 0) return data;

      const childDataArr = kids.map(k => calcSubTree(k, depth + 1));
      const isLeafLevel = childDataArr.every(c => c.kids.length === 0 && c.secondRowKids.length === 0);

      // depth >= 1 strictly means we are evaluating grandchildren (level 2) or deeper 
      // relative to the root, since depth 0 is the root evaluating its direct children.
      if (isLeafLevel && depth >= 1) {
          const maxKids = 15;
          const allowedKids = childDataArr.slice(0, maxKids);
          childDataArr.slice(maxKids).forEach(k => hiddenNodes.add(k.id));
          
          data.kids = allowedKids;
          data.leafStack = true;

          const numKids = allowedKids.length;
          const numCols = Math.ceil(numKids / 5);
          
          let totalColW = 0;
          let maxColH = 0;
          
          for (let c = 0; c < numCols; c++) {
              let w = 0, h = 0;
              for (let r = 0; r < 5; r++) {
                  const idx = c * 5 + r;
                  if (idx < numKids) {
                      w = Math.max(w, allowedKids[idx].w);
                      h += allowedKids[idx].h + MIN_GAP_Y * 0.5;
                  }
              }
              totalColW += w + MIN_GAP_X; // Full gap for routing trunk
              maxColH = Math.max(maxColH, h);
          }
          if (numCols > 0) totalColW -= MIN_GAP_X;
          if (maxColH > 0) maxColH -= MIN_GAP_Y * 0.5;

          data.subW = Math.max(data.w, totalColW);
          data.subH = data.h + MIN_GAP_Y + maxColH;

      } else {
          const maxKids = 19;
          const allowedKids = childDataArr.slice(0, maxKids);
          childDataArr.slice(maxKids).forEach(k => hiddenNodes.add(k.id));
          
          const row1 = allowedKids.slice(0, 10);
          const row2 = allowedKids.slice(10, 19);
          
          data.kids = row1;
          data.secondRowKids = row2;

          let row1W = 0, row1MaxH = 0;
          let row2W = 0, row2MaxH = 0;

          row1.forEach(c => {
              row1W += c.subW + MIN_GAP_X;
              row1MaxH = Math.max(row1MaxH, c.subH);
          });
          if (row1.length > 0) row1W -= MIN_GAP_X;

          row2.forEach(c => {
             row2W += c.subW + MIN_GAP_X;
             row2MaxH = Math.max(row2MaxH, c.subH);
          });
          if (row2.length > 0) row2W -= MIN_GAP_X;

          data.subW = Math.max(data.w, row1W, row2W);
          data.subH = data.h + MIN_GAP_Y + row1MaxH + (row2.length > 0 ? MIN_GAP_Y + row2MaxH : 0);
      }

      return data;
  }

  function placeSubTree(data, startX, startY) {
      finalPositions.set(data.id, { x: startX + data.subW/2, y: startY + data.h/2 });

      if (data.kids.length === 0 && data.secondRowKids.length === 0) return;

      if (data.leafStack) {
          let cx = startX + (data.subW / 2);
          const numCols = Math.ceil(data.kids.length / 5);
          
          const colWidths = [];
          let totalKidsW = 0;
          for (let c = 0; c < numCols; c++) {
              let mx = 0;
              for (let r = 0; r < 5; r++) {
                  const idx = c * 5 + r;
                  if (idx < data.kids.length) mx = Math.max(mx, data.kids[idx].w);
              }
              colWidths.push(mx);
              totalKidsW += mx + MIN_GAP_X;
          }
          if (numCols > 0) totalKidsW -= MIN_GAP_X;
          
          let currX = cx - (totalKidsW / 2);
          
          for (let c = 0; c < numCols; c++) {
              let currY = startY + data.h + MIN_GAP_Y;
              
              for (let r = 0; r < 5; r++) {
                  const i = c * 5 + r;
                  if (i >= data.kids.length) break;
                  
                  const kid = data.kids[i];
                  // Snap target Y to prevent uneven visual gaps AFTER global point snapping
                  let targetY = currY + kid.h/2;
                  targetY = Math.round(targetY / 20) * 20;
                  finalPositions.set(kid.id, { x: currX + colWidths[c]/2, y: targetY });
                  
                  nodeById.get(kid.id)._stackEntry = isTB ? 'Left' : 'Top';
                  // Next Y baseline starts from exactly where this node's visual box ends (+ 40px gap)
                  const visualBottom = targetY + kid.h/2;
                  currY = visualBottom + MIN_GAP_Y * 0.5;
              }
              currX += colWidths[c] + MIN_GAP_X;
          }
      } else {
          // Row 1
          let row1W = 0;
          data.kids.forEach(k => row1W += k.subW + MIN_GAP_X);
          if (data.kids.length > 0) row1W -= MIN_GAP_X;
          
          let currX = startX + (data.subW / 2) - (row1W / 2);
          let currY = startY + data.h + MIN_GAP_Y;
          let r1MaxH = 0;

          data.kids.forEach(k => {
              placeSubTree(k, currX, currY);
              currX += k.subW + MIN_GAP_X;
              r1MaxH = Math.max(r1MaxH, k.subH);
          });

          // Row 2
          if (data.secondRowKids.length > 0) {
              let row2W = 0;
              data.secondRowKids.forEach(k => row2W += k.subW + MIN_GAP_X);
              row2W -= MIN_GAP_X;
              
              let currX2 = startX + (data.subW / 2) - (row2W / 2);
              let currY2 = currY + r1MaxH + MIN_GAP_Y;
              
              data.secondRowKids.forEach(k => {
                  placeSubTree(k, currX2, currY2);
                  currX2 += k.subW + MIN_GAP_X;
              });
          }
      }
  }

  // Layout all true Roots horizontally
  let currentForestX = 0;
  trueRoots.forEach(r => {
      const treeData = calcSubTree(r);
      placeSubTree(treeData, currentForestX, 0);
      currentForestX += treeData.subW + MIN_GAP_X * 2;
  });

  // Layout Orphans in a neat grid beside the forest
  if (orphans.length > 0) {
      if (trueRoots.length > 0) currentForestX += MIN_GAP_X; // Extra spacing
      const cols = Math.ceil(Math.sqrt(orphans.length));
      let oIdx = 0;
      let gridX = currentForestX;
      let gridY = 0;
      let maxHInRow = 0;
      let maxWInCol = 0;

      orphans.forEach(oId => {
          const o = nodeById.get(oId);
          const w = isTB ? o.w : o.h;
          const h = isTB ? o.h : o.w;
          finalPositions.set(oId, { x: gridX + w/2, y: gridY + h/2 });
          
          maxHInRow = Math.max(maxHInRow, h);
          maxWInCol = Math.max(maxWInCol, w);
          
          oIdx++;
          if (oIdx % cols === 0) {
              gridX = currentForestX;
              gridY += maxHInRow + MIN_GAP_Y;
              maxHInRow = 0;
          } else {
              gridX += w + MIN_GAP_X;
          }
      });
  }

  return nodes.map(n => {
      if (hiddenNodes.has(String(n.id))) {
          // If ignored due to limits, just stack behind parent
          const p = finalPositions.get(String(n.id)) || { x: 0, y: 0 };
          return { ...n, x: p.x, y: p.y }; // Will be hidden in UI perhaps? Or just collapse.
      }
      
      const pos = finalPositions.get(String(n.id));
      if (!pos) return { ...n, x: 0, y: 0 };
      
      let finalX = isTB ? pos.x : pos.y;
      let finalY = isTB ? pos.y : pos.x;

      if (n.lockPos) {
          finalX = n.x;
          finalY = n.y;
      }

      return {
          ...n,
          x: finalX,
          y: finalY
      };
  });
}
