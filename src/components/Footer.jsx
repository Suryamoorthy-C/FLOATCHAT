import { Link } from '../router';
import { FOOTER_GROUPS } from '../routes';
import './Footer.css';

const isExternal = to => /^https?:/i.test(to);

/**
 * Site footer.
 *
 * Intent: secondary navigation plus provenance and attribution, which matter
 * because every number on this site is traceable to an Argo data source.
 *
 * Uses the dark surface, which is the only place the "Text Light" palette
 * tokens (color-8, green) are legible.
 */
export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__mark" aria-hidden="true" />
          <p className="site-footer__name">FLOATCHAT</p>
          <p className="site-footer__tagline">
            Ocean intelligence for the Argo fleet. Ask a question in plain language and get a
            cited answer drawn from live float telemetry.
          </p>
        </div>

        <nav className="site-footer__nav" aria-label="Footer">
          {FOOTER_GROUPS.map(group => (
            <div className="site-footer__group" key={group.title}>
              <h2 className="site-footer__group-title">{group.title}</h2>
              <ul className="site-footer__list">
                {group.links.map(link => (
                  <li key={`${group.title}-${link.label}`}>
                    {isExternal(link.to) ? (
                      <a
                        className="site-footer__link"
                        href={link.to}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link className="site-footer__link" to={link.to}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="container site-footer__base">
        <p className="site-footer__note">
          Data source: Argo GDAC / Ifremer ERDDAP · built on the open Argo programme.
        </p>
        <p className="site-footer__note">© {year} FLOATCHAT</p>
      </div>
    </footer>
  );
}
