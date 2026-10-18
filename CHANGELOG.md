# Sürüm Geçmişi

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
- Veritabanı: `0002_yoklama.sql` (tablolar, RLS, `qr_token`, `katilim_bileti`, `check_in` RPC'leri). **Supabase'de henüz çalıştırılmadı.**

## v0.1.0 (18 Ekim 2026)
- Vite + React + TypeScript + Tailwind iskeleti
- Sayfalar: `#/panel` (hoca), `#/sahne/:oturumId` (projeksiyon), `#/katil` (öğrenci)
- Supabase istemcisi; panelde canlı bağlantı göstergesi
- GitHub Actions: Pages'e otomatik yayın, iki günde bir Supabase uyandırma
- Veritabanı: `0001_saglik.sql` uygulandı (Supabase SQL Editor, 18 Ekim 2026)

## v0.0.1 (18 Ekim 2026)
- Proje başlatıldı: CLAUDE.md, mimari, yol haritası, prototip incelemesi.
