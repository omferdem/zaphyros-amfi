# Sürüm Geçmişi

## v0.65.1 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Zirveye Tırmanış (bilgi merdiveninin yeni hâli, GSAP ile):** karlı dağ, zirveye kıvrılan patika, patikada kamplar (5, 10, ... bayraklı güvenli çadır). Sınıf bir tırmanış ekibi: doğru bilince patika boyunca yürüyerek bir kamp çıkar, bilemeyince çığ düşer ve ekip son güvenli kampa kayar. Yükseldikçe hava kararır, kar artar; ekip boşta nefes alır. Her sonuçta "Sınıfın %72'si bildi" etiketi. Zirvede bayrak ve konfeti. İlk 10 saniye "Nasıl oynanır" ekranı.
- **Jokerler tırmanış eşyası:** ✂ Kestirme yol (yarı yarıya), 📻 Şerpaya sor (seyirci), 🫁 Oksijen +15 sn; kullanılınca sahnede kısa bir bildirim animasyonu çıkar.
- **Geçme eşiği %50'den %60'a** çıktı (soru sayısı kadar kamp). `gsap` bağımlılığı eklendi.
- Tarayıcıda yürüme ve çığ denendi; gerçek derste ve bot ile denenmedi. Kişi başına katkı ("ipi çeken") gösterimi yok, sunucudan öğrenci bazlı veri gerekir.

## v0.65.0 (16 Kasım 2026)
Veritabanı değişikliği yok. v0.65 oyun görevinin ilk parçası.
- **Olay odaklı güncelleme:** oyun sahnesi, oturum satırı değişince (soru açıldı, sonuç açıldı, adım değişti) veriyi hemen çeker ve 0,9 saniye sonra bir kez daha çeker; 3,5 saniyelik yoklama yedek olarak 6 saniyeye indi.
- **4,5 saniyelik geçişler geri alındı:** konum geçişleri 1,4 saniye ease-out (merdiven 1,8, halat 1,5, orman 1,6). Yeni hedef gelince önceki geçiş bitmiş oluyor.
- **"İlk sorunun sonucu açılınca başlar" kutusu kalktı:** veri gelene kadar perdede oyunun başlangıç sahnesi (derse katılanların karakterleri) durur.
- **Boşta yaşam:** öğrenci, kahraman, zombi ve roket görselleri her biri kendi hızında nefes alıp sallanır (hareketi azalt ayarına uyar).
- **Akış önizlemesi:** oyun kartı adımı artık oyunun sahnesini örnek oyuncularla oynatır (kutunun içinde).
- **Metinler:** kule başlığı "Hedef: N blok", merdiven kutusu 3 jokeri doğru anlatır.
- **Otomatik geçiş:** oyunlarda sayaç 10 saniye (sonuç koreografisi bitince başlasın diye).
- Bu parça canlı derste ve bot ile denenmedi; GSAP, bot aracı, Zirveye Tırmanış, kule şantiyesi ve yeni görseller sonraki parçalarda.

## v0.64.31 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Sonraki soruya kendiliğinden geçiş:** Zapoot ve oyunlarda süre bitip sonuç açılınca 6 saniye (ilk 5 tablosu varsa 10 saniye) sonra sonraki soruya geçilir; çubukta geri sayım ve "Durdur" düğmesi var. Son sorudan sonra geçilmez, hoca "Bitir" ile podyumu açar. "⋯" menüsünde "Sonraki soruya kendiliğinden geç" anahtarı (varsayılan açık). Normal ders akışındaki sorular kendiliğinden ilerlemez.
- **İlk 5 ara tablosu** her soruda değil, 3 soruda bir (3., 6., 9. ...) gösterilir; son soruda finalin podyumu vardır, tam sıralama "Tümünü göster" ile.
- Bu sürüm canlı derste denenmedi (süreler gerçek derste ayarlanacak).

## v0.64.30 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Kule yarışı grafiği:** bloklar eskiden esneyip ince çizgilere ezilirdi; artık kule alanı sabit yükseklikte ve her blok hedef kata göre hesaplanan sabit bir dilimde durur (1 ya da 18 kat fark etmez). Takım adı etiketi koyu bir hapın içinde, zemin resminin üstünde okunur; taç kulenin tepesinde durur. 30 oyuncu ve 4 takımla tarayıcıda 1280x720 denendi.

## v0.64.29 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Oyuna girince gerçek sahne:** akıştaki oyun kartı ve oyun başladıktan sonra ilk soru açılana kadar perdede artık oyunun kendi sahnesi görünür (ejderha, oyuncular, halat, orman vb.). Kartta örnek oyuncularla (derse katılanların adlarıyla) kendi kendine oynar; başladıktan sonra gerçek katılımcılar başlangıç konumunda durur. Eskiden tek bir emoji görünüyordu. Halat, merdiven ve hocayla yarış da artık oyun sırasında kilitli sahnede.
- **Bilgi merdiveni:** rakam dizisi yerine dikey merdiven: direkler, basamaklar, altın renkli güvenli basamaklar (🛡), sınıfın tırmanıcısı ve "Nasıl oynanır?" kutusu.
- **Oyunlar sihirbazı:** her oyunda aynı "Nasıl oynansın?" satırı (Bireysel / Takım; oyunun desteklemediği seçenek soluk, takımsa takım sayısı, halat 2 takım, ejderha/merdiven/hocayla yarış "sınıf birlikte").
- **Hareket:** zombi, roket, kule, kale, halat, orman ve merdiven konum geçişleri 4,5 saniyeye ve daha yumuşak bir eğriye çıkarıldı; adım adım zıplama azaldı. Tarayıcıda gerçek derste ayarlanacak.

## v0.64.28 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 13. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-13-yeni.sql`, SQL ile uygulandı). Bahar dönemi 1-13. haftaların yeni soruları tamamlandı.
- **Bahar 13. hafta soruları:** "Dinî Çoğulculuk, Kapsayıcılık ve Dışlayıcılık" sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-13.txt`.
- Eski paketler ("Hızlı Zapoot", "Ciddi Quiz", 14. hafta dahil) silinmedi; yeni paketler "(yeni, ...)" adıyla yanlarında durur.

## v0.64.27 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 12. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-12-yeni.sql`, SQL ile uygulandı).
- **Bahar 12. hafta soruları:** "Din, Bilim, Ahlak ve Sanat İlişkisi" sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-12.txt`.

## v0.64.26 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 11. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-11-yeni.sql`, SQL ile uygulandı).
- **Bahar 11. hafta soruları:** "Ölüm ve Sonrası" sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-11.txt`.

## v0.64.25 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 10. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-10-yeni.sql`, SQL ile uygulandı).
- **Bahar 10. hafta soruları:** "Ateizm" sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-10.txt`.

## v0.64.24 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 9. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-09-yeni.sql`, SQL ile uygulandı).
- **Bahar 9. hafta soruları:** "Tanrı Tasavvurları" (deizm, panteizm, pan-enteizm) sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-09.txt`.

## v0.64.23 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 8. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-08-yeni.sql`, SQL ile uygulandı).
- **Bahar 8. hafta soruları:** "Kötülük Problemi ve İnsan Hürriyeti" sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-08.txt`.

## v0.64.22 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 7. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-07-yeni.sql`, SQL ile uygulandı).
- **Bahar 7. hafta soruları:** "Konatif, Eskatolojik ve Analitik Tahliller" (din dili) sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-07.txt`.

## v0.64.21 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 6. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-06-yeni.sql`, SQL ile uygulandı).
- **Bahar 6. hafta soruları:** "Doğrulamacı ve Yanlışlamacı Tahliller" (Tanrı'nın sıfatları, din dili) sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-06.txt`.

## v0.64.20 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 5. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-05-yeni.sql`, SQL ile uygulandı).
- **Bahar 5. hafta soruları:** "Dinî Tecrübe ve Ahlak Delilleri" sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-05.txt`.

## v0.64.19 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 4. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-04-yeni.sql`, SQL ile uygulandı).
- **Bahar 4. hafta soruları:** "Nizam ve Gaye Delili" sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-04.txt`.

## v0.64.18 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 3. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-03-yeni.sql`, SQL ile uygulandı).
- **Bahar 3. hafta soruları:** "Tanrı'nın Varlığı ile İlgili Deliller" (ontolojik ve kozmolojik delil) sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-03.txt`.

## v0.64.17 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 2. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-02-yeni.sql`, SQL ile uygulandı).
- **Bahar 2. hafta soruları:** "Akıl ve İnanç İlişkisi" sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-02.txt`.

## v0.64.16 (16 Kasım 2026)
Şema değişikliği yok. Bahar dönemi (Din Felsefesi 2) 1. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-2-hafta-01-yeni.sql`, SQL ile uygulandı).
- **Bahar 1. hafta soruları:** "Din Felsefesi ve İlgili Alanlar" sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti. Kaynak: `docs/soru-onerileri/yeni/bahar-01.txt`.

## v0.64.15 (16 Kasım 2026)
Şema değişikliği yok. 13 ve 14. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-1-hafta-13-14-yeni.sql`, SQL ile uygulandı). Din Felsefesi I'in 14 haftası tamamlandı.
- **13-14. hafta soruları:** "Din ile Felsefenin Diğer Münasebetleri" sunumundan gayeler, ortak sorular, ayrılan yönler, meşruiyet (13. hafta) ile Kindi, Farabi, İbn Rüşd ve karşı çıkanlar (14. hafta); Zapoot 20+20, Quiz 15+15; denetimden 0 hata ile geçti.

## v0.64.14 (16 Kasım 2026)
Şema değişikliği yok. 11 ve 12. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-1-hafta-11-12-yeni.sql`, SQL ile uygulandı).
- **11-12. hafta soruları:** "Bilgi Meselesi" sunumundan kavramlar, bilgi teorileri ve bilginin kaynakları (11. hafta) ile bilginin değeri (12. hafta); Zapoot 20+20, Quiz 15+15; denetimden 0 hata ile geçti.

