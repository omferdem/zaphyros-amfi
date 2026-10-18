# Kendi AmfiOS kurulumunu yapmak

AmfiOS'u kullanmak isteyen her hoca kendi kopyasını kurar. Kopyan tamamen sana aittir: öğrencilerin, derslerin ve yoklama kayıtların kendi Supabase projende durur. Programı sana veren kişi ya da başka bir hoca bu verileri göremez, senin kurulumunu yönetemez ve sen de onlara bağlı değilsin.

Gereken iki ücretsiz hesap: **GitHub** (sitenin yayınlandığı yer) ve **Supabase** (veritabanı). Kurulum yaklaşık 20 dakika sürer ve bir kez yapılır.

## 1. Kodun kopyasını al

1. GitHub'a giriş yap ve AmfiOS deposunun sayfasını aç.
2. Sağ üstteki **Use this template > Create a new repository** düğmesine bas. (Bu düğme yoksa **Fork** kullan.)
3. Depoya bir ad ver (ör. `amfi`), **Public** seç ve oluştur.

Sitenin adresi şöyle olacak: `https://<github-kullanıcı-adın>.github.io/<depo-adı>/`

## 2. Supabase projesini aç

1. https://supabase.com adresinde hesap aç, **New project** ile yeni bir proje oluştur. Bölge olarak **Central EU (Frankfurt)** seç. Veritabanı şifresini bir yere not et (AmfiOS bu şifreyi kullanmaz, ama Supabase ister).
2. Proje açılınca soldaki menüden **SQL Editor**'e gir.
3. Kendi deponda `supabase/kurulum.sql` dosyasını aç, **Raw** görünümünde içeriğin tamamını kopyala, SQL Editor'e yapıştır ve **Run** de. "Success" yazısını görmelisin.

## 3. Siteyi kendi veritabanına bağla

1. Supabase'de **Project Settings > Data API** sayfasından **Project URL**'yi, **Project Settings > API Keys** sayfasından **publishable** anahtarı kopyala. (`service_role` ya da `secret` yazan anahtarı **asla** kullanma.)
2. GitHub'da kendi deponda `public/ayarlar.json` dosyasını aç, kalem simgesiyle düzenle ve iki değeri kendi değerlerinle değiştir:

```json
{
  "supabaseUrl": "https://senin-projen.supabase.co",
  "supabaseKey": "sb_publishable_..."
}
```

3. **Commit changes** ile kaydet.

## 4. Yayını aç

1. Deponda **Settings > Pages** sayfasında **Source** olarak **GitHub Actions** seç.
2. **Actions** sekmesine gir. İş akışlarını onaylaman istenirse onayla. **Yayınla** iş akışı birkaç dakikada biter; site adresin yukarıdaki adrestir.

## 5. Giriş adresini Supabase'e tanıt

Supabase'de **Authentication > URL Configuration** sayfasında:

- **Site URL**: `https://<github-kullanıcı-adın>.github.io/<depo-adı>/`
- **Redirect URLs**: aynı adresi ekle.

Bu yapılmazsa e-postana gelen giriş bağlantısı çalışmaz.

## 6. Kurulumu sahiplen

1. Siteni aç, e-posta adresini yaz ve gelen bağlantıya **aynı tarayıcıda** tıkla.
2. "Bu kurulum henüz kimseye ait değil" ekranında **Kurulumu sahiplen** de.

Artık bu kurulumun tek hocası sensin. Başka biri siteye girse bile ders açamaz, verilerini göremez.

## Bilmen gerekenler

- **Uyandırma:** Supabase'in ücretsiz projeleri bir hafta hiç kullanılmazsa duraklatılır. Deponda bunu önleyen bir iş akışı (Supabase uyandırma) iki günde bir çalışır; Actions açık olduğu sürece bir şey yapman gerekmez.
- **Sınırlar:** Ücretsiz Supabase planı aynı anda 200 bağlantıya kadar yeter. Daha kalabalık amfiler için Supabase'in ücretli planı gerekebilir.
- **Gizlilik:** Depo herkese açıktır ama içinde öğrenci verisi yoktur; veriler yalnızca senin Supabase projende durur. Öğrenciden yalnızca numara ve ad soyad tutulur.
- **Güncelleme:** Yeni sürümler `supabase/migrations` altına numaralı yeni SQL dosyaları ekleyebilir. Güncellerken kodu yenile ve yalnızca daha önce çalıştırmadığın numaralı dosyaları sırayla SQL Editor'de çalıştır.
