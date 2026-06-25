'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { downloadTemplate, parseExcel } from '../../lib/excelTemplate'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Suspense } from 'react'

// ─── Format helpers ───────────────────────────────────────
const fmt    = n => (n == null || n === '') ? '-' : Number(n).toLocaleString('id-ID')
const fmtRp  = n => (n == null || n === '') ? '-' : 'Rp ' + Number(n).toLocaleString('id-ID')
const fmtPct = n => (n == null || n === '') ? '-' : Number(n).toFixed(2) + '%'
const fmtX   = n => (n == null || n === '') ? '-' : Number(n).toFixed(2) + 'x'
const sum    = (arr, f) => arr.reduce((a, b) => a + (Number(b[f]) || 0), 0)
const avg    = (arr, f) => arr.length ? (sum(arr, f) / arr.length).toFixed(2) : 0

// ─── Metrik per platform ──────────────────────────────────
const SHOPEE_FIELDS = [
  { section: 'Awareness',             fields: [
    { label: 'Impresi',        name: 'impresi',        type: 'number' },
    { label: 'CPM (Rp)',       name: 'cpm',            type: 'number', auto: true },
  ]},
  { section: 'Interest & Consideration', fields: [
    { label: 'Klik',           name: 'klik',           type: 'number' },
    { label: 'CTR % (auto)',   name: 'ctr',            type: 'number', auto: true },
    { label: 'CPC (auto)',     name: 'cpc',            type: 'number', auto: true },
  ]},
  { section: 'Intent',                fields: [
    { label: 'ATC',            name: 'atc',            type: 'number' },
    { label: 'Rasio ATC % (auto)', name: 'rasio_atc', type: 'number', auto: true },
  ]},
  { section: 'Konversi',              fields: [
    { label: 'Pesanan',        name: 'pesanan',        type: 'number' },
    { label: 'CVR % (auto)',   name: 'cvr',            type: 'number', auto: true },
    { label: 'Produk terjual', name: 'produk_terjual', type: 'number' },
    { label: 'Biaya iklan (Rp)', name: 'biaya_iklan', type: 'number' },
    { label: 'Omzet (Rp)',     name: 'omzet',          type: 'number' },
    { label: 'ROI (auto)',     name: 'roi',            type: 'number', auto: true },
    { label: 'CPA (auto)',     name: 'cpa',            type: 'number', auto: true },
    { label: 'AOV (auto)',     name: 'aov',            type: 'number', auto: true },
  ]},
]

const TIKTOK_FIELDS = [
  { section: 'Konversi & Biaya',      fields: [
    { label: 'Biaya iklan (Rp)', name: 'biaya_iklan', type: 'number' },
    { label: 'Omzet (Rp)',     name: 'omzet',          type: 'number' },
    { label: 'ROI (auto)',     name: 'roi',            type: 'number', auto: true },
    { label: 'Pesanan',        name: 'pesanan',        type: 'number' },
    { label: 'CPA (auto)',     name: 'cpa',            type: 'number', auto: true },
  ]},
]

const META_FIELDS = [
  { section: 'Awareness',             fields: [
    { label: 'Impresi',        name: 'impresi',        type: 'number' },
    { label: 'CPM (Rp)',       name: 'cpm',            type: 'number', auto: true },
  ]},
  { section: 'Interest & Consideration', fields: [
    { label: 'Klik',           name: 'klik',           type: 'number' },
    { label: 'CTR % (auto)',   name: 'ctr',            type: 'number', auto: true },
    { label: 'CPC (auto)',     name: 'cpc',            type: 'number', auto: true },
    { label: 'View Page',      name: 'view_page',      type: 'number' },
    { label: 'View Page Rate % (auto)', name: 'view_page_rate', type: 'number', auto: true },
  ]},
  { section: 'Intent',                fields: [
    { label: 'ATC',            name: 'atc',            type: 'number' },
    { label: 'Rasio ATC % (auto)', name: 'rasio_atc', type: 'number', auto: true },
  ]},
  { section: 'Konversi',              fields: [
    { label: 'Pesanan',        name: 'pesanan',        type: 'number' },
    { label: 'CVR % (auto)',   name: 'cvr',            type: 'number', auto: true },
    { label: 'Biaya iklan (Rp)', name: 'biaya_iklan', type: 'number' },
    { label: 'Omzet (Rp)',     name: 'omzet',          type: 'number' },
    { label: 'ROI (auto)',     name: 'roi',            type: 'number', auto: true },
    { label: 'CPA (auto)',     name: 'cpa',            type: 'number', auto: true },
    { label: 'AOV (auto)',     name: 'aov',            type: 'number', auto: true },
  ]},
]

const PLATFORM_CONFIG = {
  shopee: { label: 'Shopee Ads', table: 'ads_shopee', fields: SHOPEE_FIELDS, color: { bg: '#FFF0E6', text: '#993C1D' } },
  tiktok: { label: 'TikTok GMV Max', table: 'ads_tiktok', fields: TIKTOK_FIELDS, color: { bg: '#F0F0FF', text: '#3C3489' } },
  meta:   { label: 'Meta Ads', table: 'ads_meta', fields: META_FIELDS, color: { bg: '#E6F1FB', text: '#0C447C' } },
}

const ALL_FIELDS = {
  shopee: ['impresi','cpm','klik','ctr','cpc','atc','rasio_atc','pesanan','cvr','produk_terjual','biaya_iklan','omzet','roi','cpa','aov'],
  tiktok: ['biaya_iklan','omzet','roi','pesanan','cpa'],
  meta:   ['impresi','cpm','klik','ctr','cpc','view_page','view_page_rate','atc','rasio_atc','pesanan','cvr','biaya_iklan','omzet','roi','cpa','aov'],
}