## v0.64.13 (16 Kasım 2026)
Şema değişikliği yok. 9 ve 10. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-1-hafta-9-10-yeni.sql`, SQL ile uygulandı).
- **9-10. hafta soruları:** "Değer Meselesi" sunumundan ahlâk (9. hafta) ve estetik ile din-sanat (10. hafta); Zapoot 20+20, Quiz 15+15, denetimden 0 hata ile geçti. Eski bankada birebir aynı metni olan iki soru, metni değiştirilerek eklendi.

## v0.64.12 (16 Kasım 2026)
Şema değişikliği yok. 8. hafta yeni soruları eklendi (`supabase/data/din-felsefesi-1-hafta-8-yeni.sql`, SQL ile uygulandı).
- **8. hafta soruları:** "Ruhun Varlığı Meselesi" sunumundan Zapoot 20, Quiz 15; denetimden 0 hata ile geçti.

## v0.64.11 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Akışkan hareket:** oyunlarda adımlar "tak tak" sıçramak yerine iki soru arasını dolduracak biçimde akar. Orman'da karakterler patikanın eğrilerini izleyerek kare kare yürür (yürüme sallanmasıyla); zombi, roket, kule ve kale geçişleri 1 sn yerine yaklaşık 3 sn ve yumuşak başlayıp biten eğriyle sürer; halat kayması ve kale askerlerinin yürüyüşü uzatıldı. Ortak yardımcı: `src/lib/akiskan.ts`.

## v0.64.10 (16 Kasım 2026)
Şema değişikliği yok. 6 ve 7. hafta yeni soruları eklendi (SQL ile uygulandı: `supabase/data/din-felsefesi-1-hafta-6-7-yeni.sql`).
- **6-7. hafta soruları:** "Âlem ve Felsefe" sunumundan Zapoot 20+20, Quiz 15+15; `soru-kontrol.py --yeni` denetiminden 0 hata ile geçti.

## v0.64.9 (16 Kasım 2026)
Şema değişikliği yok. 3, 4 ve 5. hafta yeni soruları `supabase/data/din-felsefesi-1-hafta-*-yeni.sql` ile eklendi (SQL ile uygulandı).
- **4-5. hafta soruları:** "Tanrı ve Felsefe" sunumundan Zapoot 20+20, Quiz 15+15; `soru-kontrol.py --yeni` denetiminden 0 hata ile geçti. 3. hafta (35 soru) veritabanına eklendi.

## v0.64.8 (16 Kasım 2026)
Veritabanı değişikliği yok (3. hafta soruları onay bekler).
- **3. hafta soru taslağı:** Zapoot 20 + Quiz 15, kaynak 1-3. hafta sunumunun son bölümü ve Din-Felsefe Münasebeti kitabı (kavramlar, gayeler, sorular, realitelere yöneliş). `docs/soru-onerileri/yeni/h03.txt`, döküm `h03-dokum.md`; `soru-kontrol.py --yeni` denetiminden 0 hata, 0 uyarı ile geçti.

## v0.64.7 (16 Kasım 2026)
Şema değişikliği yok. 1. ve 2. hafta yeni soruları kullanıcı onayıyla `supabase/data/din-felsefesi-1-hafta-1-2-yeni.sql` ile eklendi (SQL ile uygulandı).
- **Soru deposu (3):** eski 560 soruluk dosya uygulanmadı, uyarı notu eklendi. 1. ve 2. hafta Zapoot (20+20) ve Quiz (15+15) soruları yeniden yazıldı: `docs/soru-onerileri/yeni/h01-h02.txt`, okunaklı döküm `docs/soru-onerileri/yeni/h01-h02-dokum.md`. Ayrı paketler olarak eklendi ("N. hafta: Zapoot (yeni, 20 soru)" ve "N. hafta: Quiz (yeni, 15 soru)"); eski paketlere dokunulmadı, istenirse eskileri Soru bankasından silinebilir.
- `scripts/soru-kontrol.py --yeni`: soru sayısı, doğru şık konumu dengesi, doğru şıkkın en uzun/en kısa oranı, mutlak ya da ele veren çeldirici, boşluk doldurma kalıbı, slayt cümlesini kopyalama (`--slayt`) ve tekrar denetimi; `--yaz` okunaklı döküm üretir.

## v0.64.6 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Hocayla yarış büyük sahne ve final (2e):** iki rakip, büyük skor, sonuç açılınca yumruk animasyonu; yarış bitince "Sınıf hocayı yendi!" / "Hoca bu sefer kazandı" / "Berabere" ve sınıfa en çok katkı veren 5 öğrenci. Perdedeki küçük skor kutusuna ⛶ düğmesi eklendi. Daha önce final ekranı yalnızca provada taslak olarak vardı, gerçek bileşende yoktu; şimdi ikisi aynı bileşeni kullanır. Provada 30 ve 80 oyuncuyla denendi.

## v0.64.5 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Kale haritası görünümü (2d):** toprak dokulu üç halka (çim, toprak, kaya), her dolu hücrede takım renginde çadır, dalgalanan bayrak ve asker, hücre sahibinin adı; ortada hendekli, surlu, dört kuleli ayrıntılı kale (kuşatan takımın bayrağı çekilir). Durum paneli küçüldü, harita genişledi. Kale görseli dosyası olmadığı için kale SVG ile çizildi.
- **Oyun provası telefonda:** denetim çubuğu telefonda kapalı başlar (sağ altta küçük düğme), açılınca ekranın en çok %38'ini kaplar ve kaydırılır; sahne her zaman görünür kalır.

## v0.64.4 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Orman'dan eve dönüş yeniden çizildi (2b):** katmanlı gece ormanı (ay, yıldız, üç derinlikte çam, sis, dere ve köprü, toprak patika, pencereleri yanan ev); karakterler öteki oyunlardaki öğrenci çizimleri; aynı adımdaki oyuncular patikanın iki yanına yelpaze gibi açılır, 4'ten fazlası "+N" rozetinde toplanır; yakalanan öğrenci kurt atlayınca sarsılıp sağ alttaki "Kurdun yakaladıkları" alanına çekilir; eve varanlar evin önünde toplanır; her karakterin tepesinde enerji barı. 30 ve 80 oyuncuyla provada denendi.

## v0.64.3 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Enerji barı karakterin tepesinde (2a):** zombi, roket, ejderha ve arenada her karakterin üstünde ince enerji barı; sonuç açılınca +1/−1 ve seri 🔥'u karakterin üstünden çıkar. 40+ oyuncuda bar incelir ama kaybolmaz. Eski ayrı "⚡ Enerji" listesi kaldırıldı. (Halat v0.64.1'de, orman bir sonraki sürümde.)
- 80 oyuncuda ejderha ve arena karakterleri kaydırmasız tek ekrana sığar (boyut ve boşluk küçüldü, arenada kalpler sayıya döner).

## v0.64.2 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Bankadan tek tek soru seçimi:** Zapoot/Oyun sihirbazında, hoca panelindeki "Yeni quiz" formunda ve sahnedeki quiz seçicide "✋ Soruları tek tek seç" eklendi: paket paket listelenir, aramayla bulunur, işaretlenen sorular (bankadaki sırasıyla) kullanılır. Elle seçim yapılmazsa eski otomatik çekim aynen sürer.

## v0.64.1 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Halat çekme tam ekran sahne (2c):** perdede yalnızca halat ve iki takım; her öğrenci adı ve enerji barıyla halatın üstünde. Cevap beklenirken karakterler zorlanır, halat titrer; sonuç açılınca halat yay gibi kayar, toz kalkar, yanlış yapan öne tökezler, kaybeden takım çamura düşer. +1/−1 ve 🔥 karakterin üstünden çıkar. Soru perdede görünmez. Prova 30 ve 80 oyuncuyla ve final ekranıyla denendi.

## v0.64.0 (16 Kasım 2026)
- **Slayt başlıkları (1a):** PDF'ten gelen "preencoded.png", "image.png", "Resim 3" gibi görsel adı satırları ayıklanır; başlık ilk anlamlı satırdır, yoksa "Slayt N". Akış düzenleyici, perde, telefon metni, ekran görüntüsü kartı ve önizlemeler aynı temizleyiciyi kullanır. Var olan sunumlar tek seferlik SQL ile düzeltildi (28 sunum, 333 sayfa).
- **Zombi kaçışı kuralı (1b):** oyun sonunda sınıfın %60'ı yakalanmadan kalırsa sınıf kurtulur; perdedeki bütün yazılar ve ilerleme çubuğu bu kurala uydu.
- **Takım sayısı 10'a çıktı (1c, 0046_takim_on.sql, SQL ile uygulandı):** 10 renk, sihirbaz ve takım ayarında 2-10 seçeneği, lobi ve kale haritası 10 takımla.
- **Prova çubuğu (1d):** "▾ Küçült" ile tek tıkla küçük bir düğmeye iner, sahne tamamen görünür.

## v0.63.0 (16 Kasım 2026)
- **Ekran görüntüsü düğmesi hocanın elinde (0045_ekran_goruntusu_kumanda_notu.sql, SQL ile uygulandı):** perdedeki "⋯" menüsünde "Ekran görüntüsü: açık/kapalı"; kapalıyken öğrenci telefonunda düğme görünmez (varsayılan açık).
- **Kumandadan hızlı not:** telefon kumandasının Ders sekmesinde "Hızlı not" kutusu; not şubenin not defterine yeni kart olarak eklenir (kumanda anahtarıyla, hoca girişi gerekmeden; `kumanda_not_ekle`).
- Prompt'tan açıkta kalan madde kalmadı.

## v0.62.1 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Kale kuşatması animasyonları:** her soruda yeni alınan hücreye asker evinden koşar, bayrak diker; ele geçirmede 💥 çarpışma; mancınık taşları 🪨 kaleye düşer. Tarayıcıda çalıştığı görüldü.
- **Hocayla yarış:** skor sayıları sonuç açılınca döner, hoca ya da sınıf puan alınca 🥊 darbesi vurur. (Boks animasyonu tarayıcıda denenmedi.)
- Prompt'taki iş listesi bununla tamamlandı; açık kalanlar: enerji ve hızlı bonus gerçek derste ayarlanacak, kumandadan not yazma, hoca ayarından ekran görüntüsü düğmesini kapatma.

## v0.62.0 (16 Kasım 2026)
- **Hızlı doğru ve "cevap verdi" (0044_hizli_cevap.sql, SQL ile uygulandı):** `zombi_goster` her oyuncu için `hizli` (doğru ve sürenin ilk üçte birinde cevaplandı) ve `cevapladi` (açık soruda cevap verdi, doğruluğu sızdırmaz) alanlarını da döndürür; eski alanlar aynen durur.
- **Roket:** hızlı doğru +1 ek itki (soru başına en çok 1).
- **Enerji:** hızlı doğru +5 ek enerji; enerji şeridinde cevap veren oyuncunun karakteri parlar ve ✋ rozeti çıkar (doğruluk sızmaz). Birim testli.

## v0.61.2 (16 Kasım 2026)
Veritabanı değişikliği yok.
- **Enerji barı büyük oyun sahnelerinde:** zombi, roket, ejderha, arena ve orman sahnesi açıkken sol altta "⚡ Enerji" düğmesi; açılınca her oyuncunun 0-100 enerji barı (düşük enerjili soluk ve kırmızımsı, sonuç açılınca +1/−1 ve 🔥) görünür. Sahnelerin kendi düzenine dokunulmaz.
- Henüz yok: "cevap verdi" hareketi ve hızlı doğruya itki/enerji bonusu (sunucudan cevap süresi ve soru başına kimin cevapladığı bilgisi gerekir).

## v0.61.1 (15 Kasım 2026)
- **Kumandadan Orman:** telefon kumandasındaki oyun listesinde "Orman'dan eve dönüş" seçilip başlatılabilir (0043_kumanda_orman.sql, SQL ile uygulandı; yalnızca kumanda isteğinin mod listesi genişledi).

## v0.61.0 (15 Kasım 2026)
- **Bilgi merdiveni jokerleri (0042_soru_jokerleri.sql, SQL ile uygulandı):** hoca açık soruda, perdeden ya da kumandadan, turda birer kez kullanır: **✂ Yarı yarıya** (telefonlarda 2 yanlış şık silinir, doğru şık asla), **👥 Seyirci** (ilk 10 saniyedeki cevapların şık dağılımı perdede çubuk grafik), **⏱ +15 sn** (soru başlangıcı 15 saniye ileri alınır; telefon, perde ve cevap kabulü aynı süreyi kullanır). `ozel.durum` telefonlara `elenen` alanını verir.
- Not: mevcut "kurtarma" jokeri (yanlışta basamağı koruma) olduğu gibi duruyor.

## v0.60.0 (15 Kasım 2026)
Veritabanı değişikliği yok.
- **Orman'dan eve dönüş (yeni oyun):** Oyunlar sihirbazında bireysel oyun olarak seçilir. Sol alttan sağ üstteki eve kıvrılan patika (köprü, dere, ağaçlar); her öğrenci adıyla patikada yürür, her doğru 1 adım, yanlış ya da cevapsız 1 kalp götürür (3 kalp). Kalbi biten kurda yakalanır (pati izi ve toz bulutu, korkutucu görüntü yok); üst üste 3 doğru fener bulup kalp kazandırır; kalbi 1'e düşen olunca çalıların arasında kurt gözleri parlar; sorular ilerledikçe gökyüzü kararır. Eve varanlar evin yanında toplanır, ev ışıklarını yakar; final podyumu varış sırasına göredir. Oyun provasında da var. Çizim tarayıcıda denendi.
- Kale kuşatması açıklaması hücre haritası kuralına göre güncellendi.
- Sınır: telefon kumandasındaki "oyun başlat" listesi henüz Orman'ı içermiyor (kumanda isteği veritabanında oyun adlarını denetliyor, yeni migration gerekir); perdeden başlatılır.

## v0.59.1 (15 Kasım 2026)
Veritabanı değişikliği yok.
- **Telefonda final ekranı:** perdede final açılınca öğrencinin telefonunda kendi sırası, puanı, doğru sayısı ve en iyi serisi görünür (herkese açık Broadcast kanalı, HTTP ile; telefon sonucunu `benim_sonucum` RPC'siyle kendisi çeker). Perdede final kapanınca telefonda da kapanır.
- **Kumandadan emoji tepkileri:** kumandanın Ayarlar sekmesinde "Emoji tepkileri: Aç / Kapat"; perde bu komutu her zaman dinler, kapalıyken gelen emojiler yok sayılır.

## v0.59.0 (15 Kasım 2026)
- **Lobi:** bireysel modda yoklamadan gelen katılımcıların adları balonlarda görünür (adı henüz görünmeyen bağlı telefonlar silik balon olarak kalır).
- **Oyun provası** artık kale, halat, merdiven ve hocayla yarışı da içerir (kule yeni blok kuralıyla); 5/30/80 oyuncu ve %30/60/90 başarı seçenekleri bunlarda da çalışır.
- **Roket finali:** bitişe varanlar uzaya fırlar, podyumdakiler gezegenlere iner, "Tümünü göster" tam sıralamayı açar. Motor arızalı roketin yanında 💨 görünür.
- **Kale kuşatması hücre haritası (0041_takim_oyuncu_sonuclari.sql, SQL ile uygulandı):** ortada kale, 3 halkada 12'şer hücre; her öğrenci 2 doğruda 1 hücre alır (önce boş, dıştan içe, kendi toprağına komşu), boş komşu kalmayınca rakip hücresi ele geçirilir (sahibi o soruda doğru bildiyse alınamaz). İç halkayı tamamen tutan kaleyi kuşatır; soru bitince iç halkada en çok hücresi olan kazanır. Kurallar birim testli, harita tarayıcıda çizildi.
- Henüz yok: kale hücresine asker koşusu ve mancınık animasyonu.

## v0.58.2 (15 Kasım 2026)
- **Kumandadan soru sayısı (0040_kumanda_soru_sayisi.sql, SQL ile uygulandı):** telefondan Zapoot ya da quiz başlatırken "Kaç soru?" seçilir (10/20/30/40, varsayılan 20); perde pakette bu kadar soruyu karışık çeker, quiz süresi soru başına 1 dakika önerilir.
- Mevcut bütün Zapoot sorularının süresi 20 saniyeye çekildi (veri güncellemesi; soru bazında değiştirilebilir).

## v0.58.1 (15 Kasım 2026)
Geri bildirim düzeltmeleri ve soru deposu.
- **Soru sayısı sorulur:** Zapoot, Oyunlar ve Quiz başlarken kaç soru oynanacağı seçilir (varsayılan 20; 10/20/30/40/hepsi). Seçilen paketlerden karışık çekilir, ama oynanma sırası paketin özgün sırasıdır; her turda havuzdan farklı sorular gelir, son iki turda sorulanlar sona kalır. Quizde de soru sayısı seçilir; süre soru başına 1 dakika olarak önerilir (değiştirilebilir).
- **Akıştaki oyun kartı (merdiven, halat vb.):** "Oyunu başlat" artık paket ve soru sayısı seçtirip lobiyi açar, sorular oyunla birlikte gelir (eskiden yalnızca modu açıyor, sorulara geçmiyordu).
- **Hoca karakteri** adres çubuğunun üstünü kapatmıyor: sağ altta yukarı alındı, kalpler oraya uçuyor.
- **Soru deposu:** Din Felsefesi I'in 14 haftalık her Zapoot ve Quiz paketine 20'şer yeni soru (toplam 560) hazırlandı: `supabase/data/din-felsefesi-1-ek-sorular.sql` (aynı soru metni varsa atlar). Her soruda konu, zorluk (yaklaşık %40 kolay, %40 orta, %20 zor; Bloom düzeyi ve metin uzunluğuna göre atanmıştır) ve Bloom etiketi var. Zapoot soruları 20, quiz soruları 60 saniye. ZOMR dosyaları `docs/soru-onerileri/zomr/`, kaynak taslaklar `docs/soru-onerileri/kaynak/`, denetim `scripts/soru-kontrol.py`.

## v0.58.0 (15 Kasım 2026)
Faz 8 (kısmi): soru deposu hazırlığı. Veritabanına soru EKLENMEDİ.
- **Soru dosyası hazırlandı, onay bekliyor:** `docs/soru-onerileri/din-felsefesi-1-ek-zapoot-sorulari.txt` (ZOMR biçimi). Din Felsefesi I içindeki 14 haftanın her Zapoot paketi için 6-7 yeni soru (toplam 86), kaynak olarak yalnızca o haftanın slayt metinleri; her soruda `#KONU`, `#ZORLUK` (kolay/orta/zor), `#BLOOM` ve `#PAKET` etiketi var. Paket adları mevcut paketlerle aynı olduğundan içe aktarılınca onlara eklenir (adlardaki "20 kısa soru" ifadesi bu durumda eski sayıyı gösterir).
- **Soru seçim ekranı:** Zapoot ve Oyunlar sihirbazında "Karışık / Kolaydan zora" seçeneği (zorluk etiketine göre; etiketsiz sorular ortada kalır).

## v0.57.0 (15 Kasım 2026)
Faz 7: öğrenci ekran görüntüsü ve perde notu. Veritabanı değişikliği yok.
- **📸 Ekran görüntüsü (telefon):** slayt ekranında düğme; kart tamamen telefonda bir canvas üzerinde çizilir (ders adı, hafta, slayt numarası, slaytın bütün metni, telefon modunda zaten inmiş görsel), metin uzadıkça kart aşağı uzar, hiçbir satır kesilmez. Sunucuya hiçbir istek gitmez. Paylaşım menüsü (Web Share) destekleniyorsa o açılır, yoksa PNG iner; dosya adı `DersAdi_Hafta3_Slayt12.png`. Satır bölme birim testli.
- **📓 Not (perde):** araç çubuğunda düğme; yazdıkça şubenin not defterine yeni bir kart olarak kendiliğinden kaydedilir (tarih, ders ve hafta başlığıyla). "Perdeyi karart" seçeneği projeksiyonu karartır, not kutusu görünür kalır; telefonlardaki ders görüntüsü değişmez.
- Yapılmayanlar: hoca ders ayarından ekran görüntüsü düğmesini kapatma; kumandadan not yazma (kumanda hoca girişi olmadan anahtarla çalışıyor, not tablosu hoca oturumu istiyor); projeksiyon modunda slayt görselini bu düğme için indirme (veri tasarrufu kararına uyularak yalnızca metin kartı çiziliyor).

## v0.56.0 (15 Kasım 2026)
Faz 6: tahta, lazer ve kalem. Veritabanı değişikliği yok.
- **🖍️ Tahta:** perdede boş kara ya da beyaz tahta; kalem renkleri (beyaz, sarı, kırmızı, mavi, yeşil), 3 kalınlık, silgi, geri al, temizle. Fare, dokunmatik ve kalem (pointer events). Tarayıcıda çizim denendi.
- **🔴 Lazer** (düğme ya da `L` tuşu): slaytın üstünde kırmızı parlayan nokta; basılı tutunca seçili kalemle çizer. Çizimler slayta bağlıdır (slayt değişip geri gelince görünür), ders bitince silinir; veritabanına yazılmaz, bellekte ve sekmenin sessionStorage'ında durur.
- **Kumanda:** telefon kumandasının Ders sekmesinde dokunmatik yüzey; parmak hareketi perdedeki lazeri oynatır, basılı tutunca çizer (Broadcast, HTTP ile, saniyede en çok 20 mesaj). Kullanılınca perdede lazer kendiliğinden açılır.
- Bilinen sınır: lazer kanalı oturum numarasıyla adlandırılır, kumanda anahtarı denetlenmez (kanalı bilen biri lazer oynatabilir; veri sızmaz). Çizim tüm ekrana normalleştirilir, perde farklı boyuta gelirse konumlar orantılı kalır.

## v0.55.0 (15 Kasım 2026)
Faz 5: emoji tepkileri. Veritabanı değişikliği yok.
- Öğrenci telefonunda ders sırasında 👍 😂 😮 🤔 👏 ❤️ şeridi (soru açıkken görünmez). 3 saniyede en çok 1 emoji (telefonda ve perdede ayrı ayrı uygulanır).
- Emojiler Realtime Broadcast ile HTTP üzerinden gönderilir (öğrenci kanala abone olmaz, mesaj öğrencilere yayılmaz); kanalı yalnızca perde dinler, veritabanına bir şey yazılmaz. Canlı projede HTTP gönderimi denendi (202).
- Perdede emojiler alttan yukarı kıvrımlı yolda yükselip solar; aynı anda en çok 25 uçar, fazlası "×N" olarak birleşir. ❤️ sağ alttaki hoca karakterine uçar; hoca gülümser, 4 saniyede 3 kalp gelirse zıplar.
- Perde "⋯" menüsünde "Emoji tepkilerini kapat/aç" anahtarı; quiz paneli açıkken, lobide ve finalde kendiliğinden kapalı.
- Yapılmayan: kumandadan (telefondan) kapatma anahtarı; telefon şeridi tepkilerin kapalı olduğunu bilmez, kapalıyken gönderilenler perdede yok sayılır.

