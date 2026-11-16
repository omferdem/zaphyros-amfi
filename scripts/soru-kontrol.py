"""Soru taslaklarını okur, sayar ve şık uzunluğu dengesini denetler. Kullanım: python -I scripts/soru-kontrol.py [--zomr cikti_klasoru]

Yeni biçim (docs/soru-onerileri/yeni): python -I scripts/soru-kontrol.py --yeni docs/soru-onerileri/yeni/h01-h02.txt [--slayt slayt_metni.txt]
Yeni kip şunları denetler: tür başına soru sayısı, doğru şık konumu dağılımı, doğru şıkkın en uzun/en kısa çıkma oranı,
mutlak ya da ele veren çeldirici (hiçbir, tamamen, önemsiz, yabancı...), şıkların birbirine oranı, boşluk doldurma kalıbı,
slayt cümlesini kopyalama (ortak 7 kelimelik dizi), tekrar eden şık ve soru. Hata varsa çıkış kodu 1 olur."""
import collections
import json
import glob
import os
import random
import re
import sys

KAYNAK = os.path.join(os.path.dirname(__file__), '..', 'docs', 'soru-onerileri', 'kaynak')
ZORLUK = {'k': 'kolay', 'o': 'orta', 'z': 'zor'}
BLOOM = {'H': 'Hatırlama', 'A': 'Anlama', 'U': 'Uygulama', 'N': 'Analiz', 'D': 'Değerlendirme'}


def oku():
    sorular = []
    for dosya in sorted(glob.glob(os.path.join(KAYNAK, 'h*.txt'))):
        for no, satir in enumerate(open(dosya, encoding='utf8'), 1):
            satir = satir.rstrip('\n')
            if not satir.strip():
                continue
            p = satir.split('|')
            if len(p) != 10:
                raise SystemExit(f'{os.path.basename(dosya)}:{no}: 10 alan olmalı, {len(p)} var')
            hafta, tur, soru, dogru, y1, y2, y3, konu, z, b = p
            sorular.append(dict(hafta=int(hafta), tur=tur, soru=soru.strip(), dogru=dogru.strip(), yanlis=[y1.strip(), y2.strip(), y3.strip()], konu=konu.strip(), zorluk=ZORLUK[z], bloom=BLOOM[b], yer=f'{os.path.basename(dosya)}:{no}'))
    return sorular


def paket_adi(s):
    if s['tur'] == 'Z':
        return f"{s['hafta']}. hafta: Hızlı Zapoot (20 kısa soru)"
    return f"{s['hafta']}. hafta: Ciddi Quiz ({13 if s['hafta'] == 14 else 15} soru)"


def en_uzun_mu(s):
    # Kısa tek kelimelik şıklarda uzunluk ipucu olmaz; belirgin biçimde uzun ve uzun metinli doğru şıkkı say
    o = len(s['dogru'])
    return o >= 30 and o > 1.35 * max(len(y) for y in s['yanlis'])


def zorluk_ata(sorular):
    """Zorluk dağılımını %40 kolay, %40 orta, %20 zor yapar: her (hafta, tür) grubunda sorular Bloom düzeyine ve metin uzunluğuna göre sıralanır."""
    sira = {'Hatırlama': 0, 'Anlama': 1, 'Uygulama': 2, 'Analiz': 3, 'Değerlendirme': 4}
    gruplar = collections.defaultdict(list)
    for s in sorular:
        gruplar[(s['hafta'], s['tur'])].append(s)
    for liste in gruplar.values():
        liste.sort(key=lambda s: (sira[s['bloom']], len(s['soru']) + len(s['dogru'])))
        n = len(liste)
        for i, s in enumerate(liste):
            s['zorluk'] = 'kolay' if i < n * 0.4 else 'orta' if i < n * 0.8 else 'zor'


def sql_tirnak(m):
    return "'" + m.replace("'", "''") + "'"


MUTLAK = re.compile(r'\b(hiçbir\w*|hiç|tamamen|kesinlikle|asla|önemsiz|yabancı|saçma|alakasız|her zaman|daima|hepsi|hiçbiri|yalnızca|sadece)\b', re.I)
BOSLUK = re.compile(r'(\.\.\.|…|_{2,}|\(\s*\)|\?\s*$)')


