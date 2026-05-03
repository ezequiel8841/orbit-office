// Formula tokens + lexer.
export type TokKind =
  | "num"
  | "str"
  | "bool"
  | "ref"      // A1 or Sheet!A1
  | "range"    // A1:B2 or Sheet!A1:B2
  | "ident"    // function name or named range
  | "op"
  | "lparen"
  | "rparen"
  | "comma"
  | "err";

export interface Token {
  kind: TokKind;
  value: string;
  start: number;
}

const OPS = new Set(["+", "-", "*", "/", "^", "&", "=", "<", ">", "<=", ">=", "<>", "%"]);
const isAlpha = (c: string) =>
  (c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_" || c === "$";
const isDigit = (c: string) => c >= "0" && c <= "9";
const isWord = (c: string) => isAlpha(c) || isDigit(c);

const REF_RE = /^\$?[A-Za-z]+\$?\d+$/;

export function lex(src: string): Token[] {
  const toks: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === " " || ch === "\t" || ch === "\n") { i++; continue; }
    if (ch === "(") { toks.push({ kind: "lparen", value: "(", start: i++ }); continue; }
    if (ch === ")") { toks.push({ kind: "rparen", value: ")", start: i++ }); continue; }
    if (ch === ",") { toks.push({ kind: "comma", value: ",", start: i++ }); continue; }
    if (ch === '"') {
      const start = i++;
      let s = "";
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\" && i + 1 < n) { s += src[i + 1]; i += 2; continue; }
        s += src[i++];
      }
      i++;
      toks.push({ kind: "str", value: s, start });
      continue;
    }
    // number
    if (isDigit(ch) || (ch === "." && isDigit(src[i + 1] ?? ""))) {
      const start = i;
      while (i < n && (isDigit(src[i]) || src[i] === ".")) i++;
      if (i < n && (src[i] === "e" || src[i] === "E")) {
        i++;
        if (src[i] === "+" || src[i] === "-") i++;
        while (i < n && isDigit(src[i])) i++;
      }
      toks.push({ kind: "num", value: src.slice(start, i), start });
      continue;
    }
    // 'Quoted sheet name'!REF
    if (ch === "'") {
      const start = i++;
      let name = "";
      while (i < n && src[i] !== "'") name += src[i++];
      i++; // closing '
      if (src[i] === "!") {
        i++;
        const refStart = i;
        while (i < n && isWord(src[i])) i++;
        const head = src.slice(refStart, i);
        if (REF_RE.test(head)) {
          if (src[i] === ":") {
            i++;
            const tailStart = i;
            while (i < n && isWord(src[i])) i++;
            const tail = src.slice(tailStart, i);
            if (REF_RE.test(tail)) {
              toks.push({ kind: "range", value: name + "!" + (head + ":" + tail).toUpperCase(), start });
              continue;
            }
          }
          toks.push({ kind: "ref", value: name + "!" + head.toUpperCase(), start });
          continue;
        }
      }
      toks.push({ kind: "err", value: "'" + name, start });
      continue;
    }
    if (isAlpha(ch)) {
      const start = i;
      while (i < n && isWord(src[i])) i++;
      let word = src.slice(start, i);
      // Sheet!REF / Sheet!RANGE
      if (src[i] === "!") {
        const sheetName = word;
        i++;
        const refStart = i;
        while (i < n && isWord(src[i])) i++;
        const head = src.slice(refStart, i);
        if (REF_RE.test(head)) {
          if (src[i] === ":") {
            i++;
            const tailStart = i;
            while (i < n && isWord(src[i])) i++;
            const tail = src.slice(tailStart, i);
            if (REF_RE.test(tail)) {
              toks.push({ kind: "range", value: sheetName + "!" + (head + ":" + tail).toUpperCase(), start });
              continue;
            }
          }
          toks.push({ kind: "ref", value: sheetName + "!" + head.toUpperCase(), start });
          continue;
        }
        // not a real cross-sheet ref; treat 'word' as ident, leave '!REST' as error tokens
        i = refStart - 1; // back to '!'
      }
      const up = word.toUpperCase();
      if (up === "TRUE" || up === "FALSE") {
        toks.push({ kind: "bool", value: up, start });
        continue;
      }
      if (REF_RE.test(word)) {
        if (src[i] === ":") {
          const colonStart = i;
          i++;
          const tailStart = i;
          while (i < n && isWord(src[i])) i++;
          const tail = src.slice(tailStart, i);
          if (REF_RE.test(tail)) {
            toks.push({ kind: "range", value: (word + ":" + tail).toUpperCase(), start });
            continue;
          }
          toks.push({ kind: "ref", value: word.toUpperCase(), start });
          toks.push({ kind: "op", value: ":", start: colonStart });
          continue;
        }
        toks.push({ kind: "ref", value: word.toUpperCase(), start });
        continue;
      }
      toks.push({ kind: "ident", value: word, start });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (OPS.has(two)) { toks.push({ kind: "op", value: two, start: i }); i += 2; continue; }
    if (OPS.has(ch)) { toks.push({ kind: "op", value: ch, start: i++ }); continue; }
    toks.push({ kind: "err", value: ch, start: i++ });
  }
  return toks;
}