## v0.54.1 (15 Kasım 2026)
Faz 4'ün takım ve yarış kuralları.
- **0039_takim_soru_ozeti.sql (SQL ile uygulandı):** perdedeki turun her sorusu için takım başına doğru ve yanlış sayısı (halat ve kule için).
- **Halat:** konum P (−100..+100), her soruda ΔP = 35 × (G₂ − G₁), G = (doğru − 0,5 yanlış − 0,25 cevapsız) / üye; |P| ≥ 100 kazanır, sorular bitince halatı tutan kazanır. %80'e karşı %50 bilen 6-7 soruda kazanır (testli).
- **Kule:** her soruda doğru oranına göre 0-3 blok (%0-24: 0, %25-49: 1, %50-74: 2, %75+: 3), takımın yarısından fazlası bilmezse rüzgâr üst bloğu düşürür, hedef soru × 1,5 blok.
- **Roket:** bitiş soru × 0,7 doğru; yanlıştan sonraki ilk soruda motor arızası (ilerlemez, geri gitmez).
- **Hocayla yarış:** hoca cevap vermediği soruyu kaybeder; sınıf puanı için doğru oranı en az %60.
- Oyun açıklama metinleri yeni kurallara uyduruldu.
- Yapılmayanlar: kale hücre haritası, orman sahnesi ve oyun listesine eklenmesi, roket finali ve hızlı doğru itkisi, hocayla yarış animasyonları, merdiven kartının kendi soru seti ve jokerleri.

## v0.54.0 (15 Kasım 2026)
Faz 4 (kısmi): oyun kuralları ve sayısal hedefler. Veritabanı değişikliği yok.
- **Zombi kaçışı:** zirve = soru × %40 (3-12); öğrenci her 2 doğruda 1 kat çıkar, üst üste 3 yanlışta 1 kat kayar; zombiler zeminin 2 kat altından başlar, her 3 soruda 1 kat çıkar. Testle doğrulandı: 15, 20 ve 30 soruda %40 bilen yakalanır, %60 bilen kurtulur, %80 bilen zirveye çıkar. Not: istekteki "yarıdan sonra 2 soruda 1 kat" bu hedefleri bozuyordu (20 soruda %60 bilen de yakalanıyordu), bu yüzden hız sabit 3 soruda 1 kat tutuldu.
- **Son kalan arenası:** can soru sayısına bağlı (soru × %40, en az 2; 10 soruda 4 yanlışla elenilir). Herkes aynı soruda elenirse kimse diriltilmez, "Arenada kimse kalamadı" ve "Son düşen" yazar, kazanan ilan edilmez. Doğru oranı %50'nin altındaki oyuncu ayakta kalsa da kazanan sayılmaz.
- **Orman'dan eve dönüş:** kural kütüphanesi ve testleri (patika = soru × %0,6, 3 kalp, 3'lü seride fener, kurt, kararan gökyüzü). Sahne ve oyun listesine eklenmesi henüz yok.
- Yapılmayanlar: halat çekme yeni formülü, kule blok kuralı, kale hücre haritası, roket bitiş ve final, hocayla yarış animasyonları, merdiven kartının kendi soru seti ve jokerleri. Bunların çoğu takım başına soru bazında sayım gerektiriyor (yeni bir RPC).

## v0.53.0 (15 Kasım 2026)
Faz 3: ortak oyun motoru (kısmi). Veritabanı değişikliği yok.
- **`oyunMotoru.ts`:** enerji kuralları (başlangıç 50; doğru +15, yanlış −15, cevapsız −10, her 3'lü doğru seride +10; 0-100), kalabalık ayarı (karakter ölçeği küçülür, adlar ilk ada iner, 40'ın üstünde yalnızca lider ve son durumdakilerde ad görünür), prova oyuncu üretici. Birim testli.
- **Enerji şeridi:** grafik oyun dışındaki Zapoot turlarında (takım, hocayla yarış, bireysel vb.) perdenin sol altında her oyuncunun enerji barı; düşük enerjili soluk ve kırmızımsı, sonuç açılınca "+1" ya da "−1" yükselir, seri yapanda 🔥.
- **Prova:** 5, 30 ve 80 sahte oyuncu, %30, %60 ve %90 başarı oranı seçilebilir.
- Henüz yapılmayanlar: enerji barının grafik oyun sahnelerinin içine taşınması, "cevap verdi" hareketi (cevap veren karakter, doğruluk sızdırmadan) ve "hızlı doğruya +5" (sunucudan süre bilgisi gerekir), halat/orman/kale provaları (Faz 4 ile).

## v0.52.0 (15 Kasım 2026)
Faz 2: Zapoot, Oyunlar ve Quiz ayrıldı; lobi; puanlama; final töreni.
- **Araç çubuğu:** 🎮 Zapoot, 🕹️ Oyunlar, 📝 Quiz ayrı düğmeler. Zapoot sihirbazı: bireysel/takım (2-6 takım), paket(ler), soru sayısı. Oyunlar sihirbazı: oyun kartları (kısa kural, bireysel/takım etiketi), paket(ler), soru sayısı ya da süre (süre dolunca o anki soru bitince final açılır).
- **Soru seçimi:** birden çok paket işaretlenebilir; istenen sayı paketlere orantılı dağıtılır, karışık çekilir, aynı turda tekrar olmaz, son iki turda sorulmamış sorular önce gelir (`soruSec.ts`, birim testli).
- **Lobi:** başlatınca perdede lobi; takım modunda sütun sütun canlı adlar, "Takımları dengele" ve "Rastgele dağıt", ardından 3-2-1 ve oyunun kısa kuralı; ilk soru ancak "Başlat"tan sonra açılır.
- **Puanlama (0038_puan_turu_lobi.sql, SQL ile uygulandı):** puan tablosu ve öğrencinin sırası perdedeki oyun turuna göre hesaplanır; 3'lü doğru seride +100, 5'li seride toplam +300 bonus. Doğru cevap 500-1000 (hıza bağlı) zaten böyleydi.
- **Final:** 🏁 Bitir ile 3. sonra 2. sonra 1. podyuma çıkar (ses, konfeti), takım modunda önce kazanan takım, "Tümünü göster" tam sıralama.
- Bilinen eksikler: takım üst sınırı 6 (veritabanı kısıtı), her sorudan sonra "ilk 5" ara tablosu ve öğrenci telefonunda final ekranı sonraki sürüme kaldı.

## v0.51.0 (15 Kasım 2026)
Faz 1: hatalar ve hızlı düzeltmeler (tamamlandı).
- Oyun turu (0036, v0.50.2) ile takım, zombi, hocayla yarış ve merdiven sayımları yalnızca perdedeki turu sayar; tekrar oynanan paket temiz başlar.
- **Fikir silme (0037_katki_sil_hoca_yaris.sql, SQL ile uygulandı):** öğrenci beyin fırtınasında gönderdiği fikri, toplama açıkken ✕ ile silebilir; yalnızca kendi cihazının fikri silinir, hakkı geri gelir.
- **Hocayla yarış skoru:** hocanın cevabı verilmiş ve geçilmiş her soru sayılır; sınıfın hiç cevap vermediği soruda da skor işler. Kök neden: sınıf cevabı yoksa soru hiç sayılmıyordu.
- Kumandada "Derse dön" zaten vardı; "Bitir" podyumu Faz 2'de.

## v0.50.2 (15 Kasım 2026)
Faz 1 (v0.51.0) hazırlığı: oyun turu.
- **Oyun turu (0036_oyun_turlari.sql, SQL ile uygulandı):** Zapoot her başlatıldığında yeni bir tur açılır, tur kendi adım satırlarını taşır. İkinci oyun öncekinin cevaplarını, takım puanlarını ve zombi sonuçlarını devralmaz; takım, zombi, hocayla yarış ve merdiven sayımları yalnızca perdedeki turu sayar. "Derse dön" turu kapatır. Eski kayıtlar etkilenmez.

## v0.50.1 (15 Kasım 2026)
Faz 1'in veritabanı gerektirmeyen bölümü (v0.51.0'a hazırlık).
- **Perde yerleşim haritası:** el kaldırma ve soru zarfları sağ sütunda alt alta (en çok 5 el, 4 soru, fazlası "+N daha"); sıkıldım göstergesi sol alta, oyun kontrol çubuğu alt ortaya, ders kodu sağ alta taşındı; birbirinin üstüne binmez.
- **Herkes cevaplayınca geç:** derse bağlı telefon sayısı (Realtime presence; veritabanına yazılmaz) kadar cevap gelince soru 1,5 saniye sonra kapanır ve sonuç açılır. "⋯ > Herkes cevaplayınca geç" anahtarı, varsayılan açık.
- **Öğrenci geri dönüşü:** ders kodu telefonda sağ altta küçük rozet olarak görünür; sayfa yenilenince ya da bağlantı kopup gelince son 12 saatte katıldığı açık derse kod sorulmadan dönülür.
- **Beyin fırtınası ve oylama kayıtları** artık oturum kimliğiyle tutulur (başka hafta ya da şubede eski fikirler ve "hakkın doldu" durumu gelmez); eski kayıtlar bir kez temizlenir.
- **Görsel kaydetme adı:** slayt görseli "DersAdi_Hafta3_Slayt12.png" biçiminde adlandırılır (Görseli kaydet bağlantısı). "preencoded.png" adı depoda geçmiyor; tarayıcının blob görsele verdiği ad olduğu için görsel artık adlandırılmış bağlantıyla kaydedilir.

## v0.50.0 (15 Kasım 2026)
Öğrenci ekranları zapedu2 tasarımına birebir taşındı. Veritabanı değişikliği yok.
- **Stil sistemi:** zapedu2'deki renk adları (`ze-pink`, `ze-cyan`...) ve bileşenler (`glass-panel`, `btn-primary`, `btn-secondary`, `btn-danger`, `pressable`, `animate-pop`, `animate-breathe`) `index.css` içine alındı.
- **Derse katıl:** ZE logo, büyük "Derse katıl" başlığı, "6 haneli ders kodu" kartı (sarı geniş aralıklı kod), kırmızı "Bu kod tutmadı." bandı. **Yoklama formu:** "Canlı yoklama" kartı, "Öğrenci numaranı gir", "✓ Yoklamamı ver".
- **Soru cevaplama:** başlıkta geri sayım halkası (son 5 sn kırmızı) ve "Soru 3 / 5" etiketi; şıklar renkli harf/şekil rozetli dokunma kartları; cevap alınınca "Cevabın alındı" mor bandı; sonuçta puan şeridi (yeşil/kırmızı), şık başına yüzde çubukları, "İlk 5 sıralama" ve "(Sen)" vurgusu.
- **Etkinlikler:** kelime bulutu, beyin fırtınası, açık uçlu soru ve şeytanın avukatı formları aynı cam kart düzenine geçti (fikir hakkı sayacı, kalan süre, gönderdiğin fikirler listesi, yeşil/pembe taraf düğmeleri).
- **Quiz bandı** gradyanlı, **ders bitti ekranı** konfeti, karne ve devam serisi kartlarıyla.

## v0.49.0 (15 Kasım 2026)
Oyunlarda akan sahneler (sinema motoru). Veritabanı değişikliği yok.
- **Yeni sinema motoru** (`Sinema.ts`): ekranın üstünde yay çizerek uçan nesneler (iz bırakır), patlamalar, yüzen sayılar, sarsılma, devrilme. Her yeni soruda bir sahne baştan sona oynar.
- **Ejderha savaşı:** doğru bilen kahramanlar silahlarıyla ejderhaya koşup vurur (patlama, sarsılma), "−7" hasar yazısı çıkar, kahramanlar yerine döner; ejderha kükrer ve **ağzından ateş topları fırlatır**; ateş topları yanlış bilen kahramanın üstüne yay çizerek gider, patlar, kahraman geriye devrilir ve kalkar ("−1 ❤"); canı bitenler yerde kalır.
- **Roket yarışı:** doğru bilenler turbo patlamasıyla fırlar; yanlış bilenlerin üstüne gökten ateş izli meteor düşer, roket sarsılır.
- **Son kalan arenası:** doğru bilenler zıplar; yanlış bilenin üstüne dev çekiç düşer, devrilir; canı biten arenadan lavın içine fırlatılır.
- **Zombi kaçışı:** yakalanan oyuncunun üstüne sürüden zombiler atlar (yakalama patlaması); zirveye çıkanlar parıltıyla kutlanır.
- **Kale kuşatması:** ilerleyen her takım karşı kaleye mancınık taşları atar; taş düşünce hedef kale sarsılır ve patlama çıkar.

## v0.48.0 (15 Kasım 2026)
Hoca paneli yeni tasarım (zapedu2). Veritabanı değişikliği yok.
- **Derslerim:** şubeler artık ders kartının içinde ayrı kutular (şube adı ve öğrenci sayısı üstte, altında tam genişlik "▶ Devam" ya da "▶ Başlat" düğmesi). Devam parlak, başlat turkuaz çerçeveli.
- **Ders sayfası:** sekmeler gradyan etkin pill biçimine geçti.
- **Dönem özeti:** üç basamaklı şampiyonlar podyumu (1. ortada ve yüksek); 4. ile 10. aşağıda listelenir.
- **Akış düzenleme:** kart türleri renklendi (SLAYT turkuaz, SORU pembe, KELİME BULUTU ve BEYİN FIRTINASI lime, AÇIK UÇLU sarı, OYLAMA ve OYUN mor, METİN ve FOTOĞRAF turkuaz); toplu seçim çubuğu mor.

## v0.47.0 (15 Kasım 2026)
Yeni arayüz tasarımı (zapedu2): öğrenci, perde, kumanda. Veritabanı değişikliği yok.
- **Kumanda üç sekmeli:** "🎬 Ders" (adım kartı, hoca notu, sınıf paneli, puanlar), "🎮 Zapoot ve Quiz" (oyun seçimi, paket, Derse dön, Quizi bitir) ve "⚙️ Ayarlar" (yoklama, telefon modu, ana sayfa/dersi bitir, bütün adımlar). Önceki/Sonraki düğmeleri her sekmede üstte durur. Başlıkta ders ve oturum adı, dokununca kopyalanan ders kodu. Uzun tek sayfa dağınıklığı bitti.
- **Öğrenci telefonu:** alt çizgili üst şerit (ders adı mono, yeşil "yoklama alındı" ve sarı "ders üst üste" rozetleri), nefes alan ZE logolu bekleme kartı, "Perdeye bak, QR'ı okut" yoklama kartı, veri tasarrufu için anahtar, yükleniyor iskeleti, sarı yoklama uyarısı kartı.
- **Perde:** ders kodu altın rengi büyük rozet (QR altında ve yoklama kapalıyken), soru sonucunda şık başına yüzde ve kişi sayısı, son 5 saniyede kırmızı atan geri sayım halkası.

## v0.46.0 (15 Kasım 2026)
Oyunlarda hareket. Veritabanı değişikliği yok.
- **Ejderha savaşı:** her yeni soruda doğru bilen kahramanlar silahlarıyla (kılıç, yay, asa, balta...) ejderhaya doğru koşup vurur; ejderha sarsılır, patlama ve "−7" gibi hasar sayısı çıkar; ejderha ateş püskürür, yanlış bilen kahraman sarsılıp yanar. Her kahramanın elinde ayrı bir silah vardır.
- **Roket yarışı:** doğru bilen roket turbo patlamasıyla hızlanıp büyür, yanlış bilen sarsılır.
- **Zombi kaçışı:** doğru bilen karakter zıplar, yakalanan patlamayla yok olur, zirveye çıkan parıltı efekti alır.
- **Son kalan arenası:** doğru bilen savaşçı atılıp vurur, yanlış bilen darbe alıp kızarır.
- Hareketler yalnızca yeni bir sorunun sonucu açılınca çalışır (sahne açılırken eski sorular tekrar oynatılmaz); "hareketi azalt" ayarı olan cihazlarda kapalıdır.

## v0.45.0 (15 Kasım 2026)
Antigravity görselleri, Kale kuşatması, not defteri, yoklama güvenliği. Veritabanı: `0034_not_defteri.sql`, `0035_kumanda_kale.sql`.
- **Görseller:** `canli-ders-oyunu2` klasöründeki üç boyutlu görseller sisteme girdi (`public/gorseller`, 16 MB'lık PNG'ler WebP'ye çevrilip 5 MB'a indi). Zombi, roket, ejderha (sağlığa göre sağlam/yaralı/ölü), arena, kule ve halat sahnelerinde arka planlar ve karakterler; hocayla yarışta hoca ve sınıf resmi; birinciye kupa; devam serisi rozetleri; sahne ve telefon arka planları. Görsel bulunamazsa eski emoji görünümü kalır. Yeni logo dosyaları (`logo-zapedu*.svg`) klasörde durur ama mevcut ZE logosu değiştirilmedi.
- **Cevap şıklarına şekil:** A/B/C/D harflerinin üstünde ▲ ◆ ● ■ simgeleri (renk körlüğü ve uzaktan okuma için); perdede, telefonda ve önizlemede.
- **🏰 Kale kuşatması (takımlı oyun):** her takımın bir kalesi var; doğru cevaplar ordusunu bir sonraki takımın kalesine yürütür, sonra kalenin etrafını sarar. Hedef kaleyi önce tamamen kuşatan kazanır (kişi başına doğruya göre, kalabalık takım avantajlı olmaz). 2 ile 6 grup; sahnede ve kumandada seçilir.
- **Site adresi:** ders kodunun hemen altında ve yoklama ekranının altında "🌐 Adres: ..." satırı.
- **📓 Not defteri:** Panel'de "Genel notlarım", her şubede "📓 Notlar" sekmesi; yazdıkça kaydedilir.
- **Yoklama güvenliği:** cihaz kimliği çerezde de saklanır (yalnızca site verisini temizleyen öğrenci yeni kimlik alamaz). Yoklama listesinde aynı telefondan birden çok öğrenci adına yoklama verilmişse "⚠ ortak telefon" işareti çıkar. Aynı oturumda tek telefon tek numara kuralı zaten sunucuda vardı.

