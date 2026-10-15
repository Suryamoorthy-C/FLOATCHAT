import { Link } from '../router';
import { CONSOLE_PATH, GITHUB_URL } from '../routes';
import SpecularButton from '../components/SpecularButton';
import AnimatedContent from '../components/AnimatedContent';
import Reveal from '../components/Reveal';
import './Page.css';

const FEATURES = [
  {
    title: 'Conversational query',
    body: 'A natural-language front end over the current float window. Ask about a basin, a depth band, a parameter or a time window and get a written answer rather than a raw table.',
  },
  {
    title: 'Three-dimensional globe',
    body: 'Every displayed float is plotted at its reported position. Colour encodes the active metric, and the depth layer follows the core Argo observing range from the surface down to 2,000 m.',
  },
  {
    title: 'Depth profiles',
    body: 'Select a float to inspect temperature and salinity against depth. The panel keeps the source, fetch time and live-versus-cached mode visible with the profile.',
  },
  {
    title: 'Anomaly surfacing',
    body: 'Potential outliers beyond two standard deviations are flagged against the retrieved window and collected into a signal strip you can inspect. They are screening signals, not proof of cause.',
  },
  {
    title: 'Trajectory replay',
    body: 'Where cycle history is available, it is drawn as an animated path across the globe so movement and sampling coverage are visible at a glance.',
  },
  {
    title: 'Provenance on every answer',
    body: 'Responses carry their citations, the source system and the fetch timestamp, so a live reading is never confused with a cached estimate.',
  },
];

const STEPS = [
  {
    title: 'Ingest',
    body: 'The service reads the Argo GDAC window through Ifremer ERDDAP and normalises platform numbers, positions, cycles and measured values into one shape.',
  },
  {
    title: 'Enrich',
    body: 'Profiles are merged across parameters, per-float history is assembled into trajectories, and statistical outliers are computed against the current window.',
  },
  {
    title: 'Answer',
    body: 'A question is resolved against that enriched view and streamed back word by word, with the citations attached as the answer completes.',
  },
];

export default function Platform() {
  return (
    <AnimatedContent>
    <div className="page" id="platform">
      <div className="container">
        <Reveal>
          <header className="page-head">
            <p className="eyebrow">Platform</p>
            <h1 className="page-head__title" data-no-text-animation>
              A working console for the Argo fleet, with a chat interface over the top.
            </h1>
            <p className="page-head__lede">
              FLOATCHAT reads the configured worldwide Argo data window and lets you interrogate it
              in plain language, with Indian Ocean questions available as a focused regional view.
            </p>
          </header>
        </Reveal>
      </div>

      <section className="section" aria-labelledby="capabilities-title">
        <div className="container">
          <p className="eyebrow">Capabilities</p>
          <h2 className="section__title" id="capabilities-title">
            Six things it does properly.
          </h2>
          <ul className="spec-list">
            {FEATURES.map((feature, index) => (
              <Reveal as="li" className="spec" key={feature.title} delay={(index % 3) * 90}>
                <p className="spec__index">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="spec__title">{feature.title}</h3>
                <p className="spec__body">{feature.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--sunken" id="how" aria-labelledby="how-title">
        <div className="container">
          <p className="eyebrow">How it works</p>
          <h2 className="section__title" id="how-title">
            Three stages, from the GDAC to an answer.
          </h2>
          <ol className="steps">
            {STEPS.map((step, i) => (
              <Reveal as="li" className="steps__item" key={step.title} delay={i * 100}>
                <div>
                  <h3 className="steps__title">{step.title}</h3>
                  <p className="steps__body">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" id="contact" aria-labelledby="contact-title">
        <div className="container split">
          <div>
            <p className="eyebrow">Contact</p>
            <h2 className="section__title" id="contact-title">
              Questions, datasets or corrections.
            </h2>
          </div>
          <div className="prose">
            <p>
              The project is open source. Issues, data corrections and pull requests all live in
              the same place, which is also the fastest way to reach the maintainers.
            </p>
            <div className="actions">
              <SpecularButton as={Link} to={CONSOLE_PATH} size="md">
                Open the console
              </SpecularButton>
              <SpecularButton as="a" href={GITHUB_URL} target="_blank" rel="noreferrer noopener" size="md">
                Open an issue
              </SpecularButton>
            </div>
          </div>
        </div>
      </section>
    </div>
    </AnimatedContent>
  );
}
