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
  const [adsData, setAdsData] = useState([]);
  const [affiliate, setAffiliate] = useState([]);
  const [livestream, setLivestream] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);

      const [penjualanRes, shopeeRes, tiktokRes, metaRes, affiliateRes, livestreamRes] =
        await Promise.all([
          supabase.from("penjualan").select("*").order("tanggal", { ascending: false }),
          supabase.from("ads_shopee").select("*").order("tanggal", { ascending: false }),
          supabase.from("ads_tiktok").select("*").order("tanggal", { ascending: false }),
          supabase.from("ads_meta").select("*").order("tanggal", { ascending: false }),
          supabase.from("affiliate").select("*").order("tanggal", { ascending: false }),
          supabase.from("livestream").select("*").order("tanggal", { ascending: false }),
        ]);

      const errors = [
        penjualanRes.error,
        shopeeRes.error,
        tiktokRes.error,
        metaRes.error,
        affiliateRes.error,
        livestreamRes.error,
      ]
        .filter(Boolean)
        .map((err) => err.message);

      if (errors.length) {
        setError(errors.join(" | "));
      }

      const combinedAds = [
        ...(shopeeRes.data ?? []).map((row) => ({ ...row, platform: "Shopee Ads" })),
        ...(tiktokRes.data ?? []).map((row) => ({ ...row, platform: "TikTok Ads" })),
        ...(metaRes.data ?? []).map((row) => ({ ...row, platform: "Meta Ads" })),
      ].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

      setPenjualan(penjualanRes.data ?? []);
      setAdsData(combinedAds);
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
    () => adsData.reduce((sum, row) => sum + (Number(row.biaya_iklan) || 0), 0),
    [adsData],
  );

  const totalOmzetIklan = useMemo(
    () => adsData.reduce((sum, row) => sum + (Number(row.omzet) || 0), 0),
    [adsData],
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
      ...adsData.map((row) => ({
        ...row,
        sumber: "Iklan",
        nilai: row.omzet,
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
  }, [penjualan, adsData, affiliate, livestream]);

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
          label="Total Biaya Iklan"
          value={loading ? "..." : formatRupiah(totalBiayaIklan)}
          color="text-violet-600"
        />
        <StatCard
          label="Total Omzet Iklan"
          value={loading ? "..." : formatRupiah(totalOmzetIklan)}
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
          `${row.sumber}-${row.platform ?? ""}-${row.id ?? row.tanggal}-${index}`
        }
      />
    </div>
  );
}
