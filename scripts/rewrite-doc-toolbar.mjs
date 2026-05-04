import { readFileSync, writeFileSync } from 'fs';

const code = readFileSync('src/packages/doc/Doc.tsx', 'utf8');

const si = code.indexOf('      <div\n        className="oo-toolbar"');
const END_BTN = '<button className="oo-btn" title="Print preview" onClick={() => setPrintPreviewOpen(true)}><IconPrinter />{t("lbl.print")}</button>\n      </div>';
const ei = code.indexOf(END_BTN) + END_BTN.length;

const NEW_TOOLBAR = `      <div
        className="oo-toolbar"
        style={{
          display: "flex",
          flexWrap: "nowrap",
          gap: 0,
          borderBottom: "1px solid var(--oo-color-border)",
          background: "var(--oo-color-bg-alt, var(--oo-color-bg))",
          alignItems: "stretch",
          overflowX: "auto",
        }}
      >
        {/* ── Histórico ── */}
        <ToolGrp label={t("grp.history")}>
          <button className="oo-btn" disabled={!state.canUndo} title={t("common.undo")} onClick={() => ctrl.undo()}><IconUndo />{t("lbl.undo")}</button>
          <button className="oo-btn" disabled={!state.canRedo} title={t("common.redo")} onClick={() => ctrl.redo()}><IconRedo />{t("lbl.redo")}</button>
        </ToolGrp>

        {/* ── Estilo ── */}
        <ToolGrp label={t("grp.style")}>
          <select
            className="oo-btn"
            onChange={(e) => ctrl.exec({ kind: "setBlock", tag: e.target.value as any })}
            defaultValue="p"
            title={t("doc.blockStyle")}
            style={{ minWidth: 110 }}
          >
            <option value="p">Body</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
            <option value="h5">Heading 5</option>
            <option value="h6">Heading 6</option>
            <option value="blockquote">Quote</option>
            <option value="pre">Code</option>
          </select>
        </ToolGrp>

        {/* ── Fonte ── */}
        <ToolGrp label={t("grp.font")}>
          <select
            className="oo-btn"
            defaultValue=""
            title="Font family"
            style={{ minWidth: 90 }}
            onChange={(e) => {
              if (e.target.value) ctrl.exec({ kind: "fontFamily", value: e.target.value });
              e.currentTarget.value = "";
            }}
          >
            <option value="">Font</option>
            <option value="Arial">Arial</option>
            <option value="Arial Black">Arial Black</option>
            <option value="Calibri">Calibri</option>
            <option value="Courier New">Courier New</option>
            <option value="Georgia">Georgia</option>
            <option value="Impact">Impact</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Trebuchet MS">Trebuchet MS</option>
            <option value="Verdana">Verdana</option>
          </select>
          <select
            className="oo-btn"
            defaultValue=""
            title={t("doc.fontSize")}
            style={{ width: 58 }}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (v) ctrl.exec({ kind: "fontSize", px: v });
              e.currentTarget.value = "";
            }}
          >
            <option value="">Size</option>
            {[10, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="oo-sep" />
          <button className="oo-btn" title={t("doc.bold")} onClick={() => ctrl.exec({ kind: "toggleMark", tag: "b" })}><IconBold /></button>
          <button className="oo-btn" title={t("doc.italic")} onClick={() => ctrl.exec({ kind: "toggleMark", tag: "i" })}><IconItalic /></button>
          <button className="oo-btn" title={t("doc.underline")} onClick={() => ctrl.exec({ kind: "toggleMark", tag: "u" })}><IconUnderline /></button>
          <button className="oo-btn" title={t("doc.strike")} onClick={() => ctrl.exec({ kind: "toggleMark", tag: "s" })}><IconStrikethrough />{t("lbl.strike")}</button>
          <button className="oo-btn" title={t("doc.code")} onClick={() => ctrl.exec({ kind: "toggleMark", tag: "code" })}><IconCode />{t("lbl.code")}</button>
          <button className="oo-btn" title="Subscript (Ctrl+,)" onClick={() => ctrl.exec({ kind: "toggleMark", tag: "sub" })}><IconSubscript />{t("lbl.sub")}</button>
          <button className="oo-btn" title="Superscript (Ctrl+.)" onClick={() => ctrl.exec({ kind: "toggleMark", tag: "sup" })}><IconSuperscript />{t("lbl.sup")}</button>
          <span className="oo-sep" />
          <ColorPick title={t("doc.textColor")} icon="A" apply={(c) => ctrl.exec({ kind: "color", value: c })} />
          <ColorPick title={t("doc.highlight")} icon="H" apply={(c) => ctrl.exec({ kind: "highlight", value: c })} />
          <button className="oo-btn" title="Clear formatting (Ctrl+Space)" onClick={() => ctrl.exec({ kind: "clearFormatting" })}><IconClearFormatting />{t("lbl.clearFormat")}</button>
        </ToolGrp>

        {/* ── Parágrafo ── */}
        <ToolGrp label={t("grp.paragraph")}>
          <button className="oo-btn" title={t("doc.alignLeft")} onClick={() => ctrl.exec({ kind: "align", value: "left" })}><IconAlignLeft /></button>
          <button className="oo-btn" title={t("doc.alignCenter")} onClick={() => ctrl.exec({ kind: "align", value: "center" })}><IconAlignCenter /></button>
          <button className="oo-btn" title={t("doc.alignRight")} onClick={() => ctrl.exec({ kind: "align", value: "right" })}><IconAlignRight /></button>
          <button className="oo-btn" title={t("doc.alignJustify")} onClick={() => ctrl.exec({ kind: "align", value: "justify" })}><IconAlignJustify /></button>
          <span className="oo-sep" />
          <button className="oo-btn" title={t("doc.bulletList")} onClick={() => ctrl.exec({ kind: "list", ordered: false })}><IconList />{t("lbl.list")}</button>
          <button className="oo-btn" title={t("doc.numberedList")} onClick={() => ctrl.exec({ kind: "list", ordered: true })}><IconListOrdered />{t("lbl.orderedList")}</button>
          <button className="oo-btn" title={t("doc.checklist")} onClick={() => ctrl.exec({ kind: "checklist" })}><IconCheckSquare />{t("lbl.checklist")}</button>
          <button className="oo-btn" title={t("doc.divider")} onClick={() => ctrl.exec({ kind: "hr" })}><IconMinus />{t("lbl.divider")}</button>
          <span className="oo-sep" />
          <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <IconLineHeight style={{ opacity: 0.5, flexShrink: 0 }} />
            <select className="oo-btn" title="Line spacing" value={lineSpacing}
              onChange={(e) => setLineSpacing(e.target.value)} style={{ minWidth: 56 }}>
              <option value="1">1.0×</option>
              <option value="1.15">1.15×</option>
              <option value="1.5">1.5×</option>
              <option value="1.6">1.6×</option>
              <option value="2">2.0×</option>
              <option value="2.5">2.5×</option>
            </select>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 2 }} title="Letter spacing (px)">
            <IconType style={{ opacity: 0.5, flexShrink: 0 }} />
            <input type="number" min={-3} max={20} step={0.5} value={letterSpacing}
              className="oo-btn" style={{ width: 46, padding: "0 4px", fontSize: 11, textAlign: "center" }}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                setLetterSpacingState(v);
                ctrl.exec({ kind: "letterSpacing", value: v });
              }} />
          </span>
          <div style={{ position: "relative" }}>
            <button className="oo-btn" title="Text effects (shadow)" onClick={() => setTextEffectsOpen((v) => !v)}
              style={{ fontWeight: 700, fontSize: 12, textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}>Fx</button>
            {textEffectsOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30, background: "var(--oo-color-bg)", border: "1px solid var(--oo-color-border)", borderRadius: 6, padding: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", minWidth: 140 }}>
                {TEXT_SHADOW_PRESETS.map((p) => (
                  <button key={p.label} className="oo-btn"
                    style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 2, fontSize: 12, textShadow: p.value ?? "none" }}
                    onMouseDown={(e) => { e.preventDefault(); ctrl.exec({ kind: "textShadow", value: p.value }); setTextEffectsOpen(false); }}>
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </ToolGrp>

        {/* ── Inserir ── */}
        <ToolGrp label={t("grp.insert")}>
          <button
            className="oo-btn"
            title={t("doc.link")}
            onClick={() => {
              const href = prompt("Link URL (empty to remove)") ?? "";
              ctrl.exec({ kind: "link", href: href.trim() === "" ? null : href });
            }}
          ><IconLink />{t("lbl.link")}</button>
          <button
            className="oo-btn"
            title={t("doc.table")}
            onClick={() => ctrl.exec({ kind: "table", rows: 3, cols: 3 })}
          ><IconSheet />{t("lbl.table")}</button>
          <button
            className="oo-btn"
            title={t("doc.image")}
            onClick={() => {
              const src = prompt("Image URL"); if (src) ctrl.exec({ kind: "image", src });
            }}
          ><IconImage />{t("lbl.image")}</button>
          <button className="oo-btn" title="Insert math equation" onClick={() => setMathOpen(true)}><IconSigma />{t("lbl.math")}</button>
          <button className="oo-btn" title="Table of Contents" onClick={insertToc}><IconToc />{t("lbl.toc")}</button>
          <button className="oo-btn" title="Page break" onClick={() => ctrl.exec({ kind: "pageBreak" })}><IconPageBreak />{t("lbl.pageBreak")}</button>
        </ToolGrp>

        {/* ── Conteúdo ── */}
        <ToolGrp label={t("grp.content")}>
          <button className="oo-btn" title="Insert date field (/date)" onClick={() => ctrl.exec({ kind: "insertField", field: "date" })}><IconRefreshCw />{t("lbl.dateField")}</button>
          <button className="oo-btn" title="Insert footnote (/footnote)"
            onClick={() => { const t2 = prompt("Footnote text:"); if (t2) ctrl.exec({ kind: "insertFootnote", text: t2 }); }}><IconBookmark />{t("lbl.footnote")}</button>
          <button className="oo-btn" title="Add comment" onClick={doAddComment}
            style={{ background: Object.values(comments).some((c) => !c.resolved) ? "rgba(255,220,0,0.2)" : undefined }}>
            <IconMessageSquare />{t("lbl.commentVerb")}
          </button>
        </ToolGrp>

        {/* ── Página ── */}
        <ToolGrp label={t("grp.page")}>
          <button className="oo-btn" title="Page settings" onClick={() => setPageSettingsOpen((v) => !v)}
            style={{ background: pageSettingsOpen ? "var(--oo-color-selection, rgba(37,99,235,0.1))" : undefined }}>
            <IconSettings />{t("lbl.pageSettings")}
          </button>
        </ToolGrp>

        <div style={{ flex: 1, minWidth: 8 }} />

        {/* ── Exibir ── */}
        <ToolGrp label={t("grp.view")}>
          <button className="oo-btn" title={t("common.findShortcut")} onClick={() => setFindOpen((v) => !v)}><IconSearch />{t("lbl.find")}</button>
          <button className="oo-btn" title="Document statistics" onClick={() => setStatsOpen(true)}><IconBarChart />{t("lbl.stats")}</button>
          <button className="oo-btn" title="Heading navigator" onClick={() => setNavigatorOpen((v) => !v)}
            style={{ background: navigatorOpen ? "var(--oo-color-selection, rgba(37,99,235,0.1))" : undefined }}>
            <IconPanelLeft />{t("lbl.navigator")}
          </button>
          <button className="oo-btn" title="Comments panel" onClick={() => setCommentsOpen((v) => !v)}
            style={{ background: commentsOpen ? "var(--oo-color-selection, rgba(37,99,235,0.1))" : undefined }}>
            <IconMessageSquare />{t("lbl.comments")}
          </button>
        </ToolGrp>

        {/* ── Exportar ── */}
        <ToolGrp label={t("grp.export")} end>
          {!hideImport && (
            <button className="oo-btn" title={t("doc.importMd")} onClick={importMd}><IconUpload />{t("lbl.importFile")}</button>
          )}
          {!hideExport && (
            <>
              <button className="oo-btn" title="Export TXT" onClick={exportTxt}><IconFileText />{t("lbl.exportTxt")}</button>
              <button className="oo-btn" title={t("doc.exportMd")} onClick={exportMd}>{t("lbl.exportMd")}</button>
              <button className="oo-btn" title={t("doc.exportHtml")} onClick={exportHtml}><IconDownload />{t("lbl.exportHtml")}</button>
              <button className="oo-btn" title="Export .docx (Word)" onClick={() => exportDocx(ctrl.getHtml())}><IconFileWord />{t("lbl.exportWord")}</button>
            </>
          )}
          <button className="oo-btn" title="Print preview" onClick={() => setPrintPreviewOpen(true)}><IconPrinter />{t("lbl.print")}</button>
        </ToolGrp>
      </div>`;

const result = code.slice(0, si) + NEW_TOOLBAR + code.slice(ei);
writeFileSync('src/packages/doc/Doc.tsx', result);
console.log('Done. File length:', result.length);
