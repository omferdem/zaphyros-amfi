"""Soru taslaklarını okur, sayar ve şık uzunluğu dengesini denetler. Kullanım: python -I scripts/soru-kontrol.py [--zomr cikti_klasoru]"""
import collections
import json
import glob
import os
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


def main():
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
