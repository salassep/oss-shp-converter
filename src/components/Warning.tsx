export function Warning() {
  return (
    <p className="mt-4">
      <span className="font-semibold">Note</span>: Tool ini bertujuan menyesuaikan luasan SHP 
      polygon agar akurat dan sesuai dengan perhitungan sistem OSS, karena terkadang terjadi 
      selisih beberapa meter saat diunggah. Tidak disarankan jika selisih luasan 
      terlalu besar. Selalu periksa kembali file polygon sebelum diunggah ke OSS. 
      Segala kekeliruan menjadi tanggung jawab kamu sepenuhnya.
    </p>
  )
}