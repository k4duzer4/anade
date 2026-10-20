export default function Loading() {
  return (
    <div className="route-skeleton" aria-busy="true" aria-label="Carregando conteúdo">
      <div className="skeleton-line" />
      <div className="skeleton-hero" />
      <div className="skeleton-grid">
        <div />
        <div />
        <div />
      </div>
      <div className="skeleton-panels">
        <div />
        <div />
      </div>
    </div>
  );
}
