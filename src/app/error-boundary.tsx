/**
 * Error state. A crash in one page must not blank the whole workstation: the shell stays,
 * the page says what failed and offers recovery — retry, go home, or rebuild demo data.
 */
import { Button } from "@heroui/react"
import { AlertTriangle, Home, RefreshCw, RotateCcw } from "lucide-react"
import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
  /** Changing this (e.g. the route) clears the error. */
  resetKey?: string
  onResetData?: () => void
}

interface State {
  error?: Error
}

/** Lazy route chunks fail to load after a redeploy or when the network drops. */
const isChunkError = (e: Error) => /dynamically imported module|Loading chunk|Failed to fetch/i.test(e.message)

export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Production would ship this to the error tracker with the route and role.
    console.error("Page crashed", error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: undefined })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const chunk = isChunkError(error)
    return (
      <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-3 px-6 py-16">
        <span className="grid size-11 place-items-center rounded-xl bg-danger-soft text-danger">
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">{chunk ? "This screen could not be downloaded" : "This screen stopped working"}</h1>
        <p className="text-sm text-muted">
          {chunk
            ? "The connection dropped or a new version was released. Reloading fetches the current version; nothing you saved is lost."
            : "Your other work is safe — only this screen failed. Try again; if it keeps failing, go back home or rebuild the demo data."}
        </p>
        <pre className="num max-w-full overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">{error.message}</pre>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button variant="primary" onPress={() => (chunk ? window.location.reload() : this.setState({ error: undefined }))}>
            <RefreshCw className="size-4" aria-hidden /> {chunk ? "Reload" : "Try again"}
          </Button>
          <Button variant="tertiary" onPress={() => ((window.location.hash = "#/"), this.setState({ error: undefined }))}>
            <Home className="size-4" aria-hidden /> Home
          </Button>
          {this.props.onResetData && !chunk && (
            <Button variant="ghost" onPress={() => (this.props.onResetData?.(), this.setState({ error: undefined }))}>
              <RotateCcw className="size-4" aria-hidden /> Rebuild demo data
            </Button>
          )}
        </div>
      </div>
    )
  }
}
