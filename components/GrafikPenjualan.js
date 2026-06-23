"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/format";

export default function GrafikPenjualan({ data = [], loading = false, title, subtitle }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">{title || "Grafik Penjualan Mingguan"}</h2>
        <p className="text-sm text-zinc-500">
          {subtitle || "Total pendapatan per minggu (8 minggu terakhir)."}
        </p>
      </div>

      <div className="h-80 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-zinc-400">
            Memuat grafik...
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-400">
            Belum ada data penjualan.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis
                dataKey="minggu"
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={{ stroke: "#d4d4d8" }}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 12 }}
                axisLine={{ stroke: "#d4d4d8" }}
                tickFormatter={(value) =>
                  new Intl.NumberFormat("id-ID", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(value)
                }
              />
              <Tooltip
                formatter={(value) => [formatRupiah(value), "Pendapatan"]}
                labelFormatter={(label) => `Minggu ${label}`}
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e4e4e7",
                }}
              />
              <Bar dataKey="pendapatan" fill="#059669" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
