import { describe, expect, it } from "vitest"
import { parseCsv, toCsvLine } from "./csv.js"

describe("parseCsv for CSV Import", () => {
  it("reads one record per line with its cells, remembering the line each record starts on", () => {
    expect(parseCsv("date,amount\n2026-09-10,-42.50")).toEqual([
      { line: 1, cells: ["date", "amount"] },
      { line: 2, cells: ["2026-09-10", "-42.50"] }
    ])
  })

  it("treats the header as an ordinary first record: no special handling", () => {
    const [header] = parseCsv("date,amount,currency\n")
    expect(header).toEqual({ line: 1, cells: ["date", "amount", "currency"] })
  })

  it("strips a leading BOM so the first header cell is clean", () => {
    expect(parseCsv("﻿date,amount")[0]!.cells[0]).toBe("date")
  })

  it("accepts CRLF line endings without leaking \\r into cells", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      { line: 1, cells: ["a", "b"] },
      { line: 2, cells: ["1", "2"] }
    ])
  })

  it("keeps a comma inside a quoted field", () => {
    expect(parseCsv('"Rent, September",1200')[0]!.cells).toEqual(["Rent, September", "1200"])
  })

  it("unescapes doubled quotes inside a quoted field", () => {
    expect(parseCsv('"say ""hi""",x')[0]!.cells).toEqual(['say "hi"', "x"])
  })

  it("lets a quoted field span lines and dates the next record by the line it starts on", () => {
    expect(parseCsv('"first\nsecond",x\nnext,row')).toEqual([
      { line: 1, cells: ["first\nsecond", "x"] },
      { line: 3, cells: ["next", "row"] }
    ])
  })

  it("does not turn a trailing newline into an extra record", () => {
    expect(parseCsv("a,b\n1,2\n")).toHaveLength(2)
  })

  it("skips blank lines but keeps counting them, so later lines are reported correctly", () => {
    expect(parseCsv("a,b\n\n   \n1,2")).toEqual([
      { line: 1, cells: ["a", "b"] },
      { line: 4, cells: ["1", "2"] }
    ])
  })

  it("keeps a line that has a separator even when every cell is empty", () => {
    expect(parseCsv(",")).toEqual([{ line: 1, cells: ["", ""] }])
  })

  it("keeps an empty trailing cell after a comma", () => {
    expect(parseCsv("a,\n")[0]!.cells).toEqual(["a", ""])
  })

  it("returns nothing for empty input", () => {
    expect(parseCsv("")).toEqual([])
  })
})

describe("toCsvLine", () => {
  it("quotes only cells that need it and round-trips through parseCsv", () => {
    const cells = ["plain", "has,comma", 'has "quote"', "has\nnewline", ""]
    const line = toCsvLine(cells)
    expect(line).toBe('plain,"has,comma","has ""quote""","has\nnewline",')
    expect(parseCsv(line)[0]!.cells).toEqual(cells)
  })
})
