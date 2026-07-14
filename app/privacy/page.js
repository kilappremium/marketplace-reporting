export default function PrivacyPage() {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px',
        fontFamily: 'sans-serif', lineHeight: 1.7 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Privacy Policy
        </h1>
        <p style={{ color: '#666', marginBottom: 32 }}>
          Terakhir diperbarui: {new Date().toLocaleDateString('id-ID')}
        </p>
  
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          1. Informasi yang Kami Kumpulkan
        </h2>
        <p style={{ marginBottom: 16 }}>
          Aplikasi Kilap Marketplace Reporting mengumpulkan data performa 
          toko dari platform marketplace (Shopee, TikTok, Meta) yang 
          diizinkan secara eksplisit oleh pengguna melalui OAuth. 
          Data yang dikumpulkan meliputi: data penjualan, data iklan, 
          dan metrik performa toko.
        </p>
  
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          2. Penggunaan Data
        </h2>
        <p style={{ marginBottom: 16 }}>
          Data yang dikumpulkan digunakan semata-mata untuk keperluan 
          pelaporan dan analisis performa internal bisnis. Data tidak 
          dibagikan kepada pihak ketiga manapun.
        </p>
  
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          3. Penyimpanan Data
        </h2>
        <p style={{ marginBottom: 16 }}>
          Data disimpan secara aman di database Supabase dengan enkripsi 
          dan hanya dapat diakses oleh pengguna yang terotorisasi.
        </p>
  
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          4. Keamanan
        </h2>
        <p style={{ marginBottom: 16 }}>
          Kami menggunakan HTTPS dan enkripsi standar industri untuk 
          melindungi data pengguna. Access token dari platform marketplace 
          tidak disimpan secara permanen di server kami.
        </p>
  
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          5. Hak Pengguna
        </h2>
        <p style={{ marginBottom: 16 }}>
          Pengguna dapat mencabut akses aplikasi kapan saja melalui 
          pengaturan akun di masing-masing platform marketplace.
        </p>
  
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          6. Kontak
        </h2>
        <p style={{ marginBottom: 16 }}>
          Untuk pertanyaan terkait privasi, hubungi kami di:<br/>
          Email: admin@kilappremium.com
        </p>
      </div>
    )
  }