import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("sunucu paketi Fizik Atölyesi olarak taşınabilir yapıdadır", async () => {
  const html = await readFile(new URL("sunucu-paketi/index.html", projectRoot), "utf8");
  assert.match(html, /<html lang="tr">/i);
  assert.match(html, /<title>Fizik Atölyesi \| Merak Et, Kur, Keşfet<\/title>/i);
  assert.match(html, /\.\/assets\/index-[^"]+\.js/i);
  assert.match(html, /\.\/assets\/index-[^"]+\.css/i);
  await access(new URL("sunucu-paketi/assets", projectRoot));
  await access(new URL("sunucu-paketi/fizik-atolyesi-hero.png", projectRoot));
  const realisticCardImages = [
    "portal-mechanics.webp",
    "portal-electricity.webp",
    "portal-optics.webp",
    "portal-modern.webp",
    "free-force-motion.webp",
    "free-energy.webp",
    "free-pressure.webp",
    "free-electric-magnetic.webp",
    "free-heat.webp",
    "free-waves.webp",
    "free-optics.webp",
    "free-modern.webp",
    "mechanics-vectors.webp",
    "mechanics-motion.webp",
    "mechanics-freefall.webp",
    "mechanics-two-dimensional.webp",
    "mechanics-collisions.webp",
    "mechanics-ballistic.webp",
    "mechanics-torque.webp",
    "electricity-ohm.webp",
    "electricity-resistors.webp",
    "optics-mirrors.webp",
    "optics-plane-mirror.webp",
    "optics-concave-mirror.webp",
    "optics-convex-mirror.webp",
  ];
  await Promise.all(
    realisticCardImages.map((image) =>
      access(new URL(`sunucu-paketi/${image}`, projectRoot)),
    ),
  );
});

test("vektör modülü çizim, taşıma, özellik ve yöntem araçları sunar", async () => {
  const page = await readFile(new URL("app/MechanicsLabHub.tsx", projectRoot), "utf8");
  assert.match(page, /FİZ\.9\.2\.3/);
  assert.match(page, /FİZ\.9\.2\.4/);
  assert.match(page, /VectorWorkspace/);
  assert.match(page, /blank-vector-canvas/);
  assert.match(page, /vector-tool-strip/);
  assert.match(page, /> Taşı/);
  assert.match(page, /> Uç uca/);
  assert.match(page, /> Paralelkenar/);
  assert.match(page, /> Bileşenler/);
  assert.match(page, /vector-properties/);
  assert.match(page, /Başlangıç/);
  assert.match(page, /Bitiş/);
  assert.match(page, /x bileşeni/);
  assert.match(page, /y bileşeni/);
  assert.match(page, /Büyüklük/);
  assert.match(page, /vector-solution-sheet/);
  assert.match(page, /Çözüm alanı/);
  assert.match(page, /Yöntemleri sil/);
  assert.match(page, /Geri al/);
  assert.match(page, /Temizle/);
  assert.match(page, /VECTOR_COLORS/);
  assert.doesNotMatch(page, /Eşit vektör|Zıt vektör|Reel sayıyla çarpma/);
});

test("vektör çalışma alanı hazır teori ve formül sunmaz", async () => {
  const page = await readFile(new URL("app/MechanicsLabHub.tsx", projectRoot), "utf8");
  assert.doesNotMatch(page, /°|derece|sinüs|kosinüs|tanjant/i);
  assert.doesNotMatch(page, /WORKSHEET|METHODS|MethodSteps|VectorControl/);
  assert.doesNotMatch(page, /Bileşkeyi göster|Yardımcı çizgiler|ÇIKIŞ KARTI/);
  assert.doesNotMatch(page, /\|A\||R =|Math\.hypot/);
});

test("yedi modül ve serbest vektör çizimi etkileşimlidir", async () => {
  const page = await readFile(new URL("app/MechanicsLabHub.tsx", projectRoot), "utf8");
  assert.match(page, /activeModule/);
  assert.match(page, /module-choice-grid/);
  assert.match(page, /setActiveModule\("vectors"\)/);
  assert.match(page, /setActiveModule\("motion"\)/);
  assert.match(page, /setActiveModule\("free-fall"\)/);
  assert.match(page, /setActiveModule\("two-dimensional"\)/);
  assert.match(page, /setActiveModule\("collisions"\)/);
  assert.match(page, /setActiveModule\("ballistic-pendulum"\)/);
  assert.match(page, /setActiveModule\("torque"\)/);
  assert.match(page, /activeModule === "vectors"/);
  assert.match(page, /activeModule === "motion"/);
  assert.match(page, /activeModule === "free-fall"/);
  assert.match(page, /activeModule === "two-dimensional"/);
  assert.match(page, /activeModule === "collisions"/);
  assert.match(page, /activeModule === "ballistic-pendulum"/);
  assert.match(page, /activeModule === "torque"/);
  assert.match(page, /FreeFallLab/);
  assert.match(page, /TwoDimensionalMotionLab/);
  assert.match(page, /CollisionLab/);
  assert.match(page, /BallisticPendulumLab/);
  assert.match(page, /TorqueLab/);
  assert.match(page, /Serbest düşme/);
  assert.match(page, /İki boyutta hareket/);
  assert.match(page, /Çarpışmalar/);
  assert.match(page, /Balistik sarkaç/);
  assert.match(page, /Dönme dinamiği ve tork/);
  assert.match(page, /mechanics-vectors\.webp/);
  assert.match(page, /mechanics-motion\.webp/);
  assert.match(page, /mechanics-freefall\.webp/);
  assert.match(page, /mechanics-two-dimensional\.webp/);
  assert.match(page, /mechanics-collisions\.webp/);
  assert.match(page, /mechanics-ballistic\.webp/);
  assert.match(page, /mechanics-torque\.webp/);
  assert.match(page, /onPointerDown/);
  assert.match(page, /setPointerCapture/);
  assert.match(page, /pointFromPointer/);
  assert.match(page, /startInteraction/);
  assert.match(page, /moveInteraction/);
  assert.match(page, /finishInteraction/);
  assert.match(page, /setVectors/);
  assert.match(page, /distanceToVector/);
  assert.match(page, /chooseForOperation/);
  assert.match(page, /head-to-tail/);
  assert.match(page, /parallelogram/);
  assert.match(page, /components/);
  assert.match(page, /textarea/);
});

test("ana portal iki çalışma yolu ve bütün gelecek alanları sunar", async () => {
  const page = await readFile(new URL("app/page.tsx", projectRoot), "utf8");
  assert.match(page, /FİZİK ATÖLYESİ/);
  assert.match(page, /Fizik ezber değil/);
  assert.match(page, /Fizik Deney Setleri/);
  assert.match(page, /Serbest Deney ve Simülasyon/);
  assert.match(page, /EXPERIMENT_MODULES/);
  assert.match(page, /FREE_LAB_MODULES/);
  assert.match(page, /Mekanik/);
  assert.match(page, /Elektrik/);
  assert.match(page, /Dalgalar · Optik/);
  assert.match(page, /Modern Fizik/);
  assert.match(page, /Kuvvet ve Hareket/);
  assert.match(page, /Enerji/);
  assert.match(page, /Basınç ve Kaldırma Kuvveti/);
  assert.match(page, /Elektrik ve Manyetizma/);
  assert.match(page, /Isı ve Sıcaklık/);
  assert.match(page, /Dalgalar/);
  assert.match(page, /Optik/);
  assert.match(page, /portal-placeholder/);
  assert.match(page, /YAPIM AŞAMASINDA/);
  assert.match(page, /MechanicsLabHub/);
  assert.match(page, /ElectricityLabHub/);
  assert.match(page, /OpticsLabHub/);
  assert.match(page, /ModernPhysicsLabHub/);
  assert.match(page, /module\.key === "waves-optics"/);
  assert.match(page, /onNavigate\("waves-optics"\)/);
  assert.match(page, /module\.key === "modern-physics"/);
  assert.match(page, /onNavigate\("modern-physics"\)/);
  assert.match(page, /module\.key === "electricity"/);
  assert.match(page, /onNavigate\("electricity"\)/);
  assert.match(page, /2 deney açık/);
  assert.match(page, /5 deney açık/);
  assert.match(page, /<b>15<\/b>\s*çalışan deney/);
  assert.match(page, /1 deney açık/);
  assert.match(page, /fizik-atolyesi-hero\.png/);
  assert.match(page, /portal-guided-lab\.webp/);
  assert.match(page, /portal-free-simulation\.webp/);
  assert.match(page, /portal-mechanics\.webp/);
  assert.match(page, /portal-electricity\.webp/);
  assert.match(page, /portal-optics\.webp/);
  assert.match(page, /portal-modern\.webp/);
  assert.match(page, /free-force-motion\.webp/);
  assert.match(page, /free-modern\.webp/);
});

test("Fizik Atölyesi ana sayfası responsive portal görsellerini içerir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.portal-header\s*\{/);
  assert.match(css, /\.portal-hero\s*\{/);
  assert.match(css, /\.portal-image-frame\s*\{/);
  assert.match(css, /\.portal-path-grid\s*\{/);
  assert.match(css, /\.portal-path-visual img\s*\{/);
  assert.match(css, /\.portal-module-grid\s*\{/);
  assert.match(css, /\.portal-module-visual img\s*\{/);
  assert.match(css, /\.module-choice-visual img\s*\{/);
  assert.match(css, /\.electricity-choice-visual img\s*\{/);
  assert.match(css, /\.portal-visual-mechanics\s*\{/);
  assert.match(css, /\.portal-visual-electricity\s*\{/);
  assert.match(css, /\.portal-visual-waves\s*\{/);
  assert.match(css, /\.portal-visual-modern\s*,/);
  assert.match(css, /\.portal-empty-bench\s*\{/);
  assert.match(css, /\.portal-footer\s*\{/);
  assert.match(css, /@media \(max-width: 620px\)/);
});

test("Elektrik alanı TYMM uyumlu Ohm yasası deneyini sunar", async () => {
  const hub = await readFile(
    new URL("app/ElectricityLabHub.tsx", projectRoot),
    "utf8",
  );
  const page = await readFile(new URL("app/OhmLawLab.tsx", projectRoot), "utf8");
  assert.match(hub, /Elektrik deney setleri/);
  assert.match(hub, /Ohm yasası/);
  assert.match(hub, /OhmLawLab/);
  assert.match(hub, /electricity-ohm\.webp/);
  assert.match(hub, /electricity-resistors\.webp/);
  assert.match(page, /FİZ\.10\.3\.3/);
  assert.match(page, /application\/x-ohm-equipment/);
  assert.match(page, /0-20 V doğru akım güç kaynağı/);
  assert.match(page, /100 Ω ve 1000 Ω direnç panosu/);
  assert.match(page, /Doğru akım ampermetresi/);
  assert.match(page, /Doğru akım voltmetresi/);
  assert.match(page, /Yalıtımlı bağlantı kabloları/);
  assert.match(page, /onEquipmentDragStart/);
  assert.match(page, /onStageDrop/);
  assert.match(page, /REQUIRED_CONNECTIONS/);
  assert.match(page, /WIRING_STEPS/);
  assert.match(page, /source-positive/);
  assert.match(page, /ammeter-positive/);
  assert.match(page, /voltmeter-positive/);
  assert.match(page, /KABLO BAĞLANTI REHBERİ/);
  assert.match(page, /ÖNCE BU UÇ/);
  assert.match(page, /SONRA BU UÇ/);
  assert.match(page, /Gösterilen kabloyu bağla/);
  assert.match(page, /connectGuidedCable/);
  assert.match(page, /Ampermetre neden seri, voltmetre neden direncin uçlarına paralel/);
  assert.match(page, /currentMilliamp: \(voltage \/ resistance\) \* 1000/);
  assert.match(page, /Gerilim-akım grafiği/);
  assert.match(page, /V = I · R/);
  assert.match(page, /TYMM · KISA DENEY RAPORU/);
  assert.match(page, /İDEAL ÖLÇÜM/);
  assert.doesNotMatch(page, /Kirchhoff|Math\.random|NOISE|hata|belirsiz/i);
});

test("Ohm düzeneği gerçekçi cihazlar, bağlantı uçları ve veri alanları içerir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.ohm-builder\s*\{/);
  assert.match(css, /\.ohm-equipment-panel,/);
  assert.match(css, /\.ohm-apparatus\s*\{/);
  assert.match(css, /\.ohm-power-supply\s*\{/);
  assert.match(css, /\.ohm-resistor-board\s*\{/);
  assert.match(css, /\.ohm-meter\s*\{/);
  assert.match(css, /\.ohm-circuit-switch\s*\{/);
  assert.match(css, /\.ohm-terminal\s*\{/);
  assert.match(css, /\.ohm-wiring-guide\s*\{/);
  assert.match(css, /\.ohm-guide-copy\s*\{/);
  assert.match(css, /\.ohm-terminal\.guide-start,/);
  assert.match(css, /@keyframes ohm-guide-pulse/);
  assert.match(css, /\.ohm-wire-canvas\s*\{/);
  assert.match(css, /\.ohm-control-grid\s*\{/);
  assert.match(css, /\.ohm-evidence-grid\s*\{/);
  assert.match(css, /\.ohm-graph-canvas\s*\{/);
  assert.match(css, /\.ohm-report\s*\{/);
});

test("Elektrik alanı dirençlerin seri ve paralel bağlanması deneyini sunar", async () => {
  const hub = await readFile(
    new URL("app/ElectricityLabHub.tsx", projectRoot),
    "utf8",
  );
  const page = await readFile(
    new URL("app/ResistorConnectionsLab.tsx", projectRoot),
    "utf8",
  );
  assert.match(hub, /ResistorConnectionsLab/);
  assert.match(hub, /Dirençlerin bağlanması/);
  assert.match(hub, /FİZ\.10\.3\.4/);
  assert.match(page, /Elemanları yerleştir, seri ve paralel devreyi kendin kur/);
  assert.match(page, /Tut, sürükle ve tezgâha bırak/);
  assert.match(page, /application\/x-resistor-connections-equipment/);
  assert.match(page, /power-supply/);
  assert.match(page, /ammeter/);
  assert.match(page, /voltmeter/);
  assert.match(page, /resistor-a/);
  assert.match(page, /resistor-b/);
  assert.match(page, /switch/);
  assert.match(page, /cables/);
  assert.match(page, /SERIES_STEPS/);
  assert.match(page, /PARALLEL_STEPS/);
  assert.match(page, /A ile B'yi art arda bağla/);
  assert.match(page, /B kolunun girişini bağla/);
  assert.match(page, /onEquipmentDragStart/);
  assert.match(page, /onStageDrop/);
  assert.match(page, /connectTerminal/);
  assert.match(page, /connectGuidedCable/);
  assert.match(page, /RESISTANCE_OPTIONS = \[100, 220, 330, 470\]/);
  assert.match(page, /resistorA \+ resistorB/);
  assert.match(page, /\(resistorA \* resistorB\) \/ \(resistorA \+ resistorB\)/);
  assert.match(page, /I A \/ I B/);
  assert.match(page, /V A \/ V B/);
  assert.match(page, /İdeal ölçüm tablosu/);
  assert.doesNotMatch(page, /SABİT DİRENÇ BAĞLANTI PANOSU|Array\.from\(\{ length: 11 \}|label="C"|label="D"/);
  assert.match(page, /TYMM · KISA DENEY RAPORU/);
  assert.doesNotMatch(page, /Kirchhoff|Math\.random|NOISE|hata|belirsiz/i);
});

test("direnç bağlantıları düzeneği sürüklenebilir gerçek devre elemanları ve ölçüm alanları içerir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.electricity-experiment-launcher\s*\{/);
  assert.match(css, /\.rcl-mode-selector\s*\{/);
  assert.match(css, /\.rcl-mode-buttons\s*\{/);
  assert.match(css, /\.rcl-builder\s*\{/);
  assert.match(css, /\.rcl-apparatus\s*\{/);
  assert.match(css, /\.rcl-resistor-unit\s*\{/);
  assert.match(css, /\.rcl-resistor-unit\.resistor-a\s*\{/);
  assert.match(css, /\.rcl-resistor-unit\.resistor-b\s*\{/);
  assert.match(css, /\.rcl-real-resistor\s*\{/);
  assert.match(css, /\.rcl-control-grid\s*\{/);
  assert.match(css, /\.rcl-live-readings\s*\{/);
  assert.match(css, /\.rcl-data-card\s*\{/);
  assert.match(css, /\.ohm-equipment-panel,/);
  assert.match(css, /\.ohm-wiring-guide\s*\{/);
  assert.match(css, /\.ohm-terminal\s*\{/);
  assert.match(css, /\.ohm-power-supply\s*\{/);
  assert.match(css, /\.ohm-meter\s*\{/);
  assert.match(css, /\.ohm-circuit-switch\s*\{/);
});

test("Dalgalar-Optik alanı kırılma ve prizma deneyini TYMM çıktılarıyla sunar", async () => {
  const hub = await readFile(
    new URL("app/OpticsLabHub.tsx", projectRoot),
    "utf8",
  );
  const page = await readFile(
    new URL("app/PrismLab.tsx", projectRoot),
    "utf8",
  );
  assert.match(hub, /Dalgalar - Optik deney setleri/);
  assert.match(hub, /Kırılma ve prizma/);
  assert.match(hub, /PrismLab/);
  assert.match(page, /FİZ\.11\.4\.5/);
  assert.match(page, /FİZ\.11\.4\.8/);
  assert.match(page, /application\/x-optics-equipment/);
  assert.match(page, /SETUP_ORDER/);
  assert.match(page, /Cetvelli metal optik ray ve ayakları/);
  assert.match(page, /Yüksekliği ayarlanabilir tek renkli lazer/);
  assert.match(page, /Açı ölçekli döner optik tabla/);
  assert.match(page, /Milimetre ölçekli beyaz ışın ekranı/);
  assert.match(page, /1,50 cm kalınlıklı paralel yüzlü cam blok/);
  assert.match(page, /60 derece tepe açılı cam prizma/);
  assert.match(page, /İkizkenar dik üçgen cam prizma/);
  assert.match(page, /onEquipmentDragStart/);
  assert.match(page, /onStageDrop/);
  assert.match(page, /isDragOver/);
  assert.match(page, /Kalan parçaları istediğin sırayla ekleyebilirsin/);
  assert.match(page, /OpticsRayCanvas/);
  assert.match(page, /requestAnimationFrame/);
  assert.match(page, /REFRACTION_ANGLES = \[0, 15, 30, 45, 60\]/);
  assert.match(page, /DEVIATION_ANGLES = \[30, 40, 50, 60\]/);
  assert.match(page, /INTERNAL_ANGLES = \[35, 40, 42, 45, 50\]/);
  assert.match(page, /LIGHT_COLORS/);
  assert.match(page, /Kırmızı/);
  assert.match(page, /Yeşil/);
  assert.match(page, /Mavi/);
  assert.match(page, /refractiveIndex: 1\.51432/);
  assert.match(page, /refractiveIndex: 1\.51872/);
  assert.match(page, /refractiveIndex: 1\.52238/);
  assert.match(page, /SLAB_THICKNESS_CM = 1\.5/);
  assert.match(page, /PRISM_APEX_ANGLE = 60/);
  assert.match(page, /Math\.asin/);
  assert.match(page, /Cam blokta kırılma/);
  assert.match(page, /Prizmada sapma/);
  assert.match(page, /Prizmada tam yansıma/);
  assert.match(page, /Hipotezim/);
  assert.match(page, /Işını göndermeden önce kısa bir hipotez yaz/);
  assert.match(page, /Lazeri aç/);
  assert.match(page, /Optik daireyi sıfırla/);
  assert.match(page, /IŞINI GÖNDER VE ÖLÇ/);
  assert.match(page, /Işık rengi/);
  assert.match(page, /Ekrandaki gözlem/);
  assert.match(page, /Gözlem özetini göster/);
  assert.match(page, /rayPolygonIntersection/);
  assert.match(page, /refractRay/);
  assert.match(page, /reflectRay/);
  assert.match(page, /TY \$\{reflectedCount\}/);
  assert.match(page, /--optics-sample-angle/);
  assert.match(page, /GERİ DÖNÜŞ EKRANI/);
  assert.doesNotMatch(page, /İç açılar r₁ \/ r₂/);
  assert.doesNotMatch(page, /n pleksiglas/);
  assert.match(page, /KISA DENEY RAPORU/);
  assert.match(page, /LAZER GÜVENLİĞİ/);
});

test("Dalgalar-Optik alanı PDF kapsamındaki TYMM dalga leğeni deneylerini sunar", async () => {
  const hub = await readFile(
    new URL("app/OpticsLabHub.tsx", projectRoot),
    "utf8",
  );
  const page = await readFile(
    new URL("app/RippleTankLab.tsx", projectRoot),
    "utf8",
  );
  assert.match(hub, /RippleTankLab/);
  assert.match(hub, /Dalga leğeni/);
  assert.match(hub, /activeTopic === "waves" && <RippleTankLab/);
  assert.match(hub, /free-waves\.webp/);
  assert.match(page, /RippleTankCanvas/);
  assert.match(page, /Yayılma ve yansıma/);
  assert.match(page, /Dalga ölçümü/);
  assert.match(page, /Kırınım/);
  assert.match(page, /Kırılma/);
  assert.match(page, /Girişim/);
  assert.match(page, /Düzlemsel kaynak/);
  assert.match(page, /Dairesel kaynak/);
  assert.match(page, /Tek atma/);
  assert.match(page, /her doğrultuda aynı hızla yayılır/);
  assert.match(page, /Parabolik engel/);
  assert.match(page, /Düz dalga → odak/);
  assert.match(page, /Odak → düz dalga/);
  assert.match(page, /Stroboskop frekansı/);
  assert.match(page, /duran dalga/);
  assert.match(page, /Engel kenarı/);
  assert.match(page, /Ayarlı yarık/);
  assert.match(page, /Derin bölge/);
  assert.match(page, /Sığ bölge/);
  assert.match(page, /Kaynaklar arası uzaklık · d/);
  assert.match(page, /Aydınlık saçağı seç/);
  assert.match(page, /pathDifference/);
  assert.match(page, /speedForDepth/);
  assert.match(page, /refractionAngle/);
  assert.match(page, /diffractionRatio/);
  assert.match(page, /onPointerDown/);
  assert.match(page, /setPointerCapture/);
  assert.match(page, /İDEAL ÖLÇÜM TABLOSU/);
  assert.match(page, /TYMM · DENEY RAPORU/);
  assert.doesNotMatch(page, /Math\.random|hata|belirsiz/i);
});

test("dalga leğeni gerçekçi düzenek, güç kaynağı ve responsive deney panelleri içerir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.rt-lab\s*\{/);
  assert.match(css, /\.rt-hero\s*\{/);
  assert.match(css, /\.rt-equipment-strip\s*\{/);
  assert.match(css, /\.rt-mode-switch\s*\{/);
  assert.match(css, /\.rt-workspace\s*\{/);
  assert.match(css, /\.rt-canvas\s*\{/);
  assert.match(css, /\.rt-controls\s*\{/);
  assert.match(css, /\.rt-result-box\s*\{/);
  assert.match(css, /\.rt-live-badges\s*\{/);
  assert.match(css, /\.rt-data-card\s*\{/);
  assert.match(css, /\.rt-report-grid\s*\{/);
  assert.match(css, /@media \(max-width: 1080px\)/);
});

test("optik düzeneği gerçekçi ray, lazer, açı tablası, ekran ve cam elemanları gösterir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.optics-workspace\s*\{/);
  assert.match(css, /\.optics-equipment-panel\s*,/);
  assert.match(css, /\.optics-stage\.drag-over\s*\{/);
  assert.match(css, /\.optics-apparatus\s*\{/);
  assert.match(css, /\.optics-bench\s*\{/);
  assert.match(css, /\.optics-rail\s*\{/);
  assert.match(css, /\.optics-laser\s*\{/);
  assert.match(css, /\.optics-rotary-table\s*\{/);
  assert.match(css, /\.optics-degree-ring\s*\{/);
  assert.match(css, /\.optics-screen\s*\{/);
  assert.match(css, /\.screen-face\s*\{/);
  assert.match(css, /transform:\s*rotate\(var\(--optics-table-angle\)\)/);
  assert.match(css, /\.optics-screen\.return-screen\s*\{/);
  assert.match(css, /\.optics-color-options\s*\{/);
  assert.match(css, /\.optics-slab,/);
  assert.match(css, /\.optics-equilateral-prism\s*\{/);
  assert.match(css, /\.optics-right-prism\s*\{/);
  assert.match(css, /\.optics-ray-canvas\s*\{/);
  assert.match(css, /\.optics-data-table\s*\{/);
  assert.match(css, /\.optics-analysis-grid\s*\{/);
  assert.match(css, /\.optics-report\s*\{/);
});

test("Dalgalar-Optik alanı ayna seçimini ve ideal düzlem ayna deneyini sunar", async () => {
  const hub = await readFile(
    new URL("app/OpticsLabHub.tsx", projectRoot),
    "utf8",
  );
  const page = await readFile(
    new URL("app/PlaneMirrorLab.tsx", projectRoot),
    "utf8",
  );
  assert.match(hub, /Aynalar/);
  assert.match(hub, /Düzlem ayna/);
  assert.match(hub, /Çukur ayna/);
  assert.match(hub, /Tümsek ayna/);
  assert.match(hub, /PlaneMirrorLab/);
  assert.match(hub, /optics-mirrors\.webp/);
  assert.match(hub, /optics-plane-mirror\.webp/);
  assert.match(hub, /optics-concave-mirror\.webp/);
  assert.match(hub, /optics-convex-mirror\.webp/);
  assert.match(page, /ReflectionCanvas/);
  assert.match(page, /DrawingMirrorCanvas/);
  assert.match(page, /FieldOfViewCanvas/);
  assert.match(page, /onPointerDown/);
  assert.match(page, /setPointerCapture/);
  assert.match(page, /Lazerle yansıma kanunları/);
  assert.match(page, /Çiz ve görüntüyü gör/);
  assert.match(page, /Gelme açısı · i/);
  assert.match(page, /Yansıma açısı · r/);
  assert.match(page, /i = r/);
  assert.match(page, /reflectionMirrorAngle/);
  assert.match(page, /Ayna dönüş açısı/);
  assert.match(page, /incomingVector\.x - 2 \* incomingDotNormal/);
  assert.match(page, /CİSMİ BU ALANA ÇİZ/);
  assert.match(page, /AYNADAKİ SANAL GÖRÜNTÜ/);
  assert.match(page, /DRAWING_PIXELS_PER_CM/);
  assert.match(page, /reflectPointAcrossMirror/);
  assert.match(page, /imageMirrorAngle/);
  assert.match(page, /Aynayı dik konuma getir/);
  assert.match(page, /Cetvel ölçümünü kaydet/);
  assert.match(page, /ÜSTTEN GÖZ VE GÖRÜŞ ALANI/);
  assert.match(page, /Görüş alanını çiz/);
  assert.match(page, /Ayna genişliği/);
  assert.match(page, /analyzeVisionObjects/);
  assert.match(page, /Saydam cisim ekle/);
  assert.match(page, /Saydam olmayan cisim ekle/);
  assert.match(page, /Aynada görülüyor/);
  assert.match(page, /Saydam olmayan cisim engelliyor/);
  assert.match(page, /Görüş alanının dışında/);
  assert.match(page, /Eşit uzaklık/);
  assert.match(page, /Aynı boy/);
  assert.match(page, /Aynaya göre simetri/);
  assert.match(page, /Sanal görüntü/);
  assert.match(page, /Yanal terslik/);
  assert.doesNotMatch(page, /Beyaz ekran|Hareketli beyaz ekran|Ekranın aynaya/);
  assert.match(page, /TYMM · DENEY RAPORU/);
  assert.doesNotMatch(page, /Math\.random|hata|belirsiz/i);
});

test("düzlem ayna laboratuvarı gerçekçi seçim kartları, düzenek ve responsive görünüm içerir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.optics-topic-grid\s*\{/);
  assert.match(css, /\.mirror-type-grid\s*\{/);
  assert.match(css, /\.optics-topic-image img,/);
  assert.match(css, /\.mirror-type-image img\s*\{/);
  assert.match(css, /\.pm-reflection-stage\s*\{/);
  assert.match(css, /\.pm-reflection-canvas\s*\{/);
  assert.match(css, /\.pm-control-console\s*\{/);
  assert.match(css, /\.pm-angle-display\s*\{/);
  assert.match(css, /\.pm-drawing-workspace,/);
  assert.match(css, /\.pm-drawing-canvas,/);
  assert.match(css, /\.pm-drawing-controls,/);
  assert.match(css, /\.pm-color-tools\s*\{/);
  assert.match(css, /\.pm-width-tools\s*\{/);
  assert.match(css, /\.pm-drawing-readout\s*\{/);
  assert.match(css, /\.pm-mirror-rotation-control\s*\{/);
  assert.match(css, /\.pm-vision-canvas\s*\{/);
  assert.match(css, /\.pm-vision-controls\s*\{/);
  assert.match(css, /\.pm-vision-object-tools\s*\{/);
  assert.match(css, /\.pm-vision-object-list\s*\{/);
  assert.match(css, /\.pm-field-result\s*\{/);
  assert.match(css, /\.pm-evidence-section\s*\{/);
  assert.match(css, /@media \(max-width: 620px\)/);
});

test("çukur ayna laboratuvarı döndürülebilir küresel ayna, lazer ve serbest çizim sunar", async () => {
  const hub = await readFile(
    new URL("app/OpticsLabHub.tsx", projectRoot),
    "utf8",
  );
  const page = await readFile(
    new URL("app/ConcaveMirrorLab.tsx", projectRoot),
    "utf8",
  );
  assert.match(hub, /ConcaveMirrorLab/);
  assert.match(hub, /DENEY 02 · HAZIR/);
  assert.match(hub, /activeMirror === "concave" && <ConcaveMirrorLab/);
  assert.match(page, /ConcaveReflectionCanvas/);
  assert.match(page, /ConcaveImageCanvas/);
  assert.match(page, /RADIUS_OF_CURVATURE/);
  assert.match(page, /reflectVector/);
  assert.match(page, /incomingVector\.x - 2 \* incomingDotNormal/);
  assert.match(page, /reflectionMirrorAngle/);
  assert.match(page, /imageMirrorAngle/);
  assert.match(page, /hitOffset/);
  assert.match(page, /laserPosition/);
  assert.match(page, /onLaserPositionChange/);
  assert.match(page, /onHitOffsetChange/);
  assert.match(page, /Lazeri istediğin başlangıç noktasına sürükle/);
  assert.match(page, /Lazer yatay konumu/);
  assert.match(page, /Lazer dikey konumu/);
  assert.match(page, /nearMirror \? "hit" : "laser"/);
  assert.match(page, /Ayna dönüş açısı/);
  assert.match(page, /Yüzey normali/);
  assert.match(page, /i = r/);
  assert.match(page, /Odak uzaklığı · f/);
  assert.match(page, /objectDistance/);
  assert.match(page, /focalLength/);
  assert.match(page, /imageDistance/);
  assert.match(page, /magnification/);
  assert.match(page, /CİSMİ BU ALANA ÇİZ/);
  assert.match(page, /Görüntü sonsuzda/);
  assert.match(page, /Gerçek · ters · küçük/);
  assert.match(page, /Gerçek · ters · büyük/);
  assert.match(page, /Sanal görüntü · düz · büyük/);
  assert.match(page, /F–C HARİTASI/);
  assert.match(page, /onPointerDown/);
  assert.match(page, /setPointerCapture/);
  assert.match(page, /Cetvel ölçümünü kaydet/);
  assert.match(page, /TYMM · DENEY RAPORU/);
  assert.doesNotMatch(page, /Math\.random|hata|belirsiz/i);
  assert.doesNotMatch(page, /Görüş alanı|saydam olmayan|saydam cisim/i);
});

test("çukur ayna laboratuvarı gerçekçi düzenek, kontrol paneli ve responsive görünüm içerir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.cm-lab\s*\{/);
  assert.match(css, /\.cm-hero\s*\{/);
  assert.match(css, /\.cm-equipment-strip\s*\{/);
  assert.match(css, /\.cm-mode-switch\s*\{/);
  assert.match(css, /\.cm-workspace\s*\{/);
  assert.match(css, /\.cm-canvas\s*\{/);
  assert.match(css, /\.cm-reflection-canvas\s*\{/);
  assert.match(css, /\.cm-image-canvas\s*\{/);
  assert.match(css, /\.cm-control-console\s*\{/);
  assert.match(css, /\.cm-digital-display\s*\{/);
  assert.match(css, /\.cm-image-summary\s*\{/);
  assert.match(css, /\.cm-drawing-tools\s*\{/);
  assert.match(css, /\.cm-evidence-grid\s*\{/);
  assert.match(css, /\.cm-report-grid\s*\{/);
  assert.match(css, /@media \(max-width: 980px\)/);
});

test("tümsek ayna laboratuvarı serbest lazer ve ideal sanal görüntü deneyi sunar", async () => {
  const hub = await readFile(
    new URL("app/OpticsLabHub.tsx", projectRoot),
    "utf8",
  );
  const wrapper = await readFile(
    new URL("app/ConvexMirrorLab.tsx", projectRoot),
    "utf8",
  );
  const sharedLab = await readFile(
    new URL("app/ConcaveMirrorLab.tsx", projectRoot),
    "utf8",
  );
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(hub, /ConvexMirrorLab/);
  assert.match(hub, /DENEY 03 · HAZIR/);
  assert.match(hub, /activeMirror === "convex" && <ConvexMirrorLab/);
  assert.match(wrapper, /SphericalMirrorLab/);
  assert.match(wrapper, /mirrorKind="convex"/);
  assert.match(sharedLab, /mirrorKind === "convex"/);
  assert.match(sharedLab, /signedFocalLength = -focalLength/);
  assert.match(sharedLab, /objectDistance - signedFocalLength/);
  assert.match(sharedLab, /Sanal görüntü · düz · küçük/);
  assert.match(sharedLab, /ayna ile F arasında oluşur/);
  assert.match(sharedLab, /markerDirection/);
  assert.match(sharedLab, /UZAKLIK HARİTASI/);
  assert.match(sharedLab, /Yansıyan temel ışınların uzantıları/);
  assert.match(sharedLab, /onLaserPositionChange/);
  assert.match(sharedLab, /onHitOffsetChange/);
  assert.match(sharedLab, /Temel ışınları göster/);
  assert.match(sharedLab, /Cetvel ölçümünü kaydet/);
  assert.match(sharedLab, /TYMM · DENEY RAPORU/);
  assert.doesNotMatch(sharedLab, /Math\.random|hata|belirsiz/i);
  assert.match(css, /\.cm-convex-lab \.cm-tool-mirror::after/);
});

test("Modern Fizik alanı gerçek fotoelektrik düzeneği ve TYMM deney akışını sunar", async () => {
  const hub = await readFile(
    new URL("app/ModernPhysicsLabHub.tsx", projectRoot),
    "utf8",
  );
  const page = await readFile(
    new URL("app/PhotoelectricLab.tsx", projectRoot),
    "utf8",
  );
  assert.match(hub, /Modern Fizik deney setleri/);
  assert.match(hub, /Fotoelektrik etki/);
  assert.match(hub, /PhotoelectricLab/);
  assert.match(page, /FİZ\.12\.4\.1/);
  assert.match(page, /FİZ\.12\.4\.2/);
  assert.match(page, /FİZ\.12\.4\.3/);
  assert.match(page, /application\/x-photoelectric-equipment/);
  assert.match(page, /Cıva ışık kaynağı/);
  assert.match(page, /Kırınım ağı/);
  assert.match(page, /h\/e aparatı/);
  assert.match(page, /Dijital multimetre/);
  assert.match(page, /Renk filtresi/);
  assert.match(page, /Geçirgenlik filtresi/);
  assert.match(page, /pe-detector-head/);
  assert.match(page, /h\/e KONTROL ÜNİTESİ/);
  assert.match(page, /YOĞUNLUK FİLTRESİ/);
  assert.match(page, /pe-cable-signal/);
  assert.match(page, /onEquipmentDragStart/);
  assert.match(page, /onStageDrop/);
  assert.match(page, /requestAnimationFrame/);
  assert.doesNotMatch(page, /settling|Math\.sin\(progress \* Math\.PI \* 8\)/);
  assert.match(page, /BOŞALT düğmesine bas/);
  assert.match(page, /Çizgi spektrumu hazır/);
  assert.match(page, /PLANCK = 6\.62607015e-34/);
  assert.match(page, /WORK_FUNCTION_EV = 1\.412/);
  assert.match(page, /wavelength: 578/);
  assert.match(page, /wavelength: 546\.074/);
  assert.match(page, /wavelength: 435\.835/);
  assert.match(page, /wavelength: 404\.656/);
  assert.match(page, /wavelength: 365\.483/);
  assert.match(page, /stoppingVoltageFor/);
  assert.match(page, /photocurrentFor/);
  assert.match(page, /linearRegression/);
  assert.match(page, /Şiddet - durdurma gerilimi/);
  assert.match(page, /Frekans - durdurma gerilimi/);
  assert.match(page, /Planck sabiti ve yüzey/);
  assert.match(page, /Güneş paneli/);
  assert.match(page, /Fotoselli kapı/);
  assert.match(page, /Duman dedektörü/);
  assert.match(page, /TYMM · AÇIK UÇLU ÇIKIŞ KARTI/);
});

test("fotoelektrik tezgâhı gerçekçi cihaz, tayf, bağlantı ve ölçüm görsellerini içerir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.photoelectric-lab-section\s*\{/);
  assert.match(css, /\.pe-builder\s*\{/);
  assert.match(css, /\.pe-equipment-panel\s*\{/);
  assert.match(css, /\.pe-stage\.drag-over\s*\{/);
  assert.match(css, /\.pe-apparatus\s*\{/);
  assert.match(css, /\.pe-mercury-lamp\s*\{/);
  assert.match(css, /\.pe-grating\s*\{/);
  assert.match(css, /\.pe-spectrum\s*,/);
  assert.match(css, /\.pe-detector-head\s*\{/);
  assert.match(css, /\.pe-he-apparatus\s*\{/);
  assert.match(css, /\.pe-photodiode-window\s*\{/);
  assert.match(css, /\.pe-battery-test\s*\{/);
  assert.match(css, /\.pe-multimeter\s*\{/);
  assert.match(css, /\.pe-cable\s*\{/);
  assert.match(css, /\.pe-electron-stream\s*\{/);
  assert.match(css, /@keyframes pe-electron-flight/);
  assert.match(css, /\.pe-graph-canvas\s*\{/);
  assert.match(css, /\.pe-data-table\s*\{/);
  assert.match(css, /\.pe-life-cards\s*\{/);
  assert.match(css, /\.pe-report\s*\{/);
});

test("balistik sarkaç modülü PDF düzeneğiyle kurulabilir ve iki yöntemle hız bulur", async () => {
  const page = await readFile(
    new URL("app/BallisticPendulumLab.tsx", projectRoot),
    "utf8",
  );
  assert.match(page, /FİZ\.12\.1\.4/);
  assert.match(page, /FİZ\.12\.2\.5/);
  assert.match(page, /SETUP_ORDER/);
  assert.match(page, /Alüminyum taşıyıcı gövde ve taban/);
  assert.match(page, /Üç kademeli yatay bilye fırlatıcı/);
  assert.match(page, /Dijital ilk hız sensörü/);
  assert.match(page, /Bilye yakalayıcılı sarkaç mekanizması/);
  assert.match(page, /Yarım daire açıölçer/);
  assert.match(page, /Maksimum açıyı tutan gösterge çubuğu/);
  assert.match(page, /Üç bilyeli saklama tüpü/);
  assert.match(page, /Sarkaç boyu için metal cetvel/);
  assert.match(page, /application\/x-ballistic-equipment/);
  assert.match(page, /onEquipmentDragStart/);
  assert.match(page, /onStageDrop/);
  assert.match(page, /Küçük çelik bilye/);
  assert.match(page, /Büyük çelik bilye/);
  assert.match(page, /Ahşap bilye/);
  assert.match(page, /Bilyeyi merkezle/);
  assert.match(page, /Göstergeyi 0° konumuna getir/);
  assert.match(page, /requestAnimationFrame/);
  assert.match(page, /Tam esnek olmayan çarpışma/);
  assert.match(page, /Sarkaç yükseliyor/);
  assert.match(page, /sensorSpeed/);
  assert.match(page, /calculatedSpeed/);
  assert.doesNotMatch(page, /difference|Yüzdesel fark/);
  assert.match(page, /Üç bilye × üç kademe/);
  assert.match(page, /İşlemsel analizi göster/);
  assert.match(page, /mvᵢ = \(m \+ M\)vₛ/);
  assert.match(page, /Δh = l\(1 − cosφ\)/);
  assert.match(page, /vₛ = √\(2gΔh\)/);
  assert.match(page, /Hız arttıkça açı nasıl değişiyor/);
  assert.match(page, /Sensör ve sarkaçtan bulunan hız/);
  assert.match(page, /İdeal sistemde sensör ve sarkaç modeli aynı ilk hız değerini verir/);
  assert.match(page, /KISA DENEY RAPORU/);
});

test("balistik sarkaç düzeneği fırlatıcı, açıölçer ve yakalayıcıyı gerçekçi sahnede gösterir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.ballistic-apparatus\s*\{/);
  assert.match(css, /\.ballistic-workbench\s*\{/);
  assert.match(css, /\.ballistic-frame\s*\{/);
  assert.match(css, /\.ballistic-launcher\s*\{/);
  assert.match(css, /\.ballistic-speed-sensor\s*\{/);
  assert.match(css, /\.ballistic-protractor\s*\{/);
  assert.match(css, /\.ballistic-pendulum\s*\{/);
  assert.match(css, /\.pendulum-catcher\s*\{/);
  assert.match(css, /\.ballistic-indicator\s*\{/);
  assert.match(css, /\.ballistic-ball-rack\s*\{/);
  assert.match(css, /\.ballistic-ruler\s*\{/);
  assert.match(css, /\.ballistic-data-table\s*\{/);
  assert.match(css, /\.ballistic-analysis-grid\s*\{/);
  assert.match(css, /\.ballistic-graphs\s*\{/);
  assert.match(css, /\.ballistic-report\s*\{/);
});

test("tork modülü PDF düzeneğini üç araştırma serisiyle kurar", async () => {
  const page = await readFile(
    new URL("app/TorqueLab.tsx", projectRoot),
    "utf8",
  );
  assert.match(page, /FİZ\.12\.1\.1/);
  assert.match(page, /FİZ\.12\.1\.5/);
  assert.match(page, /SETUP_ORDER/);
  assert.match(page, /Ayarlanabilir ayaklı metal taban ve dönme ekseni/);
  assert.match(page, /991 g kütleli yatay ana disk/);
  assert.match(page, /1,50 - 2,00 - 2,50 cm kademeli yarıçap makarası/);
  assert.match(page, /Disk kenarına temas eden optik okuyucu/);
  assert.match(page, /Masa kenarı ip yönlendirme makarası/);
  assert.match(page, /İp, 5 g kefe ve asılı kütleler/);
  assert.match(page, /Hareket zamanlayıcı ve canlı grafik ekranı/);
  assert.match(page, /Yedek disk, metal halka ve metal blok/);
  assert.match(page, /application\/x-torque-equipment/);
  assert.match(page, /onEquipmentDragStart/);
  assert.match(page, /onStageDrop/);
  assert.match(page, /torque-workspace/);
  assert.match(page, /MALZEME RAFI/);
  assert.match(page, /Tut, sürükle ve tezgâha bırak/);
  assert.match(page, /Kalan malzemeleri istediğin sırayla sürükleyebilirsin/);
  assert.match(page, /isDragOver/);
  assert.match(page, /Malzeme tezgâha bırakılınca doğru bağlantı noktasına oturur/);
  assert.doesNotMatch(page, /Önce .* parçasını yerleştir/);
  assert.match(page, /const RADII = \[0\.015, 0\.02, 0\.025\]/);
  assert.match(page, /const MASSES = \[0\.03, 0\.05, 0\.07, 0\.09\]/);
  assert.match(page, /second-disk/);
  assert.match(page, /requestAnimationFrame/);
  assert.match(page, /theoreticalAlpha/);
  assert.match(page, /const measuredAlpha = theoreticalAlpha/);
  assert.match(page, /const torque = force \* radius/);
  assert.match(page, /completion\.total === 11/);
  assert.match(page, /Açısal hız - zaman/);
  assert.match(page, /Yarıçap - açısal ivme/);
  assert.match(page, /Kütle - açısal ivme/);
  assert.match(page, /Eylemsizlik momenti - açısal ivme/);
  assert.match(page, /İşlemsel analizi göster/);
  assert.match(page, /τ = r · F/);
  assert.match(page, /α = τ \/ I/);
  assert.match(page, /Grafik eğimi,[\s\S]*model[\s\S]*sonucuna tam eşittir/);
  assert.doesNotMatch(page, /currentError|record\.error|Yüzdesel fark/);
  assert.match(page, /KISA DENEY RAPORU/);
});

test("tork düzeneği yatay disk, optik okuyucu ve masa makarasını gerçekçi sahnede gösterir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.torque-choice-visual\s*\{/);
  assert.match(css, /\.torque-workspace\s*\{/);
  assert.match(css, /\.torque-workspace \.torque-equipment-list\s*\{/);
  assert.match(css, /\.torque-workspace \.torque-stage\.drag-over\s*\{/);
  assert.match(css, /\.torque-bench-hint\s*\{/);
  assert.match(css, /\.torque-apparatus\s*\{/);
  assert.match(css, /\.torque-workbench\s*\{/);
  assert.match(css, /\.torque-base\s*\{/);
  assert.match(css, /\.torque-disc\s*\{/);
  assert.match(css, /\.torque-stepped-pulley\s*\{/);
  assert.match(css, /\.torque-optical-reader\s*\{/);
  assert.match(css, /\.torque-edge-pulley\s*\{/);
  assert.match(css, /\.torque-hanging-pan\s*\{/);
  assert.match(css, /\.torque-data-logger\s*\{/);
  assert.match(css, /\.torque-attachment-rack\s*\{/);
  assert.match(css, /\.torque-velocity-canvas\s*\{/);
  assert.match(css, /\.torque-data-table\s*\{/);
  assert.match(css, /\.torque-analysis-grid\s*\{/);
  assert.match(css, /\.torque-relation-bars\s*\{/);
  assert.match(css, /\.torque-report\s*\{/);
});

test("çarpışmalar modülü PDF düzeneğiyle kurulabilir ve veri üretir", async () => {
  const page = await readFile(
    new URL("app/CollisionLab.tsx", projectRoot),
    "utf8",
  );
  assert.match(page, /FİZ\.12\.1\.4/);
  assert.match(page, /REQUIRED_SETUP/);
  assert.match(page, /SETUP_ORDER/);
  assert.match(page, /Ayarlanabilir ayaklı hava masası/);
  assert.match(page, /Nokta izlerini kaydeden kâğıt/);
  assert.match(page, /Hava masası kompresörü/);
  assert.match(page, /Ark kronometresi ve ayak pedalı/);
  assert.match(page, /Birinci hava diski/);
  assert.match(page, /İkinci hava diski/);
  assert.match(page, /Esnek olmayan çarpışma bandı/);
  assert.match(page, /Cırt cırt bant \(esnek olmayan\)/);
  assert.match(page, /application\/x-collision-equipment/);
  assert.match(page, /onEquipmentDragStart/);
  assert.match(page, /onStageDrop/);
  assert.match(page, /startTargetDrag/);
  assert.match(page, /moveTarget/);
  assert.match(page, /balanceTable/);
  assert.match(page, /toggleCompressor/);
  assert.match(page, /resetTimer/);
  assert.match(page, /requestAnimationFrame/);
  assert.match(page, /Esnek olmayan/);
  assert.match(page, /Pedala bas ve diski gönder/);
  assert.match(page, /momentumBeforeX/);
  assert.match(page, /momentumAfterY/);
  assert.match(page, /momentumOneBefore/);
  assert.match(page, /momentumTwoAfter/);
  assert.match(page, /momentumOneAfterX/);
  assert.match(page, /momentumTwoAfterY/);
  assert.match(page, /energyRetention/);
  assert.match(page, /PHYSICS_EPSILON/);
  assert.match(page, /exactZero/);
  assert.match(page, /ScatteringAngleOverlay/);
  assert.match(page, /roundedAngle/);
  assert.match(page, /collision-coordinate-system/);
  assert.match(page, /Saçılma açıları/);
  assert.match(page, /Saçılma yok/);
  assert.match(page, /Vektörel analizi göster/);
  assert.match(page, /CollisionVectorAnalysis/);
  assert.match(page, /VectorAnalysisCanvas/);
  assert.match(page, /Çarpışmanın tam analizi/);
  assert.match(page, /Hız ve momentum bileşenleri/);
  assert.match(page, /Önceki ve sonraki toplamlar/);
  assert.match(page, /Enerji karşılaştırması/);
  assert.match(page, /Δp = Σpₛ − Σpᵢ/);
  assert.match(page, /pₓ/);
  assert.match(page, /pᵧ/);
  assert.match(page, /Momentum ideal sistemde tam korundu/);
  assert.doesNotMatch(page, /MomentumVectorOverlay|collision-momentum-overlay/);
  assert.doesNotMatch(page, /MEASUREMENT_NOISE|const noise/);
  assert.match(page, /setMode\("inelastic"\)/);
  assert.match(page, /1\. cismin ilk momentumu/);
  assert.match(page, /2\. cismin son momentumu/);
  assert.match(page, /İlk kinetik enerji/);
  assert.match(page, /Son kinetik enerji/);
  assert.doesNotMatch(page, /<th>θ \/ φ<\/th>/);
  assert.match(page, /Momentum bileşenleri/);
  assert.match(page, /Denemelerde kinetik enerji/);
  assert.match(page, /KISA DENEY RAPORU/);
});

test("çarpışma düzeneği hava masası, diskler ve nokta izlerini gerçekçi sahnede gösterir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.collision-air-table\s*\{/);
  assert.match(css, /\.collision-trace-paper\s*\{/);
  assert.match(css, /\.collision-puck\s*\{/);
  assert.match(css, /\.collision-puck-two\s*\{/);
  assert.match(css, /\.collision-trace-mark\s*\{/);
  assert.match(css, /\.collision-coordinate-system\s*\{/);
  assert.match(css, /\.collision-coordinate-line\.coordinate-x\s*\{/);
  assert.match(css, /\.collision-coordinate-line\.coordinate-y\s*\{/);
  assert.match(css, /\.collision-scattering-overlay\s*\{/);
  assert.match(css, /\.collision-analysis-prompt\s*\{/);
  assert.match(css, /\.collision-vector-analysis\s*\{/);
  assert.match(css, /\.collision-analysis-canvas canvas\s*\{/);
  assert.match(css, /\.collision-analysis-calculations\s*\{/);
  assert.match(css, /\.collision-analysis-conclusion\s*\{/);
  assert.doesNotMatch(css, /\.collision-momentum-overlay\s*\{/);
  assert.match(css, /\.collision-compressor\s*\{/);
  assert.match(css, /\.collision-table-air-inlet\s*\{/);
  assert.match(css, /\.compressor-handle\s*\{/);
  assert.match(css, /\.compressor-fan\s*\{/);
  assert.match(css, /\.compressor-gauge\s*\{/);
  assert.match(css, /\.compressor-outlet\s*\{/);
  assert.match(css, /\.compressor-hose\s*\{/);
  assert.match(css, /\.collision-spark-timer\s*\{/);
  assert.match(css, /\.collision-pedal\s*\{/);
  assert.match(css, /\.collision-data-table\s*,/);
  assert.match(css, /\.collision-graphs\s*\{/);
  assert.match(css, /\.collision-report\s*\{/);
});

test("iki boyutta hareket modülü PDF düzeneğiyle kurulabilir ve ölçüm yapar", async () => {
  const page = await readFile(
    new URL("app/TwoDimensionalMotionLab.tsx", projectRoot),
    "utf8",
  );
  assert.match(page, /FİZ\.10\.1\.6/);
  assert.match(page, /SETUP_ORDER/);
  assert.match(page, /Fırlatıcı ünitesi ve taban/);
  assert.match(page, /Açı göstergesi/);
  assert.match(page, /İlk hız sensörü/);
  assert.match(page, /Aynı seviyedeki iniş masası/);
  assert.match(page, /Karbonlu iz kâğıdı/);
  assert.match(page, /Bir metre cetvel/);
  assert.match(page, /19 mm çelik bilye/);
  assert.match(page, /application\/x-twod-equipment/);
  assert.match(page, /onDragStart/);
  assert.match(page, /onStageDrop/);
  assert.match(page, /ANGLES = \[15, 30, 45, 60, 75\]/);
  assert.match(page, /SPEEDS/);
  assert.match(page, /startAngleDrag/);
  assert.match(page, /moveAngleDrag/);
  assert.match(page, /Hız sensörünü sıfırla/);
  assert.match(page, /Pimi çek ve fırlat/);
  assert.match(page, /requestAnimationFrame/);
  assert.match(page, /Yatay hız vₓ/);
  assert.match(page, /Düşey hız vᵧ/);
  assert.match(page, /measuredRange/);
  assert.doesNotMatch(page, /calculatedRange|errorPercent|SPEED_NOISE|RANGE_NOISE/);
  assert.match(page, /Doğrultu – menzil/);
  assert.match(page, /Doğrultu – maksimum yükseklik/);
  assert.match(page, /15 deney tamamlandı/);
  assert.match(page, /KISA DENEY RAPORU/);
});

test("iki boyutta hareket düzeneği fırlatıcı, masa ve iz kâğıdını gerçekçi sahnede gösterir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.twod-apparatus\s*\{/);
  assert.match(css, /\.twod-launcher-arm\s*\{/);
  assert.match(css, /\.twod-protractor\s*\{/);
  assert.match(css, /\.twod-speed-sensor\s*\{/);
  assert.match(css, /\.twod-landing-table\s*\{/);
  assert.match(css, /\.twod-trace-paper\s*\{/);
  assert.match(css, /\.twod-meter-ruler\s*\{/);
  assert.match(css, /\.twod-projectile\s*\{/);
  assert.match(css, /\.twod-velocity-arrows\s*\{/);
});

test("serbest düşme modülü PDF düzeneğiyle kurulabilir ve ölçüm yapar", async () => {
  const page = await readFile(new URL("app/FreeFallLab.tsx", projectRoot), "utf8");
  assert.match(page, /FİZ\.10\.1\.4/);
  assert.match(page, /FİZ\.10\.1\.5/);
  assert.match(page, /SETUP_ORDER/);
  assert.match(page, /Statif ve düşey çubuk/);
  assert.match(page, /Bilye bırakma mekanizması/);
  assert.match(page, /Algılayıcı tabla/);
  assert.match(page, /Dijital kronometre/);
  assert.match(page, /Yükseklik cetveli/);
  assert.match(page, /Çelik bilye 1/);
  assert.match(page, /Çelik bilye 2/);
  assert.match(page, /application\/x-freefall-equipment/);
  assert.match(page, /application\/x-freefall-ball/);
  assert.match(page, /onDragStart/);
  assert.match(page, /onStageDrop/);
  assert.match(page, /startReleaseDrag/);
  assert.match(page, /moveRelease/);
  assert.match(page, /HEIGHTS = \[25, 50, 75, 100, 125, 150\]/);
  assert.match(page, /Bilyeyi serbest bırak/);
  assert.match(page, /requestAnimationFrame/);
  assert.match(page, /elapsedSeconds/);
  assert.match(page, /t₁/);
  assert.match(page, /t₅/);
  assert.match(page, /height-time/);
  assert.match(page, /height-time-squared/);
  assert.match(page, /experimentalG/);
  assert.match(page, /gravity/);
  assert.match(page, /changeGravity/);
  assert.match(page, /min="1\.5"/);
  assert.match(page, /max="15"/);
  assert.match(page, /Ay/);
  assert.match(page, /Mars/);
  assert.match(page, /Dünya/);
  assert.match(page, /trialLog/);
  assert.match(page, /Ayarlanan g/);
  assert.match(page, /Hesaplanan g/);
  assert.doesNotMatch(page, /DROP_NOISE|const noise|<th>Fark<\/th>/);
  assert.match(page, /Hava sürtünmesi ihmal edilmiştir/);
  assert.match(page, /KISA DENEY RAPORU/);
});

test("serbest düşme düzeneği statif, bırakma mekanizması ve algılayıcıyı gerçekçi sahnede gösterir", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.freefall-apparatus\s*\{/);
  assert.match(css, /\.freefall-stand-rod\s*\{/);
  assert.match(css, /\.freefall-release-carriage\s*\{/);
  assert.match(css, /\.freefall-sensor\s*\{/);
  assert.match(css, /\.freefall-timer-station\s*\{/);
  assert.match(css, /\.freefall-timer\s*\{/);
  assert.match(css, /\.freefall-timer-screen\s*\{/);
  assert.match(css, /\.freefall-timer-channels\s*\{/);
  assert.match(css, /\.cable-release\s*\{/);
  assert.match(css, /\.cable-sensor\s*\{/);
  assert.match(css, /\.freefall-model-assumption\s*\{/);
  assert.match(css, /\.freefall-gravity-control\s*\{/);
  assert.match(css, /\.freefall-gravity-log\s*\{/);
  assert.match(css, /\.freefall-dropping-ball\.falling/);
  assert.match(css, /\.freefall-ruler\s*\{/);
  assert.match(css, /\.freefall-bench\s*\{/);
});

test("hava rayı deneyi sade hedeflere sürüklenerek kurulabilir", async () => {
  const page = await readFile(new URL("app/MotionLab.tsx", projectRoot), "utf8");
  assert.match(page, /SETUP_SLOTS/);
  assert.match(page, /tezgâhtaki uzun hedefe sürükle/);
  assert.match(page, /Yanlış konum/);
  assert.match(page, /doğru yuvasına kilitlendi/);
  assert.match(page, /TÜM MALZEMELER AÇIK/);
  assert.match(page, /SİSTEMİN TANIDIĞI DÜZENEK/);
  assert.match(page, /acceleratedReady/);
  assert.doesNotMatch(page, /motion-mode-tabs/);
  assert.match(page, /EquipmentVisual/);
  assert.doesNotMatch(page, /air-track-real\.jpg|air-track-pdf-diagram\.png/);
  assert.match(page, /application\/x-spektrum-equipment/);
  assert.match(page, /onDragStart/);
  assert.match(page, /onDrop/);
  assert.match(page, /startSceneDrag/);
  assert.match(page, /Hava rayı/);
  assert.match(page, /Hava pompası/);
  assert.match(page, /Kızak/);
  assert.match(page, /Optik kapı/);
  assert.match(page, /Kronometre/);
  assert.match(page, /Makara/);
  assert.match(page, /Kefe/);
  assert.match(page, /gate-2/);
  assert.match(page, /SECOND_GATE_MIN_X/);
  assert.match(page, /SECOND_GATE_MAX_X/);
  assert.match(page, /Optik kapılar arası mesafe/);
  assert.match(page, /ikinci kapıyı ray üzerinde sürükle/);
  assert.match(page, /GATE_CM_PER_STAGE_PERCENT/);
  assert.match(page, /runEndX/);
  assert.match(page, /reading-gate/);
  assert.match(page, /stage-string-path/);
  assert.match(page, /Kızak → makara → kefe/);
  assert.match(page, /item\.kind !== "string"/);
  assert.match(page, /stopwatchMs/);
  assert.match(page, /timerValue/);
  assert.match(page, /Ölçülen: turuncu bayrak/);
  assert.match(page, /air-track-bench/);
  assert.match(page, /pulley-sequence-warning/);
  assert.match(page, /stage-pulley-alert/);
  assert.match(page, /Makara ilk deney için gerekli değildir/);
  assert.match(page, /Önce fırlatıcıyla makarasız sabit hızlı hareket/);
  assert.match(page, /İvmeli hareket deneyi yapmak istiyorsan makarayı bağla/);
  assert.doesNotMatch(page, /gate-end-/);
  assert.doesNotMatch(page, /setDistance/);
});

test("hava rayı tam genişlikte çizilir ve optik kapı ayakları raya oturur", async () => {
  const css = await readFile(new URL("app/globals.css", projectRoot), "utf8");
  assert.match(css, /\.equipment-rail\s*\{[^}]*display:\s*block;[^}]*width:\s*98\.5%;/s);
  assert.match(css, /\.equipment-rail \.equipment-visual\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0 0 18px;/s);
  assert.match(css, /\.equipment-rail\.selected\s*\{[^}]*outline:\s*0;/s);
  assert.match(css, /\.gate-base::after\s*\{/);
  assert.match(css, /\.equipment-gate\.selected\s*\{/);
  assert.match(css, /\.air-track-bench\s*\{/);
});

test("hareket ölçümleri iki eşzamanlı grafik, sade tablo, kronometre ve rapor sunar", async () => {
  const page = await readFile(new URL("app/MotionLab.tsx", projectRoot), "utf8");
  assert.match(page, /Düzgün Doğrusal Hareket/);
  assert.match(page, /Sabit İvmeli Hareket/);
  assert.match(page, /Kuvvet-İvme İlişkisi/);
  assert.match(page, /Kızağın bayrağının geçiş süreleri/);
  assert.match(page, /Ölçüm sayısı/);
  assert.doesNotMatch(page, /t²ort|tort/);
  assert.match(page, /dual-motion-graphs/);
  assert.match(page, /Konum – zaman/);
  assert.match(page, /Kütle – ivme/);
  assert.match(page, /kind="position"/);
  assert.match(page, /kind="mass"/);
  assert.match(page, /graph-pulley-lock/);
  assert.match(page, /calculateAcceleration/);
  assert.doesNotMatch(page, /const variation|hata kaynağı/);
  assert.match(page, /Kızağı bırak ve ölç/);
  assert.match(page, /student-report/);
  assert.match(page, /textarea/);
  assert.doesNotMatch(page, /motion-theory-grid/);
});

test("tüm deney modülleri ideal ölçüm politikası uygular", async () => {
  const labFiles = [
    "app/MotionLab.tsx",
    "app/FreeFallLab.tsx",
    "app/TwoDimensionalMotionLab.tsx",
    "app/CollisionLab.tsx",
    "app/BallisticPendulumLab.tsx",
    "app/TorqueLab.tsx",
    "app/PrismLab.tsx",
    "app/PhotoelectricLab.tsx",
    "app/OhmLawLab.tsx",
    "app/ResistorConnectionsLab.tsx",
  ];
  const pages = await Promise.all(
    labFiles.map((file) => readFile(new URL(file, projectRoot), "utf8")),
  );
  const source = pages.join("\n");

  assert.doesNotMatch(
    source,
    /Math\.random|\bNOISE\b|DROP_NOISE|SPEED_NOISE|RANGE_NOISE|const noise|const variation|errorPercent|currentError|momentumDifference|difference: number|Yüzdesel fark|ölçüm belirsizliği|hata kaynağı|ölçüm farkları|fark %/i,
  );
});
