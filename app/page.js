"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GrafikPenjualan from "@/components/GrafikPenjualan";
import TabelData from "@/components/TabelData";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { getSalesList } from "@/lib/dashboard/penjualan";
import { supabase } from "@/lib/supabase";

const PAGE_SIZE = 25;

const fmtPct = (n) => `${(Number(n) || 0).toFixed(2)}%`;
const fmtNum = (n) => (Number(n) || 0).toLocaleString("id-ID");

function aggregateWeeklyFromOmzet(rows = []) {
  const byWeek = {};

  for (const row of rows) {
    if (!row.tanggal) continue;
    const d = new Date(row.tanggal);
    if (Number.isNaN(d.getTime())) continue;

    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = weekStart.toISOString().split("T")[0];

    if (!byWeek[key]) {
      byWeek[key] = { minggu: key.slice(5), pendapatan: 0 };
    }
    byWeek[key].pendapatan += Number(row.omzet) || 0;
  }

  return Object.keys(byWeek)
    .sort()
    .slice(-8)
    .map((key) => byWeek[key]);
}

export default function PenjualanPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({
    total_omzet: 0,
    total_pesanan: 0,
    average_aov: 0,
    average_cancel_rate: 0,
  });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartRows, setChartRows] = useState([]);

  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [channel, setChannel] = useState("");
  const [brand, setBrand] = useState("");
  const [officer, setOfficer] = useState("");

  const [brandOptions, setBrandOptions] = useState([]);
  const [channelOptions, setChannelOptions] = useState([]);
  const [officerOptions, setOfficerOptions] = useState([]);

  const loadFilterOptions = useCallback(async () => {
    const { data, error: optError } = await supabase
      .from("penjualan_harian")
      .select("brand, channel, officer")
      .order("tanggal", { ascending: false })
      .limit(1000);

    if (optError || !data) return;

    setBrandOptions(
      [...new Set(data.map((r) => r.brand).filter(Boolean))].sort(),
    );
    setChannelOptions(
      [...new Set(data.map((r) => r.channel).filter(Boolean))].sort(),
    );
    setOfficerOptions(
      [...new Set(data.map((r) => r.officer).filter(Boolean))].sort(),
    );
  }, []);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getSalesList({
        dateStart: dateStart || undefined,
        dateEnd: dateEnd || undefined,
        channel: channel || undefined,
        brand: brand || undefined,
        officer: officer || undefined,
        page,
        pageSize: PAGE_SIZE,
      });

      setRows(result.rows || []);
      setSummary(
        result.summary || {
          total_omzet: 0,
          total_pesanan: 0,
          average_aov: 0,
          average_cancel_rate: 0,
        },
      );
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 1);

      // Chart uses full filtered set (same filters, no pagination)
      const chartResult = await getSalesList({
        dateStart: dateStart || undefined,
        dateEnd: dateEnd || undefined,
        channel: channel || undefined,
        brand: brand || undefined,
        officer: officer || undefined,
        page: 1,
        pageSize: 1000,
      });
      setChartRows(chartResult.rows || []);
    } catch (err) {
      setError(err.message || "Gagal memuat data penjualan.");
      setRows([]);
      setChartRows([]);
      setTotal(0);
      setTotalPages(1);
      setSummary({
        total_omzet: 0,
        total_pesanan: 0,
        average_aov: 0,
        average_cancel_rate: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [dateStart, dateEnd, channel, brand, officer, page]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Reset to first page when filters change (without double-fetch flicker)
  const onFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const weeklyData = useMemo(
    () => aggregateWeeklyFromOmzet(chartRows),
    [chartRows],
  );

  const columns = [
    {
      key: "tanggal",
      label: "Tanggal",
      nowrap: true,
      render: (row) => formatTanggal(row.tanggal),
    },
    {
      key: "channel",
      label: "Channel",
      render: (row) => row.channel || "-",
    },
    {
      key: "omzet",
      label: "Omzet",
      align: "right",
      render: (row) => formatRupiah(row.omzet),
      className: "font-medium text-emerald-700",
    },
    {
      key: "pesanan_masuk",
      label: "Pesanan",
      align: "right",
      render: (row) => fmtNum(row.pesanan_masuk),
    },
    {
      key: "jumlah_produk_terjual",
      label: "Produk Terjual",
      align: "right",
      render: (row) => fmtNum(row.jumlah_produk_terjual),
    },
    {
      key: "pesanan_batal",
      label: "Batal",
      align: "right",
      render: (row) => fmtNum(row.pesanan_batal),
    },
    {
      key: "cancel_rate",
      label: "Cancel Rate",
      align: "right",
      render: (row) => fmtPct(row.cancel_rate),
    },
    {
      key: "aov_order",
      label: "AOV",
      align: "right",
      render: (row) => formatRupiah(row.aov_order),
    },
    {
      key: "pengunjung_toko",
      label: "Pengunjung",
      align: "right",
      render: (row) => fmtNum(row.pengunjung_toko),
    },
    {
      key: "visitor_cvr",
      label: "Visitor CVR",
      align: "right",
      render: (row) => fmtPct(row.visitor_cvr),
    },
    {
      key: "customer_baru",
      label: "Customer Baru",
      align: "right",
      render: (row) => fmtNum(row.customer_baru),
    },
    {
      key: "customer_repeat",
      label: "Customer Repeat",
      align: "right",
      render: (row) => fmtNum(row.customer_repeat),
    },
    {
      key: "repeat_customer_rate",
      label: "Repeat Rate",
      align: "right",
      render: (row) => fmtPct(row.repeat_customer_rate),
    },
    {
      key: "jumlah_gagal_pickup",
      label: "Gagal Pickup",
      align: "right",
      render: (row) => fmtNum(row.jumlah_gagal_pickup),
    },
    {
      key: "fail_to_pickup_rate",
      label: "Fail Pickup Rate",
      align: "right",
      render: (row) => fmtPct(row.fail_to_pickup_rate),
    },
    {
      key: "jumlah_campaign_didaftarkan",
      label: "Campaign",
      align: "right",
      render: (row) => fmtNum(row.jumlah_campaign_didaftarkan),
    },
    {
      key: "omzet_affiliate",
      label: "Omzet Affiliate",
      align: "right",
      render: (row) => formatRupiah(row.omzet_affiliate),
    },
    {
      key: "biaya_affiliate",
      label: "Biaya Affiliate",
      align: "right",
      render: (row) => formatRupiah(row.biaya_affiliate),
    },
    {
      key: "pesanan_affiliate",
      label: "Pesanan Affiliate",
      align: "right",
      render: (row) => fmtNum(row.pesanan_affiliate),
    },
    {
      key: "roi_affiliate",
      label: "ROI Affiliate",
      align: "right",
      render: (row) => fmtNum(row.roi_affiliate),
    },
    {
      key: "biaya_ads",
      label: "Biaya Ads",
      align: "right",
      render: (row) => formatRupiah(row.biaya_ads),
    },
    {
      key: "omzet_ads",
      label: "Omzet Ads",
      align: "right",
      render: (row) => formatRupiah(row.omzet_ads),
    },
    {
      key: "pesanan_ads",
      label: "Pesanan Ads",
      align: "right",
      render: (row) => fmtNum(row.pesanan_ads),
    },
  ];

  const hasFilters = Boolean(dateStart || dateEnd || channel || brand || officer);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Data Penjualan</h1>
        <p className="mt-2 text-zinc-600">
          Daftar performa penjualan harian dari semua marketplace.
        </p>
      </header>

      {/* Filters */}
      <section className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <span className="text-xs font-semibold text-zinc-500">Periode</span>
        <input
          type="date"
          value={dateStart}
          onChange={onFilterChange(setDateStart)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-800 outline-none"
        />
        <span className="text-zinc-300">—</span>
        <input
          type="date"
          value={dateEnd}
          onChange={onFilterChange(setDateEnd)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-800 outline-none"
        />

        <span className="ml-2 text-xs font-semibold text-zinc-500">Channel</span>
        <select
          value={channel}
          onChange={onFilterChange(setChannel)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-800 outline-none"
        >
          <option value="">Semua</option>
          {channelOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <span className="text-xs font-semibold text-zinc-500">Brand</span>
        <select
          value={brand}
          onChange={onFilterChange(setBrand)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-800 outline-none"
        >
          <option value="">Semua</option>
          {brandOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <span className="text-xs font-semibold text-zinc-500">Officer</span>
        <select
          value={officer}
          onChange={onFilterChange(setOfficer)}
          className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-800 outline-none"
        >
          <option value="">Semua</option>
          {officerOptions.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setDateStart("");
              setDateEnd("");
              setChannel("");
              setBrand("");
              setOfficer("");
              setPage(1);
            }}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Reset
          </button>
        )}
      </section>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Gagal memuat data: {error}
          <button
            type="button"
            onClick={fetchSales}
            className="ml-3 font-medium underline"
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* Summary */}
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Total Omzet</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {loading ? "..." : formatRupiah(summary.total_omzet)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Total Pesanan</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {loading ? "..." : fmtNum(summary.total_pesanan)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Average AOV</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900">
            {loading ? "..." : formatRupiah(summary.average_aov)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Average Cancel Rate</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900">
            {loading ? "..." : fmtPct(summary.average_cancel_rate)}
          </p>
        </div>
      </section>

      <div className="mb-8">
        <GrafikPenjualan data={weeklyData} loading={loading} />
      </div>

      <TabelData
        title="Semua Data Penjualan"
        subtitle={
          loading
            ? "Memuat..."
            : `${fmtNum(total)} baris · halaman ${page} dari ${totalPages}`
        }
        columns={columns}
        rows={rows}
        loading={loading}
        emptyMessage="Belum ada data penjualan."
        getRowKey={(row) => row.id ?? `${row.tanggal}-${row.channel}`}
      />

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">
            Menampilkan {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} dari {fmtNum(total)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="text-sm text-zinc-600">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
