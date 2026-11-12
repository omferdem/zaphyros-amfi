# Masaüstü uygulaması (Windows)

`masaustu/` klasöründeki Electron kabuğu, AmfiOS'u tarayıcı yerine kendi penceresinde açar. Veri ve giriş yine kendi Supabase projendedir; ayrı bir sunucu yoktur.

## Ne sağlar
- Tarayıcı sekmesi yerine ayrı bir pencere ve masaüstü kısayolu. Pencerenin yeri ve boyutu hatırlanır.
- Oturum uygulamada kalıcıdır (şifreyle girdikten sonra e-posta gerekmez).
- `F11` tam ekran; projeksiyonda sahne için uygundur.
- "Videoyu aç" gibi dış bağlantılar varsayılan tarayıcıda açılır.
- İnternet kopunca "İnternete ulaşılamıyor" sayfası çıkar ve bağlantı gelince kendiliğinden yeniden dener.
- Web uygulaması her yayında kendiliğinden güncellenir. Uygulama canlı siteyi açtığı için kabuğu yeniden kurmak gerekmez.

## Kurulum
1. `AmfiOS-Kurulum-<sürüm>.exe` dosyasını çalıştır. Yönetici yetkisi gerekmez; kullanıcıya kurulur ve masaüstüne kısayol koyar.
2. Windows "Bilinmeyen yayıncı" uyarısı çıkarsa **Daha fazla bilgi > Yine de çalıştır** de. Uygulama imzalı değildir (imza sertifikası ücretlidir); bu uyarı normaldir.

## İlk giriş (bir kerelik)
E-posta bağlantısı uygulamayı değil varsayılan tarayıcıyı açar, bu yüzden uygulamada **şifreyle** girilir:
1. Tarayıcıda siteye e-posta bağlantısıyla gir.
2. Panelin üstündeki **🔑 Şifre** düğmesinden şifre belirle (en az 8 karakter).
3. Uygulamada giriş ekranının **Şifreyle** sekmesinden e-posta ve şifrenle gir. Bundan sonra e-posta gerekmez.

Şifre belirlemek yalnızca bir kez gerekir; ev ve iş bilgisayarında aynı şifreyle girilir.

## Başka bir hocanın kopyası için
Uygulama varsayılan olarak `https://omferdem.github.io/zaphyros-amfi/` adresini açar. Başka bir kurulum için menüden **AmfiOS > Kurulum adresini değiştir…** ile kendi GitHub Pages adresi girilir (yalnızca `https://`). Adres uygulamanın ayarında saklanır.

## Geliştirme ve derleme
```
cd masaustu
npm install
npm start          # uygulamayı aç
npm run sinama     # pencere açmadan siteyi yükler, başlığı yazdırır; sorun yoksa çıkış kodu 0
npm run ikon       # public/favicon.svg dosyasından build/icon.png üretir (simge değişince)
npm run derle      # dist/AmfiOS-Kurulum-<sürüm>.exe üretir
```
`dist/` klasörü repoya girmez; kurulum dosyası yerelde üretilir ve elle dağıtılır.

## Güvenlik
- Pencere `sandbox` ve `contextIsolation` ile çalışır, Node erişimi yoktur.
- Site dışına giden gezinmeler uygulamada açılmaz, tarayıcıya yönlendirilir.
- Yalnızca tam ekran ve panoya yazma izni verilir; kamera, konum vb. reddedilir.
- Kurulum adresi yalnızca `https://` (yerel geliştirme için `http://localhost`) olabilir.
