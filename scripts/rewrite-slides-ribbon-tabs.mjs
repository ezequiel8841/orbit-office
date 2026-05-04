import { readFileSync, writeFileSync } from 'fs';

const code = readFileSync('src/packages/slides/Slides.tsx', 'utf8');
const NL = '\r\n'; // file uses CRLF

// 1) Inject ribbonTab state after useT() in MainToolbar
const FN_START = 'function MainToolbar(';
const USET_IN_FN = '  const t = useT();\r\n  return (';
const si_fn = code.indexOf(FN_START);
const USET_POS = code.indexOf(USET_IN_FN, si_fn);
const code1 = code.slice(0, USET_POS + '  const t = useT();'.length)
  + `\r\n  const [ribbonTab, setRibbonTab] = useState("home");`
  + code.slice(USET_POS + '  const t = useT();'.length);

// 2) Replace the flat toolbar div with the tabbed ribbon
// toolbar starts at the <div\r\n      className="oo-toolbar"
const OLD_TB_START = '    <div\r\n      className="oo-toolbar"';
const si = code1.indexOf(OLD_TB_START, code1.indexOf(FN_START));

// toolbar ends just before the closing of MainToolbar function
const END_MARKER = '</div>\r\n  );\r\n}\r\n\r\n/* ─────────────────────────── Context Toolbar';
const ei_raw = code1.indexOf(END_MARKER, si);
const ei = ei_raw + '</div>'.length;

const placeholderKey = '`${o.mapping_type}.${o.mapping_key}`';
const placeholderVal = `o.mapping_key.includes(".") ? o.mapping_key.split(".").pop()! : o.mapping_key`;
const emptyOptLabel = '{`{{ }}`}';

