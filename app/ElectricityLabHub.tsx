"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import MagneticFieldLab from "./MagneticFieldLab";
import OhmLawLab from "./OhmLawLab";
import ResistorConnectionsLab from "./ResistorConnectionsLab";

type ActiveExperiment = "ohm" | "resistor-connections" | "magnetic-field" | null;

export default function ElectricityLabHub({ onBack }: { onBack: () => void }) {
  const [activeExperiment, setActiveExperiment] = useState<ActiveExperiment>(null);

  return (
    <main className="page-shell electricity-hub-shell">
      <header className="site-header electricity-site-header">
        <button
          className="mechanics-back-button"
          type="button"
          onClick={onBack}
          aria-label="Fizik deney setlerine dön"
        >
          ←
        </button>
        <a className="brand" href="#elektrik-ust" aria-label="Fizik Atölyesi Elektrik">
          <span className="brand-mark electricity-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Elektrik deney setleri</small>
          </span>
        </a>
        <nav aria-label="Elektrik deneyleri">
          <button type="button" className={activeExperiment === "ohm" ? "active" : ""} onClick={() => setActiveExperiment("ohm")}>Ohm yasası</button>
          <button type="button" className={activeExperiment === "resistor-connections" ? "active" : ""} onClick={() => setActiveExperiment("resistor-connections")}>Direnç bağlantıları</button>
          <button type="button" className={activeExperiment === "magnetic-field" ? "active" : ""} onClick={() => setActiveExperiment("magnetic-field")}>Manyetik alan</button>
        </nav>
        <span className="curriculum-chip">TYMM · 10. Sınıf</span>
      </header>

      <div id="elektrik-ust">
        <section className="electricity-experiment-launcher">
          <div>
            <span>ELEKTRİK · ETKİLEŞİMLİ DENEYLER</span>
            <h1>Çalışmak istediğin deneyi seç.</h1>
          </div>
          <div className="electricity-experiment-grid">
            <button type="button" className={activeExperiment === "ohm" ? "active" : ""} onClick={() => setActiveExperiment("ohm")}>
              <span className="electricity-choice-visual ohm-choice-visual" aria-hidden="true">
                <img src="./electricity-ohm.webp" alt="" draggable="false" />
              </span>
              <span><small>DENEY 01 · FİZ.10.3.3</small><b>Ohm yasası</b><em>Devreyi kur, akım-gerilim örüntüsünü ölç</em></span>
              <strong>{activeExperiment === "ohm" ? "Açık" : "Deneyi aç"} →</strong>
            </button>
            <button type="button" className={activeExperiment === "resistor-connections" ? "active" : ""} onClick={() => setActiveExperiment("resistor-connections")}>
              <span className="electricity-choice-visual resistor-choice-visual" aria-hidden="true">
                <img src="./electricity-resistors.webp" alt="" draggable="false" />
              </span>
              <span><small>DENEY 02 · FİZ.10.3.4</small><b>Dirençlerin bağlanması</b><em>Seri ve paralel devreleri karşılaştır</em></span>
              <strong>{activeExperiment === "resistor-connections" ? "Açık" : "Deneyi aç"} →</strong>
            </button>
            <button type="button" className={activeExperiment === "magnetic-field" ? "active" : ""} onClick={() => setActiveExperiment("magnetic-field")}>
              <span className="electricity-choice-visual magnetic-field-choice-visual" aria-hidden="true">
                <img src="./electricity-magnetic-field.webp" alt="" draggable="false" />
              </span>
              <span><small>DENEY 03 · TYMM</small><b>Manyetik alan</b><em>Bobini kur, alanı yoklama kangalıyla tara</em></span>
              <strong>{activeExperiment === "magnetic-field" ? "Açık" : "Deneyi aç"} →</strong>
            </button>
          </div>
        </section>
        {activeExperiment === "ohm" && <OhmLawLab />}
        {activeExperiment === "resistor-connections" && <ResistorConnectionsLab />}
        {activeExperiment === "magnetic-field" && <MagneticFieldLab />}
      </div>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark electricity-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Elektrik deney setleri</small>
          </span>
        </div>
        <p>TYMM elektrik ve manyetizma öğrenme çıktılarıyla uyumludur.</p>
        <a href="#elektrik-ust">Başa dön ↑</a>
      </footer>
    </main>
  );
}
