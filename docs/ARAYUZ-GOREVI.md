# ZAPEDU arayüz tasarımı (Gemini için komutlar)

Bu dosya, ZAPEDU'nun üç ekran ailesinin (öğrenci telefonu, hoca paneli ve kumandası, perde/sahne) arayüzünü Gemini'ye tasarlatmak için komutlar içerir. Komutlar programın gerçek ekranlarına, renklerine ve kurallarına göre yazıldı. Gemini'nin ürettiği tasarımı bana (Claude) ver; mevcut yapıyı bozmadan ekran ekran uygularım.

## Nasıl kullanılır
1. Gemini'de yeni bir sohbet aç ve **A. Ortak marka ve kurallar** bölümünü ilk mesaj olarak yapıştır.
2. Sonra **B (öğrenci)**, **C (hoca)**, **D (perde)** bölümlerinden birini ayrı mesaj olarak ver. Her bölüm tek tek ekranlar ister; bir seferde bir ekran istersen "yalnızca şu ekranı yap" diye ekle.
3. Çıktı olarak **HTML + Tailwind CSS** (tek dosya, çalışır prototip) iste; böylece ben doğrudan okuyup React bileşenine çeviririm. Görsel (PNG) istersen "ayrıca ekran görüntüsü gibi mockup" de.
4. Beğenmediğin ekranı aynı komutla "daha sade / daha cesur / daha okunur" notuyla yeniden iste.

## A. Ortak marka ve kurallar (ilk mesaj)
```
ZAPEDU adlı bir canlı üniversite dersi sistemi için arayüz tasarlayacaksın. Hoca derse projeksiyondan bir "sahne" (perde) ekranı
açar; öğrenciler perdedeki QR kodu telefonlarıyla okutur ve telefonlarında ders akışını takip edip etkileşirler (soru cevaplama,
kelime bulutu, oylama, quiz, yarışma oyunları). Hoca ayrıca bir panelden ders, şube, akış ve raporları yönetir ve telefonundan
"kumanda" ile dersi yürütür. Dil: Türkçe. Kullanıcılar: 18-25 yaş üniversite öğrencileri ve akademisyen.

MARKA
- Ad: ZAPEDU. Logo: "ZE" harfleri (neon gradyan, yuvarlak köşeli rozet). Alt yazı yok.
- Koyu tema (tek tema). Arka plan #070a1f (lacivert-siyah), üstünde hafif mor/pembe aurora parıltıları.
- Vurgu renkleri: pembe #ff4d9d, mor #7c5cff, turkuaz #22e3d2, sarı #ffd23f, lime #b8ff4a. Ana gradyan: pembe -> mor -> turkuaz.
- Yüzeyler: "cam panel" (yarı saydam beyaz %5-8, ince beyaz çerçeve %10, backdrop-blur, 1.5-2 rem yuvarlak köşe).
- Yazı: Plus Jakarta Sans (metin), Bricolage Grotesque (başlık/büyük sayı), JetBrains Mono (kod, numara, sayaç).
- Düğmeler: birincil "parlak" (gradyan pembe-mor, hafif glow, basınca küçülür), ikincil (cam, ince çerçeve), tehlikeli (kırmızı ton).
- Hareket: yumuşak (200-300 ms), basınca scale 0.96, yeni öğeler "pop" ile gelir; prefers-reduced-motion'a saygı.
- Ton: enerjik, eğlenceli ama ciddiyetini koruyan; yapay zeka klişesi, abartılı pazarlama dili ve uzun çizgi (—) yok.

TEKNİK KURALLAR
- Çıktı: tek dosya HTML + Tailwind (CDN) + gerekirse küçük inline JS ile gerçekçi örnek veriyle çalışan prototip. Sahte ama makul Türkçe
  veri kullan (ör. "Kötülük problemi", "Ali Y.", "Din Felsefesi I · A"); gerçek kişi adı ya da öğrenci numarası yazma.
- Erişilebilirlik: kontrast WCAG AA, dokunma hedefleri en az 44 px, odak halkası görünür.
- Emoji yerine tutarlı bir ikon seti (Lucide benzeri çizgi ikonlar) kullan; yarışma sahnelerinde illüstrasyon serbest.
- Mobil öğrenci ekranları 360-430 px genişlikte; perde 1920x1080 (16:9) ve arka sıradan okunabilir (ana metin en az 40 px);
  hoca paneli masaüstü (1280+) ve tablet; kumanda yalnızca telefon.
- Her ekran için: boş durum, yükleniyor, hata ve (varsa) "bağlantı koptu" halini de göster.
```