const NEW_RIBBON = `    <div className="oo-ribbon-tabs">
        {[
          { id: "home",    label: t("tab.home") },
          { id: "insert",  label: t("tab.insert") },
          { id: "arrange", label: t("tab.arrange") },
          { id: "view",    label: t("tab.view") },
          { id: "file",    label: t("tab.file") },
        ].map(({ id, label }) => (
          <button key={id}
            className={"oo-ribbon-tab" + (ribbonTab === id ? " oo-active" : "")}
            onClick={() => setRibbonTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="oo-ribbon-pane">
        {ribbonTab === "home" && <>
          {/* ── Histórico ── */}
          <ToolGrp label={t("grp.history")}>
            <button className="oo-btn" disabled={!ctrl.canUndo() || readOnly} onClick={() => ctrl.undo()} title={t("common.undo")}>
              <IconUndo />{t("lbl.undo")}
            </button>
            <button className="oo-btn" disabled={!ctrl.canRedo() || readOnly} onClick={() => ctrl.redo()} title={t("common.redo")}>
              <IconRedo />{t("lbl.redo")}
            </button>
          </ToolGrp>

          {/* ── Apresentação ── */}
          <ToolGrp label={t("grp.presentation")}>
            <select className="oo-btn" value={deck.themeId} onChange={(e) => ctrl.setTheme(e.target.value)}
              disabled={readOnly} title={t("slides.theme")} style={{ maxWidth: 88 }}>
              {THEMES.map((th) => <option key={th.id} value={th.id}>{th.name}</option>)}
            </select>
            <select className="oo-btn" defaultValue="" title={t("slides.newSlideLayout")} disabled={readOnly}
              onChange={(e) => { if (e.target.value) ctrl.addSlide(e.target.value as LayoutId); e.currentTarget.value = ""; }}>
              <option value="">{t("slides.newSlide")}</option>
              <option value="title">{t("slides.layoutTitle")}</option>
              <option value="titleContent">{t("slides.layoutTitleContent")}</option>
              <option value="twoContent">{t("slides.layoutTwoContent")}</option>
              <option value="section">{t("slides.layoutSection")}</option>
              <option value="blank">{t("slides.layoutBlank")}</option>
            </select>
          </ToolGrp>
        </>}

        {ribbonTab === "insert" && <>
          {/* ── Inserir ── */}
          <ToolGrp label={t("grp.insert")}>
            <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.addText()} title={t("slides.addText")}
              style={{ fontWeight: 700, fontSize: 14, minWidth: 28 }}>
              <span style={{ fontWeight: 700 }}>T</span>{t("lbl.text")}
            </button>
            {SHAPE_BTNS.map(({ kind, icon, title }) => (
              <button key={kind} className="oo-btn" disabled={readOnly} onClick={() => onAddShape(kind)} title={title}>
                {icon}<span className="oo-lbl">{title}</span>
              </button>
            ))}
            <button className="oo-btn" disabled={readOnly} onClick={onPickImageFile} title="Image from file"><IconImage />{t("lbl.image")}</button>
            <button className="oo-btn" disabled={readOnly} onClick={onPickImageUrl} title="Image from URL"><IconImage style={{ opacity: 0.7 }} />{t("lbl.imageUrl")}</button>
            {placeholderOptions && placeholderOptions.length > 0 && (
              <select className="oo-btn" defaultValue="" disabled={readOnly} title={t("common.placeholderInsert")}
                onChange={(e) => { if (e.target.value) ctrl.insertPlaceholder(e.target.value); e.currentTarget.value = ""; }}>
                <option value="">` + emptyOptLabel + `</option>
                {placeholderOptions.map((o) => (
                  <option key={` + placeholderKey + `}
                    value={` + placeholderVal + `}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </ToolGrp>
        </>}

        {ribbonTab === "arrange" && <>
          {/* ── Organizar ── */}
          <ToolGrp label={t("grp.arrange")}>
            <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.bringToFront()} title="Bring to front"><IconBringToFront />{t("lbl.bringFront")}</button>
            <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.bringForward()} title={t("slides.bringForward")}><IconBringForward />{t("lbl.bringForward")}</button>
            <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.sendBackward()} title={t("slides.sendBackward")}><IconSendBackward />{t("lbl.sendBackward")}</button>
            <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.sendToBack()} title="Send to back"><IconSendToBack />{t("lbl.sendBack")}</button>
            {selCount >= 2 && (
              <>
                <span className="oo-sep" />
                <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.alignSelected("left")} title="Align left"><IconAlignStartH /></button>
                <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.alignSelected("centerH")} title="Center horizontally"><IconAlignCenterH /></button>
                <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.alignSelected("right")} title="Align right"><IconAlignEndH /></button>
                <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.alignSelected("top")} title="Align top"><IconAlignStartV /></button>
                <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.alignSelected("middle")} title="Center vertically"><IconAlignCenterV /></button>
                <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.alignSelected("bottom")} title="Align bottom"><IconAlignEndV /></button>
                {selCount >= 3 && (
                  <>
                    <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.distributeSelected("h")} title="Distribute horizontally"><IconSpaceX /></button>
                    <button className="oo-btn" disabled={readOnly} onClick={() => ctrl.distributeSelected("v")} title="Distribute vertically"><IconSpaceY /></button>
                  </>
                )}
              </>
            )}
          </ToolGrp>
        </>}

        {ribbonTab === "view" && <>
          {/* ── Exibir ── */}
          <ToolGrp label={t("grp.view")}>
            <button className="oo-btn" onClick={onZoomOut} title="Zoom out (Ctrl+-)"><IconZoomOut /></button>
            <button className="oo-btn" onClick={onZoomReset} title="Reset zoom (Ctrl+0)"
              style={{ minWidth: 46, fontVariantNumeric: "tabular-nums", fontSize: 12 }}>
              {Math.round(zoom * 100)}%
            </button>
            <button className="oo-btn" onClick={onZoomIn} title="Zoom in (Ctrl+=)"><IconZoomIn /></button>
            <span className="oo-sep" />
            <button className="oo-btn" onClick={onToggleGrid} title={t("slides.gridView")}><IconLayoutGrid />{t("lbl.gridView")}</button>
            <button className="oo-btn" onClick={onToggleNotes} title={t("slides.toggleNotes")}><IconNotes />{t("lbl.notes")}</button>
            <button className="oo-btn" onClick={onPresent} title={t("slides.presentTitle")}
              style={{ color: "var(--oo-color-primary, #2563eb)" }}><IconPlay />{t("lbl.present")}</button>
          </ToolGrp>
        </>}

        {ribbonTab === "file" && <>
          {/* ── Arquivo ── */}
          <ToolGrp label={t("grp.export")}>
            {!hideImport && <button className="oo-btn" disabled={readOnly} onClick={onImport} title={t("slides.importDeck")}><IconUpload />{t("lbl.importFile")}</button>}
            {!hideExport && <button className="oo-btn" onClick={onExport} title={t("slides.exportDeck")}><IconDownload />{t("lbl.exportMd")}</button>}
          </ToolGrp>
        </>}
      </div>`;

const result = code1.slice(0, si) + NEW_RIBBON + code1.slice(ei);
writeFileSync('src/packages/slides/Slides.tsx', result);
console.log('Done. File length:', result.length);
