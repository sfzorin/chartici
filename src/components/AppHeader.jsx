import Icon from './Icons';

export default function AppHeader({
  appTheme,
  toggleAppTheme,
  diagramTitle,
  isHudOpen,
  setIsHudOpen,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  handleDownloadSVG,
  handleDownloadChartici,
  setDiagramData,
  setDiagramTitle,
  setDialogConfig,
  setHelpTab,
  setIsHelpOpen,
  LogoUrl,
  onLogoClick,
  onUndo,
  onRedo,
  canUndo,
  canRedo
}) {
  const handleNewBlankProject = () => {
    setDialogConfig({
      type: 'confirm',
      title: 'New Blank Diagram',
      message: 'Start a new blank diagram? Unsaved changes will be lost.',
      onConfirm: () => {
        setDiagramData({ nodes: [], edges: [], groups: [] });
        setDiagramTitle('Untitled Project');
        setDialogConfig(null);
      },
      onCancel: () => setDialogConfig(null)
    });
  };

  const safeName = diagramTitle ? diagramTitle.replace(/[^a-zA-Z0-9А-Яа-я\s\-_]/g, '').trim() : 'diagram';

  return (
    <header className="app-main-header">

      {/* Left Side: Mobile Menu */}
      <div className="mobile-header-menu" style={{ gap: '8px' }}>
        <button className="app-header-btn no-hover-override" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} style={{ color: 'var(--color-text-main)' }}>
          <Icon name="hamburger" size={24} strokeWidth={1.5} />
        </button>
        <button className={`app-header-btn no-hover-override ${isHudOpen ? 'active' : ''}`} data-tooltip="Toggle Properties" onClick={() => setIsHudOpen(!isHudOpen)} style={{ color: 'var(--color-text-main)' }}>
          <Icon name="sidebar" size={24} strokeWidth={1.5} />
        </button>
        {isMobileMenuOpen && (
          <div className="mobile-dropdown">
            <button className="menu-dropdown-item" onClick={() => { handleNewBlankProject(); setIsMobileMenuOpen(false); }}>
              <Icon name="new-file" size={16} /> New Blank Project
            </button>
            <button className="menu-dropdown-item" onClick={() => { document.getElementById('native-file-upload').click(); setIsMobileMenuOpen(false); }}>
              <Icon name="folder-open" size={16} /> Open Project
            </button>
            <button className="menu-dropdown-item" onClick={() => { handleDownloadChartici(); setIsMobileMenuOpen(false); }}>
              <Icon name="save" size={16} /> Save Project
            </button>
            <div className="file-menu-divider" />
            <button className="menu-dropdown-item" disabled={!canUndo} onClick={() => { onUndo(); setIsMobileMenuOpen(false); }}>
              <Icon name="undo" size={16} /> Undo
            </button>
            <button className="menu-dropdown-item" disabled={!canRedo} onClick={() => { onRedo(); setIsMobileMenuOpen(false); }}>
              <Icon name="redo" size={16} /> Redo
            </button>
            <div className="file-menu-divider" />
            <button className="menu-dropdown-item" onClick={() => { toggleAppTheme(); setIsMobileMenuOpen(false); }}>
              <Icon name={appTheme === 'dark' ? 'sun' : 'moon'} size={16} /> Toggle Theme
            </button>
            <button className="menu-dropdown-item" onClick={() => { setHelpTab('about'); setIsHelpOpen(true); setIsMobileMenuOpen(false); }}>
              <Icon name="help-circle" size={16} /> Documentation
            </button>
          </div>
        )}
      </div>

      <div className="header-brand-group" onClick={onLogoClick} style={{ cursor: 'pointer' }}>
        <img src={LogoUrl} alt="Chartici Logo" className="header-logo" />
        <h1 className="header-title hide-on-mobile">CHARTICI</h1>
      </div>

      <div className="header-center-group">
        <button
          className="btn btn-primary btn-sm download-btn"
          onClick={handleDownloadSVG}
          data-tooltip="Export as SVG"
        >
          <Icon name="download" size={16} />
          <div className="download-btn-label">
            <span className="hide-on-mobile">Download&nbsp;</span>
            <span className="download-title-text">{safeName}</span>
            .svg
          </div>
        </button>
      </div>

      <div className="header-right-group desktop-header-controls">
        <button className="app-header-btn" data-tooltip="Undo (⌘Z)" onClick={onUndo} disabled={!canUndo}>
          <Icon name="undo" size={18} />
        </button>
        <button className="app-header-btn" data-tooltip="Redo (⌘⇧Z)" onClick={onRedo} disabled={!canRedo}>
          <Icon name="redo" size={18} />
        </button>

        <div className="header-divider" />

        <button className="app-header-btn" data-tooltip="New Blank Project" onClick={handleNewBlankProject}>
          <Icon name="new-file" size={18} />
        </button>
        <button className="app-header-btn" data-tooltip="Open Project" onClick={() => document.getElementById('native-file-upload').click()}>
          <Icon name="folder-open" size={18} />
        </button>
        <button className="app-header-btn" data-tooltip="Save Project" onClick={handleDownloadChartici}>
          <Icon name="save" size={18} />
        </button>

        <div className="header-divider" />

        <button className="app-header-btn" data-tooltip="Toggle Theme" onClick={toggleAppTheme} style={{ color: 'var(--color-text-main)' }}>
          <Icon name={appTheme === 'dark' ? 'sun' : 'moon'} size={20} strokeWidth={1.5} />
        </button>
        <button className="app-header-btn" data-tooltip="Documentation" onClick={() => { setHelpTab('about'); setIsHelpOpen(true); }} style={{ color: 'var(--color-text-main)' }}>
          <Icon name="help-circle" size={20} strokeWidth={1.5} />
        </button>
        <button className={`app-header-btn ${isHudOpen ? 'active' : ''}`} data-tooltip="Toggle Properties" onClick={() => setIsHudOpen(!isHudOpen)} style={{ color: 'var(--color-text-main)' }}>
          <Icon name="sidebar" size={20} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
