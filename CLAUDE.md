# AmfiOS: Canlı Amfi Ders Sistemi

Bu dosya, bu repoda çalışan her Claude oturumunun ilk okuması gereken yönergedir.

## Proje ne?

Üniversite derslerini canlı ve katılımlı hale getiren tarayıcı tabanlı bir sistem. Hoca derse projeksiyondan bir "sahne" ekranı açar, öğrenciler perdedeki QR kodu okutup telefonlarının tarayıcısından derse katılır. Ders akışı (yoklama, slayt, video, quiz, tartışma, oyun) tamamen hocanın kontrolündedir; öğrencinin telefonu o anki adıma göre değişir.

Sahibi: Doç. Dr. Ömer Faruk Erdem (NEÜ İlahiyat, Din Felsefesi). İlk kullanıcı kendisi, sonra başka hocalara açılacak.

## Bağlayıcı kararlar

| Konu | Karar | Gerekçe |
|---|---|---|
| Öğrenci erişimi | Uygulama yok, telefon tarayıcısı (QR ile gelen link) | Kurulum engeli olmasın |
| Backend | Supabase (Free plan): Postgres + Auth + Realtime | Ücretsiz, SQL, RLS ile çoklu hoca, Realtime Broadcast oyunlar için uygun |
| Hosting | GitHub Pages, GitHub Actions ile otomatik deploy | Ücretsiz, sunucu gerekmez |
| Frontend | Vite + React + TypeScript + Tailwind | Çok ekranlı (hoca/öğrenci) yapı için düzenli, test edilebilir |
| Dağıtım | Her hoca kendi bağımsız kopyasını kurar: kendi GitHub deposu, kendi Supabase projesi (`docs/KURULUM.md`). Merkezi sunucu yok | Program başka hocalara verilecek; kimse kimseye bağlı olmamalı, sahibi diğer kurulumların verisini görmez ve yönetmez |
| Ders düzeni | **İçerik** (akışlar, sunumlar, sorular; dönemden bağımsız) → **dönem** (`terms`) → **şube** (`courses`: her şubenin kendi sınıf listesi, oturumları ve yoklaması). Kullanıcı yılda 2 dönem, dönemde 3 4 ders, bazı derslerde 6 7 şube okutur; içeriği her yıl kullanır ve geliştirir, gelecek dönemleri önceden planlar | Bir kez hazırlanan içerik her dönem ve her şubede geçerli olmalı; yoklama ve çıktı şube bazında ayrı kalmalı |
| Gerçek zaman | Ders durumu: `sessions` satırı üzerinden postgres_changes. Oyunlar ve anlık etkileşim: Realtime Broadcast (veritabanına yazmadan) | Ücretsiz kotaları korur |

## Altyapı (kurulu)

| Ne | Değer |
|---|---|
| GitHub repo | `omferdem/zaphyros-amfi` (public) |
| Canlı site | https://omferdem.github.io/zaphyros-amfi/ (main dalına push = otomatik yayın) |
| Supabase organizasyon / proje | `Zaphyros` / `zaphyros-amfi`, Free plan, Central EU (Frankfurt) |
| Supabase URL | https://oiqatggmfktgnexxaspc.supabase.co |
| Frontend ayarı | Supabase adresi ve publishable anahtar `public/ayarlar.json` içinde (herkese açık olması normal). Koda kurulum adresi, e-posta ya da kişiye özel hiçbir değer gömülmez |

Supabase güvenlik ayarları, proje açılırken bilinçli seçildi:
- **Automatic RLS açık:** `public` şemasında açılan her yeni tabloda RLS kendiliğinden devreye girer.
- **Automatically expose new tables kapalı:** Yeni tablo, açıkça `grant` verilmedikçe Data API'ye çıkmaz. Her migration'da gereken `grant` satırlarını yazmayı unutma; unutulursa sonuç "permission denied" olur, veri sızmaz.

### Veritabanı değişiklikleri (migration)
- Her şema değişikliği `supabase/migrations/NNNN_aciklama.sql` dosyası olarak repoya girer, numara sırayla artar.
- Bu oturumlarda veritabanına doğrudan bağlanacak bir CLI/anahtar yok. SQL iki yoldan çalıştırılır:
  - **Bulut oturumları:** `.github/workflows/supabase.yml` ("Supabase işlemleri") iş akışıyla. Depoda `SUPABASE_ACCESS_TOKEN` Actions secret'ı tanımlı; iş akışı `sql-dosyasi` seçeneğiyle `supabase/` altındaki bir dosyayı, `kurulum-ve-ayar` ile `kurulum.sql`'i çalıştırır.
  - **Yerel oturumlar:** Supabase panelindeki SQL Editor'den (Claude in Chrome ile ya da kullanıcıdan rica edilerek).
  - Çalıştırılan her dosya `CHANGELOG.md` içinde not edilir.
