export default function TabelData({
  title,
  subtitle,
  columns = [],
  rows = [],
  loading = false,
  emptyMessage = "Belum ada data.",
  getRowKey,
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {(title || subtitle) && (
        <div className="border-b border-zinc-200 px-6 py-4">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 font-medium text-zinc-500 ${
                    column.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-zinc-400"
                >
                  Memuat data...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-zinc-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={getRowKey ? getRowKey(row, index) : row.id ?? index}
                  className="hover:bg-zinc-50"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 ${
                        column.align === "right"
                          ? "whitespace-nowrap text-right"
                          : column.nowrap
                            ? "whitespace-nowrap"
                            : ""
                      } ${column.className || "text-zinc-700"}`}
                    >
                      {column.render ? column.render(row) : row[column.key] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
