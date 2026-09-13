import { ArrowLeft } from "@phosphor-icons/react"
import { useNavigate } from "react-router"
import { useLoans } from "../../api/queries"
import { AppShell } from "../../layout/AppShell"
import { StickyBar } from "../../layout/StickyBar"
import { Display, Empty, ErrorNotice, IconButton, Loading, Text } from "../../ui"
import { LoanCard } from "./LoanCard"

/** Loans set aside: settled ones land here by themselves, any can be brought back or deleted from its page. */
export function LoansArchivePage() {
  const navigate = useNavigate()
  const loans = useLoans()
  const archived = (loans.data ?? []).filter((l) => l.archived)
  return (
    <AppShell>
      <StickyBar>
        <header className="pb-3">
          <div className="-ml-2.5 flex items-center gap-1">
            <IconButton icon={ArrowLeft} label="Back" onClick={() => navigate("/more")} />
            <Display size="sm">Archive</Display>
          </div>
        </header>
      </StickyBar>
      <Text className="mb-3 text-sm text-grey-ink">Loans set aside. A settled loan lands here by itself; open one to bring it back or delete it.</Text>
      {loans.isError ? <ErrorNotice message={loans.error.message} /> : null}
      {loans.isPending ? <Loading /> : null}
      {loans.data && archived.length === 0 ? <Empty>Nothing archived.</Empty> : null}
      <div className="flex flex-col gap-3">
        {archived.map((l) => (
          <LoanCard key={l.id} loan={l} />
        ))}
      </div>
      <div className="pb-6" />
    </AppShell>
  )
}
