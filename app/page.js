"use client";

import { useEffect, useMemo, useState } from "react";
import GrafikPenjualan from "@/components/GrafikPenjualan";
import TabelData from "@/components/TabelData";
import {
  aggregateWeeklySales,
  formatRupiah,
  formatRoas,
  formatTanggal,
} from "@/lib/format";
import { supabase } from "@/lib/supabase";

function StatCard({ label, value, color = "text-zinc-900" }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [penjualan, setPenjualan] = useState([]);
  const [ads, setAds] = useState([]);
  const [affiliate, setAffiliate] = useState([]);
  const [livestream, setLivestream] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);

      const [penjualanRes, adsRes, affiliateRes, livestreamRes] = await Promise.all([
        supabase.from("penjualan").select("*").order("tanggal", { ascending: false }),
        supabase.from("ads").select("*").order("tanggal", { ascending: false }),
        supabase.from("affiliate").select("*").order("tanggal", { ascending: false }),
        supabase.from("livestream").select("*").order("tanggal", { ascending: false }),
      ]);

      const fetchError =
        penjualanRes.error?.message ||
        adsRes.error?.message ||
        affiliateRes.error?.message ||
        livestreamRes.error?.message;

      if (fetchError) {
        setError(fetchError);
      }

      setPenjualan(penjualanRes.data ?? []);
      setAds(adsRes.data ?? []);
      setAffiliate(affiliateRes.data ?? []);
      setLivestream(livestreamRes.data ?? []);
      setLoading(false);
    }

    fetchAll();
  }, []);

  const totalPendapatanPenjualan = useMemo(
    () => penjualan.reduce((sum, row) => sum + (Number(row.total) || 0), 0),
    [penjualan],
  );

  const totalBiayaIklan = useMemo(
    () => ads.reduce((sum, row) => sum + (Number(row.biaya_iklan) || 0), 0),
    [ads],
  );

  const totalPendapatanAds = useMemo(
    () => ads.reduce((sum, row) => sum + (Number(row.pendapatan) || 0), 0),
    [ads],
  );

  const totalKomisiAffiliate = useMemo(
    () => affiliate.reduce((sum, row) => sum + (Number(row.komisi) || 0), 0),
    [affiliate],
  );

  const totalPendapatanLivestream = useMemo(
    () => livestream.reduce((sum, row) => sum + (Number(row.pendapatan) || 0), 0),
    [livestream],
  );

  const weeklyData = useMemo(() => aggregateWeeklySales(penjualan), [penjualan]);

  const latestRows = useMemo(() => {
    const combined = [
      ...penjualan.map((row) => ({
        ...row,
        sumber: "Penjualan",
        nilai: row.total,
      })),
      ...ads.map((row) => ({
        ...row,
        sumber: "Iklan",
        nilai: row.pendapatan,
        keterangan: row.nama_kampanye,
      })),
      ...affiliate.map((row) => ({
        ...row,
        sumber: "Affiliate",
        nilai: row.komisi,
        keterangan: row.nama_affiliate,
      })),
      ...livestream.map((row) => ({
        ...row,
        sumber: "Livestream",
        nilai: row.pendapatan,
        keterangan: row.judul_live,
      })),
    ];

    return combined
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
      .slice(0, 10);
  }, [penjualan, ads, affiliate, livestream]);

  const columns = [
    {
      key: "tanggal",
      label: "Tanggal",
      render: (row) => formatTanggal(row.tanggal),
    },
    {
      key: "sumber",
      label: "Sumber",
      render: (row) => (
        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
          {row.sumber}
        </span>
      ),
    },
    {
      key: "keterangan",
      label: "Keterangan",
      render: (row) => row.keterangan || row.produk || row.nama_kampanye || "-",
      className: "font-medium text-zinc-900",
    },
    {
      key: "platform",
      label: "Platform",
      render: (row) => row.platform || row.marketplace || "-",
    },
    {
      key: "nilai",
      label: "Nilai",
      align: "right",
      render: (row) => formatRupiah(row.nilai),
      className: "font-medium text-emerald-700",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-zinc-600">
          Ringkasan performa penjualan, iklan, affiliate, dan livestream.
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Gagal memuat data: {error}
        </div>
      )}

      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Pendapatan Penjualan"
          value={loading ? "..." : formatRupiah(totalPendapatanPenjualan)}
          color="text-emerald-600"
        />
        <StatCard
          label="Total Pesanan"
          value={loading ? "..." : penjualan.length.toLocaleString("id-ID")}
          color="text-blue-600"
        />
        <StatCard
          label="Biaya Iklan"
          value={loading ? "..." : formatRupiah(totalBiayaIklan)}
          color="text-violet-600"
        />
        <StatCard
          label="ROAS Iklan"
          value={loading ? "..." : formatRoas(totalPendapatanAds, totalBiayaIklan)}
          color="text-amber-600"
        />
        <StatCard
          label="Komisi Affiliate"
          value={loading ? "..." : formatRupiah(totalKomisiAffiliate)}
          color="text-orange-600"
        />
        <StatCard
          label="Pendapatan Livestream"
          value={loading ? "..." : formatRupiah(totalPendapatanLivestream)}
          color="text-rose-600"
        />
      </section>

      <div className="mb-8">
        <GrafikPenjualan data={weeklyData} loading={loading} />
      </div>

      <TabelData
        title="Aktivitas Terbaru"
        subtitle="10 entri terbaru dari semua sumber data."
        columns={columns}
        rows={latestRows}
        loading={loading}
        emptyMessage="Belum ada data."
        getRowKey={(row, index) =>
          `${row.sumber}-${row.id ?? row.tanggal}-${index}`
        }
      />
    </div>
  );
}
