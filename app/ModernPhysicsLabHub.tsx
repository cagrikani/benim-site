"use client";

import PhotoelectricLab from "./PhotoelectricLab";

export default function ModernPhysicsLabHub({ onBack }: { onBack: () => void }) {
  return (
    <main className="page-shell modern-hub-shell">
      <header className="site-header modern-site-header">
        <button
          className="mechanics-back-button"
          type="button"
          onClick={onBack}
          aria-label="Fizik deney setlerine dön"
        >
          ←
        </button>
        <a className="brand" href="#modern-ust" aria-label="Fizik Atölyesi Modern Fizik">
          <span className="brand-mark modern-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Modern Fizik deney setleri</small>
          </span>
        </a>
        <nav aria-label="Modern Fizik deneyleri">
          <a href="#fotoelektrik-deneyi">Fotoelektrik etki</a>
        </nav>
        <span className="curriculum-chip">TYMM · 12. Sınıf</span>
      </header>

      <div id="modern-ust">
        <PhotoelectricLab />
      </div>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark modern-brand-mark">FA</span>
          <span>
            <b>FİZİK ATÖLYESİ</b>
            <small>Modern Fizik deney setleri</small>
          </span>
        </div>
        <p>TYMM FİZ.12.4.1, FİZ.12.4.2 ve FİZ.12.4.3 öğrenme çıktılarıyla uyumludur.</p>
        <a href="#modern-ust">Başa dön ↑</a>
      </footer>
    </main>
  );
}
