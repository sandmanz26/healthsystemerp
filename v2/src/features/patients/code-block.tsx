/**
 * Read-only message / resource viewer (FHIR JSON, HL7 v2) with a standards caption and a
 * copy button, so implementers can check mappings without leaving the chart.
 */
import { Button } from "@heroui/react"
import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { toast } from "@v2/lib/toast"

interface CodeBlockProps {
  /** e.g. "FHIR R4 · US Core 6.1.0 · Patient". */
  caption: string
  code: string
  /** Optional muted note under the caption. */
  note?: string
  maxHeight?: number
}

export function CodeBlock({ caption, code, note, maxHeight = 420 }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.danger("Clipboard not available in this browser")
    }
  }
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-surface">
      <figcaption className="flex items-center justify-between gap-2 border-b border-separator px-4 py-2">
        <div className="min-w-0">
          <div className="label-caps truncate text-muted">{caption}</div>
          {note && <div className="truncate text-xs text-muted">{note}</div>}
        </div>
        <Button size="sm" variant="ghost" onPress={copy} aria-label={`Copy ${caption}`}>
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </figcaption>
      <pre className="num overflow-auto whitespace-pre bg-surface-secondary p-4 text-[11.5px] leading-relaxed" style={{ maxHeight }}>
        <code>{code}</code>
      </pre>
    </figure>
  )
}
