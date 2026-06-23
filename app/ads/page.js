"use client";

import { useEffect, useMemo, useState } from "react";
import TabelData from "@/components/TabelData";
import { formatRupiah, formatRoas, formatTanggal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

export default function AdsPage() {
  const [rows, setRows] = useState([]);
  const [platformOptions, setPlatformOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [platform, setPlatform] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    async function fetchPlatforms() {
      const { data } = await supabase.from("ads").select("platform");
      if (!data) return;

      const unique = [...new Set(data.map((row) => row.platform).filter(Boolean))].sort();
      setPlatformOptions(unique);
    }

    fetchPlatforms();
  }, []);

  useEffect(() => {
    async function fetchAds() {
      setLoading(true);
      setError(null);

      let query = supabase.from("ads").select("*").order("tanggal", { ascending: false });

      if (platform !== "all") {
        query = query.eq("platform", platform);
      }

      if (startDate) {
        query = query.gte("tanggal", startDate);
      }

      if (endDate) {
        query = query.lte("tanggal", `${endDate}T23:59:59`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        setRows([]);
      } else {
        setRows(data ?? []);
      }

      setLoading(false);
    }

    fetchAds();
  }, [platform, startDate, endDate]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.biaya += Number(row.biaya_iklan) || 0;
        acc.klik += Number(row.klik) || 0;
        acc.konversi += Number(row.konversi) || 0;
        acc.pendapatan += Number(row.pendapatan) || 0;
        return acc;
      },
      { biaya: 0, klik: 0, konversi: 0, pendapatan: 0 },
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
        <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
          {row.platform || "-"}
        </span>
      ),
    },
    {
      key: "nama_kampanye",
      label: "Nama Kampanye",
      render: (row) => row.nama_kampanye || "-",
      className: "font-medium text-zinc-900",
    },
    {
      key: "biaya_iklan",
      label: "Biaya Iklan",
      align: "right",
      render: (row) => formatRupiah(row.biaya_iklan),
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
      key: "roas",
      label: "ROAS",
      align: "right",
      render: (row) => formatRoas(row.pendapatan, row.biaya_iklan),
      className: "font-semibold text-amber-700",
    },
  ];

  function resetFilters() {
    setPlatform("all");
    setStartDate("");
    setEndDate("");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Data Iklan</h1>
        <p className="mt-2 text-zinc-600">
          Pantau performa kampanye iklan berdasarkan platform dan rentang tanggal.
        </p>
      </header>

      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label htmlFor="platform" className="mb-1.5 block text-sm font-medium text-zinc-700">
              Platform
            </label>
            <select
              id="platform"
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            >
              <option value="all">Semua Platform</option>
              {platformOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="startDate" className="mb-1.5 block text-sm font-medium text-zinc-700">
              Tanggal Mulai
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            />
          </div>

          <div>
            <label htmlFor="endDate" className="mb-1.5 block text-sm font-medium text-zinc-700">
              Tanggal Akhir
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={toDateInputValue(new Date())}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              className="w-full rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">Total Biaya Iklan</p>
          <p className="mt-2 text-2xl font-bold text-violet-600">
            {loading ? "..." : formatRupiah(summary.biaya)}
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
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {loading ? "..." : summary.konversi.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-500">ROAS Keseluruhan</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {loading ? "..." : formatRoas(summary.pendapatan, summary.biaya)}
          </p>
        </div>
      </section>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Gagal memuat data: {error}
        </div>
      )}

      <TabelData
        title="Daftar Kampanye Iklan"
        subtitle={
          loading
            ? "Memuat data..."
            : `${rows.length.toLocaleString("id-ID")} baris data ditampilkan.`
        }
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage="Tidak ada data iklan untuk filter yang dipilih."
        getRowKey={(row) => row.id ?? `${row.tanggal}-${row.platform}-${row.nama_kampanye}`}
      />
    </div>
  );
}
