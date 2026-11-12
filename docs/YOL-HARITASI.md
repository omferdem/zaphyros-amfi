# Yol Haritası

Her faz kendi başına çalışır durumda teslim edilir. Bir faz bitmeden sonrakine geçilmez.

## Faz 0: İskelet (v0.1) ✅
- Vite + React + TypeScript + Tailwind kurulumu
- Supabase istemcisi, `.env.example`
- GitHub Actions: build + GitHub Pages deploy
- GitHub Actions: Supabase keepalive (duraklatmayı önlemek için)
- Boş sayfalar: `/panel`, `/sahne/:id`, `/katil`

## Faz 1: Yoklama uçtan uca (v0.2) ✅
- Hoca girişi (e-posta ile magic link)
- Ders oluşturma, sınıf listesini Excel'den içe aktarma
- Oturum başlatma, dönen QR, `check_in()` RPC
- Sahnede canlı yoklama sayacı ve akışı
- Yoklama raporu: Excel'e dışa aktarma

## Faz 2: Ders akışı ve slayt (v0.3)
Kullanıcı kararları (19 Ekim 2026): sunumlar PPTX, PPT ya da PDF olabilir; slaytların arasına sonradan video, beyin fırtınası gibi etkinlikler eklenebilmeli ve sıra değiştirilebilmeli. Sistem hem bilgisayar + projeksiyonla hem yalnız telefonla kullanılabilmeli. Geç gelen öğrenci perdedeki kodla katılabilmeli (yoklama dahil). Üç parça halinde teslim.

### 2a: Ders akışı, PDF, sahne, kumanda, ders kodu (v0.3.0) ✅
- Ders akışı: sıralı adımlar (yoklama, slayt); sürükle bırak ve oklarla sıralama
- PDF yükleme (Supabase Storage), sayfa metinlerinin çıkarılması, dersin sunum kitaplığı
- Sahnede slayt (pdf.js), klavye ve sunum kumandasıyla ilerleme
- Telefon kumandası: sahnedeki gizli QR ile, girişsiz
- Ders kodu: 6 hane, dakikada bir değişir; geç gelen öğrenci kodla katılır, yoklama açıksa yoklamaya da yazılır
- Öğrenci telefonunda perdedeki slaytın metni

### Ara teslim: dönemler, şubeler ve hafta planı (v0.6.0) ✅
Kullanıcının düzeni (26 Ekim 2026): yılda 2 dönem, dönemde 3 4 ders, bazı derslerde 6 7 şube; her şubenin ayrı listesi ve ayrı yoklaması çıktısı; içerik her yıl kullanılır ve geliştirilir; 2026-2027 Güz'de hazırlanan 2027-2028 Güz'de de işlenir ya da önceden planlanır.
- Dönem kaydı, şube alanı, panelde dönem ve derse göre gruplama
- Yeni dönem planla (önceki dönemin yapısı boş listelerle kopyalanır)
- Hafta planı: şube x hafta tablosu, akışların hafta sırası, oradan oturum başlatma

