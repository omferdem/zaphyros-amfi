// AmfiOS masaüstü kabuğu: web uygulamasını (kendi GitHub Pages adresinden) bir pencerede açar.
// Veri ve giriş aynı Supabase projesindedir; uygulama yalnızca daha rahat bir pencere sağlar:
// oturum hatırlanır, tam ekran sahne, dış bağlantılar tarayıcıda açılır, bağlantı koparsa yeniden dener.
// Web tarafı her yayında kendiliğinden güncellenir; bu kabuğun yeniden kurulması gerekmez.
const { app, BrowserWindow, Menu, shell, session, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const VARSAYILAN_ADRES = 'https://omferdem.github.io/zaphyros-amfi/'
const sinama = process.argv.includes('--sinama')

// ------------------------------------------------------------------ ayarlar
function ayarYolu() {
  return path.join(app.getPath('userData'), 'ayarlar.json')
}
function ayarOku() {
  try {
    return JSON.parse(fs.readFileSync(ayarYolu(), 'utf8'))
  } catch {
    return {}
  }
}
function ayarYaz(yeni) {
  try {
    fs.mkdirSync(path.dirname(ayarYolu()), { recursive: true })
    fs.writeFileSync(ayarYolu(), JSON.stringify({ ...ayarOku(), ...yeni }, null, 2))
  } catch {
    /* yazılamazsa varsayılanlarla devam */
  }
}

/** Yalnızca https (ve yerel geliştirme için localhost) adresleri kabul edilir. */
function gecerliAdres(s) {
  try {
    const u = new URL(String(s).trim())
    const yerel = u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
    return u.protocol === 'https:' || yerel ? u.toString() : null
  } catch {
    return null
  }
}
function siteAdresi() {
  return gecerliAdres(ayarOku().siteAdresi) ?? VARSAYILAN_ADRES
}

// ------------------------------------------------------------------ pencere
let ana = null

function pencereOlustur() {
  const d = ayarOku().pencere ?? {}
  ana = new BrowserWindow({
    width: d.width ?? 1280,
    height: d.height ?? 820,
    x: d.x,
    y: d.y,
    minWidth: 820,
    minHeight: 600,
    show: false,
    title: 'AmfiOS',
    backgroundColor: '#070a1f',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  })
  if (d.buyuk) ana.maximize()
  ana.once('ready-to-show', () => {
    if (!sinama) ana.show()
  })

  // Pencere konumu ve boyutu bir sonraki açılış için saklanır.
  ana.on('close', () => {
    if (ana.isFullScreen()) return
    const buyuk = ana.isMaximized()
    ayarYaz({ pencere: { ...(buyuk ? ayarOku().pencere : ana.getBounds()), buyuk } })
  })

  const site = new URL(siteAdresi())
  const dis = (adres) => {
    if (/^https?:\/\//i.test(adres)) shell.openExternal(adres)
  }
  // Sitenin dışına giden bağlantılar (ör. "Videoyu aç") varsayılan tarayıcıda açılır.
  ana.webContents.setWindowOpenHandler(({ url }) => {
    dis(url)
    return { action: 'deny' }
  })
  ana.webContents.on('will-navigate', (olay, url) => {
    if (url.startsWith('file:')) return
    if (new URL(url).origin !== site.origin) {
      olay.preventDefault()
      dis(url)
    }
  })

  // Bağlantı kopuksa kullanıcıya dostça bir sayfa gösterilir ve kendiliğinden yeniden denenir.
  ana.webContents.on('did-fail-load', (_o, kod, _a, url, anaCerceve) => {
    if (!anaCerceve || kod === -3 || url.startsWith('file:')) return
    ana.loadFile(path.join(__dirname, 'cevrimdisi.html'), { query: { adres: siteAdresi() } })
  })

  ana.loadURL(siteAdresi())
  if (sinama) sinamaYap(ana)
}

/** --sinama: sayfayı yükler, başlığı ve metni yazdırıp çıkar (kurulum denetimi için). */
function sinamaYap(pencere) {
  const zamanasimi = setTimeout(() => {
    console.log('SINAMA_ZAMAN_ASIMI')
    app.exit(2)
  }, 40000)
  pencere.webContents.on('did-finish-load', async () => {
    if (pencere.webContents.getURL().startsWith('file:')) return
    await new Promise((r) => setTimeout(r, 4000))
    try {
      const sonuc = await pencere.webContents.executeJavaScript(
        'JSON.stringify({ baslik: document.title, adres: location.href, metin: document.body.innerText.slice(0, 160) })',
      )
      console.log('SINAMA ' + sonuc)
      clearTimeout(zamanasimi)
      app.exit(JSON.parse(sonuc).baslik.includes('AmfiOS') ? 0 : 1)
    } catch (e) {
      console.log('SINAMA_HATA ' + e.message)
      app.exit(3)
    }
  })
}

// ------------------------------------------------------------------ kurulum adresi penceresi
function adresPenceresi() {
  const p = new BrowserWindow({
    width: 520,
    height: 260,
    parent: ana ?? undefined,
    modal: !!ana,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    title: 'Kurulum adresi',
    backgroundColor: '#070a1f',
    webPreferences: {
      preload: path.join(__dirname, 'adres-onyukleme.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  p.removeMenu()
  p.loadFile(path.join(__dirname, 'adres.html'))
}

ipcMain.handle('adres-al', () => siteAdresi())
ipcMain.handle('adres-kaydet', (_o, adres) => {
  const temiz = gecerliAdres(adres)
  if (!temiz) return { hata: 'Adres https:// ile başlamalı.' }
  ayarYaz({ siteAdresi: temiz })
  BrowserWindow.getAllWindows().forEach((w) => {
    if (w !== ana) w.close()
  })
  ana?.loadURL(temiz)
  return { tamam: true }
})
ipcMain.on('adres-kapat', (olay) => BrowserWindow.fromWebContents(olay.sender)?.close())

// ------------------------------------------------------------------ menü
function menuKur() {
  const sablon = [
    {
      label: 'AmfiOS',
      submenu: [
        { label: 'Yeniden yükle', accelerator: 'CmdOrCtrl+R', click: () => ana?.loadURL(siteAdresi()) },
        { role: 'togglefullscreen', label: 'Tam ekran', accelerator: 'F11' },
        { type: 'separator' },
        { label: 'Kurulum adresini değiştir…', click: adresPenceresi },
        { label: 'Tarayıcıda aç', click: () => shell.openExternal(siteAdresi()) },
        { type: 'separator' },
        { role: 'quit', label: 'Çıkış' },
      ],
    },
    {
      label: 'Görünüm',
      submenu: [
        { role: 'zoomIn', label: 'Yakınlaştır' },
        { role: 'zoomOut', label: 'Uzaklaştır' },
        { role: 'resetZoom', label: 'Yakınlaştırmayı sıfırla' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(sablon))
}

// ------------------------------------------------------------------ başlangıç
if (!sinama && !app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!ana) return
    if (ana.isMinimized()) ana.restore()
    ana.focus()
  })

  app.whenReady().then(() => {
    // Yalnızca tam ekran ve panoya yazma izni verilir (kamera, konum vb. istenmez).
    session.defaultSession.setPermissionRequestHandler((_wc, izin, geriCagri) =>
      geriCagri(['fullscreen', 'clipboard-sanitized-write'].includes(izin)),
    )
    menuKur()
    pencereOlustur()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) pencereOlustur()
    })
  })

  app.on('window-all-closed', () => app.quit())
}