- Yeni kurulumlar için bütün migration'lar `supabase/kurulum.sql` dosyasında birleşir. Migration ekleyince `npm run kurulum-sql` çalıştır; test, dosya eskiyse hata verir.
- Kurulumun hocası migration ile değil, sitede "Kurulumu sahiplen" adımıyla belirlenir (ilk giren hoca). Migration'a kişisel veri yazılmaz.
- Uygulanmış migration'lar: `0001_saglik.sql`, `0002_yoklama.sql` (18 Ekim 2026, `kurulum.sql` ile SQL Editor'den), `0003_ders_akisi.sql`, `0004_ders_icerigi.sql`, `0005_bilgi_yarismasi.sql` (19 Ekim 2026), `0006_telefon_modu.sql` (25 Ekim 2026), `0007_donem_sube_plan.sql`, `0008_sube_gorunur.sql` (26 Ekim 2026). Bekleyen yok.
- Migration'lar Supabase'e gitmeden önce yerelde denenir: `npm run sql-test` (PGlite; bilgisayarda Postgres gerekmez, taklit + bütün migration'lar + düz SQL testleri). Yeni testleri psql komutu kullanmadan, hata verince duran düz SQL olarak yaz (`0003_ders_akisi_test.sql` gibi). Sonra Supabase SQL Editor'de `begin; <migration> <test> rollback;` ile bir kez daha dene, en son uygula.
- Sürüm etiketleri `.github/workflows/etiket.yml` ile main'e push sonrası otomatik atılır (commit mesajı `vX.Y.Z:` ile başlamalı). İstisna: `.github/workflows/` altında dosya değiştiren commit'lere GitHub bu yolla etiket attırmaz; bunların etiketi yerel oturumdan `git push` ile atılır. Bulut oturumları etiket push edemez.

Ayrıntılı mimari: `docs/MIMARI.md`. Yol haritası ve fazlar: `docs/YOL-HARITASI.md`. Gemini prototipinin incelemesi: `docs/PROTOTIP-INCELEME.md`.

## Ücretsiz plan sınırları (Ekim 2026 itibarıyla doğrulandı)

- Supabase Free: 200 eşzamanlı Realtime bağlantısı, ayda 2 milyon Realtime mesajı, 500 MB veritabanı.
- **Supabase Free projeler 7 gün hareketsiz kalınca duraklatılır.** Bunu önlemek için `.github/workflows/keepalive.yml` ile birkaç günde bir hafif bir istek atılacak (Faz 0'da kurulacak).
- 200 kişiyi aşan amfide Realtime sınırına takılırız. Bu durumda Pro plana geçiş ya da öğrenci tarafında bağlantıyı yalnızca etkileşimli adımlarda açık tutma düşünülecek.
- GitHub Pages, ücretsiz hesapta yalnızca **public** repodan yayın yapar. Repo public olacaksa içinde hiçbir gerçek öğrenci verisi ve hiçbir gizli anahtar bulunmamalı.

## Çalışma kuralları

1. Kullanıcıyla Türkçe konuş. Teknik terimler (API, hook, RLS, Realtime, commit vb.) İngilizce kalır.
2. Her değişikliği adım adım açıkla: ne yaptın, neden yaptın, neyi etkiler.
3. **Çalışan özelliği bozma.** Yeni bir şey eklemeden önce mevcut davranışı koru; değiştirmen gerekiyorsa önce sor.
4. Belirsiz bir noktada varsayımla ilerleme, sor. ("Beceremediğin yeri sor, kafana göre yapma.")
5. Plan anlatmak yerine işi yap; gereksiz duyuru ve önsöz yok. **Kullanıcıya iş yükleme:** tarayıcıda, terminalde ya da panelde senin yapabileceğin her adımı kendin yap. Yalnızca gerçekten kullanıcının yapması gereken adımları (şifre girmek, hesap açmak gibi) iste.
6. Kullanıcıya görünen Türkçe metinlerde (arayüz, README, mesajlar) doğal dil kullan: uzun çizgi (em dash) yok, abartılı pazarlama dili yok, yapay zeka kalıpları yok.
7. Her anlamlı teslimde sürüm numarasını artır (`package.json` + `CHANGELOG.md`) ve git tag at. Kullanıcı isterse sürümü ZIP olarak da teslim et.
8. Kod tamamlanmış sayılmadan önce çalıştır, derle ve tarayıcıda dene.
9. **Birden fazla yer:** Kullanıcı projeyi hem yerel oturumdan (Claude masaüstü, kendi bilgisayarı) hem bulut oturumundan (claude.ai/code) yürütür; ortak nokta GitHub'daki main dalıdır.
   - Yerel oturum: işe başlamadan önce `git pull` yap, iş bitince commit'leyip main'e push et. Klonun yeri her bilgisayarda `%USERPROFILE%\code\zaphyros-amfi` (oturumun geçici klasörü Windows'ta git için fazla uzun yol verdiği için kısa yol seçildi). Kullanıcının hem evde hem iş yerinde Claude masaüstü programı var; iki bilgisayarın yerel oturumu da her işi yapabilmeli.
   - Yeni bir bilgisayarda yerel oturum ilk kez açıldığında şunları denetle ve eksik olanı kendin tamamla (yalnızca giriş ve kurulum onayını kullanıcıdan iste): Git ve Node.js kurulu mu; depo klonlu mu (değilse klonla ve oturumu oraya taşı); `git config user.name/user.email` depoda ayarlı mı (`omferdem` ve GitHub'daki commit'lerle aynı adres); `npm ci` ile bağımlılıklar kurulu mu; ilk push'ta Git Credential Manager GitHub girişi ister, kullanıcı onaylar; Chrome'da Claude in Chrome eklentisi bağlı mı, Supabase ve GitHub oturumları açık mı.
   - Bulut oturumu: iş kendi dalında PR olarak biter. PR main'e alınmadan öteki taraf değişikliği görmez; iş bitince kullanıcıya PR'ı birleştirmeyi teklif et, açık PR bırakma.
   - İki tarafta aynı anda aynı dosyalar üzerinde çalışma; yarım iş varsa önce onu main'e al.

### Yerel oturumda hoca girişi (Claude in Chrome ile)
- Giriş şifresizdir ve **PKCE** kullanır: bağlantıyı **sitenin kendi giriş formundan** iste (aynı tarayıcıda doğrulama kodu saklanır). Başka yoldan (ör. doğrudan API isteğiyle) üretilen bağlantılar giriş yapmaz. Form dışında yeni istek, doğrulama kodunu ezer ve önceki e-postayı işe yaramaz hâle getirir.
- Supabase'in yerleşik e-postası **saatte 2** ile sınırlıdır (`over_email_send_rate_limit`); denemeleri sık yapma, e-posta 1 saat içinde kullanılmazsa süresi dolar.
- Gmail aynı konudaki e-postaları tek konuşmada toplar. **En alttaki (en yeni) mesajı** aç; içeriği "…" (Kısaltılmış içeriği göster) ile gizlenmiş olabilir. Bağlantıya `computer` ile gerçek bir tıklama yap (betikle `click()` yeni sekme açmaz). Gelmesi birkaç dakika sürebilir.
- Bu işi kullanıcıya yaptırma; Gmail, Supabase ve GitHub oturumları kullanıcının Chrome'unda açık.

## Güvenlik ve KVKK

- `service_role` anahtarı **asla** repoya, frontend koduna ya da GitHub Pages'e girmez. Frontend yalnızca `anon` (publishable) anahtarı kullanır; güvenlik RLS politikalarıyla sağlanır.
- `.env` dosyaları commit edilmez. Örnek değerler `.env.example` içinde durur.
- Gerçek öğrenci listesi, numara, isim, yoklama verisi repoya girmez. Test için uydurma veri kullanılır.
- Öğrenciden yalnızca öğrenci numarası ve ad soyad tutulur. Konum, cihaz bilgisi, fotoğraf toplanmaz. (Tek cihaz kontrolü için tarayıcıda rastgele bir cihaz kimliği üretilir, kişisel veri değildir.)
- Yoklama sahteciliğine karşı: QR içindeki token birkaç saniyede bir yenilenir ve doğrulama sunucu tarafında (Postgres RPC) yapılır.

## Referans

`docs/prototip-gemini.html` yalnızca **arayüz ve özellik fikri** için referanstır. Kodu temel alınmayacak; ayrıntılar `docs/PROTOTIP-INCELEME.md` içinde.
