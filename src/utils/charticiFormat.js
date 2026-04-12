import { getGroupId } from './groupUtils';
import { getEngine } from '../engines/index.js';

// ─── Вспомогательные функции ─────────────────────────────────────────────────

/**
 * Поля, которые хранятся только в рантайме и не должны попасть в .cci файл.
 * Удаляются из нод и групп при экспорте.
 */
const RUNTIME_NODE_FIELDS  = new Set(['groupId', 'bindTo', 'offsetX', 'offsetY', 'isPieSlice', 'w', 'h']);
const RUNTIME_GROUP_FIELDS = new Set(['id', 'text', 'groupLabel', 'nodeLabel']);

/** Нормализует ребро к формату с sourceId/targetId (для передачи в exportEdges). */
function normalizeEdge(e) {
  return {
    ...e,
    sourceId: String(e.sourceId || e.from || ''),
    targetId: String(e.targetId || e.to   || ''),
  };
}

// ─── Экспорт ──────────────────────────────────────────────────────────────────

/**
 * Сериализует текущее состояние диаграммы в .cci файл и сохраняет через браузерный диалог.
 *
 * Формат: тип-специфичный (nextSteps / parentId / spineId / explicit / flat nodes).
 * Определяется через engine.schema.ioFormat.edgeEncoding.
 */