## v0.44.0 (14 Kasım 2026)
(15 Kasım 2026: veritabanındaki 14 paket adı ve 4 gizli akış adı "Kahoot" yerine "Zapoot" olarak güncellendi; SQL Editor'den, şema değişikliği değil veri güncellemesi.)
Zapoot oyun akışı sadeleşti, metin kartı eklendi. Veritabanı değişikliği yok.
- **Perdede yalnızca seçilen oyun:** Zapoot'ta oyun seçilince perde o oyunda kalır (roket, zombi, ejderha, arena, kule); "Küçült" ile soru ekranına dönülmez. Sorular öğrencilerin telefonlarındadır. Alt ortada küçük bir kontrol çubuğu vardır (soru sırası, kalan süre, cevap sayısı, Cevabı göster, +10 sn, Önceki/Sonraki soru, 👁 Soru: soruyu ve şıkları istenirse perdede gösterir). Araç çubuğu oyunun üstünde kalır.
- **Karışıklık giderildi:** yeni bir oyun seçilince öteki oyunların panelleri, takım ve hocayla yarış kapanır; "Hocayla yarış / Takım modu / Bilgi merdiveni" köşe düğmeleri hiç çıkmaz. Zapoot'tan "Derse dön" deyince oyun panelleri de kapanır.
- **Grup seçimi:** takımlı oyunlarda (Takım yarışması, Kule yarışı) 2 ile 6 arasında grup sayısı ya da "Herkes bireysel" seçilir; halat çekme her zaman 2 takımdır. Hem sahnedeki seçicide hem telefon kumandasında. Öteki oyunlar (roket, zombi, ejderha, arena, bilgi merdiveni, hocayla yarış) bireysel ya da bütün sınıf oynar.
- **📝 Metin kartı:** akışa istediğini yazabileceğin kart eklenir (not, tanım, metin, ödev). Perdede büyük, telefonda okunur görünür; "✏️ Düzenle" ile değiştirilir, diğer kartlar gibi haftalar arası gönderilebilir.

## v0.43.1 (14 Kasım 2026)
- Arayüzde ve belgelerde "Kahoot" adı **Zapoot** oldu (🎮 Zapoot, "Zapoot'a git", "Oyun / Zapoot başlat"). Kod içi adlar ve eski sürüm notları değişmedi.

## v0.43.0 (14 Kasım 2026)
Yarışma müziği, daha efektli sesler, kartları toptan silme. Veritabanı değişikliği yok.
- **Yarışma müziği:** soru açıkken ve grafik oyunlar (zombi, roket, ejderha, arena, kule) sürerken tempolu bir döngü (bas, arpej, davul) çalar; sorular arasında kesilmez, sonuç açılınca ve oyun bitince yumuşakça söner. Hepsi tarayıcıda üretilir (dosya, telif ve ek trafik yok). "⋯ > 🎵 Yarışma müziğini kapat" ayrı bir anahtardır.
- **Yeni sesler:** ışıltılı doğru çanı, düşen testere "yanlış", fanfar ve alkışlı zafer, üzgün trombon, son 5 saniyede geri sayım tıkı, süre bitince zil, "yarışma başlıyor" süpürmesi.
- **Kartları toptan silme:** akış düzenlemede kartların kutusunu işaretle (Shift ile aralık, "Hepsini seç"), çubuktan "🗑 Seçilenleri sil". Slayt dosyaları ve soru bankası etkilenmez; kartlar yalnızca akıştan çıkar.

## v0.42.0 (14 Kasım 2026)
Şube yedeği ve silinenleri geri alma. Veritabanı değişikliği yok.
- **💾 Şubeyi yedekle:** ders sayfasından bir şubenin sınıf listesi, oturumları ve yoklamaları tek dosyaya (`.amfi-yedek`) indirilir.
- **Silmeden önce otomatik yedek:** "Bu şubeyi sil" şube yedeğini, "Dersi tamamen sil" bütün şubelerin yedeğini ve içerik paketini (`.amfi`) kendiliğinden indirir; yedek alınamazsa silme yapılmaz.
- **📥 Şube yedeğini geri yükle (Panel):** yedek dosyasını seçilen döneme ve içeriğe yeni şube olarak yükler; var olan veriye dokunmaz. Yoklamalar "elle" olarak yazılır (QR bilgisi taşınmaz); quiz ve oyun puanları ile misafir bağları yedeğe girmez. Ders içeriği için mevcut .amfi içe aktarma kullanılır.

## v0.41.1 (14 Kasım 2026)
- **Slayt görseli yeniden yalnızca telefon modunda.** v0.41.0'daki "projeksiyonlu derste de öğrenci telefonuna slayt görseli" depo trafiğini (Supabase ücretsiz plan, ayda 5 GB) şişirebileceği için geri alındı. Öğrenci istemcisi telefon modu kapalıyken görseli indirmiyor (trafik hemen durur); `0033_slayt_gorseli_telefon_modu.sql` sunucu tarafını da eski hâline döndürür. Telefon modunda "📶 Veri tasarrufu" anahtarı durur.

## v0.41.0 (14 Kasım 2026)
Kumandadan oyun/Kahoot/quiz başlatma, slaytın herkese telefonda görünmesi, çökme koruması. Veritabanı: `0031_kumanda_istegi.sql`, `0032_slayt_gorseli_herkese.sql`.
- **Telefon kumandası:** gereksiz "Hocayla yarış / Takım modu" yazıları kalktı. Yerine "🎮 Oyun / Kahoot başlat" (oyun modu + paket seç), "📝 Quiz başlat" (paket seç, süre önerilir), "↩ Derse dön" ve "⏹ Quizi bitir" geldi. Kumandanın hoca girişi olmadığı için istek veritabanına bırakılır; perdedeki sahne ekranı (hoca girişli) isteği alıp uygular, bu yüzden sahne ekranı açık olmalıdır.
- **Slayt öğrencinin telefonunda:** projeksiyonlu derste de perdedeki slaytın görseli öğrenci telefonunda görünür (yalnızca o anki slayt). Telefonda "📶 Veri tasarrufu" anahtarı görseli kapatır. Ücretsiz plandaki depo trafiği (ayda 5 GB) kalabalık derslerde hızlı dolabilir; Supabase panelinden "Egress" izlenmeli.
- **Çökme koruması:** bir sayfa hata verirse boş (mavi) ekran yerine hata ve "🏠 Ana sayfaya dön" düğmesi çıkar. Yeni sürüm yayınlandıktan sonra eski açık sekmede sayfa dosyası bulunamazsa sayfa kendiliğinden bir kez yenilenir (ders sonunda "Yoklama listesi"ne basınca boş ekran çıkmasının olası nedeni buydu).

## v0.40.0 (14 Kasım 2026)
Ders kodu sabit. Veritabanı: `0030_sabit_ders_kodu.sql`.
- Ders giriş kodu yoklama yazdırmadığı için projeksiyonlu derste oturum boyunca değişmez; geç gelen öğrenci perdedeki aynı kodu yazar. Karekod (yoklama) 6 saniyede bir değişmeye devam eder.
- Projeksiyonsuz derste (kod yoklamayı da yazdırır) kod 60 saniyede bir değişir; hoca sesli okuyabilir. Güncel ve önceki iki dakikanın kodu kabul edilir.

## v0.39.1 (14 Kasım 2026)
- **Yoklamayı açınca karekod her ekranda görünür:** slayt, soru ya da etkinlik ekranındayken "⋯ > Yoklamayı aç" dersen perdenin ortasında karekod, ders kodu ve katılan sayısı çıkar; "Yoklamayı kapat" ve "Karekodu gizle" düğmeleri vardır. Önceden karekod yalnızca yoklama ekranında görünüyordu.
- **Paneller üst üste binmiyor:** Kahoot seçici, Quiz, puan tablosu, kumanda karekodu, oyun provası ve rehberden biri açılınca öbürleri kapanır. Araç çubuğu ve "⋯" menüsü etkinlik sahnelerinin üstünde kalır.
- **Yoklama ekranından çıkış:** yoklama ekranına büyük "▶ Derse geç: <akış adı>" düğmesi eklendi (en son kalınan akış, yoksa yoklama haftasına ait akış, yoksa ilk akış). Yoklama açık kalır.

## v0.39.0 (14 Kasım 2026)
Yoklama yalnızca karekodla. Veritabanı: `0029_kod_yoklama_vermez.sql`.
- Perdedeki 6 haneli ders kodu artık yoklama yazdırmaz; öğrenciyi yalnızca derse (etkinlik, quiz, oyun) dahil eder. Yoklama bileti yalnızca karekodu okutan öğrenciye verilir.
- İstisna: "Projeksiyon yok" (telefon modu) seçili derste perde ve karekod olmadığı için kod yoklamayı da yazdırır; yoklama açıkken kodu giren öğrenci numarasını girer.
- Hoca yoklamayı kapatınca yoklama durur, kod geç gelenler için kalır. Hoca isterse "⋯ > Yoklamayı aç" ile karekodu yeniden açıp geç gelenlerin yoklamasını da aynı haftaya yazdırır.
- Yoklama açıkken kodla giren öğrencinin telefonunda "yoklama için QR'ı okut" uyarısı çıkar.
- Yoklama haftası, şubede "▶ Başlat: N. hafta" ile açılan oturumdan gelir; derste seçilen akıştan etkilenmez (kodda zaten böyleydi).

## v0.38.2 (14 Kasım 2026)
- Sunum sırasındaki üst araç çubuğu kısaldı (Kahoot, Quiz, 🏆, 📱, ⋯, Bitir) ve "⋯" menüsü artık kesilmiyor; önceden çubuk ekrana sığmayınca menü kaydırma alanının içinde kalıyordu.

## v0.38.1 (14 Kasım 2026)
- Akış düzenleme listesinde "oyun" adımı artık oyunun adı ve simgesiyle görünür; daha önce yanlışlıkla "Yoklama" gibi görünüyordu (adım doğru ekleniyordu, yalnızca satır yanlış çiziliyordu).

## v0.38.0 (14 Kasım 2026)
Akış kartlarını düzenleme, fotoğraf ve haftalar arası gönderme. Veritabanı: `0028_etkinlik_fotograflari.sql` (fotoğraf deposu).
- **✏️ Düzenle:** akıştaki soru kartında soru metni, doğru ve yanlış şıklar, süre; kelime bulutu, beyin fırtınası ve açık uçlu kartta soru, tür ve süre; oylamada önerme ve iki etiket; videoda adres ve başlık yerinde değiştirilir. Bilgi yarışması sorusu soru bankasında durduğu için aynı soruyu kullanan yerlerde de değişir (ekranda uyarı yazar).
- **🖼️ Fotoğraf etkinliği:** bilgisayardan ya da telefondan fotoğraf yüklenir (en uzun kenarı 1600 pikselde küçültülür), perdede büyük, telefon modunda öğrencide görünür.
- **Başka haftaya gönder:** kartların başındaki kutuyla bir ya da birden çok kart (slayt parçaları dahil) seçilir; "Hangi haftanın akışına?" listesinden hedef seçilip kopyalanır ya da taşınır (hedef akışın sonuna, sırayı koruyarak).

## v0.37.1 (14 Kasım 2026)
- Sunum ekranındaki "🥊 Hocayla yarış", "🪢 Halat çekme", "👥 Takım modu" ve "🪜 Bilgi merdiveni" köşe düğmeleri artık yalnızca Kahoot oturumunda görünür. Normal ders akışında perdeyi kalabalıklaştırıyorlardı; oyun modu "Kahoot'a git" seçicisinden seçilir. Açık olan bir oyun paneli her zaman görünür.

## v0.37.0 (14 Kasım 2026)
Devam serisi, dönem şampiyonları, davetle hoca katılımı. Veritabanı: `0026_devam_serisi.sql`, `0027_hoca_davetleri.sql`.
- **Öğrenci telefonunda devam serisi:** üst üste en az 2 derse katılan öğrenci "🔥 N ders üst üste" rozetini görür (5 ve üzerinde ⭐). Yalnızca en az bir öğrencinin katıldığı oturumlar sayılır; rozet yalnızca öğrencinin kendi serisini gösterir.
- **Dönem özetinde "🏆 Dönemin şampiyonları":** dönem boyunca en çok puan toplayan on öğrenci ve hafta hafta birinciler.
- **Hocalar sayfası (`/panel/hocalar`, yalnızca kurulumun sahibi):** e-posta adresiyle hoca ekleme, listeleme, erişimi kaldırma ve kopyalanabilir davet metni. Her hocanın dersleri, öğrencileri ve yoklamaları kendisine özel kalır. Sahip (en eski hoca) çıkarılamaz.

## v0.36.2 (14 Kasım 2026)
Ders kapanışı.
- **Perdede "⭐ Bugünün yıldızları":** ders bitince, derste bilgi yarışması oynandıysa ilk üç öğrenci podyumda görünür.
- **Öğrenci telefonunda karne:** ders bitince "Bugünkü yarışmada N kişi arasında K. oldun (puan)" yazar (yalnızca yarışmaya katılmışsa).
- Her ikisi de mevcut verileri kullanır; veritabanı değişikliği yoktur.

## v0.36.1 (14 Kasım 2026)
Ders günü sadeleştirme ve yük azaltma.
- Akış düzenleme sayfasında "Adım ekle" bölümü (slayt yükleme, soru paketi, etkinlik) akış doluyken kapalı geliyor: önce akışın adım listesi görünür, "+ Adım ekle" ile açılır. Boş akışta açık gelir; satırdaki "+ Ekle" bölümü kendiliğinden açar.
- Oyun panelleri (zombi, roket, ejderha, arena, kule) oyun açık değilken sunucuya sormuyor; sahnede boşuna her 3,5 saniyede beş istek atılıyordu.

## v0.36.0 (14 Kasım 2026)
Ders gibi deneme ve açık uçlu soruda süre ile "cevapları yansıt".
- **Önizleme artık ders gibi denenir:** soru, açık uçlu soru, beyin fırtınası, kelime bulutu ve oylama adımlarında hoca "Etkinliği aç" der, sağdaki öğrenci telefonundan cevap verirsin (süre işler), süre bitince hoca "Cevapları yansıt" / "Cevabı göster" der ve perdeye düşer. Slayt ve diğer adımlar eskisi gibi. "Ders gibi dene" kutusundan kapatılır.
- **Açık uçlu soruya süre:** akış düzenlemede etkinlik eklerken cevap süresi seçilir (açık uçlu soruda varsayılan 90 sn). Sahnede geri sayım halkası, telefonda kalan süre; süre dolunca sunucu cevap almaz. Açık uçlu soruda cevaplar "📣 Cevapları yansıt" denene kadar perdede görünmez (kumandada görünür).
- **0024_kumanda_notu.sql ve 0025_acik_uclu_sure.sql Supabase'e uygulandı** (14 Kasım 2026, SQL Editor'den, kullanıcı onayıyla ve doğrulanarak): slayt notu kumandada görünür; açık uçlu soruda süre sunucuda işler ve cevaplar yansıtılana kadar perdeye gitmez.

## v0.35.1 (14 Kasım 2026)
Canlı denemede bulunanlar.
- Dönem özeti: kimsenin katılmadığı oturum (deneme ya da yanlışlıkla açılmış) yapılmış ders sayılmıyor; katılım oranı ve risk bozulmuyordu.
- Tek öğrenci eklerken hata mesajı doğru söylüyor: numara en az 3 rakam olmalı (harfli numara kabul edilmez).
- Canlıda gerçek bir öğrenci akışı denendi: yoklama, kodsuz quiz bandı, quiz çözme ve bitirme, Kahoot cevabı, roket sahnesinde adıyla görünme.

