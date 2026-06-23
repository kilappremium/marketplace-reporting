"use client";

import { useEffect, useMemo, useState } from "react";
import TabelData from "@/components/TabelData";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export default function AffiliatePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAffiliate() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("affiliate")
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

    fetchAffiliate();
  }, []);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.komisi += Number(row.komisi) || 0;
        acc.klik += Number(row.klik) || 0;
        acc.konversi += Number(row.konversi) || 0;
        acc.pendapatan += Number(row.pendapatan) || 0;
        return acc;
      },
      { komisi: 0, klik: 0, konversi: 0, pendapatan: 0 },
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
        <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
          {row.platform || "-"}
        </span>
      ),
    },
    {
      key: "nama_affiliate",
      label: "Nama Affiliate",
      render: (row) => row.nama_affiliate || "-",
      className: "font-medium text-zinc-900",
    },
    {
      key: "klik",
      label: "Klik",
      align: "right",
      render: (row) => Number(row.klik || 0).toLocaleString("id-ID"),
    },
    {
      key: "konversi",
      label: "Konversi",
      align: "right",
      render: (row) => Number(row.konversi || 0).toLocaleString("id-ID"),
    },
    {
      key: "pendapatan",
      label: "Pendapatan",
      align: "right",
      render: (row) => formatRupiah(row.pendapatan),
    },
    {
      key: "komisi",
      label: "Komisi",
      align: "right",
      render: (row) => formatRupiah(row.komisi),
      className: "font-medium text-orange-700",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Data Affiliate</h1>
        <p className="mt-2 text-zinc-600">
          Performa program affiliate dan komisi yang dihasilkan.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Gagal memuat data: {error}
        </div>
      )}

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Total Komisi</p>
          <p className="mt-2 text-2xl font-bold text-orange-600">
            {loading ? "..." : formatRupiah(summary.komisi)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Total Pendapatan</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {loading ? "..." : formatRupiah(summary.pendapatan)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Total Klik</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {loading ? "..." : summary.klik.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Total Konversi</p>
          <p className="mt-2 text-2xl font-bold text-violet-600">
            {loading ? "..." : summary.konversi.toLocaleString("id-ID")}
          </p>
        </div>
      </section>

      <TabelData
        title="Daftar Affiliate"
        subtitle={`${rows.length.toLocaleString("id-ID")} entri affiliate.`}
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage="Belum ada data affiliate."
        getRowKey={(row) => row.id ?? `${row.tanggal}-${row.nama_affiliate}`}
      />
    </div>
  );
}
