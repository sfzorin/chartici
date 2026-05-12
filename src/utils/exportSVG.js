import { PALETTES, EXPORT_DEFAULTS } from '../diagram/colors.js';

export function finalizeExportSvgString(svgString, colorMap = {}) {
    let out = String(svgString || '');

    for (let pass = 0; pass < 3; pass++) {
        Object.entries(colorMap).forEach(([varName, val]) => {
            const regex = new RegExp(`var\\(\\s*${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:,[^)]+)?\\)`, 'g');
            out = out.replace(regex, val);
        });
    }

    return out
        .replace(/<filter\b[\s\S]*?<\/filter>/gi, '')
        .replace(/\sfilter="[^"]*"/gi, '')
        .replace(/filter\s*:\s*[^;"']+;?/gi, '')
        .replace(/<([a-z][\w:-]*)\b[^>]*\bclass="[^"]*(?:preview-bg-rect|canvas-grid-rect|selection-ui|port-ui|touch-port-hitbox|logical-link)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<[^>]*\bclass="[^"]*(?:preview-bg-rect|canvas-grid-rect|selection-ui|port-ui|touch-port-hitbox|logical-link)[^"]*"[^>]*\/>/gi, '')
        .replace(/\sfill="transparent"/gi, ' fill="none"')
        .replace(/\sstroke="transparent"/gi, ' stroke="none"')
        .replace(/var\(\s*--[^,\s)]+\s*,\s*([^)]+)\)/g, '$1')
        .replace(/var\(\s*--[^)]+\)/g, '#000000');
}

/**
 * Export the diagram SVG canvas to a downloadable file.
 * Handles: viewport reset, CSS variable baking, cleanup of UI artifacts.
 * 
 * @param {SVGElement} svgElement - The live SVG DOM element
 * @param {string} paletteTheme - Current palette key (e.g. 'blue', 'grey')
 * @param {string} diagramTitle - Title for the filename
 * @param {number} generationTimeMs - Optional generation time in milliseconds
 */
