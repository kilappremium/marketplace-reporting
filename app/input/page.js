"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const tabs = [
  {
    id: "penjualan",
    label: "Penjualan",
    table: "penjualan",
    numericFields: ["jumlah", "total"],
    fields: [
      { name: "tanggal", label: "Tanggal", type: "date", required: true },
      { name: "produk", label: "Produk", type: "text", required: true },
      { name: "marketplace", label: "Marketplace", type: "text", required: true, placeholder: "Shopee, Tokopedia, TikTok Shop" },
      { name: "jumlah", label: "Jumlah", type: "number", required: true, min: 1 },
      { name: "total", label: "Total (IDR)", type: "number", required: true, min: 0 },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: ["Selesai", "Diproses", "Dikirim", "Dibatalkan"],
      },
    ],
  },
  {
    id: "ads",
    label: "Ads",
    table: "ads",
    numericFields: ["biaya_iklan", "klik", "konversi", "pendapatan"],
    fields: [
      { name: "tanggal", label: "Tanggal", type: "date", required: true },
      { name: "platform", label: "Platform", type: "text", required: true, placeholder: "Meta Ads, Google Ads, Shopee Ads" },
      { name: "nama_kampanye", label: "Nama Kampanye", type: "text", required: true },
      { name: "biaya_iklan", label: "Biaya Iklan (IDR)", type: "number", required: true, min: 0 },
      { name: "klik", label: "Klik", type: "number", required: true, min: 0 },
      { name: "konversi", label: "Konversi", type: "number", required: true, min: 0 },
      { name: "pendapatan", label: "Pendapatan (IDR)", type: "number", required: true, min: 0 },
    ],
  },
  {
    id: "affiliate",
    label: "Affiliate",
    table: "affiliate",
    numericFields: ["klik", "konversi", "pendapatan", "komisi"],
    fields: [
      { name: "tanggal", label: "Tanggal", type: "date", required: true },
      { name: "platform", label: "Platform", type: "text", required: true, placeholder: "Shopee Affiliate, TikTok Affiliate" },
      { name: "nama_affiliate", label: "Nama Affiliate", type: "text", required: true },
      { name: "klik", label: "Klik", type: "number", required: true, min: 0 },
      { name: "konversi", label: "Konversi", type: "number", required: true, min: 0 },
      { name: "pendapatan", label: "Pendapatan (IDR)", type: "number", required: true, min: 0 },
      { name: "komisi", label: "Komisi (IDR)", type: "number", required: true, min: 0 },
    ],
  },
  {
    id: "livestream",
    label: "Livestream",
    table: "livestream",
    numericFields: ["durasi_menit", "penonton", "pesanan", "pendapatan"],
    fields: [
      { name: "tanggal", label: "Tanggal", type: "date", required: true },
      { name: "platform", label: "Platform", type: "text", required: true, placeholder: "Shopee Live, TikTok Live" },
      { name: "judul_live", label: "Judul Live", type: "text", required: true },
      { name: "durasi_menit", label: "Durasi (menit)", type: "number", required: true, min: 1 },
      { name: "penonton", label: "Penonton", type: "number", required: true, min: 0 },
      { name: "pesanan", label: "Pesanan", type: "number", required: true, min: 0 },
      { name: "pendapatan", label: "Pendapatan (IDR)", type: "number", required: true, min: 0 },
    ],
  },
];

function createEmptyForms() {
  return tabs.reduce((acc, tab) => {
    acc[tab.id] = tab.fields.reduce((fields, field) => {
      fields[field.name] = "";
      return fields;
    }, {});
    return acc;
  }, {});
}

function FormField({ field, value, onChange }) {
  const inputClass =
    "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

  return (
    <div>
      <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-zinc-700">
        {field.label}
      </label>

      {field.type === "select" ? (
        <select
          id={field.name}
          name={field.name}
          value={value}
          required={field.required}
          onChange={onChange}
          className={inputClass}
        >
          <option value="">Pilih {field.label.toLowerCase()}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={field.name}
          name={field.name}
          type={field.type}
          value={value}
          required={field.required}
          min={field.min}
          placeholder={field.placeholder}
          onChange={onChange}
          className={inputClass}
        />
      )}
    </div>
  );
}

function SuccessNotification({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 shadow-lg">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
        ✓
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-emerald-900">Berhasil!</p>
        <p className="mt-1 text-sm text-emerald-700">{message}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-emerald-600 transition hover:text-emerald-800"
        aria-label="Tutup notifikasi"
      >
        ✕
      </button>
    </div>
  );
}

export default function InputPage() {
  const [activeTab, setActiveTab] = useState("penjualan");
  const [forms, setForms] = useState(createEmptyForms);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [error, setError] = useState(null);

  const activeConfig = tabs.find((tab) => tab.id === activeTab);

  useEffect(() => {
    if (!successMessage) return undefined;

    const timer = setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [successMessage]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForms((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [name]: value,
      },
    }));
  }

  function buildPayload(tab, formData) {
    const payload = { ...formData };

    tab.numericFields.forEach((field) => {
      payload[field] = payload[field] === "" ? 0 : Number(payload[field]);
    });

    return payload;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!activeConfig) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const payload = buildPayload(activeConfig, forms[activeTab]);
    const { error: insertError } = await supabase
      .from(activeConfig.table)
      .insert(payload);

    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccessMessage(`Data ${activeConfig.label} berhasil disimpan ke Supabase.`);
      setForms((prev) => ({
        ...prev,
        [activeTab]: createEmptyForms()[activeTab],
      }));
    }

    setLoading(false);
  }

  function switchTab(tabId) {
    setActiveTab(tabId);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <SuccessNotification
        message={successMessage}
        onClose={() => setSuccessMessage(null)}
      />

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Input Data</h1>
        <p className="mt-2 text-zinc-600">
          Pilih tab, isi form sesuai kolom tabel, lalu simpan ke Supabase.
        </p>
      </header>

      <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-6 border-b border-zinc-100 pb-4">
          <h2 className="text-lg font-semibold">Form {activeConfig?.label}</h2>
          <p className="text-sm text-zinc-500">
            Data akan disimpan ke tabel{" "}
            <span className="font-medium text-zinc-700">{activeConfig?.table}</span>.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {activeConfig?.fields.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={forms[activeTab][field.name]}
              onChange={handleChange}
            />
          ))}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Gagal menyimpan: {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Menyimpan..." : `Simpan Data ${activeConfig?.label}`}
        </button>
      </form>
    </div>
  );
}
