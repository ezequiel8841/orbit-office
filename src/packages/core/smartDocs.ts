// @orbitoffice/core — Smart Docs shared contract.
// Mirrors the CRM smart-docs vocabulary so the editor and the CRM speak
// the exact same language. Zero deps.

export type SmartDocMappingType =
  | "lead"
  | "custom_field"
  | "organization"
  | "owner"
  | "current_user"
  | "system";

export type SmartDocFormat = "dd/MM/yyyy" | "dd/MM/yyyy HH:mm" | "currency";

export interface SmartDocPlaceholder {
  key: string;
  mapping_type: SmartDocMappingType;
  mapping_key: string;
  format?: SmartDocFormat;
  fallback?: string;
  occurrences?: number;
  /** PPTX only — 1-based slide indices where the placeholder appears. */
  slide_indices?: number[];
}

/** Matches `{{key}}` with an alphanumeric/_-./ key (1..81 chars). */
export const PLACEHOLDER_REGEX = /\{\{\s*([\w][\w.\-]{0,80})\s*\}\}/g;

export function isValidPlaceholderKey(key: string): boolean {
  return /^[\w][\w.\-]{0,80}$/.test(key);
}

// ---------------------------------------------------------------------------
// Mapping options
// ---------------------------------------------------------------------------

export interface MappingOption {
  group: SmartDocMappingType;
  label: string;
  key: string;            // value shown to user / used as mapping_key
  mapping_type: SmartDocMappingType;
  mapping_key: string;
}

export interface BuildMappingOptionsInput {
  /** Custom fields available for the current org. */
  customFields?: { field_key: string; label?: string; is_active?: boolean }[];
}

const FIXED_GROUPS: Omit<MappingOption, "group">[] = /*#__PURE__*/ [
  // lead
  { label: "Título do lead",     key: "title",         mapping_type: "lead", mapping_key: "title" },
  { label: "Nome do contato",    key: "contact_name",  mapping_type: "lead", mapping_key: "contact_name" },
  { label: "E-mail do contato",  key: "contact_email", mapping_type: "lead", mapping_key: "contact_email" },
  { label: "Telefone",           key: "contact_phone", mapping_type: "lead", mapping_key: "contact_phone" },
  { label: "Empresa",            key: "company_name",  mapping_type: "lead", mapping_key: "company_name" },
  { label: "Valor",              key: "value",         mapping_type: "lead", mapping_key: "value" },
  { label: "Probabilidade",      key: "probability",   mapping_type: "lead", mapping_key: "probability" },
  { label: "Origem",             key: "source",        mapping_type: "lead", mapping_key: "source" },
  { label: "Notas",              key: "notes",         mapping_type: "lead", mapping_key: "notes" },
  { label: "CNPJ",               key: "cnpj",          mapping_type: "lead", mapping_key: "cnpj" },
  { label: "CPF",                key: "cpf",           mapping_type: "lead", mapping_key: "cpf" },
  // organization
  { label: "Organização — nome",     key: "name",     mapping_type: "organization", mapping_key: "name" },
  { label: "Organização — CNPJ",     key: "cnpj",     mapping_type: "organization", mapping_key: "cnpj" },
  { label: "Organização — documento", key: "document", mapping_type: "organization", mapping_key: "document" },
  { label: "Organização — setor",    key: "sector",   mapping_type: "organization", mapping_key: "sector" },
  { label: "Organização — endereço", key: "address",  mapping_type: "organization", mapping_key: "address" },
  // owner
  { label: "Responsável — nome",  key: "display_name", mapping_type: "owner", mapping_key: "display_name" },
  { label: "Responsável — login", key: "name",         mapping_type: "owner", mapping_key: "name" },
  { label: "Responsável — e-mail", key: "email",       mapping_type: "owner", mapping_key: "email" },
  // current_user
  { label: "Usuário atual — nome", key: "display_name", mapping_type: "current_user", mapping_key: "display_name" },
  { label: "Usuário atual — login", key: "name",        mapping_type: "current_user", mapping_key: "name" },
  { label: "Usuário atual — e-mail", key: "email",      mapping_type: "current_user", mapping_key: "email" },
  // system
  { label: "Hoje (data)",        key: "today",    mapping_type: "system", mapping_key: "today" },
  { label: "Agora (data + hora)", key: "now",     mapping_type: "system", mapping_key: "now" },
  { label: "Ano corrente",       key: "year",     mapping_type: "system", mapping_key: "year" },
];

