/**
 * Declarative table on top of HeroUI's (React Aria) Table: keyboard navigation, row
 * actions and sorting come from the primitive; pages only describe columns.
 */
import { Button, Table } from "@heroui/react"
import { useMemo, useState, type ReactNode } from "react"
import { Empty } from "./empty"

export interface Column<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
  /** Value used for sorting; column is sortable when provided. */
  sortValue?: (row: T) => string | number
  className?: string
  align?: "start" | "end"
  isRowHeader?: boolean
}

interface DataTableProps<T> {
  label: string
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRowAction?: (row: T) => void
  empty?: ReactNode
  /** Initial sort. */
  defaultSort?: { column: string; direction: "ascending" | "descending" }
  /** Below this width the table scrolls horizontally instead of squashing columns. */
  minWidth?: number
  /** Rows rendered at first; more load on demand so long worklists stay fast. */
  pageSize?: number
}

export function DataTable<T>({ label, rows, columns, rowKey, onRowAction, empty, defaultSort, minWidth = 860, pageSize = 25 }: DataTableProps<T>) {
  const [sort, setSort] = useState(defaultSort)
  const [limit, setLimit] = useState(pageSize)
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.id === sort?.column)
    if (!col?.sortValue || !sort) return rows
    const dir = sort.direction === "ascending" ? 1 : -1
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a)
      const vb = col.sortValue!(b)
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir
    })
  }, [rows, columns, sort])

  if (rows.length === 0) return <>{empty ?? <Empty title="Belum ada data" />}</>

  const visible = sorted.slice(0, limit)
  const byKey = new Map(visible.map((r) => [rowKey(r), r]))
  const remaining = sorted.length - visible.length
  return (
    <>
      <Table variant="secondary" className="min-w-0">
        <Table.ScrollContainer>
          <Table.Content
            aria-label={label}
            style={{ minWidth }}
            sortDescriptor={sort}
            onSortChange={(d) => setSort({ column: String(d.column), direction: d.direction })}
            onRowAction={onRowAction ? (key) => onRowAction(byKey.get(String(key))!) : undefined}
          >
            <Table.Header>
              {columns.map((c, i) => (
                <Table.Column key={c.id} id={c.id} isRowHeader={c.isRowHeader ?? i === 0} allowsSorting={!!c.sortValue} className={c.align === "end" ? "text-right" : undefined}>
                  {c.header}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body>
              {visible.map((row) => (
                <Table.Row key={rowKey(row)} id={rowKey(row)} className={onRowAction ? "cursor-pointer" : undefined}>
                  {columns.map((c) => (
                    <Table.Cell key={c.id} className={[c.className, c.align === "end" ? "text-right" : ""].filter(Boolean).join(" ")}>
                      {c.cell(row)}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      {remaining > 0 && (
        <div className="flex items-center justify-between border-t border-separator px-4 py-2 text-sm text-muted">
          <span>
            Menampilkan {visible.length} dari {sorted.length}
          </span>
          <Button size="sm" variant="ghost" onPress={() => setLimit((l) => l + pageSize)}>
            Tampilkan {Math.min(pageSize, remaining)} lagi
          </Button>
        </div>
      )}
    </>
  )
}
