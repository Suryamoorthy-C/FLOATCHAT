import { Link } from '../router';
import './Pricing.css';

const PLANS = [
  {
    name: 'Starter Pilot',
    price: '$3,750',
    priceNote: 'per month · 1 float',
    description: 'A focused first deployment for a single lease zone or compact bay.',
    bestFor: 'Single-zone pilot · 1–5 km²',
    features: [
      '1 BGC-Argo profiling float',
      'FloatChat AI Basic tier',
      '$2,500 hardware rental + $1,250 AI SaaS',
      '1.5 km monitoring radius per node',
      'Deployment planning for one central station',
    ],
    cta: 'Plan a pilot',
    featured: false,
  },
  {
    name: 'Commercial Growth',
    price: '$11,500',
    priceNote: 'per month · 4 floats',
    description: 'Connected monitoring for growing farms with several active lease blocks.',
    bestFor: 'Medium-scale farms · 5–20 km²',
    features: [
      '4 BGC-Argo profiling floats',
      'FloatChat Enterprise tier',
      'Multi-user access for your team',
      'Automated PPI screening and anomaly alerts',
      '$10,000 hardware rental + $1,500 team SaaS',
      'Distributed monitoring across lease zones',
    ],
    cta: 'Talk about Commercial',
    featured: true,
  },
  {
    name: 'Industrial Fleet',
    price: '$25,000+',
    priceNote: 'per month · custom fleet',
    description: 'Regional visibility and a dedicated deployment for large marine operations.',
    bestFor: 'Multi-bay operations · 20–50+ km²',
    features: [
      '8–10+ BGC-Argo profiling floats',
      'Full API data pipeline',
      'Dedicated account manager',
      'Networked coverage across active harvest blocks',
      'Custom fleet sizing and deployment plan',
    ],
    cta: 'Request a fleet plan',
    featured: false,
  },
];

const COVERAGE = [
  { scale: 'Small pilot', area: '1–5 km²', radius: '1.5 km', fleet: '1 float', rate: '$3,750 / mo' },
  { scale: 'Medium commercial', area: '5–20 km²', radius: '2 km', fleet: '4 floats', rate: '$11,500 / mo' },
  { scale: 'Industrial enterprise', area: '20–50+ km²', radius: '3–5 km', fleet: '8–10+ floats', rate: '$25,000+ / mo' },
];

function CheckIcon() {
  return <span className="pricing-check" aria-hidden="true">✓</span>;
}

export default function Pricing() {
  return (
    <div className="pricing-page" id="pricing">
      <section className="pricing-hero" aria-labelledby="pricing-title">
        <div className="container pricing-hero__inner">
          <div className="pricing-hero__copy">
            <p className="pricing-eyebrow"><span /> CUSTOMER PLANS · AGRO-FLOAT</p>
            <h1 id="pricing-title">Ocean intelligence, sized to your farm.</h1>
            <p className="pricing-hero__lede">
              Lease advanced BGC-Argo floats with FloatChat analytics—without the upfront hardware purchase.
              Choose a starting point, then shape the deployment around your water and lease zones.
            </p>
            <div className="pricing-hero__meta">
              <span><b>12 months</b> minimum contract</span>
              <i aria-hidden="true" />
              <span>Hardware + AI SaaS</span>
              <i aria-hidden="true" />
              <span>USD pricing</span>
            </div>
          </div>
          <div className="pricing-hero__visual" aria-hidden="true">
            <div className="pricing-orbit pricing-orbit--outer" />
            <div className="pricing-orbit pricing-orbit--inner" />
            <div className="pricing-orbit__core"><span>FC</span></div>
            <div className="pricing-orbit__node pricing-orbit__node--one" />
            <div className="pricing-orbit__node pricing-orbit__node--two" />
            <div className="pricing-orbit__node pricing-orbit__node--three" />
            <div className="pricing-visual-label"><span>DEPLOYMENT MODEL</span><b>Hardware + intelligence</b></div>
          </div>
        </div>
      </section>

      <section className="pricing-plans section" aria-labelledby="plans-title">
        <div className="container">
          <div className="pricing-section-head">
            <div>
              <p className="eyebrow">Straightforward monthly plans</p>
              <h2 className="section__title" id="plans-title">Pick the footprint that fits.</h2>
            </div>
            <p className="pricing-section-head__note">Every plan includes float deployment and access to FloatChat. Enterprise fleet configurations are tailored with our team.</p>
          </div>

          <div className="pricing-grid">
            {PLANS.map((plan, index) => (
              <article className={`pricing-card${plan.featured ? ' pricing-card--featured' : ''}`} key={plan.name}>
                {plan.featured && <div className="pricing-card__badge"><span aria-hidden="true">✦</span> MOST POPULAR</div>}
                <div className="pricing-card__topline"><span>0{index + 1}</span><span className="pricing-card__dot" /></div>
                <h3>{plan.name}</h3>
                <p className="pricing-card__description">{plan.description}</p>
                <div className="pricing-card__price"><strong>{plan.price}</strong><span>{plan.priceNote}</span></div>
                <p className="pricing-card__fit"><span>BEST FOR</span>{plan.bestFor}</p>
                <ul className="pricing-card__features">
                  {plan.features.map(feature => <li key={feature}><CheckIcon />{feature}</li>)}
                </ul>
                <Link className={`pricing-card__cta${plan.featured ? ' pricing-card__cta--featured' : ''}`} to="/platform#contact">
                  {plan.cta}<span aria-hidden="true">↗</span>
                </Link>
              </article>
            ))}
          </div>
          <p className="pricing-contract-note"><span aria-hidden="true">ⓘ</span> Plans are billed monthly on a 12-month minimum contract. Industrial fleet pricing is a starting estimate; final rates depend on fleet size and deployment requirements.</p>
        </div>
      </section>

      <section className="pricing-coverage section" aria-labelledby="coverage-title">
        <div className="container">
          <div className="pricing-coverage__header">
            <div>
              <p className="eyebrow">Plan for your water</p>
              <h2 className="section__title" id="coverage-title">A starting point for fleet sizing.</h2>
            </div>
            <p>Coverage varies with currents, water shape and lease layout. Use this guide as a first pass; we’ll help map the final positions.</p>
          </div>
          <div className="pricing-coverage__table-wrap">
            <table className="pricing-coverage__table">
              <thead><tr><th scope="col">Farm scale</th><th scope="col">Lease area</th><th scope="col">Radius per node</th><th scope="col">Recommended fleet</th><th scope="col">Monthly investment</th></tr></thead>
              <tbody>{COVERAGE.map(row => <tr key={row.scale}><th scope="row">{row.scale}</th><td>{row.area}</td><td>{row.radius}</td><td>{row.fleet}</td><td><strong>{row.rate}</strong></td></tr>)}</tbody>
            </table>
          </div>
          <div className="pricing-bottom-cta">
            <div className="pricing-bottom-cta__mark" aria-hidden="true">↗</div>
            <div><p className="eyebrow">Have a larger or unusual site?</p><h3>Let’s size the right fleet together.</h3><p>Share your lease area and monitoring goals; we’ll help map a practical deployment.</p></div>
            <Link to="/platform#contact" className="pricing-bottom-cta__link">Talk to our team <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
