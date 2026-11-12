# Sürüm Geçmişi

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
