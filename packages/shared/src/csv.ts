/**
 * A small RFC 4180 reader for CSV Import: commas, double quotes with "" escapes, quoted fields
 * that span lines, CRLF or LF, and a leading BOM. Each record remembers the line it started on so
 * a skipped row can be reported by line.
 */

export interface CsvRecord {
  /** 1-based line in the file where the record starts. */
  readonly line: number
  readonly cells: ReadonlyArray<string>
}

export const parseCsv = (text: string): Array<CsvRecord> => {
  const src = text.startsWith("﻿") ? text.slice(1) : text
  const records: Array<CsvRecord> = []
  let cells: Array<string> = []
  let cell = ""
  let quoted = false
  let line = 1
  let recordLine = 1
  let i = 0
  const endRecord = () => {
    cells.push(cell)
    // A completely blank line is not a record.
    if (cells.length > 1 || cells[0]!.trim() !== "") records.push({ line: recordLine, cells })
    cells = []
    cell = ""
  }
  while (i < src.length) {
    const ch = src[i]!
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        quoted = false
        i++
        continue
      }
      if (ch === "\n") line++
      cell += ch
      i++
      continue
    }
    if (ch === '"') {
      quoted = true
      i++
      continue
    }
    if (ch === ",") {
      cells.push(cell)
      cell = ""
      i++
      continue
    }
    if (ch === "\r" || ch === "\n") {
      endRecord()
      if (ch === "\r" && src[i + 1] === "\n") i++
      line++
      recordLine = line
      i++
      continue
    }
    cell += ch
    i++
  }
  if (cell !== "" || cells.length > 0) endRecord()
  return records
}

/** One CSV line from cells, quoting only what needs it. */
export const toCsvLine = (cells: ReadonlyArray<string>): string =>
  cells.map((c) => (/[",\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")
