import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";


export async function GET(request) {

  const { searchParams } = new URL(request.url);

  const start =
    searchParams.get("start") || "2026-01-01";

  const end =
    searchParams.get("end") || "2026-01-31";


  const { data, error } = await supabase
    .from("penjualan_harian")
    .select(`
      tanggal,
      channel,
      brand,
      omzet,
      pengunjung_toko,
      pesanan_masuk,
      jumlah_produk_terjual,
      cancel_rate,
      aov_order,
      customer_baru,
      repeat_customer_rate,
      source
    `)
    .gte("tanggal", start)
    .lte("tanggal", end);


  if(error){
    return NextResponse.json(
      {
        error:error.message
      },
      {
        status:500
      }
    );
  }


  let totalOmzet = 0;
  let totalPesanan = 0;


  data.forEach(row=>{

    totalOmzet += Number(row.omzet || 0);

    totalPesanan += Number(
      row.pesanan_masuk || 0
    );

  });


  return NextResponse.json({

    periode:{
      start,
      end
    },

    summary:{
      omzet:totalOmzet,
      pesanan:totalPesanan,
      aov:
        totalPesanan
        ?
        Math.round(totalOmzet / totalPesanan)
        :
        0
    },

    detail: data.map(row => ({
      tanggal: row.tanggal,
      channel: row.channel,
      brand: row.brand,
      omzet: Number(row.omzet) || 0,
      pesanan_masuk: Number(row.pesanan_masuk) || 0,
      jumlah_produk_terjual: Number(row.jumlah_produk_terjual) || 0,
      aov_order: Number(row.aov_order) || 0,
      cancel_rate: Number(row.cancel_rate) || 0,
      customer_baru: Number(row.customer_baru) || 0,
      repeat_customer_rate: Number(row.repeat_customer_rate) || 0,
      source: row.source,
    })),
  });

}