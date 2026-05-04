import { readFileSync, writeFileSync } from 'fs';

const code = readFileSync('src/packages/doc/Doc.tsx', 'utf8');

// ── 1. Replace Page group in Insert tab to add Header/Footer/Background buttons ──
const OLD_PAGE_GRP = `          {/* ── Página ── */}
          <ToolGrp label={t("grp.page")}>
            <button className="oo-btn" title="Page settings" onClick={() => setPageSettingsOpen((v) => !v)}
              style={{ background: pageSettingsOpen ? "var(--oo-color-selection, rgba(37,99,235,0.1))" : undefined }}>
              <IconSettings />{t("lbl.pageSettings")}
            </button>
          </ToolGrp>`;

const NEW_PAGE_GRP = `          {/* ── Página ── */}
          <ToolGrp label={t("grp.page")}>
            <button className="oo-btn" title="Page settings" onClick={() => setPageSettingsOpen((v) => !v)}
              style={{ background: pageSettingsOpen ? "var(--oo-color-selection, rgba(37,99,235,0.1))" : undefined }}>
              <IconSettings />{t("lbl.pageSettings")}
            </button>
            <button className="oo-btn" title="Toggle header" onClick={() => setShowHeader((v) => !v)}
              style={{ background: showHeader ? "var(--oo-color-selection, rgba(37,99,235,0.1))" : undefined }}>
              ▤ {t("lbl.header")}
            </button>
            <button className="oo-btn" title="Toggle footer" onClick={() => setShowFooter((v) => !v)}
              style={{ background: showFooter ? "var(--oo-color-selection, rgba(37,99,235,0.1))" : undefined }}>
              ▤ {t("lbl.footer")}
            </button>
            <button className="oo-btn" title="Page background" onClick={() => setBgDialogOpen(true)}>
              <IconImage />{t("lbl.pageBg")}
            </button>
          </ToolGrp>`;

// ── 2. Replace the main editor layout to use paper view ──
const OLD_LAYOUT = `      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {navigatorOpen && (
          <NavigatorPanel editorRef={editorRef} onClose={() => setNavigatorOpen(false)} />
        )}
        <div
          ref={editorRef}
          className={\`oo-doc-page\${pageColumns === 2 ? " oo-doc-cols-2" : pageColumns === 3 ? " oo-doc-cols-3" : ""}\`}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          spellCheck
          onInput={onInput}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          style={{
            flex: 1,
            overflow: "auto",
            padding: \`\${pageMargins}px max(\${pageMargins}px, 8%)\`,
            background: "var(--oo-color-bg)",
            color: "var(--oo-color-fg)",
            outline: "none",
            lineHeight: lineSpacing,
            fontSize: 15,
            ...(pageOrientation === "landscape" ? { maxWidth: "none" } : {}),
          }}
        />
        {placeholderOptions && placeholderOptions.length > 0 && (
          <PlaceholderPalette
            options={placeholderOptions}
            detected={detectedPlaceholders}
            onInsert={(ph) => ctrl.exec({ kind: "insertHtml", html: buildChipHtml(ph) })}
          />
        )}
        {commentsOpen && (
          <CommentsPanel
            editorRef={editorRef}
            comments={comments}
            onResolve={resolveComment}
            onDelete={deleteComment}
            onClose={() => setCommentsOpen(false)}
          />
        )}
      </div>`;