## v0.35.0 (14 Kasım 2026)
Otomatik doğrulama.
- **Yayın öncesi kapı:** her push'ta GitHub Actions lint, birim testleri ve SQL testlerini (PGlite) çalıştırır; biri kırılırsa site yayınlanmaz.
- **Öğrenci yolculuğu testi:** supabase/test/ogrenci_yolculugu_test.sql, bir öğrencinin yoklama, takım seçimi, açık uçlu cevap, bilgi yarışması cevabı, sonuç, zombi verisi ve kodsuz quiz zincirini telefonun çağırdığı RPC'lerle uçtan uca sınar.
- **Yayın sonrası doğrulama:** yayın bitince scripts/yayin-dogrula.mjs siteden surum.json'u okuyup beklenen sürümle eşleşmesini bekler, Supabase saglik() fonksiyonunu ve açılış sayfasını denetler; kırılırsa iş akışı kırmızı olur ve bildirim gider. Site artık surum.json de yayınlar.

## v0.34.1 (14 Kasım 2026)
- Önizlemede "ikisi" görünümünde perde tam genişlikte, telefon altında; perde artık okunaklı büyüklükte.

## v0.34.0 (14 Kasım 2026)
Ders günü güvencesi: prova, ses, bağlantı uyarısı ve rehber.
- **🧪 Oyun provası:** sahne "⋯ Diğer" menüsünden ve akış önizlemesinden açılır. Sahte öğrencilerle zombi kaçışı, roket yarışı, ejderha savaşı, son kalan arenası ve kule yarışını baştan sona, gerçek derste görecek olduğun perde görünümüyle izlersin (3,5 saniyede bir soru oynanır; duraklat, sonraki soru, baştan). Hiçbir şey kaydedilmez.
- **Oyun sesleri:** oyun sahnelerinde yeni soru, zafer ve yenilgi için küçük ses efektleri (dosyasız, tarayıcıda üretilir). "⋯ Diğer" menüsünden kapatılır.
- **Bağlantı uyarısı:** sahnede ve kumandada internet kopunca ekranın üstünde uyarı çıkar; ders durumu sunucuda durduğu için bağlantı gelince devam eder.
- **❓ Ders günü rehberi:** panel başlığında ve sahne menüsünde; ders öncesi, derste, sorun olursa (öğrenci giremiyor, sayfa kapandı, dersi yanlışlıkla bitirdim, yoklama yanlış) ve kısayollar.

## v0.33.1 (14 Kasım 2026)
- Derslerim sayfasında "Yeni ders ekle" formu, dönemde dersi varsa kapalı geliyor (ders günü ekranı sade kalsın). "Derse başla" düğmesinin yazısı düzeltildi ("▶ Başlat: 1. hafta").
- Çalışma kuralı: her teslimin sonunda sistem hoca ve öğrenci gözüyle gözlemlenir, eksikler listelenip onay istenir.

## v0.33.0 (14 Kasım 2026)
Hoca notu kumandada ve dönem sonu özeti.
- **Dönem özeti:** şube sayfasında yeni "📊 Dönem özeti" sekmesi. Hafta hafta katılım çubukları, öğrenci bazında devam oranı (yarının altındakiler "risk", son iki derse gelmeyenler ayrıca işaretli; yalnızca dikkat gerekenleri süzme), quizlerin katılım ve sınıf ortalaması. Üç sayfalık Excel dosyası olarak indirilir (haftalık katılım, öğrenci devamı, quizler).
- **Hoca notu kumandada:** akış düzenlemede slayda yazılan not, telefondaki kumanda ekranında o adım açıkken "📝 Bu adımın notu" kutusunda görünür; perdede ve öğrenci telefonlarında görünmez. **0024_kumanda_notu.sql** henüz Supabase'e uygulanmadı; uygulanana kadar not kumandada çıkmaz, başka hiçbir şey etkilenmez.

## v0.32.1 (14 Kasım 2026)
- Önizlemede perde, gerçek projeksiyon gibi 1280x720 üzerinde çizilip kutuya sığdırılıyor (dar kutuda içerik taşmıyor).

## v0.32.0 (14 Kasım 2026)
Ders günü için sadeleştirme.
- **Derslerim sayfasında şube başına "▶ Derse başla":** açık bir ders varsa sahneye döner ("▶ Devam"), yoksa şubenin sıradaki yoklama haftasını açar ("▶ 3. haftayı başlat"). Şube sayfasına girmeden ders başlar.
- **Sahnede "Kaldığın yerden devam":** yoklama ekranındayken bu şubede en son kalınan akış önerilir (ör. "2. hafta … (14/28)"); tek dokunuşla o adımdan açılır.
- **Sahne araç çubuğu sadeleşti:** sık kullanılanlar (akış, geri/ileri, Kahoot, Quiz, puan tablosu, kumanda, sayaç, dersi bitir) görünür; yoklamayı aç/kapat, kodu göster/gizle, tam ekran, yoklama listesi ve ana sayfa "⋯ Diğer" menüsüne alındı.

## v0.31.0 (14 Kasım 2026)
İki yeni oyun: biri takım, biri bireysel.
- **Kule yarışı (takım):** sınıf 3 takıma ayrılır, her takım blok blok bir kule yapar. Her doğru cevap bir kat ekler; sıralama kişi başına doğruya göredir (kalabalık takım avantajlı olmaz). Hedef yüksekliğe ilk çıkan takım kazanır, önde olan taç takar.
- **Son kalan arenası (bireysel):** her öğrencinin 2 canı var; yanlış ya da cevapsız bir can götürür, canı bitenler arenadan lava düşer. Sonunda ayakta kalanlar podyuma çıkar.
- İkisi de Kahoot geçişinde ve akıştaki oyun kartlarında seçilir; veritabanı değişikliği yoktur.

## v0.30.0 (14 Kasım 2026)
Akış önizlemesi.
- **Dersi başlatmadan önizleme:** akış düzenleme sayfasındaki "👁 Önizle" düğmesi, akışı adım adım perde (hoca), öğrenci telefonu ya da ikisi yan yana gösterir. Slayt, soru (isteğe bağlı doğru cevap), açık uçlu soru, kelime bulutu, oylama, video ve oyun adımları iki tarafın görünümüyle denenir; ok tuşları ve boşlukla ilerlenir, adım listesinden atlanır. Hiçbir şey kaydedilmez, oturum açılmaz.
- Logodaki "E" harfinin orta çizgisi uzatıldı (küçük boyutta "C" gibi okunuyordu); sekme simgesi yenilenmezse tarayıcı önbelleği için sayfayı sert yenile.

## v0.29.1 (14 Kasım 2026)
- Aynı Kahoot paketi derste yeniden açılınca adımlar silinip yeniden kurulmuyor; o oturumdaki cevaplar ve puanlar korunuyor.
- Ejderha savaşı sahnesi büyütüldü, roket simgeleri sadeleştirildi. Din Felsefesi paketlerinin önerilen oyun modları haftaya göre dönüşümlü (zombi, roket, ejderha, takım, halat, hocayla yarış).

## v0.29.0 (14 Kasım 2026)
İki yeni grafik oyun.
- **Roket yarışı:** her öğrenci perdede ilk adıyla bir roket; doğru cevap roketi ileri iter, uzay sahnesinde iz bırakır, bitiş çizgisine ilk varanlar podyuma çıkar. Bireysel hız ve bilgi yarışı.
- **Ejderha savaşı:** bütün sınıf birlikte bir ejderhaya karşı savaşır. Doğru cevap ejderhaya vurur (can çubuğu azalır), yanlış ya da cevapsız kalan kahraman üç canından birini kaybeder, canı bitenler uyur. Sınıf ejderhayı yenerse kazanır. Ortak çaba oyunu.
- İkisi de Kahoot geçişinde mod olarak seçilir ve akıştaki oyun kartlarında bulunur. Veritabanı değişikliği yoktur (zombi_goster verisini kullanır).

## v0.28.1 (14 Kasım 2026)
ZAPEDU logosu.
- Yeni logo: koyu zeminde gümüş "ZE" monogramı ve altın çizgi. Sekme simgesi, panel başlığı ve masaüstü uygulaması simgesi aynı logoyu kullanır.

## v0.28.0 (14 Kasım 2026)
Etkinlik menüsü, açık uçlu soru ve Zombi Kaçışı.
- **Akış düzenlemede "Etkinlik ekle" menüsü:** açık uçlu soru, kelime bulutu, beyin fırtınası, şeytanın avukatı, video ve oyun kartları (zombi kaçışı, takım, halat, hocayla yarış, bilgi merdiveni). Satırdaki "+ Ekle" ile etkinlik ya da soru paketi o adımın arkasına eklenir.
- **Açık uçlu soru:** hoca sorar, öğrenciler telefondan (300 harfe kadar) yazar, bütün cevaplar perdede kart olarak görünür; hoca uygunsuz olanı gizleyebilir. Beyin fırtınası kısa cümleler (120 harf, 3 hak) alır; kelime bulutu eskisi gibi çalışır.
- **Zombi Kaçışı:** bilgi merdiveninin yerini alan oyun. Her öğrenci ilk adıyla ayrı bir karakter olarak piramitte görünür; doğru cevap bir kat yükseltir, zombi sürüsü her soruda yaklaşır, altında kalan yakalanıp zombi olur. Oyun sonunda sınıfın %70'i zirvedeyse sınıf kurtulur. Kahoot geçişinde "Zombi kaçışı" modu seçilir.
- **0023_acik_uclu_zombi.sql** (katkı kipleri ve zombi_goster) 14 Kasım 2026'da Supabase'e uygulandı ve doğrulandı. Din Felsefesi I ve 2 paketlerinin önerilen oyun modu bilgi merdiveninden zombi kaçışına çevrildi.

## v0.27.1 (14 Kasım 2026)
Akışta slayt önizlemesi.
- Akış düzenlemede bir slaydın küçük resmine tıklayınca büyük önizleme açılır: slayt, sayfanın metni ve yalnızca hocanın gördüğü not kutusu. Ok tuşlarıyla akıştaki öteki slaytlara geçilir, Esc kapatır. Notu olan slaytta 📝 işareti görünür. Not öğrenciye ve perdeye gitmez.
- Ek slayt sunumlarının adları "9. hafta: Ek slaytlar" biçimine getirildi.

## v0.27.0 (14 Kasım 2026)
Kaldığın yerden devam ve ek slaytlar.
- **Kaldığın yerden devam:** bir şubede akış yarım kalırsa (ör. A sınıfında 2. haftanın ortasında), o şubede aynı akış sonraki oturumda seçildiğinde ya da başlatıldığında kaldığı adımdan açılır; "nerede kalmıştık" diye aranmaz. Sahnede "N / M. adımdan devam ediliyor" bilgisi ve "Baştan başla" bağlantısı çıkar. Her şubenin ilerlemesi ayrı tutulur.
- Panel başlığındaki "Panel" yazısı gökkuşağı yerine gümüş.
- Din Felsefesi I 9-14. haftalar ve Din Felsefesi 2 13-14. haftalar için kaynak kitaplardan hazırlanan özgün ek slaytlar (hafta başına 11-13 slayt, tartışma sorusu ve özet dahil) akışlara eklendi.

## v0.26.1 (14 Kasım 2026)
Kahoot geçişi düzeltmeleri.
- Ders yoklama ekranından açılmışsa "Derse dön" Kahoot akışından çıkıp yoklama ekranına döner (önceden Kahoot ekranında kalıyordu). Önerilen paket, akış seçilmemişse oturumun hafta numarasından bulunur.
- Din Felsefesi I ve 2 içerikleri yeni düzene göre yeniden yüklendi: akışlarda ısınma, slayt, video, şeytanın avukatı ve çıkış bileti; her hafta ayrı Hızlı Kahoot ve Ciddi Quiz paketi.

## v0.26.0 (14 Kasım 2026)
Kahoot ve quizler akıştan ayrıldı: hoca konu bitince sahneden açar, bitirir, derse kaldığı yerden döner.
- **Sahnede iki yeni düğme:** "🎮 Kahoot'a git" ve "📝 Quize git". Kahoot'ta hazır bir soru paketi seçilir (bu haftanın paketi başta, önerilen), nasıl oynanacağı seçilir (bireysel, takım, halat çekme, hocayla yarış, bilgi merdiveni; her paket için önerilen mod hazırdır) ve sorular perdeye tek tek gelir. Bitince "↩ Derse dön" kaldığın akışa ve slayta geri götürür; puan tablosu aynı çubuktadır. Perde arkasında paket adıyla (⚡) gizli bir akış kurulur; akış listelerinde görünmez.
- **Quiz:** paket ve süre seçilir, derse girmiş öğrencilerin telefonunda "Quiz başladı" bandı çıkar. Perdede kalan süre, başlayan ve bitiren sayısı görünür; hoca bitirince sınıf ortalaması, katılım ve en çok zorlanılan sorular açıklanır (isim gösterilmez), sonra derse devam edilir. Öğrenci bazında sonuçlar Quiz sekmesinde durur.
- Akışlar artık yalnızca ısınma beyin fırtınası, slaytlar, videolar, şeytanın avukatı (oylama) ve çıkış bileti (açık uçlu, telefondan yazılır) gibi etkinliklerden oluşur; 20'li seri sorular Kahoot paketlerinde durur.

## v0.25.0 (14 Kasım 2026)
Derse girmiş öğrenci quize kod girmeden katılır.
- Hoca şubede bir quiz açınca, o şubenin açık dersinde yoklaması alınmış öğrencinin telefonunda "Quiz başladı" bandı çıkar; dokununca quiz başlar. Kimlik yoklama kaydından alınır, kod ve numara sorulmaz. Quiz sayfası `?o=<oturum>` ile de açılır; yarıda kalan quiz aynı telefondan kaldığı yerden devam eder. Kod ve numara ile girme yolu yoklamasız öğrenciler için aynen duruyor.
- Hata ekranı artık gerçek nedeni gösterir (yoklama yok, quiz kapalı, ders bitmiş).
- **0022_oturum_quizi.sql** (`oturum_quizi`, `oturum_quizi_baslat`) 14 Kasım 2026'da Supabase'e uygulandı ve doğrulandı.

## v0.24.0 (14 Kasım 2026)
Soru yönetimi ve soru süreleri.
- **Soruyu düzenle:** Ders düzenleme sayfasındaki soru paketlerinde her sorunun yanında "Düzenle": soru metni, doğru cevap, yanlış şıklar (her satıra bir şık, en fazla 5), cevap süresi ve paket tek formda değiştirilir; kayıttan önce denetlenir (boş metin, çift şık, doğruyla aynı şık, süre sınırı). Sorunun öbür ek bilgileri (kazanım vb.) korunur.
- **Süre soru bazında ayarlanır:** her soru kendi süresine sahip olabilir (10-120 sn). Akış düzenleme sayfasında her soru adımının yanında süre seçici vardır; soru paketinde "⏱ Süreleri ayarla" ile paketin hepsine aynı süre ya da "Otomatik" (soru ve şık uzunluğuna göre 15-60 sn) verilir.
- **Derste süre uzat:** soru perdedeyken "⏱ +10 sn" düğmesi o sorunun süresini 10 saniye uzatır (öğrenci telefonları yeni kalan süreyi alır).

## v0.23.0 (13 Kasım 2026)
Programın adı ZAPEDU oldu.
- Programın adı "AmfiOS" yerine **ZAPEDU**: panel başlığı, giriş ekranı, sekme başlığı, masaüstü uygulaması (pencere ve kurulum adı) ve belgeler. Depo adı ve canlı adres aynı kaldı. İçerik paketlerinin iç türü (`amfios-icerik`) ve uygulama kimliği, eski paketler ve kurulu masaüstü uygulaması çalışmaya devam etsin diye değişmedi; önceki sürüm notları tarihî adıyla durur.
- Marka: ekranın sol altında, her sayfada, tıklanmayan ve içeriği kapatmayan altın sarısı parıltılı "ZAPHYROS" yazısı (hareketi azalt ayarında parıltı durur, yazdırmada görünmez).

## v0.22.2 (13 Kasım 2026)
Telefonda slayt geçişi.
- Sahne sayfasını telefondan açınca slayt ekranında geçiş okları yoktu: araç çubuğu yalnızca fareyle üzerine gelince göründüğü için dokunmatik ekranda hiç çıkmıyordu. Artık slayt ekranında ekranın iki yanında her zaman görünen büyük ‹ › okları, sol altta "3 / 28" sayacı var; sola/sağa kaydırarak (swipe) de geçilir. Dokunmatik ekranlarda araç çubuğu da her zaman görünür.

