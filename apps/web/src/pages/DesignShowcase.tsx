import { useState } from "react"
import {
  Amount,
  Badge,
  Button,
  Card,
  Display,
  Field,
  Heading,
  Input,
  Label,
  Mono,
  Select,
  Text,
  Textarea
} from "../ui/index.js"

const swatches = [
  ["paper", "bg-paper"],
  ["yellow", "bg-yellow"],
  ["coral", "bg-coral"],
  ["sky", "bg-sky"],
  ["green", "bg-green"],
  ["orange", "bg-orange"],
  ["lavender", "bg-lavender"],
  ["grey", "bg-grey"],
  ["ink", "bg-ink"]
] as const

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <Heading className="border-b-3 border-ink pb-1">{title}</Heading>
      {children}
    </section>
  )
}

export function DesignShowcase() {
  const [amount, setAmount] = useState("-12.50")
  const invalid = amount !== "" && Number.isNaN(Number(amount))

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-12 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-2">
        <Display>June</Display>
        <Text className="max-w-prose">
          Design primitives. Everything on this page is built from tokens in <Mono>index.css</Mono> and components in{" "}
          <Mono>src/ui</Mono>. Source of truth for the look is <Mono>docs/style-reference.md</Mono>.
        </Text>
      </header>

      <Section title="Colour">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          {swatches.map(([name, cls]) => (
            <div key={name} className="flex flex-col gap-1">
              <div className={`h-16 border-3 border-ink shadow-hard-sm ${cls}`} />
              <Mono className="text-xs">{name}</Mono>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <Display as="p">Display · Syne 800</Display>
        <Heading as="p">Heading · Space Grotesk 700</Heading>
        <Label>Label · Space Grotesk caps</Label>
        <Text>
          Body · Inter 400. Calm and conventional. Reserve the loud gestures for headlines and calls to action; keep
          the reading experience ordinary.
        </Text>
        <Mono>Mono · Space Mono · 2026-09-12 · groceries · EUR</Mono>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Form elements">
        <form className="grid gap-5 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
          <Field label="Amount" htmlFor="amount" hint="Negative is an expense" error={invalid ? "Not a number" : undefined}>
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              invalid={invalid}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Wallet" htmlFor="wallet">
            <Select id="wallet" defaultValue="eur">
              <option value="usd">Main card · USD</option>
              <option value="eur">Euro card · EUR</option>
              <option value="cash">Cash · PLN</option>
            </Select>
          </Field>
          <Field label="Description" htmlFor="desc" className="sm:col-span-2">
            <Textarea id="desc" placeholder="flat white" />
          </Field>
          <Field label="Disabled" htmlFor="dis">
            <Input id="dis" disabled value="read only" readOnly />
          </Field>
          <div className="flex items-end gap-3">
            <Button type="submit">Save</Button>
            <Button variant="secondary">Cancel</Button>
          </div>
        </form>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-3">
          <Badge accent="yellow">Groceries</Badge>
          <Badge accent="sky">Transport</Badge>
          <Badge accent="lavender">Rent</Badge>
          <Badge accent="grey">Uncategorised</Badge>
          <Badge accent="grey">Unassigned</Badge>
          <Badge prefix="#">vacation-2026</Badge>
        </div>
      </Section>

      <Section title="Amounts">
        <div className="flex flex-wrap items-baseline gap-6">
          <Amount value={-12.5} currency="EUR" />
          <Amount value={2400} currency="USD" />
          <Amount value={0} currency="PLN" />
          <Amount value={-1834.2} currency="USD" size="lg" />
          <Amount value={12345.67} currency="USD" signed={false} size="xl" />
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-6 sm:grid-cols-3">
          <Card accent="yellow" shadow="lg" className="flex flex-col gap-1">
            <Label>Total · USD</Label>
            <Amount value={12345.67} currency="USD" signed={false} size="lg" />
          </Card>
          <Card className="flex flex-col gap-1">
            <Label>Euro card</Label>
            <Amount value={903.1} currency="EUR" signed={false} size="lg" />
          </Card>
          <Card accent="grey" shadow="sm" className="flex flex-col gap-1">
            <Label>Unassigned</Label>
            <Amount value={-45} currency="PLN" size="lg" />
          </Card>
          <Card interactive className="sm:col-span-3 flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Text className="font-semibold">Flat white</Text>
              <div className="flex gap-2">
                <Badge accent="yellow">Coffee</Badge>
                <Mono className="text-xs text-grey-ink">2026-09-12</Mono>
              </div>
            </div>
            <Amount value={-3.8} currency="EUR" />
          </Card>
        </div>
      </Section>
    </main>
  )
}
