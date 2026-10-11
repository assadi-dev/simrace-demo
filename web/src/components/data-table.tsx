import { useState } from "react"
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/*
 * Tableau generique : TanStack Table v9 pour la logique (colonnes, tri), shadcn pour le rendu.
 * v9 demande de declarer les fonctionnalites utilisees ; ici le tri cote client.
 * Les colonnes se declarent avec `createDataTableColumns<Ligne>()`.
 */
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
})

type Features = typeof features

export const createDataTableColumns = <TData extends RowData>() =>
  createColumnHelper<Features, TData>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataTableColumns<TData extends RowData> = ColumnDef<Features, TData, any>[]

type DataTableProps<TData extends RowData> = {
  columns: DataTableColumns<TData>
  /** Garder une reference stable (useMemo, useState, resultat de useQuery) : sinon le tableau se recalcule a chaque rendu. */
  data: readonly TData[]
  getRowId: (row: TData) => string
  initialSorting?: SortingState
  emptyMessage?: string
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  initialSorting = [],
  emptyMessage = "Aucune donnée.",
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)

  const table = useTable({
    features,
    columns,
    data: data as TData[],
    getRowId,
    state: { sorting },
    onSortingChange: setSorting,
  })

  const rows = table.getRowModel().rows

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="hover:bg-transparent">
            {headerGroup.headers.map((header) => {
              const sorted = header.column.getIsSorted()
              return (
                <TableHead
                  key={header.id}
                  aria-sort={
                    sorted === "asc"
                      ? "ascending"
                      : sorted === "desc"
                        ? "descending"
                        : undefined
                  }
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <table.FlexRender header={header} />
                      {sorted === "asc" ? (
                        <ArrowUpIcon aria-hidden="true" className="size-3.5" />
                      ) : sorted === "desc" ? (
                        <ArrowDownIcon
                          aria-hidden="true"
                          className="size-3.5"
                        />
                      ) : (
                        <ChevronsUpDownIcon
                          aria-hidden="true"
                          className="size-3.5 text-subtle-foreground"
                        />
                      )}
                    </button>
                  ) : (
                    <table.FlexRender header={header} />
                  )}
                </TableHead>
              )
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={table.getAllLeafColumns().length}
              className="py-8 text-center text-muted-foreground"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
