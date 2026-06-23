"use client";

import { useEffect, useMemo, useState } from "react";
import GrafikPenjualan from "@/components/GrafikPenjualan";
import TabelData from "@/components/TabelData";
import {
  aggregateWeeklySales,
  formatRupiah,
  formatTanggal,
} from "@/lib/format";
import { supabase } from "@/lib/supabase";

export default function PenjualanPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPenjualan() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("penjualan")
        .select("*")
        .order("tanggal", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
        setRows([]);
      } else {
        setRows(data ?? []);
      }

      setLoading(false);
    }

    fetchPenjualan();
  }, []);

  const totalPendapatan = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
    [rows],
  );

  const weeklyData = useMemo(() => aggregateWeeklySales(rows), [rows]);

  const columns = [
    {
      key: "tanggal",
      label: "Tanggal",
      nowrap: true,
      render: (row) => formatTanggal(row.tanggal),
    },
    {
      key: "produk",
      label: "Produk",
      render: (row) => row.produk || "-",
      className: "font-medium text-zinc-900",
    },
    {
      key: "marketplace",
      label: "Marketplace",
      render: (row) => row.marketplace || "-",
    },
    {
      key: "jumlah",
      label: "Jumlah",
      align: "right",
      render: (row) => Number(row.jumlah || 0).toLocaleString("id-ID"),
    },
    {
      key: "total",
      label: "Total",
      align: "right",
      render: (row) => formatRupiah(row.total),
      className: "font-medium text-emerald-700",
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
          {row.status || "-"}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Data Penjualan</h1>
        <p className="mt-2 text-zinc-600">
          Daftar transaksi penjualan dari semua marketplace.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Gagal memuat data: {error}
        </div>
      )}

      <section className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Total Pendapatan</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {loading ? "..." : formatRupiah(totalPendapatan)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Total Pesanan</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">
            {loading ? "..." : rows.length.toLocaleString("id-ID")}
          </p>
        </div>
      </section>

      <div className="mb-8">
        <GrafikPenjualan data={weeklyData} loading={loading} />
      </div>

      <TabelData
        title="Semua Data Penjualan"
        subtitle={`${rows.length.toLocaleString("id-ID")} transaksi.`}
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage="Belum ada data penjualan."
        getRowKey={(row) => row.id ?? `${row.tanggal}-${row.produk}`}
      />
    </div>
  );
}
