# Kısa alan adı (örn. zapedu.app) kurulumu

Site kodu adresten bağımsızdır (göreli yol, `HashRouter`, perdedeki adres `window.location` üzerinden yazılır). Alan adı eklemek için kodda değişiklik gerekmez; gereken yalnızca satın alma, DNS, GitHub ayarı ve Supabase giriş adresi.

## 1. Satın alma (senin yaptığın)
- Önerilen: **zapedu.app** (yıllık yaklaşık 14 dolar, `.xyz` yaklaşık 11 dolar; fiyat yıllıktır, aylık değil).
- Kayıt şirketi: Cloudflare Registrar (domains.cloudflare.com). Maliyetine satar, yenileme fiyatı ilk yılla aynıdır. Hesap ve kart bilgisi sende kalır.
- Satın alırken **WHOIS gizliliğini açık** bırak (Cloudflare varsayılan olarak gizler), kişisel adres herkese açık görünmesin.

## 2. DNS (Cloudflare'de)
`zapedu.app` için, **Proxy kapalı (gri bulut, "DNS only")** olacak şekilde:

| Tür | Ad | Değer |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | omferdem.github.io |

(GitHub Pages adresleri; değişirse GitHub dokümanındaki "Managing a custom domain" sayfasında güncel liste vardır.) `@` için başka A/AAAA/CNAME kaydı bırakma, HTTPS sertifikası çıkmayabilir.

## 3. GitHub (Settings > Pages)
- **Custom domain** kutusuna `zapedu.app` yaz, kaydet. DNS doğrulanınca **Enforce HTTPS** kutusu açılır (24 saate kadar sürebilir); işaretle.
- Eski adres (`omferdem.github.io/zaphyros-amfi`) GitHub tarafından yeni alan adına yönlendirilir; yazılı kaynaklar ve eski karekodlar çalışmaya devam eder.

## 4. Supabase giriş adresi (hoca girişi için şart)
Hoca girişi e-postadaki bağlantıyla yapılır; bağlantı sitenin adresine döner, bu yüzden yeni adres Supabase'in izinli listesinde olmalı.
- Depo Settings > Secrets and variables > Actions > **Variables** altında `SITE_ADRESI` = `https://zapedu.app/` ekle.
- Actions > "Supabase işlemleri" > Run workflow > `auth-ayar`. Site URL yeni adres olur, github.io adresi ve `localhost` izinli listede kalır.

## 5. Sonrası
- Masaüstü uygulamasının varsayılan adresi (`masaustu/main.cjs`, `docs/MASAUSTU.md`) yönlendirmeyle çalışmaya devam eder; yeni sürümde yeni adrese çekilir.
- `docs/MIMARI.md` ve `README.md` içindeki canlı adres güncellenir.
- İlk denemede: perdede "Adres:" satırı `zapedu.app` göstermeli, öğrenci karekodu `https://zapedu.app/#/katil?...` ile açılmalı, hoca girişi (e-posta bağlantısı) denenmeli.

## Geri dönüş
Alan adı ayarı silinirse (GitHub'da Custom domain kutusunu boşalt) site `omferdem.github.io/zaphyros-amfi` adresinde eskisi gibi çalışır. Alan adının kendisi yıllık yenilenir; yenilemezsen kaybolur, başka bir şey etkilenmez.
