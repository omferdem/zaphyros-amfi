# Mimari

## Dağıtım modeli

Her hoca kendi kopyasını kurar: kendi GitHub deposu (site) ve kendi Supabase projesi (veri). Kurulumlar arasında hiçbir bağ yoktur. Site, hangi Supabase projesine bağlanacağını yanındaki `ayarlar.json` dosyasından okur; derleme sırasında sabit adres gömülmez ve site göreli yollarla derlendiği için hangi adreste yayınlanırsa yayınlansın çalışır. Yeni kurulumun `teachers` tablosu boştur; siteye ilk giren hoca `kurulumu_sahiplen()` ile sahibi olur. Kurulum adımları: `docs/KURULUM.md`.

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

**Ders içeriği ve dönem** (`0004_ders_icerigi.sql`, kullanıcı kararı 19 Ekim 2026): hoca dersleri her yıl yeniden kullanır. `subjects` (ders içeriği: akışlar ve sunumlar) dönemden bağımsızdır; `courses` bir dönemin dersidir (sınıf listesi, oturumlar, yoklamalar) ve bir içeriğe bağlanır. Aynı içerik birden fazla döneme bağlanabilir; değişiklik hepsine yansır. İçerik seçilmeden açılan derse dersin adıyla içerik kendiliğinden açılır (tetikleyici). Dersi olan içerik silinemez.

| Tablo | Alanlar | Not |
|---|---|---|
| `subjects` | id, teacher_id, ad | Ders içeriği |
| `courses` (+) | subject_id | Dönemin dersinin bağlı olduğu içerik |

