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
| Gerçek zaman | Ders durumu: `sessions` satırı üzerinden postgres_changes. Oyunlar ve anlık etkileşim: Realtime Broadcast (veritabanına yazmadan) | Ücretsiz kotaları korur |

## Altyapı (kurulu)

| Ne | Değer |
|---|---|
| GitHub repo | `omferdem/zaphyros-amfi` (public) |
| Canlı site | https://omferdem.github.io/zaphyros-amfi/ (main dalına push = otomatik yayın) |
| Supabase organizasyon / proje | `Zaphyros` / `zaphyros-amfi`, Free plan, Central EU (Frankfurt) |
| Supabase URL | https://oiqatggmfktgnexxaspc.supabase.co |
| Frontend anahtarı | publishable anahtar, `src/lib/supabase.ts` içinde (herkese açık olması normal) |

Supabase güvenlik ayarları, proje açılırken bilinçli seçildi:
- **Automatic RLS açık:** `public` şemasında açılan her yeni tabloda RLS kendiliğinden devreye girer.
- **Automatically expose new tables kapalı:** Yeni tablo, açıkça `grant` verilmedikçe Data API'ye çıkmaz. Her migration'da gereken `grant` satırlarını yazmayı unutma; unutulursa sonuç "permission denied" olur, veri sızmaz.

### Veritabanı değişiklikleri (migration)
- Her şema değişikliği `supabase/migrations/NNNN_aciklama.sql` dosyası olarak repoya girer, numara sırayla artar.
- Bu oturumlarda veritabanına doğrudan bağlanacak bir CLI/anahtar yok. SQL, Supabase panelindeki SQL Editor'den çalıştırılır (Claude in Chrome ile ya da kullanıcıdan rica edilerek). Çalıştırılan her dosya `CHANGELOG.md` içinde not edilir.
- Uygulanmış migration'lar: `0001_saglik.sql`.

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

## Güvenlik ve KVKK

- `service_role` anahtarı **asla** repoya, frontend koduna ya da GitHub Pages'e girmez. Frontend yalnızca `anon` (publishable) anahtarı kullanır; güvenlik RLS politikalarıyla sağlanır.
- `.env` dosyaları commit edilmez. Örnek değerler `.env.example` içinde durur.
- Gerçek öğrenci listesi, numara, isim, yoklama verisi repoya girmez. Test için uydurma veri kullanılır.
- Öğrenciden yalnızca öğrenci numarası ve ad soyad tutulur. Konum, cihaz bilgisi, fotoğraf toplanmaz. (Tek cihaz kontrolü için tarayıcıda rastgele bir cihaz kimliği üretilir, kişisel veri değildir.)
- Yoklama sahteciliğine karşı: QR içindeki token birkaç saniyede bir yenilenir ve doğrulama sunucu tarafında (Postgres RPC) yapılır.

## Referans

`docs/prototip-gemini.html` yalnızca **arayüz ve özellik fikri** için referanstır. Kodu temel alınmayacak; ayrıntılar `docs/PROTOTIP-INCELEME.md` içinde.
