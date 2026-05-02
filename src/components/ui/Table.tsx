import React from 'react'
import { Loader2 } from 'lucide-react'

export interface Column<T = unknown> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
  headerClassName?: string
}

interface TableProps<T = unknown> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  keyExtractor?: (row: T) => string
}

export function Table<T = unknown>({
  columns,
  data,
  loading = false,
  emptyMessage = 'No hay datos',
  onRowClick,
  keyExtractor,
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.headerClassName ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-50">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <div className="flex items-center justify-center gap-2 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Cargando...</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={keyExtractor ? keyExtractor(row) : idx}
                onClick={() => onRowClick?.(row)}
                className={`
                  transition-colors
                  ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                  ${onRowClick ? 'cursor-pointer hover:bg-green-50' : ''}
                `}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-sm text-gray-700 ${col.className ?? ''}`}
                  >
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
