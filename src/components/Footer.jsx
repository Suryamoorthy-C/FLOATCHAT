import { Link } from '../router';
import { GITHUB_URL } from '../routes';
import './Footer.css';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__mark" aria-hidden="true" />
          <div>
            <p className="site-footer__name">FLOATCHAT</p>
            <p className="site-footer__tagline">Cited ocean intelligence from the open Argo programme.</p>
          </div>
        </div>

        <nav className="site-footer__nav" aria-label="Essential footer links">
          <Link className="site-footer__link" to="/">Home</Link>
          <Link className="site-footer__link" to="/data">Live data</Link>
          <Link className="site-footer__link" to="/pearl-zones">Pearl data</Link>
          <Link className="site-footer__link" to="/docs">Docs</Link>
          <Link className="site-footer__link" to="/docs#api">API reference</Link>
          <a className="site-footer__link" href={GITHUB_URL} target="_blank" rel="noreferrer noopener">Source</a>
        </nav>
      </div>

      <div className="container site-footer__base">
        <p className="site-footer__note">Argo GDAC / Ifremer ERDDAP</p>
        <p className="site-footer__note">© {year} FLOATCHAT</p>
      </div>
    </footer>
  );
}