export async function downloadCharticiFile(projectName, diagramData, config) {
  const { diagramType = 'flowchart', titleText, titleSize, titleX, titleY, ...restConfig } = config || {};
  const engine = getEngine(diagramType);
  const ioFmt  = engine?.schema?.ioFormat || {};

  // ── 1. Построение gMap из групп ──────────────────────────────────────────
  const exportGroups = [];
  const gMap = {};

  (diagramData.groups || []).forEach(g => {
    const gExport = {};
    // Копируем только персистентные поля группы
    for (const [k, v] of Object.entries(g)) {
      if (!RUNTIME_GROUP_FIELDS.has(k) && v !== undefined && v !== null) gExport[k] = v;
    }
    gExport.nodes = [];
    gMap[g.id] = gExport;
    exportGroups.push(gExport);
  });

  // ── 2. Распределяем ноды по группам ─────────────────────────────────────
  (diagramData.nodes || []).forEach(n => {
    const parentGroupId = getGroupId(n) || `g_${n.id}`;
    if (!gMap[parentGroupId]) {
      // Нода без группы — создаём анонимную
      gMap[parentGroupId] = { color: n.color, type: n.type, size: n.size, nodes: [] };
      exportGroups.push(gMap[parentGroupId]);
    }

    const nodeExport = { id: n.id };
    if (n.label)      nodeExport.label       = n.label;
    if (n.type)       nodeExport.type        = n.type;
    if (n.size)       nodeExport.size        = n.size;
    if (n.color)      nodeExport.color       = n.color;
    if (n.value  != null) nodeExport.value   = n.value;
    if (n.fontStyle)  nodeExport.fontStyle   = n.fontStyle;
    if (n.borderStyle) nodeExport.borderStyle = n.borderStyle;
    if (n.lockPos)    { nodeExport.x = n.x; nodeExport.y = n.y; nodeExport.lockPos = true; }

    gMap[parentGroupId].nodes.push(nodeExport);
  });

  // ── 3. Вызываем engine.parser.exportEdges для тип-специфичного кодирования ─
  const normalizedEdges = (diagramData.edges || []).map(normalizeEdge);
  const explicitEdges   = [];

  if (engine?.parser?.exportEdges) {
    engine.parser.exportEdges(gMap, normalizedEdges, explicitEdges);
  }

  // ── 4. Сборка payload ────────────────────────────────────────────────────
  const payload = {
    meta: { type: diagramType, version: '3.0.0' },
  };

  // Заголовок диаграммы — только если задан
  if (titleText) {
    payload.title = { text: titleText, size: titleSize || 'M' };
    if (titleX !== undefined) payload.title.x = titleX;
    if (titleY !== undefined) payload.title.y = titleY;
  }

  // Дополнительный конфиг (aspect, bgColor, theme…)
  const dataConfig = {};
  if (restConfig.aspect)  dataConfig.aspect  = restConfig.aspect;
  if (restConfig.bgColor) dataConfig.bgColor = restConfig.bgColor;
  if (restConfig.theme)   payload.theme = restConfig.theme; // theme — на верхнем уровне

  payload.data = {};
  if (Object.keys(dataConfig).length) payload.data.config = dataConfig;

  // ── 5. Кодировка рёбер зависит от типа ──────────────────────────────────
  switch (ioFmt.edgeEncoding) {
    case 'nextSteps':
    case 'parentId':
    case 'spineId':
      // Связи уже закодированы в нодах/группах через exportEdges выше.
      // Группы без нод исключаем из вывода.
      payload.data.groups = exportGroups.filter(g => g.nodes?.length > 0);
      // Убираем пустые узлы и внутренние поля из нод
      payload.data.groups.forEach(g => {
        g.nodes = g.nodes.filter(n => n.id); // пустые ноды не нужны
      });
      break;

    case 'explicit': {
      // Явные рёбра в именованном ключе (messages / relationships)
      payload.data.groups = exportGroups.filter(g => g.nodes?.length > 0);
      const edgeKey = ioFmt.edgeKey || 'edges';
      if (explicitEdges.length > 0) payload.data[edgeKey] = explicitEdges;
      break;
    }

    case 'none':
    default:
      if (ioFmt.flatNodes) {
        // piechart: плоский data.nodes[], без групп и рёбер
        const flatNodes = [];
        exportGroups.forEach(g => g.nodes.forEach(n => {
          const sn = { id: n.id };
          if (n.label) sn.label = n.label;
          if (n.size || g.size) sn.size = n.size || g.size;
          if (n.value != null) sn.value = n.value;
          if (n.color != null) sn.color = n.color;
          flatNodes.push(sn);
        }));
        payload.data.nodes = flatNodes;
      } else {
        // matrix: группы без рёбер
        payload.data.groups = exportGroups.filter(g => g.nodes?.length > 0);
      }
      break;
  }

  // ── 6. Сохранение файла ──────────────────────────────────────────────────
  const jsonStr = JSON.stringify(payload, null, 2);

  try {
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({
        suggestedName: projectName ? `${projectName}.cci` : 'diagram.cci',
        types: [{ description: 'Chartici Document', accept: { 'application/json': ['.cci'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
      return handle.name.replace(/\.cci$/, '');
    } else {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href  = url;
      const safeName = (projectName || 'diagram').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      link.download  = `${safeName}.cci`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return safeName;
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Save failed:', err);
    return null;
  }
}

// ─── Импорт ───────────────────────────────────────────────────────────────────

/**
 * Парсит .cci JSON-файл и возвращает нормализованные данные для App state.
 * Поддерживает только формат v3.0.0 (format.md в каждом engine плагине).
 */
export function parseCharticiFile(fileContent) {
  try {
    const data     = JSON.parse(fileContent);
    const coreData = data.data || {};
    const metaData = data.meta || {};

    // ── Группы и ноды ────────────────────────────────────────────────────
    const flatNodes   = [];
    const cleanGroups = [];

    // piechart: плоский data.nodes без групп
    if (Array.isArray(coreData.nodes) && !coreData.groups) {
      coreData.nodes.forEach(n => {
        const syntheticGroupId = `g_${n.id}`;
        cleanGroups.push({ id: syntheticGroupId, type: 'pie_slice', color: n.color || 1 });
        flatNodes.push({
          ...n,
          groupId: syntheticGroupId,
          type: 'pie_slice',
        });
      });
    } else {
      (coreData.groups || []).forEach(g => {
        const { nodes: childNodes, ...groupStyles } = g;
        groupStyles.id = groupStyles.id || `group_${Math.random().toString(36).substr(2, 9)}`;
        cleanGroups.push(groupStyles);

        (childNodes || []).forEach(n => {
          flatNodes.push({
            ...n,
            groupId:  groupStyles.id,
            type:     n.type  || groupStyles.type,
            size:     n.size  !== undefined ? n.size  : groupStyles.size,
            lockPos:  n.lockPos,
            x: n.x,
            y: n.y,
          });
        });
      });
    }

    // ── Конфиг ───────────────────────────────────────────────────────────
    const configFromData  = coreData.config || {};
    const rootTitle       = data.title;
    const diagramType     = metaData.type || configFromData.diagramType || 'flowchart';
    const engine          = getEngine(diagramType);
    const ioFmt           = engine?.schema?.ioFormat || {};

    const finalConfig = {
      ...configFromData,
      diagramType,
    };

    // Заголовок из корневого объекта title
    if (rootTitle && typeof rootTitle === 'object') {
      finalConfig.titleText  = rootTitle.text || '';
      finalConfig.titleSize  = rootTitle.size || 'M';
      if (rootTitle.x !== undefined) { finalConfig.titleX = rootTitle.x; finalConfig.titleLock = true; }
      if (rootTitle.y !== undefined)   finalConfig.titleY = rootTitle.y;
    }

    // Тема на верхнем уровне
    if (data.theme) finalConfig.theme = data.theme;

    // ── Явные рёбра (sequence / erd) ────────────────────────────────────
    const edgeKey  = ioFmt.edgeKey;
    const rawEdges = edgeKey ? (coreData[edgeKey] || []) : [];
    const explicitEdges = resolveEdges(rawEdges);

    // ── Неявные рёбра из нод/групп (flowchart / tree / radial / timeline) ─
    const implicitEdges = engine?.parser?.resolveImplicitEdges
      ? engine.parser.resolveImplicitEdges(flatNodes, coreData.groups || [])
      : [];

    // Объединяем, убираем дубли
    const existingKeys  = new Set(explicitEdges.map(e => `${e.from}::${e.to}`));
    const uniqueImplicit = implicitEdges.filter(e => e.from !== e.to && !existingKeys.has(`${e.from}::${e.to}`));

    return {
      groups: cleanGroups,
      nodes:  flatNodes,
      edges:  [...explicitEdges, ...uniqueImplicit],
      config: finalConfig,
      meta:   metaData,
    };
  } catch (error) {
    throw new Error(`Failed to parse .cci file: ${error.message}`);
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function resolveEdges(rawEdges) {
  const seen  = new Set();
  return (rawEdges || [])
    .filter(e => e.sourceId && e.targetId && String(e.sourceId) !== String(e.targetId))
    .map(e => ({
      id:             `edge_${Math.random().toString(36).substr(2, 9)}`,
      from:           String(e.sourceId),
      to:             String(e.targetId),
      sourceId:       String(e.sourceId),
      targetId:       String(e.targetId),
      ...(e.label          ? { label: e.label }                   : {}),
      ...(e.lineStyle      ? { lineStyle: e.lineStyle }           : {}),
      ...(e.connectionType ? { connectionType: e.connectionType } : {}),
    }))
    .filter(e => {
      const key = `${e.from}::${e.to}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
