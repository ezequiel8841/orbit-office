// Data validation helpers.
import type { DataValidation, CellValue, SheetData } from "./model";

export function findValidation(sheet: SheetData, row: number, col: number): DataValidation | undefined {
  for (const v of sheet.validations) {
    if (row >= v.r1 && row <= v.r2 && col >= v.c1 && col <= v.c2) return v;
  }
  return undefined;
}

export function validate(rule: DataValidation["rule"], v: CellValue): boolean {
  if (v === null || v === "") return true;
  switch (rule.kind) {
    case "list":
      return rule.values.includes(String(v));
    case "number": {
      if (typeof v !== "number") return false;
      if (rule.min !== undefined && v < rule.min) return false;
      if (rule.max !== undefined && v > rule.max) return false;
      return true;
    }
    case "text": {
      const s = String(v);
      if (rule.minLen !== undefined && s.length < rule.minLen) return false;
      if (rule.maxLen !== undefined && s.length > rule.maxLen) return false;
      return true;
    }
  }
}
