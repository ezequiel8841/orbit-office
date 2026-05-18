// Multilingual function name aliases (Portuguese, Spanish → English canonical).
// Names are uppercased; the parser already uppercases call names.
//
// Add entries here to support more localized names. Accent-insensitive matching
// is provided via `stripAccents`.

const RAW: Record<string, string> = {
  // ---- Math / aggregate ----
  SOMA: "SUM",
  SUMA: "SUM",
  MEDIA: "AVERAGE",
  PROMEDIO: "AVERAGE",
  CONT_NUM: "COUNT",
  CONTAR: "COUNT",
  CONT_VALORES: "COUNTA",
  CONTARA: "COUNTA",
  MAXIMO: "MAX",
  MINIMO: "MIN",
  ARRED: "ROUND",
  REDONDEAR: "ROUND",
  ARREDONDAR: "ROUND",
  RAIZ: "SQRT",
  RAIZQ: "SQRT",
  POTENCIA: "POWER",
  RESTO: "MOD",
  RESIDUO: "MOD",
  TRUNCAR: "FLOOR",
  TETO: "CEILING",
  MULTIPLO_SUPERIOR: "CEILING",
  MULTIPLO_INFERIOR: "FLOOR",
  ALEATORIO: "RAND",
  ALEATORIOENTRE: "RANDBETWEEN",

  // ---- Logic ----
  SE: "IF",
  SI: "IF",
  SEERRO: "IFERROR",
  SI_ERROR: "IFERROR",
  SIERROR: "IFERROR",
  E: "AND",
  Y: "AND",
  OU: "OR",
  O: "OR",
  NAO: "NOT",
  NO: "NOT",
  VERDADEIRO: "TRUE",
  FALSO: "FALSE",
  VERDADERO: "TRUE",

  // ---- Info ----
  EVAZIO: "ISBLANK",
  ESBLANCO: "ISBLANK",
  ENUMERO: "ISNUMBER",
  ESNUMERO: "ISNUMBER",
  ETEXTO: "ISTEXT",
  ESTEXTO: "ISTEXT",
  EERRO: "ISERROR",
  ESERROR: "ISERROR",
  ENAODISP: "ISNA",
  ESNOD: "ISNA",
  ELOGICO: "ISLOGICAL",
  ESLOGICO: "ISLOGICAL",

  // ---- Text ----
  CONCATENAR: "CONCATENATE",
  UNIRCADENAS: "CONCATENATE",
  NUM_CARACT: "LEN",
  LARGO: "LEN",
  MAIUSCULA: "UPPER",
  MAIUSCULAS: "UPPER",
  MAYUSC: "UPPER",
  MINUSCULA: "LOWER",
  MINUSCULAS: "LOWER",
  MINUSC: "LOWER",
  ARRUMAR: "TRIM",
  ESPACIOS: "TRIM",
  ESQUERDA: "LEFT",
  IZQUIERDA: "LEFT",
  DIREITA: "RIGHT",
  DERECHA: "RIGHT",
  EXT_TEXTO: "MID",
  EXTRAE: "MID",
  PRI_MAIUSCULA: "PROPER",
  NOMPROPIO: "PROPER",
  SUBSTITUIR: "SUBSTITUTE",
  SUSTITUIR: "SUBSTITUTE",
  MUDAR: "REPLACE",
  REEMPLAZAR: "REPLACE",
  PROCURAR: "FIND",
  ENCONTRAR: "FIND",
  HALLAR: "SEARCH",
  PESQUISAR: "SEARCH",
  TEXTO: "TEXT",
  VALOR: "VALUE",

  // ---- Stats ----
  MED: "MEDIAN",
  MEDIANA: "MEDIAN",
  DESVPAD: "STDEV",
  DESVEST: "STDEV",
  VARIANCIA: "VAR",
  ORDEM: "RANK",
  JERARQUIA: "RANK",

  // ---- Conditional ----
  CONT_SE: "COUNTIF",
  CONTAR_SI: "COUNTIF",
  SOMASE: "SUMIF",
  SUMAR_SI: "SUMIF",
  MEDIASE: "AVERAGEIF",
  PROMEDIO_SI: "AVERAGEIF",
  CONT_SES: "COUNTIFS",
  CONTAR_SI_CONJUNTO: "COUNTIFS",
  SOMASES: "SUMIFS",
  SUMAR_SI_CONJUNTO: "SUMIFS",
  MEDIASES: "AVERAGEIFS",
  PROMEDIO_SI_CONJUNTO: "AVERAGEIFS",

  // ---- Lookup ----
  PROCV: "VLOOKUP",
  BUSCARV: "VLOOKUP",
  CONSULTAV: "VLOOKUP",
  PROCH: "HLOOKUP",
  BUSCARH: "HLOOKUP",
  CONSULTAH: "HLOOKUP",
  INDICE: "INDEX",
  CORRESP: "MATCH",
  COINCIDIR: "MATCH",
  PROCX: "XLOOKUP",
  BUSCARX: "XLOOKUP",

  // ---- Dates ----
  HOJE: "TODAY",
  HOY: "TODAY",
  AGORA: "NOW",
  AHORA: "NOW",
  ANO: "YEAR",
  ANIO: "YEAR",
  MES: "MONTH",
  DIA: "DAY",
  DATA: "DATE",
  FECHA: "DATE",
  HORA: "HOUR",
  MINUTO: "MINUTE",
  SEGUNDO: "SECOND",
  DIA_DA_SEMANA: "WEEKDAY",
  DIASEM: "WEEKDAY",
  FIMMES: "EOMONTH",
  FIN_MES: "EOMONTH",
  DATADIF: "DATEDIF",
  SIFECHA: "DATEDIF",
  DIATRABALHOTOTAL: "NETWORKDAYS",
  DIAS_LAB: "NETWORKDAYS",

  // ---- Financial ----
  PGTO: "PMT",
  PAGO: "PMT",
  VF: "FV",
  VP: "PV",
  VA: "PV",
  VPL: "NPV",
  VNA: "NPV",
  TIR: "IRR",
  TAXA: "RATE",
  TASA: "RATE",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Map localized names → canonical English. Accent/dot insensitive.
 *  Wrapped in a /*#__PURE__*\/ IIFE so bundlers can eliminate the entire
 *  initialization block (including the for-loop) when canonicalFnName is
 *  tree-shaken away. */
const ALIASES: Map<string, string> = /*#__PURE__*/ (() => {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(RAW)) {
    const norm = stripAccents(k).toUpperCase().replace(/[._]/g, "");
    m.set(norm, v);
  }
  return m;
})();

/** Resolve a (possibly localized) function name to its canonical English name. */
export function canonicalFnName(name: string): string {
  const up = name.toUpperCase();
  if (/^[A-Z][A-Z0-9_]*$/.test(up) && !/[ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ]/i.test(name)) {
    // Fast path: pure ASCII — try direct, then normalized.
    const direct = ALIASES.get(up.replace(/[._]/g, ""));
    return direct ?? up;
  }
  const norm = stripAccents(up).replace(/[._]/g, "");
  return ALIASES.get(norm) ?? up;
}
