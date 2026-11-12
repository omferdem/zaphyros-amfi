const kutu = document.getElementById('adres')
const hata = document.getElementById('hata')

window.masaustu.adresAl().then((a) => {
  kutu.value = a
  kutu.select()
})

async function kaydet() {
  const s = await window.masaustu.adresKaydet(kutu.value)
  if (s.hata) hata.textContent = s.hata
}

document.getElementById('kaydet').addEventListener('click', kaydet)
document.getElementById('vazgec').addEventListener('click', () => window.masaustu.kapat())
kutu.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') kaydet()
  if (e.key === 'Escape') window.masaustu.kapat()
})
