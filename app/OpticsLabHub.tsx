"use client";

import PrismLab from "./PrismLab";

export default function OpticsLabHub({ onBack }: { onBack: () => void }) {
  return (
    <main className="page-shell optics-hub-shell">
      <header className="site-header optics-site-header">
        <button
          className="mechanics-back-button"
          type="button"
          onClick={onBack}
          aria-label="Fizik deney setlerine dön"
        >
          ←
        </button>
        <a className="brand" href="#optik-ust" aria-label="Fizik Atölyesi Dalgalar ve Optik">
          <span className="brand-mark optics-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Dalgalar - Optik deney setleri</small>
          </span>
        </a>
        <nav aria-label="Dalgalar ve Optik deneyleri">
          <a href="#kirilma-prizma-deneyi">Kırılma ve prizma</a>
        </nav>
        <span className="curriculum-chip">TYMM · 11. Sınıf</span>
      </header>

      <div id="optik-ust">
        <PrismLab />
      </div>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark optics-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Dalgalar - Optik deney setleri</small>
          </span>
        </div>
        <p>TYMM FİZ.11.4.5 ve FİZ.11.4.8 öğrenme çıktılarıyla uyumludur.</p>
        <a href="#optik-ust">Başa dön ↑</a>
      </footer>
    </main>
  );
}