function buildEmpty(platform) {
  const base = { tanggal: new Date().toISOString().split('T')[0], nama_kampanye: '', tipe_kampanye: '', status: 'aktif' }
  ALL_FIELDS[platform].forEach(f => base[f] = '')
  return base
}

function autoCalc(form, platform) {
  const f = { ...form }
  const bi = Number(f.biaya_iklan) || 0
  const imp = Number(f.impresi) || 0
  const klik = Number(f.klik) || 0
  const pesanan = Number(f.pesanan) || 0
  const omzet = Number(f.omzet) || 0
  const atc = Number(f.atc) || 0
  const vp = Number(f.view_page) || 0

  if (imp && bi)    f.cpm          = (bi / imp * 1000).toFixed(0)
  if (imp && klik)  f.ctr          = (klik / imp * 100).toFixed(2)
  if (bi && klik)   f.cpc          = (bi / klik).toFixed(0)
  if (klik && atc)  f.rasio_atc    = (atc / klik * 100).toFixed(2)
  if (klik && pesanan) f.cvr       = (pesanan / klik * 100).toFixed(2)
  if (bi && omzet)  f.roi          = (omzet / bi).toFixed(2)
  if (bi && pesanan) f.cpa         = (bi / pesanan).toFixed(0)
  if (omzet && pesanan) f.aov      = (omzet / pesanan).toFixed(0)
  if (platform === 'meta' && klik && vp) f.view_page_rate = (vp / klik * 100).toFixed(2)

  return f
}

const statusBadge = {
  aktif:   { bg: '#DCFCE7', text: '#166534', label: 'Aktif' },
  pause:   { bg: '#FEF9C3', text: '#854D0E', label: 'Pause' },
  selesai: { bg: '#FEE2E2', text: '#991B1B', label: 'Selesai' },
}

// ─── Tabel kolom per platform ─────────────────────────────
const TABLE_COLS = {
  shopee: [
    { label: 'Kampanye', key: 'nama_kampanye', fmt: v => v },
    { label: 'Status', key: 'status', fmt: (v) => v },
    { label: 'Impresi', key: 'impresi', fmt: fmt },
    { label: 'CPM', key: 'cpm', fmt: fmtRp },
    { label: 'Klik', key: 'klik', fmt: fmt },
    { label: 'CTR', key: 'ctr', fmt: fmtPct },
    { label: 'CPC', key: 'cpc', fmt: fmtRp },
    { label: 'ATC', key: 'atc', fmt: fmt },
    { label: 'Rasio ATC', key: 'rasio_atc', fmt: fmtPct },
    { label: 'Pesanan', key: 'pesanan', fmt: fmt },
    { label: 'CVR', key: 'cvr', fmt: fmtPct },
    { label: 'Produk Terjual', key: 'produk_terjual', fmt: fmt },
    { label: 'Biaya Iklan', key: 'biaya_iklan', fmt: fmtRp },
    { label: 'Omzet', key: 'omzet', fmt: fmtRp },
    { label: 'ROI', key: 'roi', fmt: fmtX },
    { label: 'CPA', key: 'cpa', fmt: fmtRp },
    { label: 'AOV', key: 'aov', fmt: fmtRp },
  ],
  tiktok: [
    { label: 'Kampanye', key: 'nama_kampanye', fmt: v => v },
    { label: 'Status', key: 'status', fmt: v => v },
    { label: 'Biaya Iklan', key: 'biaya_iklan', fmt: fmtRp },
    { label: 'Omzet', key: 'omzet', fmt: fmtRp },
    { label: 'ROI', key: 'roi', fmt: fmtX },
    { label: 'Pesanan', key: 'pesanan', fmt: fmt },
    { label: 'CPA', key: 'cpa', fmt: fmtRp },
  ],
  meta: [
    { label: 'Kampanye', key: 'nama_kampanye', fmt: v => v },
    { label: 'Status', key: 'status', fmt: v => v },
    { label: 'Biaya Iklan', key: 'biaya_iklan', fmt: fmtRp },
    { label: 'Omzet', key: 'omzet', fmt: fmtRp },
    { label: 'ROI', key: 'roi', fmt: fmtX },
    { label: 'Impresi', key: 'impresi', fmt: fmt },
    { label: 'CPM', key: 'cpm', fmt: fmtRp },
    { label: 'Klik', key: 'klik', fmt: fmt },
    { label: 'CTR', key: 'ctr', fmt: fmtPct },
    { label: 'CPC', key: 'cpc', fmt: fmtRp },
    { label: 'View Page', key: 'view_page', fmt: fmt },
    { label: 'View Page Rate', key: 'view_page_rate', fmt: fmtPct },
    { label: 'ATC', key: 'atc', fmt: fmt },
    { label: 'Rasio ATC', key: 'rasio_atc', fmt: fmtPct },
    { label: 'Pesanan', key: 'pesanan', fmt: fmt },
    { label: 'CVR', key: 'cvr', fmt: fmtPct },
    { label: 'CPA', key: 'cpa', fmt: fmtRp },
    { label: 'AOV', key: 'aov', fmt: fmtRp },
  ],
}

// ─── Komponen utama ───────────────────────────────────────
export default function AdsPageWrapper() {
  return (
    <Suspense fallback={<div style={{padding:24}}>Memuat...</div>}>
      <AdsPage />
    </Suspense>
  )
}