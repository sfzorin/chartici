import { PALETTES } from './constants.js';

/**
 * Export the diagram SVG canvas to a downloadable file.
 * Handles: viewport reset, CSS variable baking, cleanup of UI artifacts.
 * 
 * @param {SVGElement} svgElement - The live SVG DOM element
 * @param {string} paletteTheme - Current palette key (e.g. 'blue', 'grey')
 * @param {string} diagramTitle - Title for the filename
 */
export function downloadSVG(svgElement, paletteTheme, diagramTitle) {
    const svgClone = svgElement.cloneNode(true);
    
    const viewportGroup = svgClone.querySelector('#diagram-viewport');
    if (viewportGroup) viewportGroup.removeAttribute('transform');

    const canvasPaperRect = svgClone.querySelector('#canvas-paper rect:not(.preview-bg-rect)') || svgClone.querySelector('#canvas-paper rect');
    if (canvasPaperRect) {
       const x = canvasPaperRect.getAttribute('x');
       const y = canvasPaperRect.getAttribute('y');
       const w = canvasPaperRect.getAttribute('width');
       const h = canvasPaperRect.getAttribute('height');
       svgClone.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
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

    // Remove editor-only checkerboard preview rectangles inside the canvas
    const previewRects = svgClone.querySelectorAll('.preview-bg-rect');
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
        '--canvas-bg': rootStyles.getPropertyValue('--canvas-bg').trim() || '#ffffff',
        '--border-color-active': rootStyles.getPropertyValue('--border-color-active').trim() || '#000000',
        '--color-text-main': rootStyles.getPropertyValue('--color-text-main').trim() || '#1A1A1A',
        '--color-secondary': rootStyles.getPropertyValue('--color-secondary').trim() || '#000000',
        '--grid-line-color': rootStyles.getPropertyValue('--grid-line-color').trim() || 'rgba(0,0,0,0.05)',
        '--diagram-text': svgElement.style.getPropertyValue('--diagram-text').trim() || '#1a1a1a',
        '--diagram-edge': svgElement.style.getPropertyValue('--diagram-edge').trim() || '#475569',
        '--diagram-group': svgElement.style.getPropertyValue('--diagram-group').trim() || '#64748b',
        '--unfilled-text-color': PALETTES[paletteTheme].unfilledText
    };

    for (let i = 0; i < paletteVars.length; i++) {
      const hex = paletteVars[i];
      colorMap[`--color-${i}`] = hex.bg;
      colorMap[`--text-color-${i}`] = hex.text;
      if (hex.border) colorMap[`--border-color-${i}`] = hex.border;
      else colorMap[`--border-color-${i}`] = hex.bg;
    }

    const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
    styleElement.textContent = `text { font-family: Inter, -apple-system, sans-serif; }`;
    svgClone.insertBefore(styleElement, svgClone.firstChild);

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
