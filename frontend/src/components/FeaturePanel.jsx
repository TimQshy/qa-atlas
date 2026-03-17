import './FeaturePanel.css';

function findFeatureInProduct(product, featureId) {
  if (!product?.modules) return null;
  for (const mod of product.modules) {
    const feature = mod.features?.find((f) => f.id === featureId);
    if (feature) return { feature, module: mod };
  }
  return null;
}

export default function FeaturePanel({ feature, product }) {
  if (!feature) {
    return (
      <div className="feature-panel feature-panel--empty">
        <p>Select a feature</p>
        <span className="feature-panel-hint">Click a feature on the map to see details.</span>
      </div>
    );
  }

  const attrs = feature.attributes ?? {};
  const featureId = attrs.featureId;
  const found = findFeatureInProduct(product, featureId);
  const data = found?.feature ?? {};
  const moduleName = found?.module?.name ?? '';

  const testCases = data.testCases ?? [];
  const tickets = data.tickets ?? [];
  const bugs = data.bugs ?? [];
  const automation = data.automation ?? [];
  const coverage = data.coverage ?? attrs.coverage ?? 0;

  const getCoverageClass = (c) => {
    if (c >= 80) return 'coverage-high';
    if (c >= 40) return 'coverage-medium';
    return 'coverage-low';
  };

  return (
    <div className="feature-panel">
      <h3 className="feature-panel-title">{data.name ?? feature.name}</h3>
      {moduleName && <p className="feature-panel-module">Module: {moduleName}</p>}

      <section className="feature-panel-section">
        <h4>Coverage</h4>
        <div className={`feature-panel-coverage ${getCoverageClass(coverage)}`}>
          {coverage}%
        </div>
      </section>

      <section className="feature-panel-section">
        <h4>Test Cases</h4>
        {testCases.length ? (
          <ul>
            {testCases.map((tc, i) => (
              <li key={tc.id ?? i}>
                {typeof tc === 'string' ? tc : tc.name}
                {tc.automated && <span className="badge badge-auto">automated</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="feature-panel-empty">No test cases</p>
        )}
      </section>

      <section className="feature-panel-section">
        <h4>Tickets</h4>
        {tickets.length ? (
          <ul>
            {tickets.map((t, i) => (
              <li key={i}>{typeof t === 'string' ? t : t.key}</li>
            ))}
          </ul>
        ) : (
          <p className="feature-panel-empty">No tickets</p>
        )}
      </section>

      <section className="feature-panel-section">
        <h4>Bugs</h4>
        {bugs.length ? (
          <ul>
            {bugs.map((b, i) => (
              <li key={i}>{typeof b === 'string' ? b : b.title ?? b.key}</li>
            ))}
          </ul>
        ) : (
          <p className="feature-panel-empty">No bugs</p>
        )}
      </section>

      <section className="feature-panel-section">
        <h4>Automation</h4>
        {automation.length ? (
          <ul>
            {automation.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        ) : (
          <p className="feature-panel-empty">No automation</p>
        )}
      </section>
    </div>
  );
}
