import Reveal from '../components/Reveal';
import SpecularButton from '../components/SpecularButton';
import { GITHUB_URL } from '../routes';
import './Page.css';

const ENDPOINTS = [
  ['GET', '/api/health', 'Service status, data source and fetch time.'],
  ['GET', '/api/floats', 'Fleet positions and readings. Accepts ?status, ?region, ?live, ?refresh.'],
  ['GET', '/api/floats/{id}/trajectory', 'Cycle-by-cycle path for one platform.'],
  ['GET', '/api/profiles', 'Depth profile for one float. Accepts ?float_id, ?cycle, ?param.'],
  ['GET', '/api/anomalies', 'Outliers beyond two standard deviations.'],
  ['GET', '/api/stats/overview', 'Active floats, anomalies, coverage and window.'],
  ['POST', '/api/chat', 'Server-Sent Events stream of the answer, then citations.'],
];

const TOKEN_GROUPS = [
  {
    name: 'Colour',
    rows: [
      ['--color-bg', '#060D0D', 'Deep-ocean page background'],
      ['--color-text-primary', '#F4F4F5', 'Primary text'],
      ['--color-text-link', '#C1FF00', 'Links and focus accent'],
      ['--color-accent', '#C1FF00', 'Lime interaction accent'],
      ['--color-surface', 'rgba(255,255,255,0.055)', 'Translucent glass surface'],
      ['--color-border', 'rgba(255,255,255,0.13)', 'Glass edge'],
    ],
  },
  {
    name: 'Type',
    rows: [
      ['--text-sm', '14px', 'Labels, secondary'],
      ['--text-base', '16px', 'Body'],
      ['--text-lg', '20px', 'Subheadings'],
      ['--text-xl', '26px', 'Section headings'],
      ['--text-2xl', '38px', 'Page headings'],
      ['--text-3xl', '72px', 'Display'],
    ],
  },
  {
    name: 'Shape',
    rows: [
      ['--radius-sm', '3px', 'Inline details'],
      ['--radius-md', '16px', 'Cards, notices'],
      ['--radius-lg', '18px', 'Panels'],
      ['--radius-6', '100px', 'Pills and chips'],
      ['--radius-full', '100%', 'Dots'],
    ],
  },
];

export default function Docs() {
  return (
    <div className="page" id="docs">
      <div className="container">
        <Reveal>
        <header className="page-head">
          <p className="eyebrow">Docs</p>
          <h1 className="page-head__title">Run it locally, call the API, and know where the data came from.</h1>
          <p className="page-head__lede">
            The front end is a Vite and React build; the API is a FastAPI service. Nothing is
            hidden behind a proprietary layer.
          </p>
        </header>
        </Reveal>
      </div>

      <section className="section" aria-labelledby="start-title">
        <div className="container split">
          <div>
            <p className="eyebrow">Quick start</p>
            <h2 className="section__title" id="start-title">
              Two processes, one command each.
            </h2>
          </div>
          <div className="prose">
            <p>
              Install dependencies, then run the front end. In development the Vite server proxies
              every <code>/api</code> request to the FastAPI service on port 8000, so no CORS setup
              is needed.
            </p>
            <p>
              <code>npm install</code>
            </p>
            <p>
              <code>npm run dev</code>
            </p>
            <p>
              For production, set <code>VITE_API_BASE_URL</code> to the deployed API origin before
              building. Everything the interface needs — health, floats, profiles, anomalies, stats
              and the chat stream — is addressed relative to that one value.
            </p>
          </div>
        </div>
      </section>

      <section className="section section--sunken" id="api" aria-labelledby="api-title">
        <div className="container">
          <p className="eyebrow">Reference</p>
          <h2 className="section__title" id="api-title">
            API surface.
          </h2>
          <div className="table-wrap">
            <table className="data-table">
              <caption>Seven endpoints, all served by the FastAPI service</caption>
              <thead>
                <tr>
                  <th scope="col">Method</th>
                  <th scope="col">Endpoint</th>
                  <th scope="col">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map(([method, path, purpose]) => (
                  <tr key={path}>
                    <td>{method}</td>
                    <th scope="row">{path}</th>
                    <td>{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section" id="provenance" aria-labelledby="provenance-title">
        <div className="container split">
          <div>
            <p className="eyebrow">Provenance</p>
            <h2 className="section__title" id="provenance-title">
              Where the numbers come from.
            </h2>
          </div>
          <div className="prose">
            <p>
              Readings originate from the international Argo programme. Core profiling floats
              repeatedly sample temperature and salinity from the surface to about 2,000 m; some
              missions also carry biogeochemical sensors with their own data-management rules. See
              the{' '}
              <a href="https://www.aoml.noaa.gov/argo/" target="_blank" rel="noreferrer noopener">
                NOAA Argo overview
              </a>{' '}
              and{' '}
              <a href="https://biogeochemical-argo.org/data-management.php" target="_blank" rel="noreferrer noopener">
                BGC-Argo data-management guidance
              </a>.
            </p>
            <p>
              FLOATCHAT reads the aggregated GDAC window through Ifremer ERDDAP. Each response
              carries the source name and the time it was fetched. When the upstream service cannot
              be reached, the interface says so explicitly rather than presenting a stale value as a
              live one.
            </p>
          </div>
        </div>
      </section>

      <section className="section section--sunken" id="attribution" aria-labelledby="attribution-title">
        <div className="container split">
          <div>
            <p className="eyebrow">Attribution</p>
            <h2 className="section__title" id="attribution-title">
              Built on open data.
            </h2>
          </div>
          <div className="prose">
            <p>
              Argo data are collected and made freely available by the International Argo Program
              and the national programmes that contribute to it. We credit the programme and the
              Ifremer ERDDAP service wherever the data are shown.
            </p>
            <p>
              The interface and API source are open. Issues and corrections are welcome in the
              repository.
            </p>
            <div className="actions">
              <SpecularButton as="a" href={GITHUB_URL} target="_blank" rel="noreferrer noopener" size="md">
                View the repository
              </SpecularButton>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="tokens" aria-labelledby="tokens-title">
        <div className="container">
          <p className="eyebrow">Design system</p>
          <h2 className="section__title" id="tokens-title">
            Tokens, not magic numbers.
          </h2>
          <p className="page-head__lede">
            Every component on this site references the tokens below. No component hardcodes a
            colour, a size or a font.
          </p>

          <ul className="spec-list">
            {TOKEN_GROUPS.map((group, i) => (
              <Reveal as="li" className="spec" key={group.name} delay={(i % 3) * 90}>
                <h3 className="spec__title">{group.name}</h3>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Token</th>
                        <th scope="col">Value</th>
                        <th scope="col">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map(([token, value, role]) => (
                        <tr key={token}>
                          <th scope="row">
                            <code>{token}</code>
                          </th>
                          <td>{value}</td>
                          <td>{role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
