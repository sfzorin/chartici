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

export function getFittedManualEdgeLabel({ labelPolicy, displayLabel, pts, labelStyle }) {
  if (!displayLabel || !pts || pts.length < 2) return displayLabel || null;
  if (labelPolicy?.strategy !== 'source-near') return displayLabel;
  const best = getFlowchartLabelCandidate(displayLabel, pts, labelStyle);
  if (!best) return null;
  const labelExtraWidth = flowchartLabelWidth(displayLabel, labelStyle) - flowchartTextWidth(displayLabel, labelStyle);
  const maxTextWidth = Math.max(0, best.len - best.minGap * 2 - labelExtraWidth);
  return truncateLabelToWidth(displayLabel, maxTextWidth, labelStyle.charWidth);
}

export function getTextPathStartOffset(labelPolicy) {
  return labelPolicy?.textPathStartOffset || DEFAULT_LABELING.textPathStartOffset;
}

function getFlowchartLabelPlacement(displayLabel, pts, labelStyle) {
  const best = getFlowchartLabelCandidate(displayLabel, pts, labelStyle);
  if (!best) return null;
  const offset = Math.abs(labelStyle.offsetY ?? -7);
  const ux = best.dx / best.len;
  const uy = best.dy / best.len;
  const anchor = {
    x: best.a.x + ux * best.gap + (best.horizontal ? 0 : -offset),
    y: best.a.y + uy * best.gap + (best.horizontal ? -offset : 0),
  };
  const textAnchor = textAnchorForFlowchartSegment(best);
  const anchorSign = textAnchor === 'end' ? -1 : 1;
  const boxCenter = {
    x: anchor.x + (best.horizontal ? anchorSign * best.labelWidth / 2 : 0),
    y: anchor.y + (best.horizontal ? 0 : -best.labelWidth / 2),
  };
  return {
    x: anchor.x,
    y: anchor.y,
    boxCenterX: boxCenter.x,
    boxCenterY: boxCenter.y,
    labelWidth: best.labelWidth,
    labelHeight: best.labelHeight,
    angle: best.horizontal ? 0 : -90,
    textAnchor,
  };
}

function getFlowchartLabelCandidate(displayLabel, pts, labelStyle) {
  const textWidth = flowchartTextWidth(displayLabel, labelStyle);
  const labelWidth = flowchartLabelWidth(displayLabel, labelStyle);
  const labelHeight = labelStyle.fontSize + 8;
  const minGap = 5;
  const preferredGap = 20;
  let best = null;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) continue;

    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const axisPad = labelAdvancePad(labelStyle);
    const gap = labelGapForSegment(len, labelWidth, minGap + axisPad, preferredGap + axisPad);
    const readableLen = labelWidth + gap * 2;
    if (len >= readableLen) {
      best = { a, dx, dy, len, horizontal, labelWidth, labelHeight, gap, minGap: minGap + axisPad };
      break;
    }

    const tooShortPenalty = (readableLen - len) * 8;
    const score = -i * 220 + Math.min(len, 240) + (horizontal ? 80 : 0) - tooShortPenalty;
    if (!best || score > best.score) {
      best = { a, dx, dy, len, horizontal, labelWidth, labelHeight, gap, minGap: minGap + axisPad, score };
    }
  }

  return best;
}

function labelAdvancePad(labelStyle) {
  return Math.ceil((labelStyle.fontSize || EDGE_LABEL_STYLE.fontSize || 12) / 2);
}

function flowchartTextWidth(displayLabel, labelStyle) {
  return Math.max(1, String(displayLabel).length * labelStyle.charWidth);
}

function flowchartLabelWidth(displayLabel, labelStyle) {
  return flowchartTextWidth(displayLabel, labelStyle) + 14;
}

function textAnchorForFlowchartSegment(segment) {
  if (segment.horizontal) return segment.dx < 0 ? 'end' : 'start';
  return segment.dy > 0 ? 'end' : 'start';
}

function labelGapForSegment(len, labelWidth, minGap, preferredGap) {
  const availableGap = Math.max(0, (len - labelWidth) / 2);
  if (availableGap >= preferredGap) return preferredGap;
  return minGap;
}

export function truncateLabelToWidth(label, maxTextWidth, charWidth) {
  const text = String(label || '');
  if (!text) return null;
  const width = Math.max(1, charWidth || EDGE_LABEL_STYLE.charWidth || 7.4);
  if (text.length * width <= maxTextWidth) return text;
  if (maxTextWidth < width) return text.slice(0, 1);
  const ellipsis = '...';
  const ellipsisWidth = ellipsis.length * width;
  if (maxTextWidth <= ellipsisWidth + width) {
    return text.slice(0, Math.max(1, Math.floor(maxTextWidth / width)));
  }
  const chars = Math.max(1, Math.floor((maxTextWidth - ellipsisWidth) / width));
  return `${text.slice(0, chars)}${ellipsis}`;
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
