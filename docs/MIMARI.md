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

## Veri modeli

Faz 1 itibarıyla kurulu olanlar (`0002_yoklama.sql`):

| Tablo | Alanlar | Not |
|---|---|---|
| `teachers` | eposta, ad_soyad, unvan | İzin listesi. Burada olmayan e-posta giriş yapsa da ders açamaz. Data API'ye kapalı |
| `courses` | id, teacher_id, ad, kod, donem | Hocaya ait |
| `students` | id, course_id, ogrenci_no, ad_soyad | Excel'den içe aktarılır; (course_id, ogrenci_no) tekil |
| `sessions` | id, course_id, baslik, yoklama_acik, basladi, bitti | Canlı ders oturumu |
| `ozel.session_secrets` | session_id, anahtar | Oturumun gizli anahtarı. `ozel` şeması API'ye kapalı, hiçbir rol doğrudan okuyamaz |
| `attendance` | session_id, student_id, cihaz_id, yontem (qr/elle), zaman | (session_id, student_id) ve (session_id, cihaz_id) tekil |

Sonraki fazlarda gelecek: `lessons` (haftalık içerik), `responses` (quiz ve oylama cevapları), `sessions.aktif_adim`.

RLS: Hoca yalnızca kendi `courses` kayıtlarını ve bunlara bağlı öğrenci, oturum ve yoklamaları görür. Öğrenci (anon) hiçbir tabloyu okuyamaz ve yazamaz; yalnızca `katilim_bileti()` ve `check_in()` RPC'lerini çağırır (`SECURITY DEFINER`).

## Yoklama akışı

1. Hoca oturumu başlatır. Veritabanı oturuma rastgele bir gizli anahtar üretir.
2. Sahne ekranı `qr_token(oturum)` ile güncel kodu alır. Kod, anahtar ile 10 saniyelik zaman penceresinden türetilir (SHA-256). Her 10 saniyede veritabanına yazma yapılmaz.
3. QR linki: `https://omferdem.github.io/zaphyros-amfi/#/katil?s=<oturum>&t=<kod>`.
4. Öğrenci QR'ı okuttuğunda sayfa hemen `katilim_bileti(oturum, kod, cihaz_id)` çağırır. Kod son 3 pencereden biriyse (en fazla 30 sn) cihaza bağlı, 3 dakika geçerli bir bilet döner. Kod adres çubuğundan silinir.
5. Öğrenci numarasını girer, `check_in(oturum, bilet, cihaz_id, numara)` çağrılır. Kontroller: yoklama açık mı, bilet bu cihaza ait ve süresi içinde mi, numara dersin listesinde mi, bu numara başka cihazdan girilmiş mi, bu cihazdan başka numara girilmiş mi.
6. Başarılıysa öğrenciye adı kısaltılmış olarak ("Ali Y.") gösterilir; sahne ekranı Realtime ile kaydı alır.

Bilet aşaması sayesinde öğrenci numarasını yazarken acele etmek zorunda kalmaz, ama eski bir QR fotoğrafı ya da dışarıya gönderilen link 30 saniye sonra işe yaramaz. Bu yöntem sahteciliği tamamen engellemez (sınıftaki biri linki anında dışarı gönderebilir) ama ciddi şekilde zorlaştırır. İleride ek önlem gerekirse ders sonunda rastgele "yeniden doğrulama" adımı eklenebilir.

## Giriş (hoca)

Supabase Auth, e-postaya gelen tek kullanımlık bağlantı (magic link), PKCE akışı. HashRouter ile çakışmasın diye bağlantı siteye `?code=...` ile döner, uygulama oturumu açınca bu parametreyi adresten siler. PKCE gereği bağlantı, istendiği tarayıcıda açılmalıdır.

Supabase panelinde gereken ayar: Authentication > URL Configuration > Site URL `https://omferdem.github.io/zaphyros-amfi/`, Redirect URLs listesinde aynı adres ve yerel geliştirme için `http://localhost:5173/`.

## Gerçek zaman stratejisi

- **Yoklama**: sahne ekranı `attendance` ve kendi `sessions` satırını postgres_changes ile dinler (RLS geçerli). Bağlantı koparsa 20 saniyede bir yedek sorgu çalışır.
- **Ders durumu** (`aktif_adim`, aktif slayt, aktif soru, Faz 2+): hoca `sessions` satırını günceller. Öğrencinin `sessions` tablosunu okuması gerekecek; gizli anahtar ayrı tabloda tutulduğu için bu güvenli olacak.
- **Quiz cevapları**: `submit_response()` ile veritabanına yazılır (raporlanacağı için). Sahne ekranı sayıları dinler.
- **Oyunlar** (halat çekme, kovalamaca): Realtime Broadcast kanalı `session:<id>`. Öğrenci telefonu dokunuşları kendi içinde toplar ve en fazla saniyede 2-3 mesaj gönderir. Veritabanına yazılmaz, sadece oyun sonucu kaydedilir.

## Mesaj bütçesi (kaba hesap)

150 öğrenci, 90 dakikalık ders, adım/slayt değişimi 80 kez: 80 x 150 = 12.000 mesaj.
Oyun: 150 öğrenci x 2 mesaj/sn x 120 sn = 36.000 mesaj, sahneye yayın dahil yaklaşık 2 katı.
Ders başına ~100.000 mesaj, ayda 12 ders yaklaşık 1,2 milyon. Free planın 2 milyon sınırının altında ama oyun sayısı arttıkça izlenmeli. Birden fazla hoca kullanmaya başladığında plan yeniden değerlendirilecek.

## Slaytlar

PPTX'i tarayıcıda birebir çizmek güvenilir değil. Önerilen yol: hoca sunumu **PDF olarak** yükler, pdf.js ile sayfa sayfa gösterilir, görüntü birebir korunur. PPTX'ten yalnızca metin çıkarma (öğrenci telefonuna not olarak) ikincil seçenek olarak kalır.
