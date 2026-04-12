import { PALETTES, EXPORT_DEFAULTS } from '../diagram/colors.js';


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
       
       svgClone.setAttribute('viewBox', `${paperX} ${paperY} ${paperW} ${paperH}`);
       svgClone.removeAttribute('width');
       svgClone.removeAttribute('height');

       // Remove shadow from the paper for clean export
       canvasPaperRect.removeAttribute('style');
    }

    // Strip out the root style to wipe React runtime variables like background-color: var(--desk-bg)
    svgClone.removeAttribute('style');

    // Remove the infinite gray desk backgrounds from the export
    const deskBackgrounds = svgClone.querySelectorAll('rect[width="100%"]');
    deskBackgrounds.forEach(r => r.remove());

    // Remove editor-only checkerboard preview rectangles and grids inside the canvas
    const previewRects = svgClone.querySelectorAll('.preview-bg-rect, .canvas-grid-rect');
    previewRects.forEach(r => r.remove());

    // Remove UI handles and selection boxes
    const selectedBoxes = svgClone.querySelectorAll('.diagram-node.selected rect[stroke-dasharray], .diagram-node.selected ellipse[stroke-dasharray]');
    selectedBoxes.forEach(box => box.remove());

    // Scrub invisible/logical links from the final export
    const logicalLinks = svgClone.querySelectorAll('.logical-link');
    logicalLinks.forEach(ll => ll.remove());

    // Build CSS variable → hex color map for baking
    const rootStyles = getComputedStyle(document.documentElement);
    const paletteVars = PALETTES[paletteTheme].colors;
    const colorMap = {
        '--canvas-bg':           rootStyles.getPropertyValue('--canvas-bg').trim()           || EXPORT_DEFAULTS['--canvas-bg'],
        '--border-color-active': rootStyles.getPropertyValue('--border-color-active').trim() || EXPORT_DEFAULTS['--border-color-active'],
        '--color-text-main':     rootStyles.getPropertyValue('--color-text-main').trim()     || EXPORT_DEFAULTS['--color-text-main'],
        '--color-secondary':     rootStyles.getPropertyValue('--color-secondary').trim()     || EXPORT_DEFAULTS['--color-secondary'],
        '--grid-line-color':     rootStyles.getPropertyValue('--grid-line-color').trim()     || EXPORT_DEFAULTS['--grid-line-color'],
        '--diagram-text':        svgElement.style.getPropertyValue('--diagram-text').trim()  || EXPORT_DEFAULTS['--diagram-text'],
        '--diagram-edge':        svgElement.style.getPropertyValue('--diagram-edge').trim()  || EXPORT_DEFAULTS['--diagram-edge'],
        '--diagram-group':       svgElement.style.getPropertyValue('--diagram-group').trim() || EXPORT_DEFAULTS['--diagram-group'],
        '--unfilled-text-color': PALETTES[paletteTheme].unfilledText,
    };


    for (let i = 0; i < paletteVars.length; i++) {
      const hex = paletteVars[i];
      colorMap[`--color-${i}`] = hex.bg;
      colorMap[`--text-color-${i}`] = hex.text;
      if (hex.border) colorMap[`--border-color-${i}`] = hex.border;
      else colorMap[`--border-color-${i}`] = hex.bg;
    }

    const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleElement.textContent = `text { font-family: system-ui, -apple-system, 'Inter', sans-serif; font-weight: 500; }`;
    svgClone.insertBefore(styleElement, svgClone.firstChild);

    // Guarantee watermark visibility by checking actual SVG background
    const bgFill = canvasPaperRect ? (canvasPaperRect.getAttribute('fill') || '#ffffff').toLowerCase() : '#ffffff';
    const watermarkFill = bgFill === '#000000' ? '#ffffff' : '#1e293b';

    if (generationTimeMs !== undefined && generationTimeMs !== null && paperW > 0) {
        const watermark = document.createElementNS("http://www.w3.org/2000/svg", "text");
        watermark.setAttribute("x", paperX + paperW - 32);
        watermark.setAttribute("y", paperY + paperH - 24); // Lifted slightly from bottom edge
        watermark.setAttribute("text-anchor", "end");
        watermark.setAttribute("fill", watermarkFill);
        watermark.setAttribute("font-family", "system-ui, -apple-system, 'Inter', sans-serif");
        watermark.setAttribute("font-size", "14");
        watermark.setAttribute("font-weight", "600"); // Much thicker font for export
        watermark.setAttribute("opacity", "0.4");
        watermark.textContent = `generated by chartici.com in ${generationTimeMs} ms`;
        svgClone.appendChild(watermark);
    }

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svgClone);

    // Bake CSS custom properties into hex values for standalone SVG viewers
    // (macOS Preview, Illustrator do not support var())
    Object.entries(colorMap).forEach(([varName, val]) => {
        const regex = new RegExp(`var\\(\\s*${varName}\\s*(?:,[^)]+)?\\)`, 'g');
        svgString = svgString.replace(regex, val);
    });

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
