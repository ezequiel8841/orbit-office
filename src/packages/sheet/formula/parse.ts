// Pratt parser for spreadsheet expressions.
import type { Token } from "./lex";
import { canonicalFnName } from "./aliases";

export type Node =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "ref"; addr: string; sheet?: string }
  | { t: "range"; from: string; to: string; sheet?: string }
  | { t: "name"; name: string }
  | { t: "call"; name: string; args: Node[] }
  | { t: "unary"; op: string; rhs: Node }
  | { t: "binary"; op: string; lhs: Node; rhs: Node }
  | { t: "postfix"; op: string; lhs: Node };

const PREC: Record<string, number> = {
  "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1,
  "&": 2,
  "+": 3, "-": 3,
  "*": 4, "/": 4,
  "^": 5,
};

export class ParseError extends Error {}

function splitSheet(v: string): { sheet?: string; rest: string } {
  const i = v.indexOf("!");
  if (i < 0) return { rest: v };
  return { sheet: v.slice(0, i), rest: v.slice(i + 1) };
}

export function parse(tokens: Token[]): Node {
  let i = 0;
  const peek = () => tokens[i];
  const eat = () => tokens[i++];

  function parseExpr(minPrec: number): Node {
    let left = parsePrefix();
    while (peek() && peek().kind === "op" && peek().value === "%") {
      eat();
      left = { t: "postfix", op: "%", lhs: left };
    }
    while (true) {
      const tk = peek();
      if (!tk || tk.kind !== "op") break;
      const prec = PREC[tk.value];
      if (!prec || prec < minPrec) break;
      eat();
      const rhs = parseExpr(prec + 1);
      left = { t: "binary", op: tk.value, lhs: left, rhs };
    }
    return left;
  }

  function parsePrefix(): Node {
    const tk = peek();
    if (!tk) throw new ParseError("Unexpected end");
    if (tk.kind === "op" && (tk.value === "-" || tk.value === "+")) {
      eat();
      return { t: "unary", op: tk.value, rhs: parsePrefix() };
    }
    if (tk.kind === "num") { eat(); return { t: "num", v: parseFloat(tk.value) }; }
    if (tk.kind === "str") { eat(); return { t: "str", v: tk.value }; }
    if (tk.kind === "bool") { eat(); return { t: "bool", v: tk.value === "TRUE" }; }
    if (tk.kind === "ref") {
      eat();
      const { sheet, rest } = splitSheet(tk.value);
      return { t: "ref", addr: rest.replace(/\$/g, ""), sheet };
    }
    if (tk.kind === "range") {
      eat();
      const { sheet, rest } = splitSheet(tk.value);
      const [a, b] = rest.replace(/\$/g, "").split(":");
      return { t: "range", from: a, to: b, sheet };
    }
    if (tk.kind === "lparen") {
      eat();
      const expr = parseExpr(1);
      if (!peek() || peek().kind !== "rparen") throw new ParseError("Missing )");
      eat();
      return expr;
    }
    if (tk.kind === "ident") {
      eat();
      if (peek() && peek().kind === "lparen") {
        eat();
        const args: Node[] = [];
        if (peek() && peek().kind !== "rparen") {
          args.push(parseExpr(1));
          while (peek() && peek().kind === "comma") {
            eat();
            args.push(parseExpr(1));
          }
        }
        if (!peek() || peek().kind !== "rparen") throw new ParseError("Missing )");
        eat();
        return { t: "call", name: canonicalFnName(tk.value), args };
      }
      // bare ident → named range
      return { t: "name", name: tk.value };
    }
    throw new ParseError("Unexpected token " + tk.value);
  }

  const root = parseExpr(1);
  if (i < tokens.length) throw new ParseError("Trailing tokens");
  return root;
}
