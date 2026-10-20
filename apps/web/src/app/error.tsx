'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="about-page">
      <span className="eyebrow">ANADE 10</span>
      <h1>NÃO FOI POSSÍVEL ABRIR ESTA TELA.</h1>
      <p>Tente novamente para continuar no portal.</p>
      <button className="button primary" onClick={reset}>
        Tentar novamente
      </button>
    </main>
  );
}
