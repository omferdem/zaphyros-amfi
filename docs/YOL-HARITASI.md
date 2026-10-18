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

## Faz 2: Slayt (v0.3)
- PDF yükleme (Supabase Storage), pdf.js ile sahnede gösterim
- Hocanın kumanda görünümü (telefondan ileri/geri)
- Öğrenci telefonunda aktif slayt başlığı / notu

## Faz 3: Quiz (v0.4)
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
