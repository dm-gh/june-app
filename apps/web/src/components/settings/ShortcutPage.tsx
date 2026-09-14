import type { CaptureTokenIssued } from "@june/shared"
import { ArrowLeft } from "@phosphor-icons/react"
import { type ReactNode, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { useCategories, useMe, useRegenerateCaptureToken, useWallets } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { StickyBar } from "../../layout/StickyBar"
import { Button, Card, cn, CopyButton, Dialog, Display, ErrorNotice, Heading, IconButton, Label, Notice, Text } from "../../ui"

/** The plain token is shown once by the api; the tab remembers it so a reload mid-setup does not lose it. */
const STORAGE_KEY = "june.capture-url"

const readIssued = (): CaptureTokenIssued | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CaptureTokenIssued) : null
  } catch {
    return null
  }
}

/** A value to type into the Shortcuts app, with a copy button. Only a long value (the URL) may break mid-word. */
function Value({ children, copy, long }: { children: string; copy?: boolean; long?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <code className={cn("border-2 border-ink bg-white px-1.5 py-0.5 font-mono text-sm", long ? "break-all" : "whitespace-nowrap")}>{children}</code>
      {copy ? <CopyButton value={children} /> : null}
    </span>
  )
}

/** A Shortcuts variable, drawn as the pill the app shows. */
function Variable({ name }: { name: string }) {
  return <span className="inline-block border-2 border-ink bg-lavender px-1.5 font-mono text-sm leading-snug">{name}</span>
}

