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

### Ara teslim: yıllar arası içerik ve karekodsuz başlatma (v0.3.1) ✅
- Kullanıcı kararı: ders içeriği (akışlar, sunumlar) dönemler arasında ortak; yeni dönem aynı içeriğe bağlanır
- Ders yoklamasız (QR'sız) başlatılabilir

### 2b: Yalnız telefon modu
- Bilgisayar yoksa hoca dersi telefonundan yönetir; perdede görünecek ekran öğrenci telefonlarında görünür (slaytın görüntüsü + metni)
- Slayt görüntüleri küçültülmüş resim olarak hazırlanır. Ücretsiz plan trafiği (ayda 5 GB) için hesap: 150 öğrenci x 40 slayt ders başına 300-400 MB; görüntü boyutu buna göre seçilecek

### 2c: PPTX/PPT çevirisi
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
- Canlı soru, süre sayacı, cevap dağılımı grafiği, doğru cevabı açma
- Puan tablosu ve ders sonu raporu

## Faz 4: Tartışma araçları (v0.5)
- Beyin fırtınası: kelime bulutu
- Şeytanın avukatı: iki kutuplu oylama ve gerekçe gönderme
- Video adımı (YouTube linki, sahnede oynatma)

## Faz 5: Oyunlar (v0.6)
- Halat çekme (iki takım, Broadcast)
- Kovalamaca oyunu (soru doğru cevaplanınca hızlanma)

## Faz 6: Dağıtım paketi (v1.0)
Karar (v0.2.1): Merkezi çok hocalı sistem yerine her hoca kendi bağımsız kopyasını kurar (`docs/KURULUM.md`).
- Kurulum kılavuzunun gerçek bir ikinci hocayla denenmesi
- Sürüm notları ve güncelleme rehberi (yeni migration'ları uygulama)
- İsteğe bağlı: kurulum sahibinin aynı kopyaya yardımcı hoca ekleyebilmesi
