const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('masaustu', {
  adresAl: () => ipcRenderer.invoke('adres-al'),
  adresKaydet: (adres) => ipcRenderer.invoke('adres-kaydet', adres),
  kapat: () => ipcRenderer.send('adres-kapat'),
})
