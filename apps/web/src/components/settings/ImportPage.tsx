import {
  IMPORT_COLUMNS,
  IMPORT_MAX_ROWS,
  type ImportPlanned,
  type ImportRow,
  type ImportSkipped,
  parseCsv,
  type Transaction,
  type TransactionId
} from "@june/shared"
import { FileCsv, UploadSimple } from "@phosphor-icons/react"
import { DateTime } from "effect"
import { type DragEvent, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { useCategoryIndex, useImportPreview, useImportRun, useWalletIndex } from "../../api/queries"
import { FormPage } from "../../layout/FormPage"
import { plural } from "../../lib/format"
import { usePeriod } from "../../lib/period"
import { routes } from "../../routes"
import { Button, Card, Checkbox, cn, CopyButton, ErrorNotice, Label, Loading, Notice, Text } from "../../ui"
import { TransactionCard } from "../transactions/TransactionCard"

const HEADER = IMPORT_COLUMNS.join(",")
const PREVIEW_ROWS = 5

const columnHelp: Record<(typeof IMPORT_COLUMNS)[number], string> = {
  date: "YYYY-MM-DD.",
  amount: "Negative for an expense, positive for income: -4.50 or 2000.",
  currency: "ISO code such as USD. The row lands in your first wallet holding it, or stays Unassigned.",
  category: "A category slug. An unknown slug means Uncategorised.",
  description: "Free text; quote it if it holds a comma.",
  tags: "Words separated by spaces."
}

interface Chosen {
  readonly name: string
  readonly size: number
  readonly rows: ReadonlyArray<ImportRow>
}

const fileSize = (bytes: number): string => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`)

/** Read the file into rows of the template: the header names the columns, in any order, extra columns are ignored. */
const readFile = (text: string): { rows: Array<ImportRow> } | { error: string } => {
  const records = parseCsv(text)
  const header = records[0]
  if (!header) return { error: "The file is empty." }
  const names = header.cells.map((c) => c.trim().toLowerCase())
  const index = new Map(IMPORT_COLUMNS.map((col) => [col, names.indexOf(col)] as const))
  const missing = IMPORT_COLUMNS.filter((col) => index.get(col) === -1)
  if (missing.length > 0) return { error: `The header row is missing ${missing.join(", ")}. June expects: ${HEADER}` }
  const cell = (r: (typeof records)[number], col: (typeof IMPORT_COLUMNS)[number]) => r.cells[index.get(col)!] ?? ""
  const rows = records.slice(1).map(
    (r) =>
      ({
        line: r.line,
        date: cell(r, "date"),
        amount: cell(r, "amount"),
        currency: cell(r, "currency"),
        category: cell(r, "category"),
        description: cell(r, "description"),
        tags: cell(r, "tags")
      }) as ImportRow
  )
  if (rows.length === 0) return { error: "The file has a header but no rows." }
  if (rows.length > IMPORT_MAX_ROWS) return { error: `${rows.length.toLocaleString("en")} rows is more than the ${IMPORT_MAX_ROWS.toLocaleString("en")} an import can take. Split the file.` }
  return { rows }
}

/** A planned row drawn as the card it will become. */
const asTransaction = (r: ImportPlanned): Transaction =>
  ({
    id: `preview-${r.line}` as TransactionId,
    type: "change",
    walletId: r.walletId,
    amountMinor: r.amountMinor,
    currency: r.currency,
    occurredOn: r.occurredOn,
    description: r.description,
    tags: r.tags,
    hiddenFromAnalysis: false,
    categoryId: r.categoryId,
    exchangeId: null,
    defaultMinor: null,
    createdAt: DateTime.unsafeNow(),
    updatedAt: DateTime.unsafeNow()
  }) as Transaction

function CountCard({ label, value, accent }: { label: string; value: number; accent: "white" | "coral" | "lavender" }) {
  return (
    <Card accent={accent} shadow="sm" className="p-3">
      <Label as="div" className="text-[10px]">
        {label}
      </Label>
      <div className="mt-1 font-mono text-2xl font-bold tabular-nums">{value.toLocaleString("en")}</div>
    </Card>
  )
}

/**
 * Import from CSV: the template, a drop zone, a preview of what each row becomes with the rows
 * June cannot read listed by line, and the import itself. Rules match a capture.
 */
export function ImportPage() {
  const navigate = useNavigate()
  const { setPeriod } = usePeriod()
  const categories = useCategoryIndex()
  const wallets = useWalletIndex()
  const preview = useImportPreview()
  const run = useImportRun()
  const input = useRef<HTMLInputElement>(null)
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(true)

  const slugs = categories.list.map((c) => c.slug)

  const choose = (file: File | undefined) => {
    preview.reset()
    run.reset()
    setChosen(null)
    setFileError(null)
    if (!file) return
    file.text().then((text) => {
      const read = readFile(text)
      if ("error" in read) return setFileError(read.error)
      setChosen({ name: file.name, size: file.size, rows: read.rows })
    })
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    choose(e.dataTransfer.files[0])
  }
  const startPreview = () => {
    if (chosen) preview.mutate({ rows: chosen.rows, preview: true, skipDuplicates })
  }
  const startImport = () => {
    if (!chosen) return
    run.mutate(
      { rows: chosen.rows, preview: false, skipDuplicates },
      {
        onSuccess: (result) => {
          // Show the period the file covers, so the new rows are the first thing seen.
          const dates = result.rows.map((r) => r.occurredOn).sort()
          if (dates.length > 0) setPeriod({ from: dates[0]!, to: dates[dates.length - 1]! })
        }
      }
    )
  }

  const planned = preview.data?.rows ?? []
  const duplicates = planned.filter((r) => r.duplicate).length
  const willImport = skipDuplicates ? planned.length - duplicates : planned.length
  const skipped: ReadonlyArray<ImportSkipped> = preview.data?.skipped ?? []
  const uncategorised = planned.filter((r) => r.categoryId === null).length
  const sample = (skipDuplicates ? planned.filter((r) => !r.duplicate) : planned).slice(0, PREVIEW_ROWS)

  if (run.data) {
    return (
      <FormPage title="Import" backTo={routes.settings}>
        <Notice accent="green" label="Done">
          <Text className="text-sm">
            Imported {run.data.imported.toLocaleString("en")} {plural(run.data.imported, "row")} from {chosen?.name}.
            {run.data.skipped.length > 0 ? ` ${run.data.skipped.length} could not be read and were left out.` : ""}
          </Text>
        </Notice>
        <Button size="lg" className="w-full" onClick={() => navigate(routes.transactions)}>
          See the transactions
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => choose(undefined)}>
          Import another file
        </Button>
      </FormPage>
    )
  }

  return (
    <FormPage title="Import" backTo={routes.settings}>
      <Card accent="sky" shadow="sm" className="p-3">
        <div className="flex items-center justify-between gap-3">
          <Label as="div">June's template</Label>
          <CopyButton value={HEADER} label="Copy header" />
        </div>
        <code className="mt-2 block overflow-x-auto border-2 border-ink bg-white px-2 py-1.5 font-mono text-xs whitespace-nowrap">{HEADER}</code>
        <dl className="mt-3 flex flex-col gap-1.5 text-sm">
          {IMPORT_COLUMNS.map((col) => (
            <div key={col} className="grid grid-cols-[6.5rem_1fr] gap-2">
              <dt className="font-mono text-xs font-bold leading-5">{col}</dt>
              <dd className="font-sans leading-5">{columnHelp[col]}</dd>
            </div>
          ))}
        </dl>
        {slugs.length > 0 ? (
          <Text className="mt-3 text-xs text-grey-ink">
            Your slugs: <span className="font-mono">{slugs.join(", ")}</span>
          </Text>
        ) : null}
      </Card>

      {chosen === null ? (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn("flex flex-col items-center gap-3 border-3 border-dashed border-ink p-6 text-center", dragging ? "bg-accent" : "bg-paper")}
        >
          <UploadSimple size={32} weight="bold" />
          <Text className="text-sm">Drop a CSV here, or</Text>
          <Button variant="secondary" onClick={() => input.current?.click()}>
            Choose file
          </Button>
          <Text className="text-xs text-grey-ink">June's template, up to {IMPORT_MAX_ROWS.toLocaleString("en")} rows.</Text>
          <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
        </div>
      ) : (
        <Card className="flex items-center gap-3 p-3">
          <FileCsv size={28} weight="bold" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-heading font-bold">{chosen.name}</div>
            <div className="font-mono text-xs text-grey-ink">
              {chosen.rows.length.toLocaleString("en")} {plural(chosen.rows.length, "row")} · {fileSize(chosen.size)}
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => choose(undefined)}>
            Change
          </Button>
        </Card>
      )}
      {fileError ? <ErrorNotice message={fileError} /> : null}
      {preview.isError ? <ErrorNotice message={preview.error.message} /> : null}
      {run.isError ? <ErrorNotice message={run.error.message} /> : null}

      {preview.data === undefined ? (
        <Button size="lg" className="w-full" disabled={chosen === null || preview.isPending} onClick={startPreview}>
          {preview.isPending ? "Reading…" : "Preview"}
        </Button>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <CountCard label="Will import" value={willImport} accent="white" />
            <CountCard label="Skipped" value={skipped.length + (skipDuplicates ? duplicates : 0)} accent="coral" />
            <CountCard label="Uncategorised" value={uncategorised} accent="lavender" />
          </div>

          {sample.length > 0 ? (
            <div>
              <Label as="div" className="mb-2 block text-grey-ink">
                First rows
              </Label>
              <div className="flex flex-col gap-3">
                {sample.map((r) => {
                  const t = asTransaction(r)
                  return (
                    <TransactionCard
                      key={r.line}
                      item={{ kind: "single", transaction: t }}
                      category={categories.get(r.categoryId)}
                      walletName={wallets.name}
                      onOpen={() => undefined}
                    />
                  )
                })}
              </div>
            </div>
          ) : null}

          {skipped.length > 0 ? (
            <Notice accent="coral" label={`${skipped.length} ${plural(skipped.length, "row")} June cannot read`}>
              <ul className="flex flex-col gap-0.5 font-mono text-xs">
                {skipped.slice(0, 20).map((s) => (
                  <li key={s.line}>
                    line {s.line}: {s.reason}
                  </li>
                ))}
                {skipped.length > 20 ? <li>… and {skipped.length - 20} more</li> : null}
              </ul>
            </Notice>
          ) : null}

          {duplicates > 0 ? (
            <Checkbox
              label={`Skip ${duplicates} ${plural(duplicates, "row")} identical to an existing transaction`}
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
            />
          ) : null}

          {run.isPending ? <Loading label="Importing" /> : null}
          <Button size="lg" className="w-full" disabled={willImport === 0 || run.isPending} onClick={startImport}>
            Import {willImport.toLocaleString("en")} {plural(willImport, "row")}
          </Button>
        </>
      )}
    </FormPage>
  )
}
