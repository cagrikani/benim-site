"use client";

import OhmLawLab from "./OhmLawLab";

export default function ElectricityLabHub({ onBack }: { onBack: () => void }) {
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
          <a href="#ohm-yasasi-deneyi">Ohm yasası</a>
        </nav>
        <span className="curriculum-chip">TYMM · 10. Sınıf</span>
      </header>

      <div id="elektrik-ust">
        <OhmLawLab />
      </div>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark electricity-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Elektrik deney setleri</small>
          </span>
        </div>
        <p>TYMM FİZ.10.3.3 öğrenme çıktısıyla uyumludur.</p>
        <a href="#elektrik-ust">Başa dön ↑</a>
      </footer>
    </main>
  );
}
