import { getEngine } from '../engines/index.js';
import { EDGE_LABEL_STYLE } from './edges.js';

const DEFAULT_LABELING = {
  strategy: 'center',
  textPathStartOffset: '50%',
};

export function getEdgeLabelPolicy(diagramType) {
  return getEngine(diagramType)?.labeling || DEFAULT_LABELING;
}

export function getEdgeLabelStyle(labelPolicy) {
  return {
    ...EDGE_LABEL_STYLE,
    ...(labelPolicy?.labelStyle || {}),
  };
}

export function usesManualEdgeLabels(labelPolicy) {
  return labelPolicy?.strategy === 'source-near' || labelPolicy?.strategy === 'relationship-center';
}

export function getManualEdgeLabelPlacement({ labelPolicy, displayLabel, pts, labelStyle }) {
  if (!displayLabel || !pts || pts.length < 2) return null;
  if (labelPolicy?.strategy === 'source-near') return getFlowchartLabelPlacement(displayLabel, pts, labelStyle);
  if (labelPolicy?.strategy === 'relationship-center') return getErdLabelPlacement(displayLabel, pts, labelStyle);
  return null;
}

export function getTextPathStartOffset(labelPolicy) {
  return labelPolicy?.textPathStartOffset || DEFAULT_LABELING.textPathStartOffset;
}

function getFlowchartLabelPlacement(displayLabel, pts, labelStyle) {
  const labelWidth = Math.max(36, String(displayLabel).length * labelStyle.charWidth + 14);
  const labelHeight = labelStyle.fontSize + 8;
  const sourceGap = 6;
  let best = null;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 24) continue;

    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const readableLen = labelWidth + sourceGap * 2;
    if (len >= readableLen) {
      best = { a, dx, dy, len, horizontal, labelWidth, labelHeight };
      break;
    }

    const tooShortPenalty = (readableLen - len) * 8;
    const score = -i * 220 + Math.min(len, 240) + (horizontal ? 80 : 0) - tooShortPenalty;
    if (!best || score > best.score) {
      best = { a, dx, dy, len, horizontal, labelWidth, labelHeight, score };
    }
  }

  if (!best) return null;
  const offset = Math.abs(labelStyle.offsetY ?? -7);
  const t = Math.min(0.48, (labelWidth / 2 + sourceGap) / best.len);
  return {
    x: best.a.x + best.dx * t + (best.horizontal ? 0 : -offset),
    y: best.a.y + best.dy * t + (best.horizontal ? -offset : 0),
    labelWidth: best.labelWidth,
    labelHeight: best.labelHeight,
    angle: best.horizontal ? 0 : -90,
  };
}

function getErdLabelPlacement(displayLabel, pts, labelStyle) {
  const midIndex = Math.max(0, Math.floor((pts.length - 1) / 2));
  const labelWidth = Math.max(36, String(displayLabel).length * labelStyle.charWidth + 18);
  const candidates = [];

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 32) continue;

    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const nearEndpointPenalty = (i === 0 || i === pts.length - 2) ? 140 : 0;
    const centerPenalty = Math.abs(i - midIndex) * 10;
    const readableBonus = len >= labelWidth + 32 ? 180 : -(labelWidth + 32 - len) * 2.5;
    const score = Math.min(len, 260) + readableBonus + (horizontal ? 24 : 12) - nearEndpointPenalty - centerPenalty;
    candidates.push({ a, dx, dy, len, horizontal, score });
  }

  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (!best) return null;

  const offset = Math.abs(labelStyle.offsetY ?? -7);
  return {
    x: best.a.x + best.dx * 0.5 + (best.horizontal ? 0 : -offset),
    y: best.a.y + best.dy * 0.5 + (best.horizontal ? -offset : 0),
    labelWidth,
    labelHeight: labelStyle.fontSize + 6,
    angle: best.horizontal ? 0 : -90,
  };
}