def yeni_oku(yol):
    """10 alanlı kaynak (doğru şık önce) okunur; doğru şıkkın A-D konumu her (hafta, tür) paketinde dengeli ve tekrarsız dağıtılır."""
    satirlar = []
    for no, satir in enumerate(open(yol, encoding='utf8'), 1):
        satir = satir.rstrip('\n')
        if not satir.strip() or satir.startswith('#'):
            continue
        p = [x.strip() for x in satir.split('|')]
        if len(p) != 10:
            raise SystemExit(f'{os.path.basename(yol)}:{no}: 10 alan olmalı, {len(p)} var')
        satirlar.append((no, p))
    gruplar = collections.defaultdict(list)
    for i, (no, p) in enumerate(satirlar):
        gruplar[(int(p[0]), p[1])].append(i)
    harf_of = {}
    for gi, (anahtar, idler) in enumerate(sorted(gruplar.items())):
        n = len(idler)
        harfler = list('ABCD' * (n // 4 + 2))[gi % 4:gi % 4 + n]
        rnd = random.Random(1000 + gi)
        for _ in range(500):
            rnd.shuffle(harfler)
            if not any(harfler[i] == harfler[i + 1] == harfler[i + 2] for i in range(n - 2)):
                break
        for i, h in zip(idler, harfler):
            harf_of[i] = h
    sorular = []
    for i, (no, p) in enumerate(satirlar):
        hafta, tur, soru, dogru, y1, y2, y3, konu, zorluk, bloom = p
        harf = harf_of[i]
        yanlis = [y1, y2, y3]
        sik = []
        for k in 'ABCD':
            sik.append(dogru if k == harf else yanlis.pop(0))
        sorular.append(dict(hafta=int(hafta), tur=tur, soru=soru, sik=sik, harf=harf, dogru=dogru, yanlis=[y1, y2, y3], konu=konu, zorluk=zorluk, bloom=bloom, yer=f'{os.path.basename(yol)}:{no}'))
    return sorular


def yeni_yaz(sorular, yol):
    """Okunaklı döküm (Markdown): hafta ve türe göre bölümler, şıklar harfli, doğru şık işaretli."""
    with open(yol, 'w', encoding='utf8', newline='\n') as f:
        f.write('# Din Felsefesi I: 1. ve 2. hafta soru taslağı (yeniden yazım)\n\n')
        f.write('Her paketin altında soru numarası, şıklar, doğru şık, konu, zorluk (yazar tahmini) ve Bloom düzeyi vardır. Onaylanmadan veritabanına eklenmez.\n')
        for (h, t) in sorted({(x['hafta'], x['tur']) for x in sorular}, key=lambda a: (a[0], 0 if a[1] == 'Z' else 1)):
            f.write(f"\n## {h}. hafta: {'Zapoot' if t == 'Z' else 'Quiz'}\n")
            for i, x in enumerate([y for y in sorular if y['hafta'] == h and y['tur'] == t], 1):
                f.write(f"\n**{i}.** {x['soru']}\n\n")
                for k, o in zip('ABCD', x['sik']):
                    f.write(f"- {k}) {o}{'  ✔' if k == x['harf'] else ''}\n")
                f.write(f"\n*{x['konu']} · {x['zorluk']} · {x['bloom']}*\n")


def kelimeler(m):
    return re.findall(r'\w+', m.lower())


def slayt_kopyasi(soru, slayt_kelimeleri, n=7):
    k = kelimeler(soru)
    parcalar = {tuple(slayt_kelimeleri[i:i + n]) for i in range(len(slayt_kelimeleri) - n + 1)}
    return any(tuple(k[i:i + n]) in parcalar for i in range(len(k) - n + 1))


def yeni_kontrol(yol, slayt_yolu=None):
    sorular = yeni_oku(yol)
    slayt = kelimeler(open(slayt_yolu, encoding='utf8').read()) if slayt_yolu else []
    hatalar = []
    uyarilar = []
    gruplar = collections.defaultdict(list)
    for s in sorular:
        gruplar[(s['hafta'], s['tur'])].append(s)
    goruldu = set()
    for s in sorular:
        if s['soru'].lower() in goruldu:
            hatalar.append(('tekrar eden soru', s['yer']))
        goruldu.add(s['soru'].lower())
        if len(set(o.lower() for o in s['sik'])) != 4:
            hatalar.append(('tekrar eden şık', s['yer']))
        if BOSLUK.search(s['soru'][:-1]) or not s['soru'].rstrip().endswith('?'):
            hatalar.append(('soru işaretiyle bitmiyor ya da boşluk doldurma kalıbı', s['yer']))
        if len(s['soru']) < 45:
            uyarilar.append(('soru çok kısa, bağlamsız olabilir', s['yer']))
        uz = [len(o) for o in s['sik']]
        if max(uz) > 2.2 * min(uz):
            uyarilar.append((f'şık uzunlukları çok farklı ({min(uz)} ile {max(uz)})', s['yer']))
        if any(MUTLAK.search(y) for y in s['yanlis']) and not MUTLAK.search(s['dogru']):
            uyarilar.append(('çeldiricide mutlak/ele veren sözcük: ' + ', '.join(sorted({m.group(0).lower() for y in s['yanlis'] for m in MUTLAK.finditer(y)})), s['yer']))
        if re.search(r'(hepsi|hiçbiri|hiçbirisi|yukarıdakilerin)', ' '.join(s['sik']), re.I):
            hatalar.append(('hepsi/hiçbiri şıkkı', s['yer']))
        if slayt and slayt_kopyasi(s['soru'], slayt):
            hatalar.append(('soru slayt cümlesini kopyalıyor (7 kelimelik ortak dizi)', s['yer']))
    print('GRUP  adet  konum(A/B/C/D)  doğru en uzun  doğru en kısa  ort. doğru/çeldirici uzunluk')
    for (h, t), liste in sorted(gruplar.items()):
        n = len(liste)
        beklenen = 20 if t == 'Z' else 15
        if n != beklenen:
            hatalar.append((f'{h}. hafta {t} paketinde {n} soru var, {beklenen} olmalı', ''))
        konum = collections.Counter(x['harf'] for x in liste)
        en_uzun = sum(len(x['dogru']) == max(len(o) for o in x['sik']) and sum(len(o) == len(x['dogru']) for o in x['sik']) == 1 for x in liste)
        en_kisa = sum(len(x['dogru']) == min(len(o) for o in x['sik']) and sum(len(o) == len(x['dogru']) for o in x['sik']) == 1 for x in liste)
        oran = sum(len(x['dogru']) / (sum(len(y) for y in x['yanlis']) / 3) for x in liste) / n
        print(f"{h}{t}    {n:>3}   {konum['A']}/{konum['B']}/{konum['C']}/{konum['D']}          {en_uzun}/{n}          {en_kisa}/{n}          {oran:.2f}")
        pay = n / 4
        for harf in 'ABCD':
            if konum[harf] < pay * 0.6 or konum[harf] > pay * 1.5:
                hatalar.append((f'{h}{t}: doğru şık konumu dengesiz ({harf}: {konum[harf]}/{n})', ''))
        if en_uzun > n * 0.40:
            hatalar.append((f'{h}{t}: doğru şık çok sık en uzun ({en_uzun}/{n}); beklenen oran yaklaşık %25', ''))
        if en_kisa < n * 0.12:
            uyarilar.append((f'{h}{t}: doğru şık nadiren en kısa ({en_kisa}/{n})', ''))
        if not 0.85 <= oran <= 1.20:
            hatalar.append((f'{h}{t}: doğru şıkkın ortalama uzunluğu çeldiricilerden belirgin farklı ({oran:.2f})', ''))
    z = collections.Counter(x['zorluk'] for x in sorular)
    print('zorluk (yazar tahmini):', dict(z))
    for u in uyarilar:
        print('UYARI', *u)
    for h in hatalar:
        print('HATA', *h)
    print(f'{len(sorular)} soru, {len(hatalar)} hata, {len(uyarilar)} uyarı')
    return 1 if hatalar else 0


def main():
    if '--yeni' in sys.argv:
        yol = sys.argv[sys.argv.index('--yeni') + 1]
        slayt = sys.argv[sys.argv.index('--slayt') + 1] if '--slayt' in sys.argv else None
        if '--yaz' in sys.argv:
            yeni_yaz(yeni_oku(yol), sys.argv[sys.argv.index('--yaz') + 1])
            print('Döküm yazıldı:', sys.argv[sys.argv.index('--yaz') + 1])
        raise SystemExit(yeni_kontrol(yol, slayt))
    sorular = oku()
    zorluk_ata(sorular)
    sayac = collections.Counter((s['hafta'], s['tur']) for s in sorular)
    for h in range(1, 15):
        print(h, 'Z', sayac[(h, 'Z')], 'Q', sayac[(h, 'Q')])
    z = collections.Counter(s['zorluk'] for s in sorular)
    print('zorluk', dict(z))
    for t in 'ZQ':
        alt = [s for s in sorular if s['tur'] == t]
        print(t, 'doğru en uzun:', sum(en_uzun_mu(s) for s in alt), '/', len(alt))
    hata = []
    for s in sorular:
        tum = [s['dogru']] + s['yanlis']
        if len(set(tum)) != 4:
            hata.append(('tekrar eden şık', s['yer']))
        if any(re.search(r'(^|\s)(hepsi|hiçbiri|hiçbirisi)(\s|$)', o, re.I) for o in tum):
            hata.append(('hepsi/hiçbiri', s['yer']))
    for h in hata:
        print('HATA', *h)
    if '--zomr' in sys.argv:
        klasor = sys.argv[sys.argv.index('--zomr') + 1]
        os.makedirs(klasor, exist_ok=True)
        gruplar = collections.defaultdict(list)
        for s in sorted(sorular, key=lambda x: (x['hafta'], x['tur'], x['yer'])):
            gruplar[(s['hafta'], s['tur'])].append(s)
        for (h, t), liste in gruplar.items():
            ad = f"hafta{h:02d}_{'zapoot' if t == 'Z' else 'quiz'}.txt"
            with open(os.path.join(klasor, ad), 'w', encoding='utf8', newline='\n') as f:
                for s in liste:
                    f.write(f"#QUESTION:{s['soru']}\n#CORRECT:{s['dogru']}\n")
                    for y in s['yanlis']:
                        f.write(f'#WRONG:{y}\n')
                    f.write(f"#PAKET:{paket_adi(s)}\n#KONU:{s['konu']}\n#ZORLUK:{s['zorluk']}\n#BLOOM:{s['bloom']}\n\n")
        print('ZOMR dosyaları yazıldı:', klasor)
    if '--sql' in sys.argv:
        yol = sys.argv[sys.argv.index('--sql') + 1]
        satirlar = [
            "-- Din Felsefesi I: her hafta paketine 20 Zapoot ve 20 Quiz sorusu eklenir (aynı soru metni varsa atlanır).",
            "-- Zapoot soruları 20, quiz soruları 60 saniye süreyle eklenir. Kaynak: docs/soru-onerileri/kaynak, üreten: scripts/soru-kontrol.py.",
            "do $$",
            "declare v_icerik uuid;",
            "begin",
            "  select id into v_icerik from public.subjects where ad = 'Din Felsefesi I' limit 1;",
            "  if v_icerik is null then raise exception 'Din Felsefesi I içeriği bulunamadı'; end if;",
        ]
        for s in sorular:
            sure = 20 if s['tur'] == 'Z' else 60
            ek = json.dumps({'paket': paket_adi(s), 'konu': s['konu'], 'zorluk': s['zorluk'], 'bloom': s['bloom']}, ensure_ascii=False)
            yl = 'array[' + ', '.join(sql_tirnak(y) for y in s['yanlis']) + ']'
            satirlar.append('  insert into public.questions (subject_id, soru, dogru, yanlislar, sure_sn, ek)')
            satirlar.append(f"  select v_icerik, {sql_tirnak(s['soru'])}, {sql_tirnak(s['dogru'])}, {yl}, {sure}, {sql_tirnak(ek)}::jsonb")
            satirlar.append(f"  where not exists (select 1 from public.questions q where q.subject_id = v_icerik and lower(q.soru) = lower({sql_tirnak(s['soru'])}));")
        satirlar.append('end $$;')
        with open(yol, 'w', encoding='utf8', newline=chr(10)) as f:
            f.write(chr(10).join(satirlar) + chr(10))
        print('SQL yazıldı:', yol)


if __name__ == '__main__':
    main()