/** One action as it appears in the Shortcuts editor: an icon tile, the action name, then its parameters. */
function Action({ name, tint, params, children }: { name: string; tint: string; params?: ReadonlyArray<[string, ReactNode]>; children?: ReactNode }) {
  return (
    <div className="border-3 border-ink bg-white shadow-hard-sm">
      <div className="flex items-center gap-3 border-b-3 border-ink px-3 py-2">
        <span aria-hidden className={cn("size-6 shrink-0 border-2 border-ink", tint)} />
        <span className="font-heading font-bold">{name}</span>
      </div>
      {params ? (
        <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-3 gap-y-2 px-3 py-2">
          {params.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-sans text-sm text-grey-ink">{label}</dt>
              <dd className="min-w-0 font-sans text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children ? <div className="px-3 pb-3">{children}</div> : null}
    </div>
  )
}

/** Items of a List action, each copyable, since they are typed one by one on the phone. */
function ListItems({ items, empty }: { items: ReadonlyArray<string>; empty: string }) {
  if (items.length === 0) return <Text className="text-sm text-grey-ink">{empty}</Text>
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-center justify-between gap-3">
          <code className="font-mono text-sm">{item}</code>
          <CopyButton value={item} />
        </li>
      ))}
    </ul>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center border-3 border-ink bg-accent font-heading text-sm font-bold">{n}</span>
        <Heading as="h2">{title}</Heading>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

/**
 * The Shortcut cannot be generated as a file, so June walks the User through building it in the
 * Shortcuts app, every action shown with the User's own capture URL, currencies and Category slugs.
 */
export function ShortcutPage() {
  const navigate = useNavigate()
  const me = useMe()
  const wallets = useWallets()
  const categories = useCategories()
  const regenerate = useRegenerateCaptureToken()
  const [issued, setIssued] = useState<CaptureTokenIssued | null>(readIssued)
  const [confirm, setConfirm] = useState(false)

  const currencies = useMemo(() => [...new Set((wallets.data?.wallets ?? []).map((w) => w.currency))], [wallets.data])
  const expense = (categories.data ?? []).filter((c) => c.type === "expense").map((c) => c.slug)
  const income = (categories.data ?? []).filter((c) => c.type === "income").map((c) => c.slug)

  const generate = () =>
    regenerate.mutate(undefined, {
      onSuccess: (result) => {
        setIssued(result)
        setConfirm(false)
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(result))
        } catch {
          // The URL still shows; it just will not survive a reload.
        }
      }
    })
  const wantGenerate = () => (me.data?.hasCaptureToken ? setConfirm(true) : generate())

  const url = issued?.captureUrl ?? `${window.location.origin}/api/capture/<your token>`
  const provided = <Variable name="Provided Input" />

  return (
    <AppShell tabs={false} width="form">
      <StickyBar className="pb-2">
        <div className="-ml-2.5 flex items-center">
          <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate("/settings")} />
        </div>
      </StickyBar>
      <Display size="sm" className="mt-2 mb-4">
        Shortcut
      </Display>
      <Text>
        Build it once in the Shortcuts app on your iPhone and put it on the home screen. From then on a capture is one tap: amount, category, currency, done.
        Every action below is shown with your own values filled in.
      </Text>

      <Step n={1} title="Get your capture URL">
        <Card accent="sky">
          {issued ? (
            <>
              <Label as="div" className="mb-1.5">
                Your URL
              </Label>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 border-2 border-ink bg-white px-2 py-1.5 font-mono text-xs break-all">{issued.captureUrl}</code>
                <CopyButton value={issued.captureUrl} />
              </div>
              <Text className="mt-2 text-sm">It contains your secret token and is shown only now. If you lose it, generate a new one and update the Shortcut.</Text>
              <button type="button" onClick={() => setConfirm(true)} className="mt-2 font-heading text-sm font-bold text-coral-ink hover:underline">
                Generate a new one
              </button>
            </>
          ) : (
            <>
              <Text className="text-sm">
                The URL carries a secret token that June shows once. Generate it now, then paste it into the last action of the Shortcut.
              </Text>
              <Button className="mt-3" onClick={wantGenerate} disabled={regenerate.isPending}>
                Generate URL
              </Button>
            </>
          )}
          {regenerate.isError ? (
            <div className="mt-3">
              <ErrorNotice message={regenerate.error.message} />
            </div>
          ) : null}
        </Card>
      </Step>

      <Step n={2} title="Create the Shortcut">
        <Text className="text-sm">
          Open Shortcuts, tap <strong>+</strong>, name it <Value copy>June</Value>. Add the actions below in this order by searching each one by name.
        </Text>
      </Step>

      <Step n={3} title="Ask for the amount">
        <Action name="Ask for Input" tint="bg-sky" params={[["Input Type", "Number"], ["Prompt", <Value copy>Amount</Value>], ["Allow Decimal Numbers", "On"]]} />
        <Text className="text-sm text-grey-ink">Always a positive number; the next step decides expense or income.</Text>
      </Step>

      <Step n={4} title="Expense or income, and the category">
        <Action name="Choose from Menu" tint="bg-yellow" params={[["Prompt", <Value copy>Expense or income?</Value>], ["Menu items", <>
          <Value>Expense</Value> and <Value>Income</Value>
        </>]]} />
        <Text className="text-sm">Inside the <strong>Expense</strong> branch add these four:</Text>
        <Action name="List" tint="bg-lavender">
          <ListItems items={expense} empty="No expense categories yet. Add them in Settings and come back." />
        </Action>
        <Action name="Choose from List" tint="bg-lavender" params={[["List", <Variable name="List" />], ["Prompt", <Value copy>Category</Value>]]} />
        <Action name="Set Variable" tint="bg-green" params={[["Variable name", <Value copy>category</Value>], ["Input", <Variable name="Chosen Item" />]]} />
        <Action name="Calculate" tint="bg-orange" params={[["Input", provided], ["Operation", "×"], ["Number", <Value copy>-1</Value>]]} />
        <Action name="Set Variable" tint="bg-green" params={[["Variable name", <Value copy>amount</Value>], ["Input", <Variable name="Calculation Result" />]]} />
        <Text className="text-sm">
          Inside the <strong>Income</strong> branch: the same List, Choose from List and Set Variable <Value>category</Value>, but with these items, and then Set Variable{" "}
          <Value>amount</Value> to {provided} directly, with no Calculate.
        </Text>
        <Action name="List" tint="bg-lavender">
          <ListItems items={income} empty="No income categories yet. Add them in Settings and come back." />
        </Action>
      </Step>

      <Step n={5} title="Pick the currency">
        {currencies.length <= 1 ? (
          <>
            <Text className="text-sm">All your wallets hold one currency, so a fixed value is enough:</Text>
            <Action name="Set Variable" tint="bg-green" params={[["Variable name", <Value copy>currency</Value>], ["Input", <Value copy>{currencies[0] ?? "USD"}</Value>]]} />
          </>
        ) : (
          <>
            <Action name="List" tint="bg-lavender">
              <ListItems items={currencies} empty="" />
            </Action>
            <Action name="Choose from List" tint="bg-lavender" params={[["List", <Variable name="List" />], ["Prompt", <Value copy>Currency</Value>]]} />
            <Action name="Set Variable" tint="bg-green" params={[["Variable name", <Value copy>currency</Value>], ["Input", <Variable name="Chosen Item" />]]} />
          </>
        )}
        <Text className="text-sm text-grey-ink">The transaction lands in the first wallet, in your wallet order, that holds the chosen currency.</Text>
      </Step>

      <Step n={6} title="Describe it">
        <Action name="Ask for Input" tint="bg-sky" params={[["Input Type", "Text"], ["Prompt", <Value copy>Description</Value>]]} />
        <Action name="Set Variable" tint="bg-green" params={[["Variable name", <Value copy>description</Value>], ["Input", provided]]} />
      </Step>

      <Step n={7} title="Today's date">
        <Action name="Date" tint="bg-coral" params={[["Date", "Current Date"]]} />
        <Action name="Format Date" tint="bg-coral" params={[["Date", <Variable name="Date" />], ["Date Format", "Custom"], ["Format String", <Value copy>yyyy-MM-dd</Value>]]} />
        <Action name="Set Variable" tint="bg-green" params={[["Variable name", <Value copy>date</Value>], ["Input", <Variable name="Formatted Date" />]]} />
      </Step>

      <Step n={8} title="Send it to June">
        <Action
          name="Get Contents of URL"
          tint="bg-accent"
          params={[
            ["URL", <Value copy={issued !== null} long>{url}</Value>],
            ["Method", "POST"],
            ["Request Body", "JSON"]
          ]}
        >
          <Label as="div" className="mt-1 mb-1.5">
            JSON fields
          </Label>
          <ul className="flex flex-col gap-2 font-sans text-sm">
            {(
              [
                ["amount", "Number", "amount"],
                ["currency", "Text", "currency"],
                ["category", "Text", "category"],
                ["description", "Text", "description"],
                ["date", "Text", "date"]
              ] as const
            ).map(([key, type, variable]) => (
              <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Value copy>{key}</Value>
                <span className="text-grey-ink">{type}</span>
                <Variable name={variable} />
              </li>
            ))}
          </ul>
        </Action>
        <Notice accent="lavender" label="Unknown values are fine">
          A category slug June does not recognise is stored as Uncategorised, and a currency no wallet holds is stored Unassigned. Nothing is lost.
        </Notice>
      </Step>

      <Step n={9} title="Show June's answer">
        <Text className="text-sm">June answers every capture with a short message. Two actions turn it into the notification you see after the tap.</Text>
        <Action name="Get Dictionary Value" tint="bg-lavender" params={[["Get", "Value"], ["Key", <Value copy>message</Value>], ["Dictionary", <Variable name="Contents of URL" />]]} />
        <Action name="Show Notification" tint="bg-grey" params={[["Title", <Variable name="Dictionary Value" />]]} />
        <Notice accent="green" label="What it shows">
          <p className="font-mono">✅ Saved 22 GEL | ☕ Coffee</p>
          <p className="font-mono">❌ Error: currency "XYZ" is invalid</p>
        </Notice>
        <Text className="text-sm">
          Run it once to test, then in the Shortcut's details choose <strong>Add to Home Screen</strong>. Regenerating the capture URL later means pasting the new one into step 8.
        </Text>
      </Step>

      <Dialog
        open={confirm}
        title={issued ? "Generate a new capture URL?" : "Replace your capture token?"}
        body="Any Shortcut built with the previous URL stops working until you paste the new one into it."
        confirmLabel="Generate"
        danger
        busy={regenerate.isPending}
        onConfirm={generate}
        onCancel={() => setConfirm(false)}
      />
    </AppShell>
  )
}
