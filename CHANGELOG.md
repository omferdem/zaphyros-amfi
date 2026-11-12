# Sürüm Geçmişi

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