## B. Öğrenci telefonu
```
Öğrenci telefonu ekranlarını tasarla (360-430 px, dikey, tek elle kullanım). Öğrenci uygulama kurmaz; QR ile tarayıcıda açılır.
Ekranlar ve içerikleri:

1. Derse katıl (giriş): ZE logosu, "Derse katıl" başlığı, 6 haneli ders kodu girişi (büyük, aralıklı, sayısal klavye), "Katıl" düğmesi.
   Alt not: "Perdedeki kodu yaz ya da QR'ı okut." Hata hali: "Bu kod tutmadı."
2. Yoklama formu (QR okutunca): ders adı + şube, "Öğrenci numaranı gir" tek alan, "Yoklamamı ver" düğmesi, süre dolarsa "QR'ı yeniden okut" uyarısı.
3. Ders takibi (ana ekran, üstte sabit şerit): solda ders adı (küçük, mono), sağda "✓ Ali, yoklama alındı" rozeti ve "🔥 4 ders üst üste" seri rozeti.
   Altındaki büyük cam kart o anki adıma göre değişir (aşağıdaki durumlar). Kartın altında sınıf etkileşim düğmeleri
   (hızlı tepkiler: "Anlamadım", "Tekrar", "Hızlı", "Yavaş", el kaldır) ve küçük "Veri tasarrufu" anahtarı.
   3a. Slayt: slayt görseli (16:9), altında katlanır "Slaytın metni". Sağ üstte "Slayt 5 / 28". (Slayt yoksa yalnızca metin.)
   3b. Yoklama alınıyor: "Perdeye bak, QR'ı okut" yönlendirmesi.
   3c. Bekleme: "Hocanın ekranını izle. Bir sonraki adım burada görünecek." (sakin, nefes alan animasyon)
4. Soru cevaplama (bilgi yarışması): üstte geri sayım halkası (kalan saniye), soru metni, 2-5 şık (büyük renkli dokunma kartları, A/B/C/D harfi + şekil
   sembolü), seçince "Cevabın alındı" kilidi. Sonuç hali: doğru şık yeşil, seçtiğin yanlışsa kırmızı, "+740 puan", kısa dağılım çubuğu, ilk 5 sıralama.
5. Etkinlik cevabı: (a) kelime bulutu: tek kelimelik alan + gönder; (b) beyin fırtınası: kısa cümle alanı, en çok 3 fikir sayacı; (c) açık uçlu soru:
   çok satırlı alan, kalan süre, "cevapların hoca yansıtınca perdede görünür"; (d) şeytanın avukatı oylaması: iki büyük taraf düğmesi (Katılıyorum / Katılmıyorum)
   + isteğe bağlı gerekçe alanı; (e) video/fotoğraf: oynatıcı ya da büyük görsel.
6. Quiz bandı (derse girmiş öğrenciye üstte beliren): "📝 Quiz başladı" + süre + "Başla" düğmesi; quiz çözme ekranı (soru x/y, ilerleme çubuğu,
   şıklar, "Bitir"); bitişte "Cevapların kaydedildi".
7. Oyun ekranları (telefon yalnızca cevap verir, oyun perdede oynanır): takım seçimi (3 renk takım kartı, kişi sayıları), "Takımın: Mavi" bandı,
   halat çekme/zombi/roket/ejderha/arena/kule için telefonda yalnızca şık seçimi + canlı skor şeridi (sınıf puanı, takım sırası).
8. Ders bitti: konfeti, "Ders bitti, teşekkürler", varsa karne ("Bugünkü yarışmada 48 kişi arasında 3. oldun, 5.120 puan"), devam serisi.

Bu ekranların hepsini tek tek değil, önce 3, 4 ve 5'i (en çok kullanılanlar) tasarla; sonra diğerleri.
```

