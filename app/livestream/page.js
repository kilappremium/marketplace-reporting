"use client";

import { useEffect, useMemo, useState } from "react";
import TabelData from "@/components/TabelData";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export default function LivestreamPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchLivestream() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("livestream")
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

    fetchLivestream();
  }, []);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.pendapatan += Number(row.pendapatan) || 0;
        acc.penonton += Number(row.penonton) || 0;
        acc.pesanan += Number(row.pesanan) || 0;
        acc.durasi += Number(row.durasi_menit) || 0;
        return acc;
      },
      { pendapatan: 0, penonton: 0, pesanan: 0, durasi: 0 },
    );
  }, [rows]);

  const columns = [
    {
      key: "tanggal",
      label: "Tanggal",
      nowrap: true,
      render: (row) => formatTanggal(row.tanggal),
    },
    {
      key: "platform",
      label: "Platform",
      render: (row) => (
        <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
          {row.platform || "-"}
        </span>
      ),
    },
    {
      key: "judul_live",
      label: "Judul Live",
      render: (row) => row.judul_live || "-",
      className: "font-medium text-zinc-900",
    },
    {
      key: "durasi_menit",
      label: "Durasi (menit)",
      align: "right",
      render: (row) => Number(row.durasi_menit || 0).toLocaleString("id-ID"),
    },
    {
      key: "penonton",
      label: "Penonton",
      align: "right",
      render: (row) => Number(row.penonton || 0).toLocaleString("id-ID"),
    },
    {
      key: "pesanan",
      label: "Pesanan",
      align: "right",
      render: (row) => Number(row.pesanan || 0).toLocaleString("id-ID"),
    },
    {
      key: "pendapatan",
      label: "Pendapatan",
      align: "right",
      render: (row) => formatRupiah(row.pendapatan),
      className: "font-medium text-rose-700",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Data Livestream</h1>
        <p className="mt-2 text-zinc-600">
          Laporan performa live selling di berbagai platform.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Gagal memuat data: {error}
        </div>
      )}

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Total Pendapatan</p>
          <p className="mt-2 text-2xl font-bold text-rose-600">
            {loading ? "..." : formatRupiah(summary.pendapatan)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Total Penonton</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {loading ? "..." : summary.penonton.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Total Pesanan</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {loading ? "..." : summary.pesanan.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Total Durasi</p>
          <p className="mt-2 text-2xl font-bold text-violet-600">
            {loading ? "..." : `${summary.durasi.toLocaleString("id-ID")} mnt`}
          </p>
        </div>
      </section>

      <TabelData
        title="Daftar Livestream"
        subtitle={`${rows.length.toLocaleString("id-ID")} sesi livestream.`}
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage="Belum ada data livestream."
        getRowKey={(row) => row.id ?? `${row.tanggal}-${row.judul_live}`}
      />
    </div>
  );
}
