import { getNodeDim } from '../../diagram/nodes.jsx';

export function layoutTree(nodes, edges, layoutRules, isHorizontalFlow) {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ ...nodes[0], x: 0, y: 0 }];

  const MIN_GAP_X = layoutRules.MIN_GAP_X;
  const MIN_GAP_Y = layoutRules.MIN_GAP_Y;
  const SIBLING_GAP_X = Math.max(40, Math.round(MIN_GAP_X * 0.55));
  const STACK_GAP_X = Math.max(40, Math.round(MIN_GAP_X * 0.7));
  const FOREST_GAP_X = Math.max(80, Math.round(MIN_GAP_X * 1.25));
  const STACK_TRUNK_GUTTER = 40;
  
  // Trees specifically use inverted directional logic.
  // If isHorizontalFlow == false (meaning vertical, like 16:9 screen), Tree flows top-to-bottom.
  // If isHorizontalFlow == true, Tree flows left-to-right.
  const isTB = !isHorizontalFlow;

  const nodeById = new Map(nodes.map(n => [String(n.id), n]));
  const childMap = new Map();
  const inDeg = new Map();
  const parentById = new Map();
  
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
          parentById.set(v, u);
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

  const contourOf = (w) => [{ left: -w / 2, right: w / 2 }];
  const stackEntryContourOf = (w) => [{ left: -w / 2 - STACK_TRUNK_GUTTER, right: w / 2 }];

  function mergeContours(target, source, offsetX, offsetLevel = 0) {
      source.forEach((contour, index) => {
          const level = index + offsetLevel;
          const shifted = {
              left: contour.left + offsetX,
              right: contour.right + offsetX
          };
          if (!target[level]) {
              target[level] = shifted;
          } else {
              target[level] = {
                  left: Math.min(target[level].left, shifted.left),
                  right: Math.max(target[level].right, shifted.right)
              };
          }
      });
  }

  function contourWidth(contours) {
      const extents = contourExtents(contours);
      return Math.max(0, extents.right - extents.left);
  }

  function contourExtents(contours) {
      return contours.reduce((acc, contour) => ({
          left: Math.min(acc.left, contour.left),
          right: Math.max(acc.right, contour.right)
      }), { left: 0, right: 0 });
  }

  function finalizeSubTreeData(data) {
      const extents = contourExtents(data.contours);
      const contourW = Math.max(0, extents.right - extents.left);
      data.subW = Math.max(data.subW, contourW, data.w);
      data.originX = -extents.left + Math.max(0, data.subW - contourW) / 2;
      return data;
  }

  function packRowByContours(row) {
      const centers = new Map();
      const rowContours = [];
      let cursor = 0;

      row.forEach((child, index) => {
          let center = index === 0 ? child.w / 2 : cursor + child.w / 2;
          let shift = 0;

          child.contours.forEach((contour, level) => {
              const occupied = rowContours[level];
              if (!occupied) return;
              shift = Math.max(shift, occupied.right + SIBLING_GAP_X - (center + contour.left));
          });

          if (shift > 0) center += shift;
          centers.set(child.id, center);
          mergeContours(rowContours, child.contours, center);
          cursor = center + child.w / 2 + SIBLING_GAP_X;
      });

      const contourExt = contourExtents(rowContours);
      const childExt = row.reduce((acc, child) => {
          const center = centers.get(child.id) || 0;
          return {
              left: Math.min(acc.left, center - child.w / 2),
              right: Math.max(acc.right, center + child.w / 2),
          };
      }, { left: Infinity, right: -Infinity });
      const rowCenter = Number.isFinite(childExt.left)
          ? (childExt.left + childExt.right) / 2
          : 0;
      const offsets = new Map();
      centers.forEach((center, id) => offsets.set(id, center - rowCenter));

      return {
          offsets,
          width: Math.max(0, contourExt.right - contourExt.left)
      };
  }

  function stackColumnSizes(numKids, numCols) {
      const sizes = [];
      let remaining = numKids;
      for (let col = 0; col < numCols; col++) {
          const remainingCols = numCols - col;
          const size = Math.ceil(remaining / remainingCols);
          sizes.push(size);
          remaining -= size;
      }
      return sizes;
  }

  function hasChildBearingSibling(nodeId) {
      const parentId = parentById.get(String(nodeId));
      if (!parentId) return false;
      return (childMap.get(parentId) || [])
          .filter(id => String(id) !== String(nodeId))
          .some(id => (childMap.get(id) || []).length > 0);
  }

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
          compactMixedBinary: false,
          compactOffsets: new Map(),
          rowOffsets: new Map(),
          row2Offsets: new Map(),
          row2LevelOffset: 1,
          contours: contourOf(isTB ? node.w : node.h),
          originX: (isTB ? node.w : node.h) / 2,
          secondRowKids: [],
          subW: isTB ? node.w : node.h,
          subH: isTB ? node.h : node.w
      };

      if (kids.length === 0) return finalizeSubTreeData(data);

      const childDataArr = kids.map(k => calcSubTree(k, depth + 1));
      const isLeafLevel = childDataArr.every(c => c.kids.length === 0 && c.secondRowKids.length === 0);
      const isTerminalChild = c => c.kids.length === 0 && c.secondRowKids.length === 0 && !c.leafStack;
      const terminalKids = childDataArr.filter(isTerminalChild);
      const branchKids = childDataArr.filter(c => !isTerminalChild(c));

      // depth >= 1 strictly means we are evaluating grandchildren (level 2) or deeper 
      // relative to the root, since depth 0 is the root evaluating its direct children.
      if (childDataArr.length === 2 && terminalKids.length === 1 && branchKids.length === 1) {
          data.kids = childDataArr;
          data.compactMixedBinary = true;

          const immediateRowW = childDataArr.reduce((sum, child, index) => (
              sum + child.w + (index > 0 ? SIBLING_GAP_X : 0)
          ), 0);

          let cursor = -immediateRowW / 2;
          let leftExtent = -data.w / 2;
          let rightExtent = data.w / 2;
          let maxChildH = 0;

          childDataArr.forEach(child => {
              const offset = cursor + child.w / 2;
              data.compactOffsets.set(child.id, offset);
              mergeContours(data.contours, child.contours, offset, 1);
              leftExtent = Math.min(leftExtent, offset - child.subW / 2);
              rightExtent = Math.max(rightExtent, offset + child.subW / 2);
              maxChildH = Math.max(maxChildH, child.subH);
              cursor += child.w + SIBLING_GAP_X;
          });

          const symmetricExtent = Math.max(Math.abs(leftExtent), Math.abs(rightExtent));
          data.subW = Math.max(data.w, symmetricExtent * 2);
          data.subH = data.h + MIN_GAP_Y + maxChildH;
      } else if (isLeafLevel && depth >= 1 && childDataArr.length >= 3 && hasChildBearingSibling(nodeId)) {
          const maxKids = 15;
          const allowedKids = childDataArr.slice(0, maxKids);
          childDataArr.slice(maxKids).forEach(k => hiddenNodes.add(k.id));
          
          data.kids = allowedKids;
          data.leafStack = true;

          const numKids = allowedKids.length;
          const numCols = Math.ceil(numKids / 5);
          const colSizes = stackColumnSizes(numKids, numCols);
          
          let totalColW = 0;
          let maxColH = 0;
          let colStart = 0;
          
          for (let c = 0; c < numCols; c++) {
              let w = 0, h = 0;
              for (let r = 0; r < colSizes[c]; r++) {
                  const idx = colStart + r;
                  if (idx < numKids) {
                      w = Math.max(w, allowedKids[idx].w);
                      h += allowedKids[idx].h + MIN_GAP_Y * 0.5;
                  }
              }
              totalColW += w + STACK_GAP_X; // Keep a clear routing trunk between stacked columns.
              maxColH = Math.max(maxColH, h);
              colStart += colSizes[c];
          }
          if (numCols > 0) totalColW -= STACK_GAP_X;
          if (maxColH > 0) maxColH -= MIN_GAP_Y * 0.5;

          data.subW = Math.max(data.w, totalColW);
          data.subH = data.h + MIN_GAP_Y + maxColH;

          let stackX = -totalColW / 2;
          colStart = 0;
          for (let c = 0; c < numCols; c++) {
              let level = 1;
              for (let r = 0; r < colSizes[c]; r++) {
                  const idx = colStart + r;
                  if (idx >= allowedKids.length) break;
                  const kid = allowedKids[idx];
                  const offset = stackX + kid.w / 2;
                  mergeContours(data.contours, stackEntryContourOf(kid.w), offset, level);
                  level++;
              }
              let colW = 0;
              for (let r = 0; r < colSizes[c]; r++) {
                  const idx = colStart + r;
                  if (idx < allowedKids.length) colW = Math.max(colW, allowedKids[idx].w);
              }
              stackX += colW + STACK_GAP_X;
              colStart += colSizes[c];
          }
          data.subW = Math.max(data.subW, contourWidth(data.contours));

      } else {
          const maxKids = 19;
          const allowedKids = childDataArr.slice(0, maxKids);
          childDataArr.slice(maxKids).forEach(k => hiddenNodes.add(k.id));
          
          const firstRowCount = allowedKids.length > 8
            ? Math.ceil(allowedKids.length / 2)
            : allowedKids.length;
          const row1 = allowedKids.slice(0, firstRowCount);
          const row2 = allowedKids.slice(firstRowCount);
          
          data.kids = row1;
          data.secondRowKids = row2;

          let row1MaxH = 0;
          let row2MaxH = 0;

          row1.forEach(c => { row1MaxH = Math.max(row1MaxH, c.subH); });
          row2.forEach(c => { row2MaxH = Math.max(row2MaxH, c.subH); });

          const row1Pack = packRowByContours(row1);
          const row2Pack = packRowByContours(row2);
          data.rowOffsets = row1Pack.offsets;
          data.row2Offsets = row2Pack.offsets;
          data.row2LevelOffset = 1 + Math.max(1, ...row1.map(c => c.contours.length));

          row1.forEach(child => {
              mergeContours(data.contours, child.contours, data.rowOffsets.get(child.id) || 0, 1);
          });
          row2.forEach(child => {
              mergeContours(data.contours, child.contours, data.row2Offsets.get(child.id) || 0, data.row2LevelOffset);
          });

          data.subW = Math.max(data.w, contourWidth(data.contours), row1Pack.width, row2Pack.width);
          data.subH = data.h + MIN_GAP_Y + row1MaxH + (row2.length > 0 ? MIN_GAP_Y + row2MaxH : 0);
      }

      return finalizeSubTreeData(data);
  }

  function placeSubTree(data, startX, startY) {
      finalPositions.set(data.id, { x: startX + data.originX, y: startY + data.h/2 });

      if (data.kids.length === 0 && data.secondRowKids.length === 0) return;

      if (data.leafStack) {
          let cx = startX + data.originX;
          const numCols = Math.ceil(data.kids.length / 5);
          const colSizes = stackColumnSizes(data.kids.length, numCols);
          
          const colWidths = [];
          let totalKidsW = 0;
          let colStart = 0;
          for (let c = 0; c < numCols; c++) {
              let mx = 0;
              for (let r = 0; r < colSizes[c]; r++) {
                  const idx = colStart + r;
                  if (idx < data.kids.length) mx = Math.max(mx, data.kids[idx].w);
              }
              colWidths.push(mx);
              totalKidsW += mx + STACK_GAP_X;
              colStart += colSizes[c];
          }
          if (numCols > 0) totalKidsW -= STACK_GAP_X;
          
          let currX = cx - (totalKidsW / 2);
          colStart = 0;
          
          for (let c = 0; c < numCols; c++) {
              let currY = startY + data.h + MIN_GAP_Y;
              
              for (let r = 0; r < colSizes[c]; r++) {
                  const i = colStart + r;
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
              currX += colWidths[c] + STACK_GAP_X;
              colStart += colSizes[c];
          }
      } else if (data.compactMixedBinary) {
          const cx = startX + data.originX;
          const currY = startY + data.h + MIN_GAP_Y;
          data.kids.forEach(kid => {
              const offset = data.compactOffsets.get(kid.id) || 0;
              placeSubTree(kid, cx + offset - kid.originX, currY);
          });
      } else {
          // Row 1
          const cx = startX + data.originX;
          let currY = startY + data.h + MIN_GAP_Y;
          let r1MaxH = 0;

          data.kids.forEach(k => {
              const offset = data.rowOffsets.get(k.id) || 0;
              placeSubTree(k, cx + offset - k.originX, currY);
              r1MaxH = Math.max(r1MaxH, k.subH);
          });

          // Row 2
          if (data.secondRowKids.length > 0) {
              let currY2 = currY + r1MaxH + MIN_GAP_Y;
              
              data.secondRowKids.forEach(k => {
                  const offset = data.row2Offsets.get(k.id) || 0;
                  placeSubTree(k, cx + offset - k.originX, currY2);
              });
          }
      }
  }

  // Layout all true Roots horizontally
  let currentForestX = 0;
  trueRoots.forEach(r => {
      const treeData = calcSubTree(r);
      placeSubTree(treeData, currentForestX, 0);
      currentForestX += treeData.subW + FOREST_GAP_X;
  });

  // Layout Orphans in a neat grid beside the forest
  if (orphans.length > 0) {
      if (trueRoots.length > 0) currentForestX += SIBLING_GAP_X; // Extra spacing
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
              gridX += w + SIBLING_GAP_X;
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