## C. Hoca paneli ve kumandası
```
Hoca arayüzünü tasarla. Masaüstü (1280 px+) panel + telefon kumandası.

PANEL (masaüstü, üstte sabit başlık: ZE logo + "ZAPEDU Panel" (Panel yazısı gümüş gradyan), sürüm, ❓ Rehber, 👥 Hocalar (yalnızca sahibe), e-posta, 🔑 Şifre, Çıkış):
1. Giriş: iki sekme (Şifreyle / E-posta bağlantısı), e-posta + şifre, "Giriş yap".
2. Ana sayfa (Derslerim): dönem seçici (2026-2027 Güz); dönemdeki ders kartları (her kartın kendi vurgu gradyanı), kartın içinde şubeler (A, B, C...)
   ve her şubede "▶ Başlat: 3. hafta" ya da "▶ Devam (3. hafta)" düğmesi, öğrenci sayısı. Altta katlanır "+ Yeni ders ekle", "Yeni dönem planla", "📥 Şube yedeğini geri yükle".
3. Ders sayfası, sekmeler: Akışlar | Sınıf listesi | Yoklama raporu | Quiz | 📊 Dönem özeti | Gelişim | Yoklama haftaları. Altta "💾 Şubeyi yedekle", "Bu şubeyi sil", "Dersi tamamen sil".
   Dönem özeti: şampiyonlar podyumu, devam grafiği, hafta hafta birinciler, "Excel'e aktar".
4. Akış düzenleme: akış adı (büyük düzenlenebilir), "👁 Önizle" düğmesi, kart listesi (her kart: onay kutusu, sıra no, küçük görsel/etiket (SLAYT, SORU, KELİME BULUTU,
   BEYİN FIRTINASI, AÇIK UÇLU, OYLAMA, VİDEO, FOTOĞRAF, OYUN, YOKLAMA), başlık, "✏️ Düzenle", "+ Ekle", ↑ ↓ ✕), sürükle-bırak sıralama,
   seçilince beliren üst çubuk ("3 kart seçili | Hangi haftanın akışına? | Kopyala | Taşı | 🗑 Seçilenleri sil"), katlanır "+ Adım ekle"
   (PDF sürükle bırak, kayıtlı sunumdan ekle, soru paketi ekle, etkinlik kartları: Açık uçlu, Kelime bulutu, Beyin fırtınası, Şeytanın avukatı, Video, Fotoğraf, Oyun).
5. Akış önizleme: perde ve öğrenci telefonu yan yana canlı simülasyon, üstte "Perde | Telefon | İkisi" geçişi, "Ders gibi dene" etkileşimli mod.
6. Yoklama listesi (oturum detayı): sayaç (24 / 38), filtre (Hepsi/Gelenler/Gelmeyenler), öğrenci satırları ("Var/Yok" düğmesi, saat, "(elle)"), Excel'e aktar.
7. Hocalar (sahibe özel): davet formu (e-posta + ad), kayıtlı hocalar listesi (sahip rozeti, "henüz giriş yapmadı", şube sayısı, Çıkar, davet metnini kopyala).

KUMANDA (telefon, hoca dersi yürütürken; tek elle kullanım, büyük dokunma hedefleri):
- Üstte ders adı ve oturum adı; altında "Adım 7 / 28 · slayt görseli" önizlemesi.
- Büyük ◀ ▶ düğmeleri (adım geçişi), slayt notu kartı (hoca notu).
- Soru adımında: "Soruyu aç", "Sonucu göster", cevap sayacı, süre uzat (+15 sn).
- Açık uçlu/beyin fırtınası adımında: gelen cevaplar listesi, "Perdeye yansıt", gizle.
- Hızlı eylem satırı: 🎮 Oyun / Zapoot başlat (oyun modu çipleri + paket listesi), 📝 Quiz başlat (paket + süre), ↩ Derse dön, ⏹ Quizi bitir.
- Sınıf paneli: "Anlamadım" sayacı, el kaldıranlar.
- Telefon modu anahtarı (projeksiyon yoksa), ders kodu (büyük, kopyalanabilir), "Dersi bitir".
```

