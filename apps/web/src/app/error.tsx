'use client';
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="about-page">
      <span className="eyebrow">ANADE 10</span>
      <h1>NÃO FOI POSSÍVEL ABRIR ESTA TELA.</h1>
      <p>Tente novamente para continuar no portal.</p>
      <button className="button primary" onClick={retry}>
        Tentar novamente
      </button>
    </main>
  );
}