const NEW_LAYOUT = `      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {navigatorOpen && (
          <NavigatorPanel editorRef={editorRef} onClose={() => setNavigatorOpen(false)} />
        )}
        <div className="oo-doc-outer" style={{ flex: 1 }}>
          <div
            className={"oo-doc-paper" + (pageOrientation === "landscape" ? " landscape" : "")}
            style={{
              background:
                pageBgType === "image"
                  ? \`url("\${pageBgValue}") center/cover no-repeat\`
                  : pageBgType === "color"
                  ? pageBgValue
                  : undefined,
            }}
          >
            {showHeader && (
              <div
                ref={headerRef}
                className="oo-page-header"
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => setHeaderHtml(e.currentTarget.innerHTML)}
              />
            )}
            <div
              ref={editorRef}
              className={\`oo-doc-page\${pageColumns === 2 ? " oo-doc-cols-2" : pageColumns === 3 ? " oo-doc-cols-3" : ""}\`}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              spellCheck
              onInput={onInput}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              style={{
                flex: 1,
                padding: \`\${pageMargins}px\`,
                background: "transparent",
                color: "var(--oo-color-fg)",
                outline: "none",
                lineHeight: lineSpacing,
                fontSize: 15,
              }}
            />
            {showFooter && (
              <div
                ref={footerRef}
                className="oo-page-footer"
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => setFooterHtml(e.currentTarget.innerHTML)}
              />
            )}
          </div>
          {placeholderOptions && placeholderOptions.length > 0 && (
            <PlaceholderPalette
              options={placeholderOptions}
              detected={detectedPlaceholders}
              onInsert={(ph) => ctrl.exec({ kind: "insertHtml", html: buildChipHtml(ph) })}
            />
          )}
        </div>
        {commentsOpen && (
          <CommentsPanel
            editorRef={editorRef}
            comments={comments}
            onResolve={resolveComment}
            onDelete={deleteComment}
            onClose={() => setCommentsOpen(false)}
          />
        )}
      </div>`;

// ── 3. Add background dialog before the closing of the root div ──
const CLOSE_ROOT = `      {mathOpen && (`;

const BG_DIALOG = `      {bgDialogOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--oo-color-bg)", border: "1px solid var(--oo-color-border)", borderRadius: 10, padding: 24, width: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.22)" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>{t("lbl.pageBg")}</div>

            {/* Type selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["none","color","image"] as const).map((type) => (
                <button key={type} className="oo-btn"
                  style={{ background: pageBgType === type ? "var(--oo-color-selection,rgba(37,99,235,0.12))" : undefined, fontWeight: pageBgType === type ? 600 : undefined }}
                  onClick={() => setPageBgType(type)}>
                  {type === "none" ? "None" : type === "color" ? "Color" : "Image"}
                </button>
              ))}
            </div>

            {pageBgType === "color" && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
                <input type="color" value={pageBgValue || "#ffffff"}
                  style={{ width: 40, height: 32, border: "1px solid var(--oo-color-border)", borderRadius: 4, cursor: "pointer" }}
                  onChange={(e) => setPageBgValue(e.target.value)} />
                <input type="text" className="oo-btn" value={pageBgValue}
                  placeholder="#ffffff or rgba(…)"
                  style={{ flex: 1 }}
                  onChange={(e) => setPageBgValue(e.target.value)} />
              </div>
            )}

            {pageBgType === "image" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                <label style={{ fontSize: 12, opacity: 0.65, fontWeight: 500 }}>Image URL</label>
                <input type="text" className="oo-btn" value={pageBgValue}
                  placeholder="https://example.com/image.jpg"
                  style={{ width: "100%" }}
                  onChange={(e) => setPageBgValue(e.target.value)} />
                <label style={{ fontSize: 12, opacity: 0.65, fontWeight: 500 }}>Or upload from computer</label>
                <input type="file" accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => setPageBgValue(ev.target?.result as string ?? "");
                    reader.readAsDataURL(file);
                  }} />
                {pageBgValue && (
                  <img src={pageBgValue} alt="preview"
                    style={{ maxHeight: 110, objectFit: "cover", borderRadius: 6, border: "1px solid var(--oo-color-border)" }} />
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              {pageBgType !== "none" && (
                <button className="oo-btn" onClick={() => { setPageBgType("none"); setPageBgValue(""); }}>Clear</button>
              )}
              <button className="oo-btn" style={{ fontWeight: 600 }} onClick={() => setBgDialogOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {mathOpen && (`;

let result = code;
result = result.replace(OLD_PAGE_GRP, NEW_PAGE_GRP);
result = result.replace(OLD_LAYOUT, NEW_LAYOUT);
result = result.replace(CLOSE_ROOT, BG_DIALOG);

writeFileSync('src/packages/doc/Doc.tsx', result);
console.log('Done. File length:', result.length);
console.log('Page grp replaced:', !code.includes(NEW_PAGE_GRP));
console.log('Layout replaced:', !code.includes(NEW_LAYOUT));
