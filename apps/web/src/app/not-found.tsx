import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="about-page">
      <span className="eyebrow">ANADE 10 · PÁGINA NÃO ENCONTRADA</span>
      <h1>VAMOS VOLTAR AO NOSSO CAMINHO.</h1>
      <p>Este endereço não existe no portal.</p>
      <Link href="/painel" className="button primary">
        Voltar ao diretório →
      </Link>
    </main>
  );
}
