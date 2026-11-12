const adres = new URLSearchParams(location.search).get('adres')

function dene() {
  if (adres) location.href = adres
}

document.getElementById('dene').addEventListener('click', dene)
setTimeout(dene, 8000)
