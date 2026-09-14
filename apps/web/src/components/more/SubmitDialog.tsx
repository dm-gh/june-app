import type { Recurring } from "@june/shared"
import { useEffect, useRef } from "react"
import { useNavigate } from "react-router"
import { useFireRecurring } from "../../api/queries"
import { shortDate, signedMoney } from "../../lib/format"
import { formatLongDate, todayLocal } from "../../lib/period"
import { Button, ErrorNotice, Heading, Text } from "../../ui"

export interface SubmitDialogProps {
  recurring: Recurring
  onClose: () => void
}

/**
 * Submit fires the Recurring for its due date as it is; Edit & submit opens the Change form
 * prefilled so the amount or date can be adjusted first. Either way the Schedule advances.
 */
export function SubmitDialog({ recurring: r, onClose }: SubmitDialogProps) {
  const navigate = useNavigate()
  const fire = useFireRecurring()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])
  const on = r.nextOn ?? todayLocal()
  const submit = () => fire.mutate({ id: r.id, payload: {} }, { onSuccess: () => navigate("/transactions") })
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm border-3 border-ink bg-paper p-5 shadow-hard-lg backdrop:bg-ink/50"
    >
      <Heading as="h2">Submit {r.name}?</Heading>
      <Text className="mt-2">
        Records {signedMoney(r.amountMinor, r.currency)} dated {formatLongDate(on)}
        {r.walletId === null ? ", unassigned" : ""}.
        {r.cron ? ` The schedule moves on from ${shortDate(on)}.` : r.nextOn ? " This once schedule is then spent." : ""}
      </Text>
      {fire.error ? (
        <div className="mt-3">
          <ErrorNotice message={fire.error.message} />
        </div>
      ) : null}
      <div className="mt-5 flex flex-col gap-2.5">
        <Button onClick={submit} disabled={fire.isPending}>
          Submit
        </Button>
        <Button variant="secondary" onClick={() => navigate(`/transactions/new?recurring=${r.id}`)} disabled={fire.isPending}>
          Edit &amp; submit
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={fire.isPending}>
          Cancel
        </Button>
      </div>
    </dialog>
  )
}