## v0.22.1 (13 Kasım 2026)
Karekod ve giriş kodu 6 saniyede bir değişir.
- Karekod ve yoklama (ders) kodu süresi uzun bulunduğu için ikisi de **6 saniyede** bir değişir (önceden karekod 10 saniye, kod 10 saniyeydi; v0.22.0'daki 10 saniyelik kod değişikliği 6 saniyeye çekildi). Sahnedeki karekodun geri sayım çubuğu, perdedeki ve kumandadaki 6 haneli kod aynı süreyle yenilenir. Karekod ve kodda içinde bulunulan ve önceki iki pencere (en fazla 18 saniye) kabul edilir; yavaş okutan ya da yazan öğrenci de girebilir. Öğrenciye verilen bilet, numarasını yazması için yaklaşık 108 saniye geçerlidir.
- Veritabanı: `0021_pencere_6sn.sql` (adı `0021_kod_10sn.sql` iken değiştirildi; `ozel.pencere`, `qr_token`, `kod_bilgisi`, `kodla_katil`). `npm run sql-test` ile yerelde denendi; Supabase'e 13 Kasım 2026'da uygulandı (dört fonksiyonun 6 saniyeli yeni sürümü, anonim yetkiler ve sahte kodun reddi sorguyla doğrulandı).

## v0.22.0 (13 Kasım 2026)
Yoklama iptali ve 10 saniyelik giriş kodu.
- **Yoklamayı iptal et:** Yoklama haftaları kartlarında "İptal et" düğmesi. O haftanın oturumu ve bütün katılım kayıtları (onayla) tamamen silinir; hafta "Yoklama alınmadı" durumuna döner ve sıfırdan başlatılabilir.
- **Ders kodu 10 saniyede bir değişir:** Perdedeki ve kumandadaki 6 haneli giriş kodu artık karekodla aynı sürede (10 saniye) değişir; kod dışarıdaki birine verilip derse girilemez. Karekoddaki gibi içinde bulunulan ve önceki iki pencerenin kodu kabul edilir (en fazla 30 saniye), yavaş yazan öğrenci de girebilir. Eski dakikalık kodlar artık geçmez.
- Veritabanı: ilk sürümü `0021_kod_10sn.sql`ydı, v0.22.1'de `0021_pencere_6sn.sql` oldu (aşağıya bak).

## v0.21.1 (13 Kasım 2026)
İçerik paketi içe aktarma düzeltmeleri (gerçek paketle denemede çıktı).
- Karışık türde adımlar (slayt, video, etkinlik, soru) tek seferde eklenirken eksik alanlar boş değerle yazılıyor ve akışa hiç adım eklenmiyordu; bütün adımlar artık aynı alanlarla gönderiliyor.
- İçe aktarma tekrarlanabilir: aynı ad ve sayfa sayısıyla kayıtlı sunum yeniden yüklenmez, aynı paket adı ve metinle bankada olan soru yeniden eklenmez. Yarım kalan bir içe aktarma, aynı dosya yeniden seçilerek eksik kalan yerden tamamlanır.
- Hata olduğunda sunucunun iletisi gösterilir ("İçe aktarılamadı: ...").

## v0.21.0 (13 Kasım 2026)
Yoklama sınıfın içinde: yoklama haftaları.
- Yoklama artık haftalık akışların içinde değil, şubenin (sınıfın) içindedir. Şube sayfasındaki "Oturumlar" sekmesinin en üstünde "Yoklama haftaları" bölümü: hoca şubede kaç yoklama alacağını (ör. 15 hafta ya da 30 ders; 1-60) "⚙ Sayıyı ayarla" ile belirler. Her hafta ayrı bir kart: "Yoklamayı aç" (sıradaki hafta vurgulanır), açıksa "AÇIK" etiketi, alınmışsa "n / N katıldı", "Yeniden aç" ve yoklama listesine "Liste" bağlantısı.
- Akış sonradan seçilir: yoklama açılınca sahne karekodu gösterir, öğrenciler katılır; hoca sahnenin araç çubuğundaki "Akış seç" listesinden "📋 Yoklama ekranı" ile bir akış arasında geçiş yapar (akış seçilince ilk adımı açılır). Yoklama akıştan bağımsız olduğu için 2. haftanın yoklaması 1. haftanın akışından verilebilir; bir akış iki hafta sürebilir. Akışların içine artık yoklama adımı konmaz.
- Aynı gün (ya da sonra) o haftanın yoklaması yeniden açılırsa aynı oturum kullanılır: önceki kayıtlar korunur, yeni gelenler de var yazılır (karekod, ders kodu ya da elle). Bir şubede bir hafta numarası tek oturumda bulunur.
- Eski "Ders başlat" formu "Ek ders başlat" adıyla duruyor (yoklama haftasından bağımsız, akışlı ya da yoklamasız oturumlar için).
- Veritabanı: `0020_yoklama_haftalari.sql` (`courses.yoklama_sayisi`, `courses.yoklama_birimi`, `sessions.hafta_no` ve şube başına tekil hafta numarası). `npm run sql-test` ile yerelde denendi; Supabase'e 13 Kasım 2026'da uygulandı (sütunlar, tekil indeks ve kısıtlar sorguyla doğrulandı).

## v0.20.0 (13 Kasım 2026)
Akışta "oyun" adımı.
- Haftalık akışa "🎮 Bugünün oyunu" kartı konabilir (akış düzenleyicide Tartışma etkinliği > Oyun kartı): takım yarışması, halat çekme, hocayla yarış ya da bilgi merdiveni. Adım perdede oyunun adını, nasıl oynandığını ve "🚀 Oyunu başlat" düğmesini gösterir; düğme ilgili modu açar (takım sayısını ayarlar, hocayla yarışı açar, halat ya da merdiven panelini gösterir). Öğrenci telefonunda "hocanın ekranını izle" görünür.
- İçerik paketini içe aktarırken, aynı adlı ve içi boş bir akış zaten varsa (örneğin hafta planıyla önceden açılmış) yenisi açılmaz, o akış doldurulur.
- Veritabanı: `0019_oyun_adimi.sql` (`lesson_steps.tur` içine `oyun`; `ayar.oyun` zorunlu ve dört değerden biri). `npm run sql-test` ile yerelde denendi; Supabase'e 13 Kasım 2026'da uygulandı (`oyun` türü kısıtta doğrulandı).

## v0.19.2 (13 Kasım 2026)
Yoklama raporunda elle var yazma.
- Şube sayfasındaki "Yoklama raporu" artık öğrenci x oturum tablosudur: her oturumun tarihi bir sütundur ve hücreye tıklayınca öğrenci o oturumda elle "var" yazılır ya da kaldırılır (✓ var, ✋ elle yazılmış, ↗ başka şubede misafir olarak katılmış, boş yok). Katılım sayısı ve oran anında güncellenir; oturum başlığına tıklayınca o oturumun yoklama listesi açılır (orada da elle ekleme vardır). Veritabanı değişikliği yok (hocanın elle yoklama izni 0002'den beri var).

## v0.19.1 (13 Kasım 2026)
Oyunlarda öğrencinin ilk adı.
- Derse herkes kayıtlı numarasıyla girdiği için oyunlarda takma ad yerine öğrencinin ilk adı görünür: puan tablosu, podyum, takım tablosu, perdedeki parmak ve soru zarfları, sıkıldım çekilişi. "Ahmet Can Yılmaz" ilk adıyla "Ahmet Can", "Ayşe Kaya" "Ayşe" görünür. Aynı oturumda aynı ilk adı taşıyan başka bir yoklamalı öğrenci varsa soyadın baş harfi eklenir ("Ali V.", "Ali Y."). Yoklaması olmayıp takma ad almış cihazın adı olduğu gibi kalır.
- Veritabanı: `0018_ilk_ad.sql` (`ozel.ilk_ad`, `ozel.oyuncu_adi` ve `ozel.sinif_adi` güncellendi). `npm run sql-test` ile yerelde denendi (çok adlı isim, çakışma, takma ad); Supabase'e 13 Kasım 2026'da uygulandı; fonksiyonların anonim role kapalı olduğu ve `sinif_adi`nin yeni sürümü kullandığı sorguyla doğrulandı.

## v0.19.0 (13 Kasım 2026)
Ders sayacı, sürükle-bırak sunum yükleme, ders düzenleme merkezi.
- **Ders sayacı:** Sahnenin araç çubuğunda "⏱ 50:00" düğmesi. Hoca süreyi hazır değerlerden (10-60 dk), dakika yazarak ya da bitiş saati (10:40) vererek ayarlar; Başlat, Durdur, +5 dk, Sıfırla. Son 5 dakika sarı, son dakika kırmızı yanıp söner; süre bitince perdede tam ekran "Süre doldu!" uyarısı çıkar ve üç kısa ses çalar (+5 dakika ya da Tamam). Durum tarayıcıda saklanır, sayfa yenilense de sayaç sürer.
- **Sunum yükleme:** Akış düzenleme sayfasında "Sunumları buraya sürükleyip bırak" alanı; birden fazla PDF aynı anda bırakılabilir, ada göre sıralanıp sırayla yüklenir ve slaytları akışa eklenir.
- **Toplu hafta ekleme her yerde:** "Haftalık planı topluca ekle" kutusu ortak bileşen oldu; ders içerik sayfasında ve hafta planı sayfasında var.
- **Ders düzenleme merkezi:** Ders adının yanındaki "✏️ Düzenle" düğmesi akışları, sunum kitaplığını, soru paketlerini ve içerik paylaşımını tek sayfada toplar. Şube sayfasında yalnızca sınıfa özel işler kalır (oturumlar, sınıf listesi, yoklama, quiz sonuçları, gelişim); "Ders akışları" sekmesi buraya taşındı.
- Veritabanı değişikliği yok. Sayaç kuralları 6 birim testle denendi.

## v0.18.0 (13 Kasım 2026)
Bilgi merdiveni.
- Sınıfın tek bir yarışmacı gibi basamak basamak çıktığı, güvenli basamaklı ve jokerli yeni oyun (özgün; bilinen bir televizyon yarışmasının adını ya da görünümünü kullanmaz). Perdede (ve kumandada) "🪜 Bilgi merdiveni" düğmesi açılır; soru akışındaki her soru bir basamaktır (15 soru = 15 basamak).
- Kural: bir sorunun sonucu açılınca cevap verenlerin en az yarısı doğru bildiyse sınıf bir basamak çıkar; bilemezse son güvenli basamağa (her 5. basamak) iner. Hoca yanlış bilinen son soruyu en fazla 2 kez "🛟 Joker" ile yok sayabilir (basamak korunur). Tüm basamaklar çıkılınca "Sınıf merdiveni tamamladı!" yazar.
- Soru çözülürken merdiven kıpırdamaz; sonuç açılınca ya da soru geçilince güncellenir (cevabı önceden belli etmesin). Joker ve merdiveni açık tutma bu tarayıcıda saklanır. Bilgi yarışmasının puanlaması, takım modu ve hocayla yarış aynen çalışır; öğrenci telefonunda değişiklik yok.
- Veritabanı: `0017_bilgi_merdiveni.sql` (yalnızca okuyan `merdiven_goster` RPC'si; kurallar `src/lib/merdiven.ts` içinde, 8 birim testle). `npm run sql-test` ile yerelde denendi; Supabase'e 13 Kasım 2026'da uygulandı; anonim çalıştırma ve yanlış anahtarın reddi sorguyla doğrulandı. Arayüz gerçek derste denenmedi.

## v0.17.0 (13 Kasım 2026)
Halat çekme.
- Takım modunda tam 2 takım seçiliyse takım düğmelerinin yanında "🪢 Halat çekme" çıkar. Halat perdede iki takımın renkleri arasında durur; bilgi yarışmasında bir takımın üye başına doğru cevabı diğerinden fazlaysa halat o takıma doğru kayar, fark 3 doğru cevaba ulaşınca "takım halatı çekti!" yazar. Takımların üye sayısı eşit olmayabildiği için doğru sayısı üyeye bölünür.
- Halat, soru açıkken kıpırdamaz; soru kapanıp cevap açıklanınca kayar (doğru cevabı önceden belli etmesin diye). Perdede ve kumandada çalışır; öğrenci telefonunda değişiklik yok.
- Veritabanı değişikliği yok: halat, takım puan tablosundan (`takim_goster`) tarayıcıda hesaplanır (`halatHesapla`, 5 birim testle). Görünüm sahte verilerle tarayıcıda denendi; gerçek derste denenmedi.

## v0.16.1 (13 Kasım 2026)
Canlı denemede çıkan düzeltmeler.
- Takma adı olmayan öğrenci (yoklamasız derste) parmak, soru ya da sıkıldım düğmesine basınca hata görüyordu; artık önce "Takma ad seç" kutusu çıkar, ad alınır ve basılan düğme kendiliğinden gönderilir. Ad, soru cevaplarında kullanılanla aynıdır.
- "Hocayla yarış" skoru ve gizli cevap seçimi perdenin sol üstünde soru başlığının üstüne biniyordu; alt ortaya taşındı.
- İçerik paketi içe aktarılınca soru paketleri listesi yenilenmiyordu (veri doğru kaydediliyordu); düzeltildi.
- Canlıda gerçek hoca girişiyle denendi (deneme dersi sonunda silindi, gerçek derslere dokunulmadı): toplu hafta planı, misafir öğrenci, "Dersi tamamen sil", parmak, soru zarfı, sıkıldım uyarısı ve çekiliş, takım tablosu, hocayla yarış skoru, .amfi dışa ve içe aktarma. Öğrenci telefonu ekranı gerçek arayüzden açıldı; düğmeler göründü. Not: hocanın gizli cevabı soru süresi (varsayılan 20 sn) dolmadan verilmelidir.

## v0.16.0 (13 Kasım 2026)
Hocayla yarış.
- Perdede (ve kumandada) "🥊 Hocayla yarış" düğmesi bilgi yarışmasını sınıf-hoca düellosuna çevirir. Soru açıkken hoca kendi cevabını gizlice verir: sahnede şıklar yalnızca harfle (A, B, C…) gösterilir, kumandada metinleriyle; perdede yalnızca "✓ Hoca cevabını verdi" görünür. Cevap, sonuç açılana kadar değiştirilebilir.
- Sonuç açılınca hocanın doğru bilip bilmediği ve sınıfın doğru oranı gösterilir. Skor: hoca soruyu doğru bilirse hoca 1 puan, cevap verenlerin en az yarısı doğru bilirse sınıf 1 puan (ikisi birden puan alabilir). Skor "Hoca 3 – 5 Sınıf" olarak perdenin solunda durur; yalnızca sonucu açılmış ya da geçilmiş sorular sayılır, böylece skor hocanın cevabını önceden belli etmez.
- Öğrencilerin telefonunda değişiklik yok; mevcut puan tablosu, podyum ve takım modu aynen çalışır.
- Veritabanı: `0016_hocayla_yaris.sql` (tablolar `hoca_yaris`, `hoca_cevaplari`; RPC'ler `hoca_yaris_ayarla`, `hoca_cevapla`, `hoca_yaris_goster`; hoca yetkisi sahnede giriş, kumandada anahtar). Hocanın cevabı şık sırası oturuma göre karıştığı için metin olarak saklanır. `npm run sql-test` ile yerelde denendi (gizlilik, skor kuralları, yetki); Supabase'e 13 Kasım 2026'da uygulandı; RLS, anonim yetkiler (tabloları okuyamaz) ve yanlış anahtarın reddi sorguyla doğrulandı. Arayüz gerçek derste denenmedi.

## v0.15.0 (13 Kasım 2026)
Takım yarışması.
- Perdede (ve kumandada) "👥 Takım modu" düğmesi: hoca takım sayısını seçer (2 ile 6 arası, 🔴 Kırmızı, 🔵 Mavi, 🟢 Yeşil, 🟡 Sarı, 🟣 Mor, 🟠 Turuncu) ya da kapatır. Mod açılınca öğrenci telefonunda "Takımını seç" düğmeleri çıkar; yoklaması ya da takma adı olan her cihaz seçebilir.
- Bilgi yarışmasındaki puanlar takım bazında toplanır. Perdenin sağ altındaki tabloda her takımın üye başına ortalama puanı, toplam puanı ve üye sayısı canlı görünür; sıralama ortalamaya göredir (takımların üye sayısı eşit olmayabilir). Öğrenci ilk cevabını verince takımını değiştiremez (kazanan takıma geçip puan toplanamasın). Takım sayısı azalırsa dışarıda kalan üyeler yeniden seçer.
- Takım modu bilgi yarışmasının mevcut puanlamasını değiştirmez; bireysel puan tablosu ve podyum aynen çalışır.
- Veritabanı: `0015_takim_yarismasi.sql` (tablolar `takim_ayar`, `takim_uyeleri`; RPC'ler `takim_durumum`, `takim_sec` öğrenci için, `takim_goster`, `takim_ayarla` hoca ve kumanda için). `npm run sql-test` ile yerelde denendi (seçim kuralları, kilit, ortalama sıralaması, yetki); Supabase'e 13 Kasım 2026'da uygulandı; RLS, anonim yetkiler (tabloları okuyamaz) ve yanlış anahtarın reddi sorguyla doğrulandı. Arayüz gerçek derste denenmedi.

## v0.14.0 (13 Kasım 2026)
Sınıf etkileşimi: parmak kaldır, soru sor, sıkıldım ve çekiliş.
- **Öğrenci telefonunda üç düğme** (derse katılınca, ders bitene kadar): ✋ Parmak kaldır (basınca "Elini indir" olur), ❓ Soru sor (3-280 harflik yazılı soru) ve 😮‍💨 Sıkıldım ("Vazgeçtim" ile geri alınır). Düğmeleri yoklaması alınmış ya da takma ad almış cihaz kullanabilir; öğrencinin gördüğü adı kısadır ("Ahmet Y."). Öğrenci kendi son sorularını ve cevaplanıp cevaplanmadığını görür. Bekleyen en fazla 3 soru.
- **Perdede (sahne):** kaldırılan parmaklar sağ kenarda sırayla (ad ve sıra numarası; adına basınca söz verilmiş sayılıp iner, "Hepsini indir"), sorular sol altta soran kişinin adıyla zarf olarak (zarfa basınca soru büyük açılır, "Cevaplandı" ya da "Sonra bakarım"), altta "😮‍💨 3 / 40 sıkıldı" göstergesi.
- **Sıkıldım uyarısı:** sıkıldım diyenler katılanların yüzde 25'ine (en az 2 kişi) ulaşınca perdede tam ekran 😵 "Sınıf sıkıldı!" çıkar. "Dersi durdur, çekiliş yap" molayı açar ve sıkıldım diyenler arasından rastgele birini seçer; seçilen kişinin telefonunda "Sıra sende!", diğerlerinde "Ders kısa bir mola verdi" yazar. Kabul etmezse "yeniden çek" (en fazla 3 çekiliş, aynı kişi tekrar çıkmaz); "Anlattı, derse dön" ya da "Derse dön" molayı kapatır ve sıkıldım kayıtlarını sıfırlar. "Devam et" uyarıyı kapatır.
- **Kumanda (projeksiyonsuz ders):** aynı bilgiler hocanın telefonundaki kumandada "Sınıf" kartı olarak çıkar; parmaklar, sorular, sıkıldım sayısı, çekiliş ve mola oradan da yönetilir.
- Veritabanı: `0014_sinif_etkilesimi.sql` (tablolar `sinif_olaylari`, `sinif_durum`; RPC'ler `sinif_gonder`, `sinif_durumum` öğrenci için, `sinif_goster`, `sinif_komut` hoca ve kumanda için). Öğrenci tabloları okuyamaz. `npm run sql-test` ile yerelde denendi (cihaz doğrulama, sınırlar, çekiliş kuralları, yetki); Supabase'e 13 Kasım 2026'da uygulandı; RLS, anonim yetkiler (tabloyu okuyamaz, yalnızca öğrenci RPC'leri çalışır), Realtime ve yanlış anahtarın reddi sorguyla doğrulandı. Perde görünümü sahte verilerle tarayıcıda denendi; öğrenci telefonu ve gerçek derste uçtan uca denenmedi.

## v0.13.0 (13 Kasım 2026)
Hoca araçları: içerik paylaşma, toplu hafta planı, esnek sınıf listesi.
- **İçeriği paylaş:** Ders akışları sekmesinde "Dışa aktar" dersin akışlarını, sunum PDF'lerini ve soru bankasını tek bir `.amfi` dosyasına (ZIP) toplar; "İçe aktar" başka bir hocanın paketini kendi dersine ekler. Var olan içerik silinmez; sunumlar kendi kurulumunda yeniden işlenir (sayfa metinleri, telefon görselleri). Öğrenci listesi, şube ve yoklama pakete girmez. Paket doğrulanır (yabancı dosya, yeni sürüm, bozuk bağlantı reddedilir).
- **Haftalık planı topluca ekle:** Ders akışları sekmesine konu satırlarını yapıştırınca her satır bir akış olur (14 satır = 14 hafta). Satır başındaki "1.", "Hafta 1:" gibi numaralar atılır, akış "N. hafta: konu" adıyla açılır, mevcut akışların arkasına sıralanır.
- **Sınıf listesi:** Seçilenleri sil, görünenlerin hepsini seç ve "Listeyi tamamen sil". "Dersi sil" ikiye ayrıldı: "Bu şubeyi sil" yalnızca bu şubenin listesini ve yoklamasını siler; "Dersi tamamen sil" bütün şubeleri, dönemleri ve içeriği kaldırır (dersin adı yazılarak onaylanır).
- **Misafir öğrenci:** Başka şubede kayıtlı bir öğrenci bu şubenin listesine "misafir" olarak eklenir (asıl şubesi ve kendisi seçilir). Bu şubede yoklamaya ve etkinliklere katılır; yoklaması kendi şubesinin aynı akışla yapılmış (aynı hafta) oturumunda da var sayılır. Gelişim raporunda misafir öğrencinin cevapları henüz asıl şubeye taşınmıyor.
- Veritabanı: `0013_misafir_ogrenci.sql` (`students.asil_id`; asıl öğrenci başka şubede, aynı hocanın ve kendisi misafir olmayan bir kayıt olmalı). `npm run sql-test` ile yerelde denendi; Supabase'e 13 Kasım 2026'da uygulandı; sütun, iki tetikleyici ve anonim erişimin kapalı olduğu sorguyla doğrulandı.

## v0.12.0 (12 Kasım 2026)
Habersiz quiz.
- Kahoot'tan ayrı, sessiz bir ölçme modu. Ders (şube) sayfasındaki yeni "📝 Quiz" sekmesinden hoca bir soru paketinden (ya da bütün sorulardan) quiz açar: başlık, soru sayısı, süre (dakika), rastgele seçim ve "bitirince öğrenci kendi puanını görsün" seçenekleri vardır. Quiz 6 haneli bir kod alır; kod ekranda büyük gösterilir ve "Kodu perdede göster" ile tam ekran açılır.
- Öğrenci sitenin adresine girip aynı kod kutusuna quiz kodunu yazar (ders kodu değilse otomatik quiz ekranına geçilir), öğrenci numarasını girer ve soruları kendi hızında çözer. Soru sırası ve şıkların sırası her öğrencide farklıdır. Soruya numara kutucuklarıyla geçilir, süre içinde cevap değiştirilebilir, boş soru olursa bitirmeden önce uyarılır, süre dolunca quiz kendiliğinden biter. Bağlantı zayıfsa cevap telefonda tutulup sonra gönderilir; sayfa yenilenirse kaldığı yerden devam eder.
- Canlı sıralama yoktur. Hoca açık quizde kaç öğrencinin başladığını ve bitirdiğini canlı görür, "Quizi bitir" ile kapatır (bitirmeyenler o ana kadarki cevaplarla biter).
- Sonuçlar öğrenciye bağlı kaydedilir: öğrenci başına doğru sayısı, başarı, çözme süresi; soru bazında başarı (en zor soru üstte); Excel çıktısı (öğrenci sonuçları ve soru analizi iki sayfada); öğrenciye "yeniden hak ver" (denemesini silme).
- Gelişim raporu quiz cevaplarını da kullanır: "Kaynak" filtresiyle yarışma, quiz ya da ikisi birden. Quiz öğrenci numarasıyla girildiği için her cevap öğrenciye bağlanır; yarışmadaki "takma adla oynayan izlenemez" sınırı quiz için yoktur.
- Güvenlik: doğru cevap öğrenciye hiç gönderilmez, doğruluk sunucuda hesaplanır; numara şubenin listesinde olmalı; bir numara tek cihazdan, bir cihaz tek numarayla girer; süre ve kapanış sunucuda uygulanır; öğrenci tabloları okuyamaz, hoca yalnızca kendi şubesinin quizlerini görür.
- Veritabanı: `0012_quiz.sql` uygulandı (Supabase, 12 Kasım 2026; tablolar `quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_answers`). Önce `npm run sql-test` ile yerelde denendi; uygulamadan sonra RLS, politikalar ve izinler sorguyla doğrulandı (anonim kullanıcı cevap ve denemeleri okuyamaz, quiz oluşturma ve kapatma yalnızca hocaya açık). Geri alınan işlemle ikinci deneme yapılmadı.
- Denendi: öğrenci akışı tarayıcıda sahte sunucu yanıtlarıyla uçtan uca (kod, numara, üç soru, bitirme, puan). Hoca ekranları giriş gerektirdiği için canlı denenmedi; sonuç hesabı 4, gelişim hesabı 10 birim testle denendi.

## v0.11.0 (12 Kasım 2026)
Öğrenci gelişim raporu.
- Ders (şube) sayfasında yeni "📈 Gelişim" sekmesi: bilgi yarışması cevaplarından öğrenci x konu başarısı. Üstte cevap sayısı, izlenen öğrenci, sınıf başarısı ve desteğe ihtiyacı olan öğrenci sayısı; "Sınıfın konuları" bölümünde en zayıf konu üstte olacak biçimde konu başarı çubukları ve o konuda zayıf kalan öğrenci sayısı.
- Öğrenci tablosu: cevap sayısı, başarı, eğilim (ilk yarı oturumlara göre son yarının farkı, yüzde puan), güçlü ve zayıf konu. Önce zayıflar, önce başarılılar, önce gerileyenler, numara ya da ada göre sıralanır; ad ya da numarayla aranır. Satır açılınca oturum oturum başarı çizgisi, ortalama süre, puan ve her konudaki başarı görünür. Hiç cevap vermemiş öğrenciler her sıralamada sonda durur.
- Konu ölçütü seçilebilir: Otomatik (sorudaki kazanım `#OUTCOME`, yoksa paket adı), Soru paketi, Kazanım ya da Bloom düzeyi (`#BLOOM`). Bir konuda yorum için en az 3 cevap gerekir; daha azında doğru/toplam gösterilir.
- Excel çıktısı: öğrenci özeti ve her konu için başarı yüzdesi (yetersiz veride boş).
- Cevaplar, o oturumda aynı cihazdan yoklama veren öğrenciye bağlanır. Takma adla oynayanlar ve yoklaması elle girilenler izlenemez; sayıları raporda uyarı olarak gösterilir.
- Veritabanı değişikliği yok: rapor mevcut `responses`, `attendance` ve `questions` kayıtlarından tarayıcıda hesaplanır. Hesaplama `src/lib/gelisim.ts` içinde, 8 birim testle denendi. Görünüm sahte verilerle tarayıcıda denendi; gerçek ders verisiyle henüz denenmedi (veritabanında yarışma cevabı yok).

## v0.10.0 (12 Kasım 2026)
Masaüstü uygulaması ve şifreyle giriş.
- Şifreyle giriş: giriş ekranında "Şifreyle" ve "E-posta bağlantısı" sekmeleri. Panelin üstündeki "🔑 Şifre" düğmesinden şifre belirlenir (en az 8 karakter); sonraki girişlerde e-posta beklenmez, ücretsiz planın saatte 2 e-posta sınırına da takılınmaz. Seçilen yöntem hatırlanır. Supabase tarafında ek ayar ya da migration gerekmedi.
- Masaüstü uygulaması (Windows): `masaustu/` klasöründeki Electron kabuğu, canlı siteyi kendi penceresinde açar. Pencere konumu hatırlanır, `F11` tam ekran, dış bağlantılar tarayıcıda açılır, bağlantı koparsa yeniden dener, kurulum adresi menüden değiştirilebilir. Web tarafı her yayında kendiliğinden güncellenir. Kurulum, ilk giriş ve derleme: `docs/MASAUSTU.md`.
- Uygulama imzalı değildir; Windows ilk kurulumda "Bilinmeyen yayıncı" uyarısı gösterir.
- Denendi: uygulama (hem `npm start` hem paketlenmiş `AmfiOS.exe`) `--sinama` kipiyle canlı siteyi yükledi. Kurulum dosyasının kendisi bu bilgisayarda kurulup çalıştırılmadı; şifreyle giriş ekranı tarayıcıda görsel olarak denendi, gerçek bir giriş denenmedi.

## v0.9.0 (12 Kasım 2026)
Soru paketleri: ders ve haftaya göre soru setleri, akışa topluca ekleme, seri yarışma.
- Soru paketi: ders içeriğinin soru bankasındaki sorular artık paketlere ayrılır (ör. "3. hafta: Kötülük problemi"). ZOMR dosyası yüklerken paket adı verilir (dosya adından önerilir); dosyada `#PAKET:ad` satırı varsa soru kendi paketine girer. Soru bankası paketlere göre gruplanır; paket yeniden adlandırılır, silinir, tek tek soru başka pakete taşınır.
- Akışa topluca ekleme: akış düzenleyicide "Soru paketi ekle" paneli. Paket, akışın sonuna, başına ya da seçilen bir adımın (ör. bir slaytın) arkasına tek seferde eklenir; sırayı karıştırma ve "ilk N soru" sınırı vardır. Adı akışın adıyla aynı olan paket (bu haftanın paketi) listenin başında çıkar. Her adım satırında "+ Soru" düğmesi konumu o adımın arkasına alır.
- Doğrudan yükleme: aynı panelden yeni bir ZOMR dosyası yüklenip tek adımda akışa eklenebilir.
- Seri yarışma: paketin yanındaki "Yarışma akışı oluştur" yalnızca o paketin sorularından oluşan yeni bir akış açar (slaytsız Kahoot tarzı yarışma).
- Panelde ve soru bankasında "nasıl çalışır" açıklaması eklendi.
- Düzeltme: akışa adım eklerken sıra numarası artık mevcut en büyük sıradan başlıyor. Eskiden ortadan bir adım silindikten sonra eklenen adım, sondakiyle aynı sıra numarasını alıp yanlış yere düşebiliyordu.
- Paket adı sorunun `ek` alanında (`ek.paket`) tutulur; yeni tablo ya da migration gerekmedi.
- Tarayıcıda denenmedi: hoca ekranları giriş gerektirir; saf mantık (gruplama, araya yerleştirme, karıştırma) 7 birim testle denendi.

## v0.8.0 (12 Kasım 2026)
Gençlere yönelik yeni görünüm ve ders sırasında bitirme düğmeleri.
- Dersi bitir: sahnede, kumandada, ders sayfasındaki oturum listesinde ve yoklama listesinde "Dersi bitir" düğmesi var. Bitince yoklama kapanır, perdede kapanış ekranı çıkar (katılan sayısı, yoklama listesi ve ana sayfa bağlantısı), öğrencilerin telefonunda "Ders bitti" görünür. Bitmiş ders yeniden açılabilir. Daha önce ders yalnızca yeni ders başlatılınca kapanıyordu.
- Ana sayfa: sahnede ve kumandada panele dönen düğme (ders açık kalır). Canlı dersler oturum listesinde "● canlı" etiketi taşır.
- Yeni tasarım dili: hareketli aurora arka plan, canlı pembe-mor-turkuaz paleti, başlıklar için Bricolage Grotesque yazı tipi, daha yuvarlak ve basınca tepki veren düğmeler, hareketli girişler. Hareketi azaltma tercihi olan cihazlarda animasyonlar durur.
- Perde: dönen QR için parlayan çerçeve, renkli katılım sayacı, geri sayım halkası (son çeyrekte kırmızı), gradyanlı ve gölgeli şıklar, doğru şıkta vurgu ve konfeti, ilk üçlü podyum ve madalyalı puan tablosu.
- Öğrenci telefonu: daha canlı karşılama ekranı, geri sayım halkası, büyük renkli şıklar, doğru cevapta konfeti, "Ders bitti" ekranı.
- Panel: yapışkan üst çubuk, derse göre renkli şeritli kartlar.
- Veritabanı: `0011_kumanda_dersi_bitir.sql` uygulandı (Supabase, 12 Kasım 2026; kumandaya `ders_bitir` ve `ders_ac` komutları). Önce `npm run sql-test` ile yerelde denendi, uygulamadan sonra fonksiyon tanımı ve izinleri sorguyla doğrulandı.
- Tarayıcıda yalnızca öğrenci giriş ekranı (masaüstü ve telefon boyutu) görsel olarak denendi; hoca ekranları giriş gerektirdiği için henüz canlı denenmedi.

## v0.7.0 (12 Kasım 2026)
Faz 4: tartışma araçları.
- Beyin fırtınası: hoca bir soru yazar, öğrenciler telefonlarından en çok 3 kısa fikir (2-40 harf) gönderir, perdede kelime bulutu oluşur; aynı fikri yazanlar birleşir ve yazı büyür. Uygunsuz fikir perdede ya da kumandada ✕ ile gizlenir.
- Şeytanın avukatı: iki taraflı oylama (varsayılan "Katılıyorum / Katılmıyorum", istenirse özel etiketler). Öğrenci taraf seçer, isterse 200 harfe kadar gerekçe yazar ve sonuç açılana kadar fikrini değiştirebilir. Oy sayıları ve gerekçeler hoca "Sonucu göster" diyene kadar öğrencilere ve perdeye gitmez; hoca kumandada her zaman görür. Oylama yeniden açılabilir.
- Video adımı: https adresi (YouTube bağlantıları çerezsiz gömülü oynatılır, diğerleri "Videoyu aç" bağlantısı olur). Telefon modunda öğrencinin telefonunda da oynar.
- Akış düzenleyicide "Tartışma etkinliği" formu. Kumanda yeni adımları gösterir, sonucu açar/kapatır.
- Gizlilik: katkılar öğrenci kimliğine ya da cihaz kimliğine bağlanmaz; yalnızca "aynı kişi mi" denetimi için oturum anahtarıyla karılmış bir özet tutulur. Öğrenci katkı tablosunu okuyamaz.
- Windows'ta `kurulum.sql` güncellik testi satır sonu (CRLF) farkından yanlışlıkla kırılıyordu; düzeltildi.
- Güvenlik danışmanı uyarısı: `rls_auto_enable()` fonksiyonunun Data API'den çağrılabilirliği 0010 ile kapatılır.
- Veritabanı: `0010_tartisma.sql` uygulandı (Supabase, 12 Kasım 2026; önce `npm run sql-test` ile yerelde denendi, uygulamadan sonra tablo, RLS, kısıtlar ve izinler sorguyla doğrulandı). Geri alınan işlemle ikinci deneme yapılmadı. Tarayıcıda uçtan uca deneme henüz yapılmadı.

## v0.6.2 (9 Kasım 2026)
Supabase duraklatma uyarısı düzeltildi.
- Sorun: Supabase, iki günde bir başarıyla çalışan "Supabase uyandırma" iş akışına rağmen projeyi "7 günden uzun süredir yeterli hareket görmedi" diye duraklatma listesine aldı ve 7 Kasım'da uyarı e-postası gönderdi (proje o gün duraklatılmamıştı). Eski iş akışı yalnızca `saglik()` çağırıyordu; bu fonksiyon `select true` döndürür ve hiçbir tabloya dokunmaz, Supabase bunu hareket saymadı. Hareketin tanımı Supabase belgelerinde yok.
- Yeni `uyandir()` fonksiyonu gerçek bir tabloya yazar (`ozel.nabiz`, en fazla saatte bir) ve dersler ile öğrenciler tablolarını okur. İş akışı artık bunu çağırır. `saglik()` panelin bağlantı göstergesi için aynen kalır.
- Veritabanı: `0009_uyandir.sql` uygulandı (Supabase SQL Editor, 9 Kasım 2026; önce geri alınan bir işlemle denendi). Uyarının geçtiğini sonraki hafta Supabase panelinden izlemek gerekir.

## v0.6.1 (26 Ekim 2026)
Çok şubeli düzende karışıklığı önleyen düzeltmeler (6 7 şubeli bir derste hangi şubenin açık olduğu ve hangi çıktının hangi şubeye ait olduğu belli olsun).
- Şube adı perdede, kumandada ve öğrenci telefonunda görünür: "Din Felsefesi I · B". Şubesiz derslerde değişen bir şey olmaz.
- Excel çıktılarının dosya adı dersin kodunu ya da adını, şubeyi ve dönemi taşır (ör. `Yoklama Din Felsefesi I B 2026 Güz 26.10.2026.xlsx`); yedi şubenin dosyaları artık aynı ada sahip olmaz.
- Yanlış şubenin öğrencisi giremez; uyarı metni artık "bu şubenin listesinde yok, kendi şubenin kodunu ya da QR kodunu kullan" der.
- Şube çubuğundaki öğrenci sayıları liste kaydedilince hemen güncellenir.
- Oturum sayfasında dönem de görünür.
- Tarayıcıda denendi: 3 şubeli ders açma, her şubeye ayrı liste, bir şubenin oturumuna başka şubenin öğrencisinin girememesi, hafta planı, önceki dönemin yapısıyla yeni dönem planlama (içerik ve haftalar ortak, listeler boş).
- Veritabanı: `0008_sube_gorunur.sql` uygulandı (Supabase SQL Editor, 26 Ekim 2026; önce geri alınan bir işlemle denendi). Yalnızca üç fonksiyonun döndürdüğü ders adı metni değişti.

## v0.6.0 (26 Ekim 2026)
Dönemler, şubeler ve hafta planı: sistem bir seferlik ders gibi değil, yıllarca süren bir ders düzeni gibi çalışır.
- Dönem: "2026-2027 Güz" gibi ayrı bir kayıt. Başlangıç tarihiyle sıralanır, gelecek dönemler önceden açılabilir. Panelde dönem seçici ve dönemin adını değiştirme vardır.
- Şube: bir dersin o dönemdeki kolu (A, B, C...). Her şubenin kendi sınıf listesi, oturumları ve yoklaması, dolayısıyla ayrı Excel çıktısı vardır. Derse tek seferde birden çok şube açılabilir ("A, B, C"); ders sayfasında kardeş şubeler arasında geçilir, şube eklenir, ad, kod ve şube düzenlenir.
- Panel dönem ve derse göre yeniden düzenlendi: dönemdeki her ders ve şubeleri tek kartta görünür.
- Yeni dönem planla: bir önceki dönemin ders ve şube yapısı boş sınıf listeleriyle kopyalanır. İçerik (akışlar, sunumlar, sorular) zaten ortaktır, yani 2026-2027 Güz'de hazırlanan her şey 2027-2028 Güz'de de geçerlidir.
- Hafta planı: satırlar haftalar (içerikteki akışlar), sütunlar şubeler. Hangi şubede hangi hafta işlendi, yoklamaya kaç kişi katıldı görünür; işlenmemiş haftayı "Başlat" ile o şubede doğrudan başlatırsın. Haftalar okla yeniden sıralanır ve hafta eklenir.
- Var olan dersin "2026 Güz" dönemine bağlandı; öğrenci listesi ve oturumlar olduğu gibi duruyor.
- PPTX/PPT dönüştürme (eski Faz 2c) kullanıcı kararıyla kaldırıldı: sunumlar PDF olarak yüklenir.
- Veritabanı: `0007_donem_sube_plan.sql` uygulandı (Supabase SQL Editor, 26 Ekim 2026; önce geri alınan bir işlem içinde 0003 ile 0007 arası testleriyle denendi, gerçek dersin dönem bağlantısı orada doğrulandı).

## v0.5.0 (25 Ekim 2026)
Faz 2b: yalnız telefon modu.
- Ders başlatırken "Projeksiyon yok" kutusu: ders telefondaki kumandada açılır, perdede görünecek slayt öğrencilerin telefonunda görünür. Öğrenciler sitenin adresine girip kumandada yazan 6 haneli kodla katılır; yoklama açıksa yoklama da bu kodla alınır.
- Sunum yüklenirken her sayfanın küçültülmüş bir görseli (en uzun kenarı 900 piksel, WebP) hazırlanıp depoya yüklenir. Önceden yüklenmiş sunumlar için sunum kitaplığında "Telefon görsellerini hazırla" düğmesi var.
- Öğrenci görseli yalnızca telefon modundaki açık dersin perdedeki slaytı için okuyabilir; sıradaki slaytı önceden indiremez, ders bitince hiçbir görsele erişemez (veritabanı kuralı).
- Kumanda: perdedeki slaytın görselini gösterir; telefon modunu dersin içinde açıp kapatma düğmesi vardır. Oturum listesinden de kumandaya geçilir.
- Telefon modunda soru sonucunda ilk 5 öğrenci telefonlarında da görünür (perde yok).
- Sunum ya da içerik silinince sayfa görselleri de depodan silinir.
- Giriş ekranı: e-posta sınırına takılınca gerçek nedeni söyler (ücretsiz e-posta saatte 2 ile sınırlı). `docs/KURULUM.md` kendi e-posta sunucusunu bağlama adımlarını anlatır.
- Tarayıcıda denendi: sunum yükleyince görseller üretilir; girişsiz (anon) öğrenci yalnızca perdedeki slaytın görselini okur, kumandadan ilerleyince erişim de ilerler, telefon modu kapanınca tamamen kapanır.
- Veritabanı: `0006_telefon_modu.sql` uygulandı (Supabase SQL Editor, 25 Ekim 2026; önce geri alınan bir işlem içinde 0003 ile 0006 arası testleriyle denendi).

## v0.4.0 (19 Ekim 2026)
Faz 3: soru bankası ve bilgi yarışması.
- Soru bankası: ders içeriğine bağlı, her yıl kullanılır. ZOMR biçimindeki sorular (#QUESTION, #CORRECT, #WRONG; isteğe bağlı #EASINESS, #BLOOM, #OUTCOME) yapıştırılarak ya da .txt dosyasından içe aktarılır. Hatalı sorular nedeniyle listelenir, sağlamlar alınır. Her sorunun cevap süresi ayrı ayarlanır.
- Akışa soru adımı: bankadan seçilen sorular slaytların arasına eklenir; yalnızca sorulardan oluşan akışla slaytsız yarışma yapılır.
- Sahne: soru, renkli ve harfli şıklar (her oturumda karışık sıra), geri sayım ve gelen cevap sayısı. Süre bitince ya da "Cevabı göster" ile doğru şık, şıklara göre dağılım ve ilk 5. Her an açılabilen puan tablosu (ilk 10).
- Puan: doğru cevap 500 ile 1000 arası, ne kadar erken o kadar çok; yanlış 0. Doğruluk ve puan sunucuda hesaplanır.
- Öğrenci telefonu: aynı renkli şık düğmeleri; sonuçta doğru/yanlış, puan, toplam ve sıra. Yoklaması alınan öğrenci adıyla ("Ali Y."), yoklamasız derste takma adla yarışır.
- Kumanda: soruyu, şıkları, cevap sayısını ve ilk 5'i gösterir; "Cevabı göster" düğmesi.
- Oturum sayfası: yarışma sonuçları tablosu ve Excel'e aktarma.
- Veritabanı: `0005_bilgi_yarismasi.sql` uygulandı (Supabase SQL Editor, 19 Ekim 2026; önce geri alınan bir işlem içinde 0003, 0004 ve 0005 testleriyle denendi).

## v0.3.1 (19 Ekim 2026)
Dersler yıllarca kullanılabilsin.
- Ders içeriği: akışlar ve sunumlar artık dönemden bağımsız bir ders içeriğinde durur. Her dönemin dersi (sınıf listesi, oturumlar, yoklamalar) bu içeriğe bağlanır. Aynı içerik birden fazla döneme bağlanabilir; içerikte yapılan değişiklik hepsinde görünür.
- Ders sayfasında "Bu dersin yeni dönemini aç": aynı içerikle yeni dönem açılır, sınıf listesi ve yoklamalar boş başlar.
- Yeni ders açarken önceki bir dersin içeriği seçilebilir. Seçilmezse dersin adıyla yeni içerik açılır.
- Bir dönemin dersi silinince içerik silinmez. Hiçbir döneme bağlı olmayan içerikler panelde listelenir; buradan silinebilir (sunum dosyalarıyla birlikte).
- Karekodsuz başlatma: ders başlatırken "Yoklama al" kutusu kaldırılırsa yoklama kapalı başlar, perdede QR çıkmaz; gerekirse dersin içinde açılır. Yoklamasız derste sınıf listesi gerekmez.
- Veritabanı: `0004_ders_icerigi.sql` uygulandı (Supabase SQL Editor, 19 Ekim 2026; önce geri alınan bir işlem içinde testleriyle denendi). Mevcut ders için kendi adıyla bir içerik açıldı.

## v0.3.0 (19 Ekim 2026)
Faz 2a: ders akışı ve slayt.
- Ders akışları: her derse haftalık akışlar açılır. Akış, perdede sırayla gösterilecek adımlardır (şimdilik yoklama ve slayt). Adımlar sürüklenerek ya da oklarla sıralanır, silinir.
- Sunum yükleme (PDF): her sayfa akışa ayrı bir adım olarak eklenir. Sayfaların metni yüklerken tarayıcıda çıkarılır. Sunumlar dersin kitaplığında durur, başka akışlarda da kullanılabilir. PPTX/PPT desteği Faz 2c'de gelecek.
- Sahne: akışın o anki adımı yoklamaysa QR ekranı, slaytsa slayt tam ekran görünür. Klavyenin ok tuşları, PageUp/PageDown ve boşluk ile (sunum kumandaları da bu tuşları gönderir) ilerlenir.
- Kumanda: sahnedeki "Kumanda" düğmesi hocaya özel bir QR gösterir; telefonla okutunca giriş gerekmeden önceki/sonraki, adım listesi, yoklama aç/kapat ve ders kodu telefonda olur.
- Ders kodu: perdede 6 haneli, dakikada bir değişen bir kod görünür. Geç gelen öğrenci sitenin adresine girip kodu yazar; yoklama açıksa yoklamaya da yazılır.
- Öğrenci ekranı: katıldıktan sonra telefonda perdedeki slaytın metni görünür, slayt değişince kendiliğinden güncellenir.
- Sitenin kök adresi öğrenciye ders kodu formunu açar; giriş yapmış hoca doğrudan paneline gider.
- Ders silinince sunum dosyaları da depodan silinir.
- `npm run sql-test`: migration'lar ve SQL testleri bilgisayarda Postgres kurmadan (PGlite ile) denenir.
- Veritabanı: `0003_ders_akisi.sql` uygulandı (Supabase SQL Editor, 19 Ekim 2026; önce geri alınan bir işlem içinde testleriyle denendi).

## v0.2.2 (18 Ekim 2026)
- Sınıf listesi yapıştırma: boşlukla ayrılmış satırlar da okunur ("22010101001 Ali Yılmaz" gibi, PDF, Word ya da web sayfasından kopyalanan listeler). Önceden bu satırların hepsi atlanıyordu.
- Excel dar sütundaki numarayı "2,2E+10" diye kopyaladığında uyarı çıkar; hiç öğrenci bulunamazsa beklenen biçim gösterilir.
- Bu kurulumda hoca hesabı başka bir e-posta adresine taşındı, mevcut ders de yeni hesaba geçti (Supabase SQL Editor, elle, 18 Ekim 2026). Migration değişmedi.

## v0.2.1 (18 Ekim 2026)
Bağımsız kurulum: program başka hocalara verilebilir, her kopya kendi başına çalışır.
- Supabase adresi ve anahtarı koddan çıkarıldı; site bunları `public/ayarlar.json` dosyasından okur. Dosya doldurulmamışsa "Kurulum tamamlanmamış" ekranı çıkar.
- Site göreli yollarla derlenir; depo adı ne olursa olsun çalışır.
- Hoca e-postası migration'dan çıkarıldı. Yeni kurulumda siteye ilk giren hoca "Kurulumu sahiplen" ile sahibi olur.
- `supabase/kurulum.sql`: yeni kurulum için bütün migration'lar tek dosyada (`npm run kurulum-sql` ile üretilir, test güncelliğini denetler).
- `docs/KURULUM.md`: başka bir hocanın kendi kopyasını kurması için adım adım kılavuz.
- Supabase uyandırma iş akışı adresi `ayarlar.json`'dan okur.

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
- Veritabanı: `0002_yoklama.sql` (tablolar, RLS, `qr_token`, `katilim_bileti`, `check_in` RPC'leri). Uygulandı (Supabase SQL Editor, `kurulum.sql` ile, 18 Ekim 2026).

## v0.1.0 (18 Ekim 2026)
- Vite + React + TypeScript + Tailwind iskeleti
- Sayfalar: `#/panel` (hoca), `#/sahne/:oturumId` (projeksiyon), `#/katil` (öğrenci)
- Supabase istemcisi; panelde canlı bağlantı göstergesi
- GitHub Actions: Pages'e otomatik yayın, iki günde bir Supabase uyandırma
- Veritabanı: `0001_saglik.sql` uygulandı (Supabase SQL Editor, 18 Ekim 2026)

## v0.0.1 (18 Ekim 2026)
- Proje başlatıldı: CLAUDE.md, mimari, yol haritası, prototip incelemesi.
