export function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatTanggal(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRoas(pendapatan, biaya) {
  const revenue = Number(pendapatan) || 0;
  const cost = Number(biaya) || 0;
  if (cost <= 0) return "-";
  return `${(revenue / cost).toFixed(2)}x`;
}

export function getWeekKey(dateString) {
  const date = new Date(dateString);
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start.toISOString().slice(0, 10);
}

export function getWeekLabel(weekKey) {
  const date = new Date(weekKey);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export function aggregateWeeklySales(rows) {
  const grouped = {};

  rows.forEach((row) => {
    if (!row.tanggal) return;

    const key = getWeekKey(row.tanggal);
    if (!grouped[key]) {
      grouped[key] = {
        weekKey: key,
        minggu: getWeekLabel(key),
        pendapatan: 0,
        pesanan: 0,
      };
    }

    grouped[key].pendapatan += Number(row.total) || 0;
    grouped[key].pesanan += 1;
  });

  return Object.values(grouped)
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
    .slice(-8);
}
