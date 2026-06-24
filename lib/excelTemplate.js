import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'

// ─── Kolom per platform ───────────────────────────────────
const TEMPLATE_COLS = {
  shopee: [
    { header: 'tanggal', example: '2026-06-01', note: 'Format: YYYY-MM-DD' },
    { header: 'nama_kampanye', example: 'Iklan Produk', note: 'Iklan Toko atau Iklan Produk' },
    { header: 'status', example: 'aktif', note: 'aktif / pause / selesai' },
    { header: 'impresi', example: 10000, note: 'Angka bulat' },
    { header: 'cpm', example: 5000, note: 'Rupiah (angka saja)' },
    { header: 'klik', example: 300, note: 'Angka bulat' },
    { header: 'cpc', example: 166, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'ctr', example: 3.0, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'atc', example: 50, note: 'Add to Cart' },
    { header: 'rasio_atc', example: 16.7, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'pesanan', example: 20, note: 'Angka bulat' },
    { header: 'cvr', example: 6.7, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'produk_terjual', example: 25, note: 'Angka bulat' },
    { header: 'biaya_iklan', example: 500000, note: 'Rupiah (angka saja)' },
    { header: 'omzet', example: 2500000, note: 'Rupiah (angka saja)' },
    { header: 'roi', example: 5.0, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'cpa', example: 25000, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'aov', example: 125000, note: 'Otomatis dihitung (boleh dikosongkan)' },
  ],
  tiktok: [
    { header: 'tanggal', example: '2026-06-01', note: 'Format: YYYY-MM-DD' },
    { header: 'nama_kampanye', example: 'GMV Max Juni', note: 'Nama kampanye bebas' },
    { header: 'status', example: 'aktif', note: 'aktif / pause / selesai' },
    { header: 'biaya_iklan', example: 500000, note: 'Rupiah (angka saja)' },
    { header: 'omzet', example: 2500000, note: 'Rupiah (angka saja)' },
    { header: 'roi', example: 5.0, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'pesanan', example: 20, note: 'Angka bulat' },
    { header: 'cpa', example: 25000, note: 'Otomatis dihitung (boleh dikosongkan)' },
  ],
  meta: [
    { header: 'tanggal', example: '2026-06-01', note: 'Format: YYYY-MM-DD' },
    { header: 'nama_kampanye', example: 'Campaign Juni', note: 'Nama kampanye bebas' },
    { header: 'status', example: 'aktif', note: 'aktif / pause / selesai' },
    { header: 'biaya_iklan', example: 500000, note: 'Rupiah (angka saja)' },
    { header: 'omzet', example: 2500000, note: 'Rupiah (angka saja)' },
    { header: 'roi', example: 5.0, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'impresi', example: 10000, note: 'Angka bulat' },
    { header: 'cpm', example: 5000, note: 'Rupiah (angka saja)' },
    { header: 'klik', example: 300, note: 'Angka bulat' },
    { header: 'ctr', example: 3.0, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'cpc', example: 166, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'view_page', example: 150, note: 'Angka bulat' },
    { header: 'view_page_rate', example: 50.0, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'atc', example: 50, note: 'Add to Cart' },
    { header: 'rasio_atc', example: 16.7, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'pesanan', example: 20, note: 'Angka bulat' },
    { header: 'cvr', example: 6.7, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'cpa', example: 25000, note: 'Otomatis dihitung (boleh dikosongkan)' },
    { header: 'aov', example: 125000, note: 'Otomatis dihitung (boleh dikosongkan)' },
  ],
}

const PLATFORM_LABEL = {
  shopee: 'Shopee Ads',
  tiktok: 'TikTok GMV Max',
  meta: 'Meta Ads',
}

export function downloadTemplate(platform) {
  const cols = TEMPLATE_COLS[platform]
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Template isi data ──
  const headers = cols.map(c => c.header)
  const example = cols.map(c => c.example)
  const wsData = [headers, example]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Lebar kolom otomatis
  ws['!cols'] = cols.map(c => ({ wch: Math.max(c.header.length + 4, 18) }))

  XLSX.utils.book_append_sheet(wb, ws, 'Data')

  // ── Sheet 2: Panduan ──
  const panduanData = [
    ['PANDUAN PENGISIAN TEMPLATE'],
    ['Platform:', PLATFORM_LABEL[platform]],
    [''],
    ['Nama Kolom', 'Contoh Isi', 'Keterangan'],
    ...cols.map(c => [c.header, c.example, c.note]),
    [''],
    ['CATATAN PENTING:'],
    ['1. Jangan ubah nama kolom di baris pertama'],
    ['2. Format tanggal harus YYYY-MM-DD (contoh: 2026-06-01)'],
    ['3. Kolom bertanda "Otomatis" boleh dikosongkan, akan dihitung saat upload'],
    ['4. Isi angka tanpa titik atau koma pemisah ribuan'],
    ['5. Hapus baris contoh (baris ke-2) sebelum upload'],
  ]
  const wsPanduan = XLSX.utils.aoa_to_sheet(panduanData)
  wsPanduan['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 45 }]
  XLSX.utils.book_append_sheet(wb, wsPanduan, 'Panduan')

  // Download
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/octet-stream' })
  saveAs(blob, `template_${platform}_ads.xlsx`)
}

export function parseExcel(file, platform) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets['Data'] || wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

        const cols = TEMPLATE_COLS[platform]
        const numericCols = cols
          .filter(c => typeof c.example === 'number')
          .map(c => c.header)

        const cleaned = rows.map(row => {
          const obj = {}
          cols.forEach(c => {
            const val = row[c.header]
            if (numericCols.includes(c.header)) {
              obj[c.header] = Number(val) || 0
            } else {
              obj[c.header] = val || ''
            }
          })

          // Auto kalkulasi
          const bi = obj.biaya_iklan || 0
          const imp = obj.impresi || 0
          const klik = obj.klik || 0
          const pesanan = obj.pesanan || 0
          const omzet = obj.omzet || 0
          const atc = obj.atc || 0
          const vp = obj.view_page || 0

          if (imp && bi && !obj.cpm) obj.cpm = +(bi / imp * 1000).toFixed(0)
          if (imp && klik && !obj.ctr) obj.ctr = +(klik / imp * 100).toFixed(2)
          if (bi && klik && !obj.cpc) obj.cpc = +(bi / klik).toFixed(0)
          if (klik && atc && !obj.rasio_atc) obj.rasio_atc = +(atc / klik * 100).toFixed(2)
          if (klik && pesanan && !obj.cvr) obj.cvr = +(pesanan / klik * 100).toFixed(2)
          if (bi && omzet && !obj.roi) obj.roi = +(omzet / bi).toFixed(2)
          if (bi && pesanan && !obj.cpa) obj.cpa = +(bi / pesanan).toFixed(0)
          if (omzet && pesanan && !obj.aov) obj.aov = +(omzet / pesanan).toFixed(0)
          if (platform === 'meta' && klik && vp && !obj.view_page_rate)
            obj.view_page_rate = +(vp / klik * 100).toFixed(2)

          return obj
        }).filter(row => row.tanggal && row.nama_kampanye)

        resolve(cleaned)
      } catch (err) {
        reject('File tidak valid. Pastikan menggunakan template yang benar.')
      }
    }
    reader.onerror = () => reject('Gagal membaca file.')
    reader.readAsArrayBuffer(file)
  })
}