## D. Perde / sahne (projeksiyon, 1920x1080)
```
Perde (sahne) ekranlarını tasarla. 16:9, projeksiyonda arka sıradan okunmalı: ana metin en az 40 px, sayaçlar ve QR çok büyük, kontrast yüksek.
Sağ üstte yarı saydam, fareyle belirginleşen hoca araç çubuğu (akış seçici, ◀ 5/28 ▶, 🎮 Zapoot, 📝 Quiz, 🏆, 📱, ⋯ menüsü, ⏹ Bitir).

Ekranlar:
1. Yoklama ekranı: solda dev QR (beyaz kutuda, glow), altında 6 saniyelik geri sayım çubuğu ve "Ders kodu 482 913" şeridi; sağda "Katılan" büyük sayı
   (örn. 24, "/ 38" isteğe bağlı), ilerleme çubuğu ve gelen öğrencilerin kısa adları (Ali Y.) pop animasyonuyla çip olarak. Başlık: ders + şube.
   Üstte "▶ Derse geç: 3. Hafta" büyük düğme. Yoklama kapalı hali: "Yoklama kapandı · 24 öğrenci derse katıldı" + yalnızca ders kodu.
2. Slayt ekranı: slayt tam ekran (siyah zemin), köşelerde ‹ › okları, sol altta "5 / 28", sağ altta küçük katılan sayısı + ders kodu şeridi.
   Yoklama açıksa ortada karekod kartı (QR + kod + katılan sayısı + "Yoklamayı kapat" / "Karekodu gizle").
3. Soru sahnesi (Zapoot tarzı): üstte soru (büyük), dört renkli şık kartı (şekil + harf), kalan süre halkası (son 5 sn kırmızıya ve titreşime döner),
   cevap sayacı "18 / 24 cevapladı". Sonuç hali: doğru şık parlar, yanlışlar söner, her şıkta cevap dağılımı çubuğu, sağda ilk 5 sıralama (puanlar).
4. Etkinlik sahneleri: (a) kelime bulutu (sözcükler çoklukla büyür, canlı), (b) beyin fırtınası kartları (post-it duvarı), (c) açık uçlu soru: süre bitene kadar
   "cevaplar toplanıyor" + "📣 Cevapları yansıt" sonrası kartlar, (d) şeytanın avukatı: iki taraflı dev oy çubuğu + gerekçe akışı, (e) video, (f) fotoğraf.
5. Oyun sahneleri (her biri ayrı bir görsel dünya; canlı skor ve ilerleme): Zombi Kaçışı (öğrenciler karakter, zombiler yaklaşır), Roket Yarışı (dikey pist),
   Ejderha Savaşı (ejderha can çubuğu), Arena (takım savaşı), Kule (takımlar kule yükseltir), Halat çekme (iki takım), Hocayla yarış (Hoca 4 - 7 Sınıf),
   Bilgi merdiveni (basamaklar). Hepsinde kazanma/kaybetme animasyonu ve sonuç ekranı.
6. Puan tablosu ve ders kapanışı: "⭐ Bugünün yıldızları" podyumu (ilk üç), konfeti, "Ders bitti" kartı, Yoklama listesi / Ana sayfa düğmeleri.
7. Telefon kumandası karekodu (yalnızca hocaya, öğrenciye gösterilmez uyarısıyla), Rehber (ders günü kontrol listesi), oyun provası.

Önce 1, 2 ve 3'ü tasarla; bu üçü her derste kullanılır.
```

## E. Tasarımı bana verirken
- Gemini'nin ürettiği HTML dosyalarını (ya da ekran görüntülerini) bir klasöre koy ve yolunu söyle.
- Ben ekran ekran uygularım: önce renk, tipografi ve bileşen sınıflarını (`src/index.css`) güncellerim, sonra her ekranı mevcut işlevi bozmadan yeniden giydiririm; her ekranı yayına almadan önce senden onay alırım.
- Mevcut renk ve bileşen adları: `cam-panel`, `parlak-buton`, `ikincil-buton`, `tehlike-buton`, `renkli-yazi`, `gumus-yazi`, `giris-kutusu` (hepsi `src/index.css` içinde).
