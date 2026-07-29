"use client";

import { useEffect, useState } from "react";
import MechanicsLabHub from "./MechanicsLabHub";
import OpticsLabHub from "./OpticsLabHub";

type PortalView =
  | "home"
  | "experiment-sets"
  | "free-labs"
  | "mechanics"
  | "waves-optics"
  | "placeholder";

type ModuleCard = {
  key: string;
  title: string;
  description: string;
  detail: string;
  visual: string;
  available?: boolean;
};

const EXPERIMENT_MODULES: ModuleCard[] = [
  {
    key: "mechanics",
    title: "Mekanik",
    description: "Hareketten torka, yedi etkileşimli deney.",
    detail: "7 deney açık",
    visual: "portal-visual-mechanics",
    available: true,
  },
  {
    key: "electricity",
    title: "Elektrik",
    description: "Devre kurma ve elektriksel büyüklükleri keşfetme alanı.",
    detail: "Hazırlanıyor",
    visual: "portal-visual-electricity",
  },
  {
    key: "waves-optics",
    title: "Dalgalar · Optik",
    description: "Kırılmayı, prizmadaki sapmayı ve tam yansımayı deneyle.",
    detail: "1 deney açık",
    visual: "portal-visual-waves",
    available: true,
  },
  {
    key: "modern-physics",
    title: "Modern Fizik",
    description: "Atomdan kuantuma uzanan yeni deney alanı.",
    detail: "Hazırlanıyor",
    visual: "portal-visual-modern",
  },
];

const FREE_LAB_MODULES: ModuleCard[] = [
  {
    key: "force-motion",
    title: "Kuvvet ve Hareket",
    description: "Kuvveti değiştir, hareketin nasıl karşılık verdiğini gözle.",
    detail: "Serbest çalışma alanı",
    visual: "portal-visual-force",
  },
  {
    key: "energy",
    title: "Enerji",
    description: "Enerji dönüşümlerini kendi koşullarınla araştır.",
    detail: "Serbest çalışma alanı",
    visual: "portal-visual-energy",
  },
  {
    key: "pressure",
    title: "Basınç ve Kaldırma Kuvveti",
    description: "Akışkanlarla, yoğunlukla ve dengeyle denemeler yap.",
    detail: "Serbest çalışma alanı",
    visual: "portal-visual-pressure",
  },
  {
    key: "electric-magnetic",
    title: "Elektrik ve Manyetizma",
    description: "Alanları, devreleri ve manyetik etkileşimleri kur.",
    detail: "Serbest çalışma alanı",
    visual: "portal-visual-magnetism",
  },
  {
    key: "heat",
    title: "Isı ve Sıcaklık",
    description: "Maddenin ısıl davranışını karşılaştırarak keşfet.",
    detail: "Serbest çalışma alanı",
    visual: "portal-visual-heat",
  },
  {
    key: "waves",
    title: "Dalgalar",
    description: "Genlik, frekans ve yayılma ilişkilerini serbestçe değiştir.",
    detail: "Serbest çalışma alanı",
    visual: "portal-visual-wave-free",
  },
  {
    key: "optics",
    title: "Optik",
    description: "Işınları, aynaları ve mercekleri kendi düzeninde birleştir.",
    detail: "Serbest çalışma alanı",
    visual: "portal-visual-optics",
  },
  {
    key: "modern",
    title: "Modern Fizik",
    description: "Görünmeyen dünyayı etkileşimli modellerle sorgula.",
    detail: "Serbest çalışma alanı",
    visual: "portal-visual-modern-free",
  },
];

function PortalBrand({ onHome }: { onHome: () => void }) {
  return (
    <button
      className="portal-brand"
      type="button"
      onClick={onHome}
      aria-label="Fizik Atölyesi ana sayfası"
    >
      <span className="portal-brand-mark" aria-hidden="true">
        <i />
        <i />
        <b>F</b>
      </span>
      <span>
        <b>FİZİK ATÖLYESİ</b>
        <small>Merak et · Kur · Keşfet</small>
      </span>
    </button>
  );
}