### Ara teslim: yıllar arası içerik ve karekodsuz başlatma (v0.3.1) ✅
- Kullanıcı kararı: ders içeriği (akışlar, sunumlar) dönemler arasında ortak; yeni dönem aynı içeriğe bağlanır
- Ders yoklamasız (QR'sız) başlatılabilir

### 2b: Yalnız telefon modu (v0.5.0) ✅
- Bilgisayar yoksa hoca dersi telefonundan yönetir; perdede görünecek ekran öğrenci telefonlarında görünür (slaytın görüntüsü + metni)
- Slayt görüntüleri sunum yüklenirken tarayıcıda küçültülür (en uzun kenar 900 piksel, WebP, sayfa başına yaklaşık 40-70 KB). Ücretsiz plan depo trafiği ayda 5 GB: 150 öğrenci x 40 slayt x 50 KB, ders başına yaklaşık 300 MB; ayda 15 dersin üstüne çıkılırsa görsel boyutu küçültülür ya da Pro plana geçilir

### 2c: PPTX/PPT çevirisi (kaldırıldı)
Kullanıcı kararı (26 Ekim 2026): PowerPoint dosyasını sistem dışında PDF'e çevirip yüklemek yeterli; sistem içinde dönüştürmeye gerek yok. Aşağıdaki plan geçersizdir:
- Yüklenen PPTX/PPT dosyası GitHub Actions'ta LibreOffice ile PDF'e çevrilir
- Kullanıcı kararı: ek token yok; iş akışı birkaç dakikada bir bekleyen dosyalara bakar (5-20 dakika gecikme kabul)
- Animasyonlar düşer, bazı yazı tipleri farklı görünebilir (Calibri yerine metrik uyumlu Carlito kurulacak)

## Faz 3: Quiz ve bilgi yarışması (v0.4.0) ✅
Kullanıcı istekleri (19 Ekim 2026): slaytsız, yalnızca hazır sorularla bilgi yarışması ya da oyun başlatılabilmeli; sorular ZOMR biçiminde hazır. Kullanıcı sırayı "önce quiz, sonra 2b ve 2c" olarak seçti.
- Soru bankası ders içeriğine bağlı ve yıllarca kullanılır; ZOMR biçiminde (#QUESTION / #CORRECT / #WRONG ...) içe aktarma
- Soru adımı akışa slaytların arasına eklenebilir; yalnızca sorulardan oluşan akış da olur (slaytsız yarışma)
- Kullanıcı kararları: Kahoot gibi hız puanı (500-1000), yoklamasız derste takma ad
- Sıradaki: 2b (yalnız telefon modu), 2c (PPTX çevirisi), sonra Faz 4
- Haftaya soru ekleme (elle ya da metin yapıştırarak)
- Öğrenci gelişim raporu (v0.11.0): öğrenci x konu başarısı, eğilim, zayıf/güçlü konu, Excel. 
- Habersiz quiz (v0.12.0): numarayla girilen, kendi hızında çözülen, puanları kaydedilen, canlı sıralamasız quiz; sonuçlar gelişim raporuna girer. Sırada: ödüller, rozetler ve seri bonusu
- Soru paketleri (v0.9.0): hafta/konu başına paket, akışa topluca ekleme (sona, başa, slaytların arasına), paketten yarışma akışı
- Canlı soru, süre sayacı, cevap dağılımı grafiği, doğru cevabı açma
- Puan tablosu ve ders sonu raporu

## Faz 4: Tartışma araçları (v0.7.0) ✅ (tarayıcıda uçtan uca denenmedi)
- Beyin fırtınası: kelime bulutu
- Şeytanın avukatı: iki kutuplu oylama ve gerekçe gönderme
- Video adımı (YouTube linki, sahnede oynatma)
- Sonraki iyileştirmeler: tartışma sonuçlarının oturum sayfasında ve Excel'de görünmesi, etkinlik adımını akışta düzenleme (şimdilik silip yeniden eklenir)

## Faz 4b: Hoca araçları (v0.13) ✅ (tarayıcıda uçtan uca denenmedi)
Kullanıcı istekleri (13 Kasım 2026):
- Ders içeriğini dışa/içe aktarma (.amfi paketi); boş kurulum için bkz. docs/KURULUM.md
- Haftalık planı satır satır yapıştırarak topluca akış açma
- Sınıf listesi: toplu silme, misafir öğrenci (asıl şubesine yoklama), şubeyi sil / dersi tamamen sil ayrımı
- Sonraki iyileştirme: misafir öğrencinin quiz ve yarışma cevaplarının asıl şubenin gelişim raporuna taşınması

## Faz 4c: Sınıf etkileşimi (v0.14) ✅ (gerçek derste denenmedi)
- Öğrenci konsolunda düğmeler: "Soru sor" (yazılı soru perdede zarf olarak, hoca sırası gelince açıp cevaplar) ve "Parmak kaldır" (ad perdenin kenarında sıraya girer)
- "Sıkıldım" düğmesi: sınıfın yüzde 25'i basarsa perdede uyarı; hoca dersi durdurur, sıkıldım diyenler arasından çekiliş (fıkra anlatma, en fazla 3 çekiliş), sonra derse döner

## Faz 5: Oyunlar (v0.6)
- Takım yarışması (v0.15) ✅: bilgi yarışmasında sınıf 2-6 gruba bölünür (öğrenci grubunu seçer), gruplar üye başına ortalama puanla yarışır
- Halat çekme (v0.17) ✅: iki takım, doğru cevaplar halatı çeker (Broadcast gerektirmedi). Sonraki: öğrencilerin hızlı dokunuşla çektiği canlı sürüm (Broadcast)
- Hocayla yarış (v0.16) ✅: sınıf hocaya karşı; hoca her soruda kendi cevabını gizli verir, doğru bilen taraf puan alır
- Bilgi merdiveni (v0.18) ✅: sınıf tek yarışmacı gibi basamak çıkar, güvenli basamak ve joker
- Aday oyunlar (hoca seçimine göre): Doğru mu Yanlış mı (ayakta/oturarak hızlı eleme), Eşleştirme yarışı (kavram-tanım), Boşluk doldurma, Resim/sözcük tahmin (Pictionary tarzı, hoca çizer), Mini turnuva (eleme usulü), Kovalamaca (doğru cevap hızlandırır)
- Kovalamaca oyunu (soru doğru cevaplanınca hızlanma)

## Faz 6: Dağıtım paketi (v1.0)
Karar (v0.2.1): Merkezi çok hocalı sistem yerine her hoca kendi bağımsız kopyasını kurar (`docs/KURULUM.md`).
- Kurulum kılavuzunun gerçek bir ikinci hocayla denenmesi
- Sürüm notları ve güncelleme rehberi (yeni migration'ları uygulama)
- İsteğe bağlı: kurulum sahibinin aynı kopyaya yardımcı hoca ekleyebilmesi
