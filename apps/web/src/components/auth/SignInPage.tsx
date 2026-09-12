import { type ReactNode, useState } from "react"
import { Navigate } from "react-router"
import { signInWithGoogle, useSession } from "../../api/auth"
import { Button, Display, ErrorNotice, Loading } from "../../ui"

export function SignInPage() {
  const session = useSession()
  const [error, setError] = useState<string | null>(null)
  if (session.isPending) return <Loading />
  if (session.data) return <Navigate to="/transactions" replace />
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <div className="border-3 border-ink bg-accent px-6 py-5 text-center shadow-hard-lg">
          <Display as="div" className="text-6xl">
            June
          </Display>
        </div>
        <Button
          size="lg"
          onClick={() =>
            signInWithGoogle().then((result) => {
              if (result.error) setError(result.error.message ?? "Google sign-in failed")
            })
          }
        >
          Continue with Google
        </Button>
        {error ? <ErrorNotice message={error} /> : null}
      </div>
    </main>
  )
}

/** Gate: renders children only with a session; otherwise sends the visitor to Sign in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()
  if (session.isPending) return <Loading />
  if (!session.data) return <Navigate to="/sign-in" replace />
  return <>{children}</>
}