function PortalHeader({
  view,
  onNavigate,
}: {
  view: PortalView;
  onNavigate: (view: PortalView) => void;
}) {
  return (
    <header className="portal-header">
      <PortalBrand onHome={() => onNavigate("home")} />
      <nav aria-label="Ana bölümler">
        <button
          type="button"
          className={view === "home" ? "active" : ""}
          onClick={() => onNavigate("home")}
        >
          Ana sayfa
        </button>
        <button
          type="button"
          className={view === "experiment-sets" ? "active" : ""}
          onClick={() => onNavigate("experiment-sets")}
        >
          Deney setleri
        </button>
        <button
          type="button"
          className={view === "free-labs" ? "active" : ""}
          onClick={() => onNavigate("free-labs")}
        >
          Serbest alan
        </button>
      </nav>
      <span className="portal-header-badge">TYMM UYUMLU</span>
    </header>
  );
}

function PortalFooter({ onHome }: { onHome: () => void }) {
  return (
    <footer className="portal-footer">
      <PortalBrand onHome={onHome} />
      <p>Fiziği izlemekle kalma; düzeneği kur, ölç ve kendi sonucuna ulaş.</p>
      <button type="button" onClick={onHome}>
        Ana sayfaya dön ↑
      </button>
    </footer>
  );
}

