/**
 * Shared-workstation lock. Nurse stations and registration desks are used by many people
 * per shift; locking hides patient data without losing the current page.
 */
import { Avatar, Button, Card } from "@heroui/react"
import { Lock } from "lucide-react"
import { useState } from "react"
import { TextInput } from "@v2/components/ui/fields"
import { ROLES, ROLE_ORDER } from "@v2/domain/roles"
import { initials } from "@v2/lib/format"
import { useActions } from "@v2/store"
import { useSession } from "@v2/store/selectors"
import { Logo } from "./logo"

export function LockScreen() {
  const { user, role } = useSession()
  const { unlock, switchRole } = useActions()
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string>()

  const submit = () => {
    // Demo PIN. Production verifies against the identity provider.
    if (pin === "1234") unlock()
    else setError("Incorrect PIN. For the demo, use 1234.")
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-4 backdrop-blur-md">
      <Card className="w-full max-w-sm gap-5 p-6">
        <Logo />
        <div className="flex items-center gap-3">
          <Avatar color="accent" variant="soft">
            <Avatar.Fallback>{initials(user?.name ?? "?")}</Avatar.Fallback>
          </Avatar>
          <div>
            <div className="font-semibold">{user?.name}</div>
            <div className="text-sm text-muted">{ROLES[role].label} · workstation locked</div>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="space-y-3"
        >
          <TextInput label="PIN" type="password" inputMode="numeric" value={pin} onChange={(v) => { setPin(v); setError(undefined) }} error={error} autoFocus description="Demo: 1234" maxLength={6} />
          <Button type="submit" variant="primary" fullWidth>
            <Lock className="size-4" aria-hidden />
            Unlock
          </Button>
        </form>
        <div>
          <div className="mb-2 text-xs font-medium text-muted">Or sign in as another user</div>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_ORDER.filter((r) => r !== role).map((r) => (
              <Button key={r} size="sm" variant="tertiary" onPress={() => switchRole(r)}>
                {ROLES[r].label}
              </Button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