Faz 2a ile gelenler (`0003_ders_akisi.sql`; 0004'ten beri sunum ve akışlar `course_id` yerine `subject_id` taşır):

| Tablo | Alanlar | Not |
|---|---|---|
| `presentations` | id, course_id, ad, kaynak, durum, sayfa_sayisi, metinler | Sunum kitaplığı. Dosya depoda: `sunumlar/<içerik id>/<sunum id>.pdf`. `metinler` her sayfanın metni (yüklerken tarayıcıda çıkarılır) |
| `lessons` | id, course_id, ad | Ders akışı (ör. "3. hafta") |
| `lesson_steps` | id, lesson_id, sira, tur, presentation_id, sayfa_no, ayar | Akış adımı. `tur`: yoklama, slayt; sonraki fazlarda video, beyin fırtınası, quiz. `ayar` etkinliğe özel ayarlar için |
| `sessions` (+) | lesson_id, aktif_adim | Oturumda izlenen akış ve perdedeki adım |
| `ozel.session_secrets` (+) | kumanda | Kumanda anahtarı |

Faz 3 ile gelenler (`0005_bilgi_yarismasi.sql`):

| Tablo | Alanlar | Not |
|---|---|---|
| `questions` | id, subject_id, soru, dogru, yanlislar, sure_sn, ek | Soru bankası, ders içeriğine bağlı. `ek`: ZOMR'daki #EASINESS, #BLOOM, #OUTCOME |
| `lesson_steps` (+) | question_id | `tur = 'soru'` adımı |
| `sessions` (+) | soru_durum, soru_basladi | Perdeye soru adımı gelince tetikleyici `acik` yapar ve zamanı yazar; `sonuc` doğru cevabı açıklar |
| `session_players` | session_id, cihaz_id, takma_ad | Yoklamasız derste takma ad; oturumda tekil |
| `responses` | session_id, step_id, question_id, cihaz_id, secim, dogru, puan, sure_ms | Bir cihaz bir soruya bir kez cevap verir |

**Yarışma güvenliği:** Şıkların sırası oturum ve soru kimliğinden türetilen bir sıralamayla karışır, herkese aynı görünür. Öğrenci şıkkın sırasını gönderir; `cevap_ver()` sırayı yeniden hesaplar, süreyi (1,5 sn pay ile) ve doğruluğu sunucuda denetler, puanı kendisi yazar. Doğru şık `soru_durum = 'sonuc'` olana kadar hiçbir yanıtta yer almaz.

RLS: Hoca yalnızca kendi `courses` kayıtlarını (ve bunlara bağlı sunum, akış ve adımları) ve bunlara bağlı öğrenci, oturum ve yoklamaları görür. Öğrenci (anon) hiçbir tabloyu okuyamaz ve yazamaz; yalnızca `katilim_bileti()`, `check_in()`, `kodla_katil()` ve `ders_durumu()` RPC'lerini çağırır (`SECURITY DEFINER`). Kumanda (girişsiz) `kumanda_durumu()` ve `kumanda_komut()` ile, oturumun kumanda anahtarını vererek çalışır.

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
- **Ders durumu** (Faz 2a'dan itibaren): perdedeki adımı hoca (sahne ya da kumanda) `sessions.aktif_adim` ile değiştirir. Sahne bunu postgres_changes ile alır. Öğrenci tablo okumaz: `sessions` üzerindeki tetikleyici durumu `realtime.send()` ile herkese açık `oturum:<id>` Broadcast kanalına yayınlar (yalnızca ders adı, adım ve slayt metni); öğrenci ve kumanda bu kanalı dinler, ayrıca yedek olarak `ders_durumu()` ile sorar.
- **Quiz cevapları**: `submit_response()` ile veritabanına yazılır (raporlanacağı için). Sahne ekranı sayıları dinler.
- **Oyunlar** (halat çekme, kovalamaca): Realtime Broadcast kanalı `session:<id>`. Öğrenci telefonu dokunuşları kendi içinde toplar ve en fazla saniyede 2-3 mesaj gönderir. Veritabanına yazılmaz, sadece oyun sonucu kaydedilir.

## Mesaj bütçesi (kaba hesap)

150 öğrenci, 90 dakikalık ders, adım/slayt değişimi 80 kez: 80 x 150 = 12.000 mesaj.
Oyun: 150 öğrenci x 2 mesaj/sn x 120 sn = 36.000 mesaj, sahneye yayın dahil yaklaşık 2 katı.
Ders başına ~100.000 mesaj, ayda 12 ders yaklaşık 1,2 milyon. Free planın 2 milyon sınırının altında ama oyun sayısı arttıkça izlenmeli. Birden fazla hoca kullanmaya başladığında plan yeniden değerlendirilecek.

## Slaytlar

PPTX'i tarayıcıda birebir çizmek güvenilir değil. Hoca sunumu **PDF olarak** yükler, pdf.js ile sayfa sayfa gösterilir, görüntü birebir korunur. PPTX/PPT yüklenirse Faz 2c'de GitHub Actions'taki LibreOffice ile PDF'e çevrilecek.

- PDF özel `sunumlar` kovasındadır; sahne 6 saat geçerli imzalı adresle açar. Öğrenci dosyaya erişmez, yalnızca sayfa metnini görür (Faz 2b'de yalnız telefon modu için küçültülmüş görüntüler eklenecek).
- Sayfa metni yüklerken pdf.js ile çıkarılır ve `presentations.metinler` dizisine yazılır.

## Telefon modu

`sessions.telefon_modu` açıkken ders projeksiyonsuz yürütülür: hoca telefonundaki kumandadan yönetir, perdedeki slayt öğrencilerin telefonunda görünür.

- Sayfa görselleri `slayt-gorselleri` kovasında (özel), `<içerik id>/<sunum id>/<sayfa no>` yolunda durur. Sunum yüklenirken tarayıcıda üretilir (en uzun kenar 900 piksel, WebP); `presentations.gorseller_hazir` hazır olduğunu söyler.
- Öğrenci (anon) bir görseli yalnızca depo kuralı izin verirse okur: `gorsel_gorunur(yol)` telefon modundaki açık bir oturumda o an PERDEDEKİ adımın sunumu ve sayfasıysa doğru döner. Sıradaki slayt önceden indirilemez, ders bitince erişim kapanır. Hoca kendi içeriğinin bütün görsellerini okur ve yazar.
- `ders_durumu()` telefon modunda perdedeki slaytın görsel yolunu (`gorsel`) da verir; yayınlanan durum bu alanı da taşır. Görseli hazır olmayan sunumda yol boştur, öğrenci metni görür.
- Telefon modunda perde olmadığı için soru sonucunda ilk 5 `benim_sonucum()` ile öğrenci telefonuna da gelir.
- Kumanda `telefon_ac` ve `telefon_kapat` komutlarıyla modu dersin içinde değiştirir.

## Ders kodu ve kumanda

- **Ders kodu**: oturumun gizli anahtarı ve dakika numarasından türetilen 6 haneli sayı. `kodla_katil()` açık oturumlar arasında (son 12 saat) bu dakikanın ya da bir önceki dakikanın koduna uyanı bulur. Yoklama açıksa QR'daki gibi cihaza bağlı bilet döner, numara `check_in()` ile girilir.
- **Kumanda**: her oturumun ayrı, rastgele 64 haneli kumanda anahtarı vardır (`ozel.session_secrets.kumanda`). Sahnedeki Kumanda QR'ı bu anahtarı içerir; telefon anahtarı saklar ve adres çubuğundan siler. Telefonda hoca girişi varsa anahtar `kumanda_anahtari()` ile de alınır.