function HomeView({
  onNavigate,
}: {
  onNavigate: (view: PortalView) => void;
}) {
  return (
    <>
      <section className="portal-hero">
        <div className="portal-hero-copy">
          <span className="portal-eyebrow">
            <i />
            DİJİTAL FİZİK LABORATUVARI
          </span>
          <h1>
            Fizik ezber değil,
            <em> deneyimdir.</em>
          </h1>
          <p>
            Bir düzeneği kendi ellerinle kur. Değişkenleri değiştir. Sonucu
            izle ve fiziğin günlük hayatla nasıl konuştuğunu keşfet.
          </p>
          <div className="portal-hero-actions">
            <button
              className="portal-primary-button"
              type="button"
              onClick={() => onNavigate("experiment-sets")}
            >
              Deney setlerini keşfet <span>→</span>
            </button>
            <button
              className="portal-secondary-button"
              type="button"
              onClick={() => onNavigate("free-labs")}
            >
              Serbest çalışmaya başla
            </button>
          </div>
          <div className="portal-hero-notes">
            <span>
              <b>07</b>
              çalışan mekanik deneyi
            </span>
            <span>
              <b>12</b>
              hazır konu alanı
            </span>
            <span>
              <b>∞</b>
              merak etme hakkı
            </span>
          </div>
        </div>

        <div className="portal-hero-visual">
          <div className="portal-image-frame">
            {/* Static GitHub Pages paketi için göreli, sağlayıcıdan bağımsız görsel. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="./fizik-atolyesi-hero.png"
              alt="Işık, dalga, sarkaç ve elektrik deneylerinden oluşan özgün Fizik Atölyesi sahnesi"
            />
            <i className="portal-image-glow" />
          </div>
          <span className="portal-float-card card-build">
            <i>01</i>
            <b>Kur</b>
            <small>Düzeneği sen oluştur.</small>
          </span>
          <span className="portal-float-card card-measure">
            <i>02</i>
            <b>Ölç</b>
            <small>Veriyi canlı izle.</small>
          </span>
          <span className="portal-float-card card-discover">
            <i>03</i>
            <b>Keşfet</b>
            <small>Sonucunu kanıtla.</small>
          </span>
        </div>
      </section>

      <section className="portal-paths" aria-labelledby="portal-paths-title">
        <div className="portal-section-heading">
          <span>ATÖLYEYE GİRİŞ</span>
          <h2 id="portal-paths-title">Bugün nasıl çalışmak istersin?</h2>
          <p>Yönergeli bir deney seç veya kendi koşullarını özgürce oluştur.</p>
        </div>
        <div className="portal-path-grid">
          <button
            className="portal-path-card experiment-path"
            type="button"
            onClick={() => onNavigate("experiment-sets")}
          >
            <span className="portal-path-number">01</span>
            <div className="portal-path-visual" aria-hidden="true">
              <i className="path-lab-table" />
              <i className="path-stand" />
              <i className="path-pendulum" />
              <i className="path-gate" />
              <i className="path-ray" />
            </div>
            <span className="portal-path-copy">
              <small>YÖNERGELİ LABORATUVAR</small>
              <b>Fizik Deney Setleri</b>
              <em>
                Malzemeleri yerleştir, ölçüm adımlarını tamamla ve deney
                raporunu oluştur.
              </em>
            </span>
            <strong>4 alanı gör <i>→</i></strong>
          </button>

          <button
            className="portal-path-card simulation-path"
            type="button"
            onClick={() => onNavigate("free-labs")}
          >
            <span className="portal-path-number">02</span>
            <div className="portal-path-visual" aria-hidden="true">
              <i className="path-orbit orbit-one" />
              <i className="path-orbit orbit-two" />
              <i className="path-particle particle-one" />
              <i className="path-particle particle-two" />
              <i className="path-wave" />
            </div>
            <span className="portal-path-copy">
              <small>ÖZGÜR KEŞİF ALANI</small>
              <b>Serbest Deney ve Simülasyon</b>
              <em>
                Değişkenleri sen belirle, sınırları dene ve kendi fizik
                sorununun peşinden git.
              </em>
            </span>
            <strong>8 alanı gör <i>→</i></strong>
          </button>
        </div>
      </section>

      <section className="portal-micro-story">
        <div>
          <span className="story-orbit" aria-hidden="true">
            <i />
            <i />
            <b />
          </span>
          <p>
            <small>FİZİĞİN EN GÜZEL ANI</small>
            <strong>“Neden böyle oldu?”</strong> diye sorduğun andır.
          </p>
        </div>
        <div className="portal-story-steps">
          <span>
            <b>Merak</b>
            Bir soru seç.
          </span>
          <i>→</i>
          <span>
            <b>Deney</b>
            Koşulları değiştir.
          </span>
          <i>→</i>
          <span>
            <b>Kanıt</b>
            Verinle açıkla.
          </span>
        </div>
      </section>
    </>
  );
}

function ModuleVisual({ className }: { className: string }) {
  return (
    <span className={`portal-module-visual ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function ModuleGrid({
  modules,
  onSelect,
}: {
  modules: ModuleCard[];
  onSelect: (module: ModuleCard) => void;
}) {
  return (
    <div className="portal-module-grid">
      {modules.map((module, index) => (
        <button
          key={module.key}
          className={module.available ? "available" : ""}
          type="button"
          onClick={() => onSelect(module)}
        >
          <span className="portal-module-index">
            {String(index + 1).padStart(2, "0")}
          </span>
          <ModuleVisual className={module.visual} />
          <span className="portal-module-copy">
            <small>{module.detail}</small>
            <b>{module.title}</b>
            <em>{module.description}</em>
          </span>
          <strong>
            {module.available ? "Deneyleri aç" : "Alanı görüntüle"} <i>→</i>
          </strong>
        </button>
      ))}
    </div>
  );
}

function CollectionView({
  type,
  onNavigate,
  onPlaceholder,
}: {
  type: "experiment-sets" | "free-labs";
  onNavigate: (view: PortalView) => void;
  onPlaceholder: (module: ModuleCard, parent: PortalView) => void;
}) {
  const isExperiment = type === "experiment-sets";
  const modules = isExperiment ? EXPERIMENT_MODULES : FREE_LAB_MODULES;
  return (
    <section className="portal-collection">
      <button
        className="portal-text-back"
        type="button"
        onClick={() => onNavigate("home")}
      >
        ← Ana sayfa
      </button>
      <div className="portal-collection-heading">
        <div>
          <span>
            {isExperiment ? "FİZİK DENEY SETLERİ" : "SERBEST DENEY VE SİMÜLASYON"}
          </span>
          <h1>
            {isExperiment
              ? "Düzeneği kur, deneyi yaşa."
              : "Soruyu sen sor, sınırları sen belirle."}
          </h1>
          <p>
            {isExperiment
              ? "Her sette gerçek laboratuvar akışını izleyen yönergeler, canlı ölçümler ve kanıta dayalı rapor alanları bulunur."
              : "Hazır bir sonuca gitmek zorunda değilsin. Değişkenlerle oyna, yeni koşullar kur ve gözlemini kaydet."}
          </p>
        </div>
        <aside>
          <b>{modules.length}</b>
          <span>{isExperiment ? "deney alanı" : "serbest konu alanı"}</span>
          <small>{isExperiment ? "Mekanik ve Dalgalar-Optik açık" : "İskelet hazır"}</small>
        </aside>
      </div>
      <ModuleGrid
        modules={modules}
        onSelect={(module) => {
          if (module.key === "mechanics" && module.available) {
            onNavigate("mechanics");
          } else if (module.key === "waves-optics" && module.available) {
            onNavigate("waves-optics");
          } else {
            onPlaceholder(module, type);
          }
        }}
      />
    </section>
  );
}

function PlaceholderView({
  module,
  parent,
  onNavigate,
}: {
  module: ModuleCard;
  parent: PortalView;
  onNavigate: (view: PortalView) => void;
}) {
  return (
    <section className="portal-placeholder">
      <button
        className="portal-text-back"
        type="button"
        onClick={() => onNavigate(parent)}
      >
        ← Alanlara dön
      </button>
      <div className="portal-placeholder-card">
        <ModuleVisual className={module.visual} />
        <span className="portal-placeholder-status">
          <i />
          YAPIM AŞAMASINDA
        </span>
        <h1>{module.title}</h1>
        <p>
          Bu alanın kapısı hazır. Deneyler ve simülasyonlar eklendikçe aynı
          atölye düzeni içinde burada açılacak.
        </p>
        <div className="portal-empty-bench" aria-hidden="true">
          <i className="empty-grid" />
          <i className="empty-table" />
          <i className="empty-light" />
          <span>Sıradaki deney için hazır</span>
        </div>
        <button
          className="portal-primary-button"
          type="button"
          onClick={() => onNavigate(parent)}
        >
          Diğer alanları gör <span>→</span>
        </button>
      </div>
    </section>
  );
}

export default function Home() {
  const [view, setView] = useState<PortalView>("home");
  const [placeholder, setPlaceholder] = useState<{
    module: ModuleCard;
    parent: PortalView;
  } | null>(null);

  const navigate = (nextView: PortalView) => {
    setView(nextView);
    if (nextView !== "placeholder") setPlaceholder(null);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  if (view === "mechanics") {
    return <MechanicsLabHub onBack={() => navigate("experiment-sets")} />;
  }

  if (view === "waves-optics") {
    return <OpticsLabHub onBack={() => navigate("experiment-sets")} />;
  }

  return (
    <main className="portal-shell">
      <PortalHeader view={view} onNavigate={navigate} />
      {view === "home" && <HomeView onNavigate={navigate} />}
      {view === "experiment-sets" && (
        <CollectionView
          type="experiment-sets"
          onNavigate={navigate}
          onPlaceholder={(module, parent) => {
            setPlaceholder({ module, parent });
            setView("placeholder");
          }}
        />
      )}
      {view === "free-labs" && (
        <CollectionView
          type="free-labs"
          onNavigate={navigate}
          onPlaceholder={(module, parent) => {
            setPlaceholder({ module, parent });
            setView("placeholder");
          }}
        />
      )}
      {view === "placeholder" && placeholder && (
        <PlaceholderView
          module={placeholder.module}
          parent={placeholder.parent}
          onNavigate={navigate}
        />
      )}
      <PortalFooter onHome={() => navigate("home")} />
    </main>
  );
}