export function downloadSVG(svgElement, paletteTheme, diagramTitle, generationTimeMs) {
    const svgClone = svgElement.cloneNode(true);
    
    const viewportGroup = svgClone.querySelector('#diagram-viewport');
    if (viewportGroup) viewportGroup.removeAttribute('transform');

    const canvasPaperRect = svgClone.querySelector('#canvas-paper rect:not(.preview-bg-rect)') || svgClone.querySelector('#canvas-paper rect');
    let paperX = 0, paperY = 0, paperW = 0, paperH = 0;
    if (canvasPaperRect) {
       paperX = parseFloat(canvasPaperRect.getAttribute('x'));
       paperY = parseFloat(canvasPaperRect.getAttribute('y'));
       paperW = parseFloat(canvasPaperRect.getAttribute('width'));
       paperH = parseFloat(canvasPaperRect.getAttribute('height'));
       const paperStrokePad = 0;
       
       svgClone.setAttribute('viewBox', `${paperX - paperStrokePad} ${paperY - paperStrokePad} ${paperW + paperStrokePad * 2} ${paperH + paperStrokePad * 2}`);
       svgClone.removeAttribute('width');
       svgClone.removeAttribute('height');

       // Keep the paper fill as the exported background, but do not export the
       // editor paper outline as a visible SVG frame.
       canvasPaperRect.setAttribute('stroke', 'none');
       canvasPaperRect.removeAttribute('stroke-width');
       canvasPaperRect.style.removeProperty('stroke');
       canvasPaperRect.style.removeProperty('stroke-width');
       // Remove shadow from the paper for clean export.
       canvasPaperRect.style.filter = 'none';
    }

    // Inkscape and some print pipelines can render browser filters as black boxes
    // or drop the filtered shapes entirely. Keep the editor preview effects in-app,
    // but export a flat, predictable SVG.
    const exportFilters = svgClone.querySelectorAll('filter, [filter]');
    exportFilters.forEach(el => {
        if (el.tagName && el.tagName.toLowerCase() === 'filter') el.remove();
        else el.removeAttribute('filter');
    });
    svgClone.querySelectorAll('[style]').forEach(el => {
        if (el.style?.filter) el.style.removeProperty('filter');
    });

    // Inkscape can materialize SVG/CSS "transparent" paint as black on some
    // imported objects. Transparent helper shapes (title/text bounding rects,
    // empty borders) should be explicit non-paint in exported SVG.
    svgClone.querySelectorAll('[fill="transparent"]').forEach(el => el.setAttribute('fill', 'none'));
    svgClone.querySelectorAll('[stroke="transparent"]').forEach(el => el.setAttribute('stroke', 'none'));

    // Strip out the root style to wipe React runtime variables like background-color: var(--desk-bg)
    svgClone.removeAttribute('style');

    // Remove the infinite gray desk backgrounds from the export
    const deskBackgrounds = svgClone.querySelectorAll('rect[width="100%"]');
    deskBackgrounds.forEach(r => r.remove());

    // Remove editor-only checkerboard preview rectangles and grids inside the canvas
    const previewRects = svgClone.querySelectorAll('.preview-bg-rect, .canvas-grid-rect');
    previewRects.forEach(r => r.remove());

    // Remove editor-only handles, selection halos, and touch targets
    const editorArtifacts = svgClone.querySelectorAll('.selection-ui, .port-ui, .touch-port-hitbox');
    editorArtifacts.forEach(el => el.remove());

    // Scrub invisible/logical links from the final export
    const logicalLinks = svgClone.querySelectorAll('.logical-link');
    logicalLinks.forEach(ll => ll.remove());

    // Build CSS variable → hex color map for baking
    const rootStyles = getComputedStyle(document.documentElement);
    const paletteInfo = PALETTES[paletteTheme] || PALETTES.basic || Object.values(PALETTES)[0];
    const paletteVars = paletteInfo.colors;
    const colorMap = {
        '--canvas-bg':           rootStyles.getPropertyValue('--canvas-bg').trim()           || EXPORT_DEFAULTS['--canvas-bg'],
        '--color-brand':         rootStyles.getPropertyValue('--color-brand').trim()         || '#be355d',
        '--color-primary-dark':  rootStyles.getPropertyValue('--color-primary-dark').trim()  || '#be355d',
        '--border-color-active': rootStyles.getPropertyValue('--border-color-active').trim() || EXPORT_DEFAULTS['--border-color-active'],
        '--border-color-soft':   rootStyles.getPropertyValue('--border-color-soft').trim()   || EXPORT_DEFAULTS['--border-color-soft'],
        '--color-text-main':     rootStyles.getPropertyValue('--color-text-main').trim()     || EXPORT_DEFAULTS['--color-text-main'],
        '--color-text-dim':      rootStyles.getPropertyValue('--color-text-dim').trim()      || EXPORT_DEFAULTS['--color-text-dim'],
        '--color-secondary':     rootStyles.getPropertyValue('--color-secondary').trim()     || EXPORT_DEFAULTS['--color-secondary'],
        '--bg-panel':            rootStyles.getPropertyValue('--bg-panel').trim()            || '#ffffff',
        '--grid-line-color':     rootStyles.getPropertyValue('--grid-line-color').trim()     || EXPORT_DEFAULTS['--grid-line-color'],
        '--diagram-text':        svgElement.style.getPropertyValue('--diagram-text').trim()  || EXPORT_DEFAULTS['--diagram-text'],
        '--diagram-edge':        svgElement.style.getPropertyValue('--diagram-edge').trim()  || EXPORT_DEFAULTS['--diagram-edge'],
        '--diagram-group':       svgElement.style.getPropertyValue('--diagram-group').trim() || EXPORT_DEFAULTS['--diagram-group'],
        '--diagram-label-halo':  svgElement.style.getPropertyValue('--diagram-label-halo').trim() || svgElement.style.getPropertyValue('--canvas-bg').trim() || EXPORT_DEFAULTS['--canvas-bg'],
        '--unfilled-text-color': paletteInfo.unfilledText,
    };

    for (let i = 0; i < rootStyles.length; i++) {
        const prop = rootStyles[i];
        if (prop.startsWith('--') && !colorMap[prop]) {
            const value = rootStyles.getPropertyValue(prop).trim();
            if (value) colorMap[prop] = value;
        }
    }
    for (let i = 0; i < svgElement.style.length; i++) {
        const prop = svgElement.style[i];
        if (prop.startsWith('--')) {
            const value = svgElement.style.getPropertyValue(prop).trim();
            if (value) colorMap[prop] = value;
        }
    }

    for (let i = 0; i < paletteVars.length; i++) {
      const hex = paletteVars[i];
      colorMap[`--color-${i}`] = hex.bg;
      colorMap[`--text-color-${i}`] = hex.text;
      if (hex.border) colorMap[`--border-color-${i}`] = hex.border;
      else colorMap[`--border-color-${i}`] = hex.bg;
    }

    const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleElement.textContent = `text { font-family: system-ui, -apple-system, 'Inter', sans-serif; }`;
    svgClone.insertBefore(styleElement, svgClone.firstChild);

    const serializer = new XMLSerializer();
    const svgString = finalizeExportSvgString(serializer.serializeToString(svgClone), colorMap);

    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    const safeName = diagramTitle ? diagramTitle.replace(/[^a-zA-Z0-9А-Яа-я\s\-_]/g, '').trim() : 'diagram';
    link.download = `${safeName}.svg`;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
