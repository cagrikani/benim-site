# Fizik Atölyesi

Türkiye Yüzyılı Maarif Modeli ile uyumlu, etkileşimli fizik deneyleri ve
serbest simülasyonlar için hazırlanan web portalıdır.

## Visual Studio Code ile çalıştırma

1. Visual Studio Code'da `fizik-atolyesi` klasörünü açın.
2. Terminalde `npm install` komutunu çalıştırın.
3. `npm run dev` komutuyla yerel geliştirme sunucusunu başlatın.
4. Terminalde gösterilen yerel adresi tarayıcıda açın.

## Sunucu paketi

`npm run build:static` komutu, herhangi bir statik web sunucusuna veya GitHub
Pages'e yüklenebilen dosyaları `sunucu-paketi` klasöründe üretir. Paket göreli
dosya yolları kullandığından bir alt klasörde de çalışabilir.

## Ana yapı

- İlgi çekici, özgün ve telif sorunu taşımayan Fizik Atölyesi ana sayfası
- Fizik Deney Setleri ve Serbest Deney ve Simülasyon olarak iki ana çalışma yolu
- Deney setleri altında Mekanik, Elektrik, Dalgalar-Optik ve Modern Fizik alanları
- Serbest çalışma altında sekiz fizik konu alanı
- Henüz hazırlanmayan bütün alanlar için çalışan bekleme sayfaları
- Masaüstü, tablet ve telefonlara uyumlu responsive tasarım

## Açık deney seti: Mekanik

- Serbest vektör çalışma alanı
- Hava rayında düzgün ve sabit ivmeli hareket
- Serbest düşme
- İki boyutta hareket
- İki boyutlu çarpışmalar
- Balistik sarkaç
- Dönme dinamiği ve tork

Mekanik deneylerinde öğrenciler düzenekleri kurabilir, ölçüm alabilir, grafikleri
inceleyebilir ve kanıta dayalı kısa deney raporlarını yazabilir.

## Açık deney seti: Dalgalar - Optik

- Cam blokta ışığın kırılması ve yanal kayma
- 60 derece prizmada sapma açısı
- Dik üçgen prizmada tam yansıma

Optik deneyinde öğrenciler optik rayı sürükleyerek kurabilir, ışın yoluna ilişkin
hipotez oluşturabilir; kırmızı, yeşil ve mavi ışığı karşılaştırabilir; iki
kırılma veya iki tam yansıma sonrasında ışının ekrana ulaştığını gözleyebilir.
Optik tabla çevrildiğinde cam eleman aynı eksende döner; ışın yolu, dönen
yüzeylerle kesişim ve Snell yasası kullanılarak yeniden hesaplanır.

## Açık deney seti: Modern Fizik

- Cıva tayfı ve gerçek h/e aparatıyla fotoelektrik etki
- Işık şiddeti, fotoakım ve durdurma gerilimi karşılaştırması
- Frekans-durdurma gerilimi grafiğinden Planck sabiti ve iş fonksiyonu

Öğrenciler ışık kaynağı, kırınım ağı, fotodiyot, filtreler ve multimetreden
oluşan düzeneği kurar; fototüpü boşaltıp ölçüm alır, verilerini grafikle
karşılaştırır ve fotoelektrik etkinin günlük yaşam uygulamalarını yorumlar.