export function buildMappingOptions(input: BuildMappingOptionsInput = {}): MappingOption[] {
  const out: MappingOption[] = FIXED_GROUPS.map((o) => ({ ...o, group: o.mapping_type }));
  for (const f of input.customFields ?? []) {
    if (f.is_active === false) continue;
    out.push({
      group: "custom_field",
      label: f.label ?? f.field_key,
      key: f.field_key,
      mapping_type: "custom_field",
      mapping_key: f.field_key,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Heuristic auto-mapping (mirrors backend `autoMapPlaceholder`)
// ---------------------------------------------------------------------------

interface HeuristicRule { match: RegExp; type: SmartDocMappingType; key: string }

const HEURISTICS: HeuristicRule[] = /*#__PURE__*/ [
  { match: /^(titulo|title)$/i,                           type: "lead", key: "title" },
  { match: /^(nome[_-]?contato|contact[_-]?name|nome)$/i, type: "lead", key: "contact_name" },
  { match: /^(email|e[_-]?mail|contact[_-]?email)$/i,     type: "lead", key: "contact_email" },
  { match: /^(telefone|fone|phone|contact[_-]?phone)$/i,  type: "lead", key: "contact_phone" },
  { match: /^(empresa|company|company[_-]?name)$/i,       type: "lead", key: "company_name" },
  { match: /^(valor|value|preco|price)$/i,                type: "lead", key: "value" },
  { match: /^(probabilidade|probability)$/i,              type: "lead", key: "probability" },
  { match: /^(origem|source)$/i,                          type: "lead", key: "source" },
  { match: /^(notas|observacoes|notes)$/i,                type: "lead", key: "notes" },
  { match: /^cnpj$/i,                                     type: "lead", key: "cnpj" },
  { match: /^cpf$/i,                                      type: "lead", key: "cpf" },
  { match: /^(org|organizacao|organization)$/i,           type: "organization", key: "name" },
  { match: /^(setor|sector)$/i,                           type: "organization", key: "sector" },
  { match: /^(endereco|address)$/i,                       type: "organization", key: "address" },
  { match: /^(responsavel|owner)$/i,                      type: "owner", key: "display_name" },
  { match: /^(usuario|user|current[_-]?user)$/i,          type: "current_user", key: "display_name" },
  { match: /^(data|today|hoje)$/i,                        type: "system", key: "today" },
  { match: /^(agora|now|datahora|datetime)$/i,            type: "system", key: "now" },
  { match: /^(ano|year)$/i,                               type: "system", key: "year" },
];

export function autoMapPlaceholder(key: string): { mapping_type: SmartDocMappingType; mapping_key: string } {
  for (const rule of HEURISTICS) {
    if (rule.match.test(key)) return { mapping_type: rule.type, mapping_key: rule.key };
  }
  return { mapping_type: "custom_field", mapping_key: key };
}

// ---------------------------------------------------------------------------
// suggestMapping — Levenshtein normalised, rejects score > 60% of length.
// ---------------------------------------------------------------------------

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export function suggestMapping(key: string, options: MappingOption[]): MappingOption | null {
  const target = norm(key);
  if (!target) return null;
  let best: { opt: MappingOption; score: number } | null = null;
  for (const opt of options) {
    for (const candidate of [opt.key, opt.label]) {
      const c = norm(candidate);
      if (!c) continue;
      const d = lev(target, c);
      const max = Math.max(target.length, c.length);
      const score = d / max; // 0 = perfect
      if (!best || score < best.score) best = { opt, score };
    }
  }
  if (!best) return null;
  return best.score <= 0.6 ? best.opt : null;
}

// ---------------------------------------------------------------------------
// Format helper used at runtime by the host (not by the editor).
// Exposed for parity testing.
// ---------------------------------------------------------------------------

export function formatPlaceholderValue(value: unknown, fmt?: SmartDocFormat): string {
  if (value == null || value === "") return "";
  if (fmt === "currency") {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n)) return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return String(value);
  }
  if (fmt === "dd/MM/yyyy" || fmt === "dd/MM/yyyy HH:mm") {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    if (fmt === "dd/MM/yyyy") return `${dd}/${mm}/${yyyy}`;
    const HH = String(d.getHours()).padStart(2, "0");
    const MM = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${HH}:${MM}`;
  }
  return String(value);
}
