# Mimari

## Üç parça

```
 Projeksiyon (hoca)            Öğrenci telefonları
 /sahne  /panel                /katil?s=...&t=...
        \                         /
         \                       /
          Supabase (Postgres + Auth + Realtime)
```

- **Hoca paneli (`/panel`)**: Giriş yapılan alan. Ders, hafta, içerik, sınıf listesi, raporlar.
- **Sahne (`/sahne/:sessionId`)**: Projeksiyonda açık kalan ekran. QR, slayt, quiz sonuçları, oyunlar. Hoca akışı buradan ya da kendi telefonundan (uzaktan kumanda görünümü) yönetir.
- **Öğrenci (`/katil`)**: Girişsiz. QR'dan gelir, numara girer, sonra o anki adımı görür.

## Veri modeli (ilk taslak)

| Tablo | Alanlar | Not |
|---|---|---|
| `teachers` | id (auth.users), ad, unvan | Supabase Auth ile |
| `courses` | id, teacher_id, ad, kod, dönem | Hocaya ait |
| `students` | id, course_id, ogrenci_no, ad_soyad | Excel'den içe aktarılır |
| `lessons` | id, course_id, hafta_no, baslik, icerik (jsonb) | Slaytlar, sorular, tez, video linki |
| `sessions` | id, lesson_id, durum, aktif_adim, qr_token, token_zamani, basladi, bitti | Canlı ders oturumu |
| `attendance` | session_id, student_id, cihaz_id, zaman | (session_id, student_id) ve (session_id, cihaz_id) tekil |
| `responses` | session_id, student_id, soru_id, cevap, zaman | Quiz ve oylamalar |

RLS: Hoca yalnızca kendi `courses` ve altındaki kayıtları görür. Öğrenci tarafı doğrudan tablo yazmaz; `check_in()` ve `submit_response()` gibi `SECURITY DEFINER` RPC fonksiyonlarını çağırır.

## Yoklama akışı

1. Hoca oturumu başlatır. Sahne ekranı her 10-15 saniyede bir yeni `qr_token` üretip `sessions` satırına yazar ve QR'ı yeniler.
2. QR linki: `/katil?s=<session_id>&t=<token>`.
3. Öğrenci numarasını girer. `check_in(session_id, token, ogrenci_no, cihaz_id)` çağrılır.
4. RPC kontrol eder: token güncel mi (son 2 token kabul), numara bu dersin listesinde mi, bu cihazdan bu oturumda başka giriş yapılmış mı.
5. Başarılıysa öğrenciye kısa ömürlü bir oturum kimliği döner, telefon ders akışına bağlanır.

Bu yöntem sahteciliği tamamen engellemez (sınıftaki biri linki anında dışarı gönderebilir) ama ciddi şekilde zorlaştırır. İleride ek önlem gerekirse ders sonunda rastgele "yeniden doğrulama" adımı eklenebilir.

## Gerçek zaman stratejisi

- **Ders durumu** (`aktif_adim`, aktif slayt, aktif soru): hoca `sessions` satırını günceller, herkes postgres_changes ile dinler.
- **Quiz cevapları**: `submit_response()` ile veritabanına yazılır (raporlanacağı için). Sahne ekranı sayıları dinler.
- **Oyunlar** (halat çekme, kovalamaca): Realtime Broadcast kanalı `session:<id>`. Öğrenci telefonu dokunuşları kendi içinde toplar ve en fazla saniyede 2-3 mesaj gönderir. Veritabanına yazılmaz, sadece oyun sonucu kaydedilir.

## Mesaj bütçesi (kaba hesap)

150 öğrenci, 90 dakikalık ders, adım/slayt değişimi 80 kez: 80 x 150 = 12.000 mesaj.
Oyun: 150 öğrenci x 2 mesaj/sn x 120 sn = 36.000 mesaj, sahneye yayın dahil yaklaşık 2 katı.
Ders başına ~100.000 mesaj, ayda 12 ders yaklaşık 1,2 milyon. Free planın 2 milyon sınırının altında ama oyun sayısı arttıkça izlenmeli. Birden fazla hoca kullanmaya başladığında plan yeniden değerlendirilecek.

## Slaytlar

PPTX'i tarayıcıda birebir çizmek güvenilir değil. Önerilen yol: hoca sunumu **PDF olarak** yükler, pdf.js ile sayfa sayfa gösterilir, görüntü birebir korunur. PPTX'ten yalnızca metin çıkarma (öğrenci telefonuna not olarak) ikincil seçenek olarak kalır.
