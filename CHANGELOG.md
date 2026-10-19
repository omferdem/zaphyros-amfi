# Sürüm Geçmişi

## v0.3.1 (19 Ekim 2026)
Dersler yıllarca kullanılabilsin.
- Ders içeriği: akışlar ve sunumlar artık dönemden bağımsız bir ders içeriğinde durur. Her dönemin dersi (sınıf listesi, oturumlar, yoklamalar) bu içeriğe bağlanır. Aynı içerik birden fazla döneme bağlanabilir; içerikte yapılan değişiklik hepsinde görünür.
- Ders sayfasında "Bu dersin yeni dönemini aç": aynı içerikle yeni dönem açılır, sınıf listesi ve yoklamalar boş başlar.
- Yeni ders açarken önceki bir dersin içeriği seçilebilir. Seçilmezse dersin adıyla yeni içerik açılır.
- Bir dönemin dersi silinince içerik silinmez. Hiçbir döneme bağlı olmayan içerikler panelde listelenir; buradan silinebilir (sunum dosyalarıyla birlikte).
- Karekodsuz başlatma: ders başlatırken "Yoklama al" kutusu kaldırılırsa yoklama kapalı başlar, perdede QR çıkmaz; gerekirse dersin içinde açılır. Yoklamasız derste sınıf listesi gerekmez.
- Veritabanı: `0004_ders_icerigi.sql` uygulandı (Supabase SQL Editor, 19 Ekim 2026; önce geri alınan bir işlem içinde testleriyle denendi). Mevcut ders için kendi adıyla bir içerik açıldı.

## v0.3.0 (19 Ekim 2026)
Faz 2a: ders akışı ve slayt.
- Ders akışları: her derse haftalık akışlar açılır. Akış, perdede sırayla gösterilecek adımlardır (şimdilik yoklama ve slayt). Adımlar sürüklenerek ya da oklarla sıralanır, silinir.
- Sunum yükleme (PDF): her sayfa akışa ayrı bir adım olarak eklenir. Sayfaların metni yüklerken tarayıcıda çıkarılır. Sunumlar dersin kitaplığında durur, başka akışlarda da kullanılabilir. PPTX/PPT desteği Faz 2c'de gelecek.
- Sahne: akışın o anki adımı yoklamaysa QR ekranı, slaytsa slayt tam ekran görünür. Klavyenin ok tuşları, PageUp/PageDown ve boşluk ile (sunum kumandaları da bu tuşları gönderir) ilerlenir.
- Kumanda: sahnedeki "Kumanda" düğmesi hocaya özel bir QR gösterir; telefonla okutunca giriş gerekmeden önceki/sonraki, adım listesi, yoklama aç/kapat ve ders kodu telefonda olur.
- Ders kodu: perdede 6 haneli, dakikada bir değişen bir kod görünür. Geç gelen öğrenci sitenin adresine girip kodu yazar; yoklama açıksa yoklamaya da yazılır.
- Öğrenci ekranı: katıldıktan sonra telefonda perdedeki slaytın metni görünür, slayt değişince kendiliğinden güncellenir.
- Sitenin kök adresi öğrenciye ders kodu formunu açar; giriş yapmış hoca doğrudan paneline gider.
- Ders silinince sunum dosyaları da depodan silinir.
- `npm run sql-test`: migration'lar ve SQL testleri bilgisayarda Postgres kurmadan (PGlite ile) denenir.
- Veritabanı: `0003_ders_akisi.sql` uygulandı (Supabase SQL Editor, 19 Ekim 2026; önce geri alınan bir işlem içinde testleriyle denendi).

## v0.2.2 (18 Ekim 2026)
- Sınıf listesi yapıştırma: boşlukla ayrılmış satırlar da okunur ("22010101001 Ali Yılmaz" gibi, PDF, Word ya da web sayfasından kopyalanan listeler). Önceden bu satırların hepsi atlanıyordu.
- Excel dar sütundaki numarayı "2,2E+10" diye kopyaladığında uyarı çıkar; hiç öğrenci bulunamazsa beklenen biçim gösterilir.
- Bu kurulumda hoca hesabı başka bir e-posta adresine taşındı, mevcut ders de yeni hesaba geçti (Supabase SQL Editor, elle, 18 Ekim 2026). Migration değişmedi.

## v0.2.1 (18 Ekim 2026)
Bağımsız kurulum: program başka hocalara verilebilir, her kopya kendi başına çalışır.
- Supabase adresi ve anahtarı koddan çıkarıldı; site bunları `public/ayarlar.json` dosyasından okur. Dosya doldurulmamışsa "Kurulum tamamlanmamış" ekranı çıkar.
- Site göreli yollarla derlenir; depo adı ne olursa olsun çalışır.
- Hoca e-postası migration'dan çıkarıldı. Yeni kurulumda siteye ilk giren hoca "Kurulumu sahiplen" ile sahibi olur.
- `supabase/kurulum.sql`: yeni kurulum için bütün migration'lar tek dosyada (`npm run kurulum-sql` ile üretilir, test güncelliğini denetler).
- `docs/KURULUM.md`: başka bir hocanın kendi kopyasını kurması için adım adım kılavuz.
- Supabase uyandırma iş akışı adresi `ayarlar.json`'dan okur.

## v0.2.0 (18 Ekim 2026)
Faz 1: QR yoklama uçtan uca.
- Hoca girişi: e-postaya gelen tek kullanımlık bağlantı (şifresiz). Yalnızca `teachers` listesindeki adresler ders açabilir.
- Ders ekleme ve silme
- Sınıf listesi: OBS Excel dosyası, CSV ya da Excel'den kopyala-yapıştır ile içe aktarma; tek öğrenci ekleme, silme, arama
- Oturum başlatma ve sahne ekranı: 10 saniyede bir değişen QR, canlı katılım sayacı ve katılanların kısa adları ("Ali Y.")
- Öğrenci sayfası: QR okut, numara gir, yoklama alındı. Eski kod, liste dışı numara ve aynı telefondan ikinci numara reddedilir.
- Oturum yoklama listesi: var/yok görünümü, elle ekleme ve çıkarma, yoklamayı kapatma ve yeniden açma
- Yoklama raporu: öğrenci başına katılım oranı; oturum ve dönem raporunu Excel'e aktarma
- GitHub Actions: yayından önce testler çalışır; `vX.Y.Z:` ile başlayan commit'lere otomatik sürüm etiketi atılır
- Veritabanı: `0002_yoklama.sql` (tablolar, RLS, `qr_token`, `katilim_bileti`, `check_in` RPC'leri). Uygulandı (Supabase SQL Editor, `kurulum.sql` ile, 18 Ekim 2026).

## v0.1.0 (18 Ekim 2026)
- Vite + React + TypeScript + Tailwind iskeleti
- Sayfalar: `#/panel` (hoca), `#/sahne/:oturumId` (projeksiyon), `#/katil` (öğrenci)
- Supabase istemcisi; panelde canlı bağlantı göstergesi
- GitHub Actions: Pages'e otomatik yayın, iki günde bir Supabase uyandırma
- Veritabanı: `0001_saglik.sql` uygulandı (Supabase SQL Editor, 18 Ekim 2026)

## v0.0.1 (18 Ekim 2026)
- Proje başlatıldı: CLAUDE.md, mimari, yol haritası, prototip incelemesi.
