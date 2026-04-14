export function formatRibuanInput(value) {
  if (!value) return '';
  const numberString = value.toString().replace(/[^,\d]/g, '');
  const split = numberString.split(',');
  const sisa = split[0].length % 3;
  let rupiah = split[0].substr(0, sisa);
  const ribuan = split[0].substr(sisa).match(/\d{3}/gi);

  if (ribuan) {
    const separator = sisa ? '.' : '';
    rupiah += separator + ribuan.join('.');
  }

  rupiah = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah;
  return rupiah;
}

export function parseRibuan(value) {
  if (!value) return 0;
  return parseInt(value.toString().replace(/\./g, ''), 10) || 0;
}
