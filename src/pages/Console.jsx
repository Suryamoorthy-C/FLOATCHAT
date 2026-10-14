import ConsoleApp from '../console/Console';
import { Link } from '../router';
import './Console.css';

/**
 * Console route.
 *
 * Wraps the existing operations console in the .console-route shell that its
 * stylesheet is now scoped to, and adds a way back to the site without editing
 * anything inside the console itself.
 */
export default function Console() {
  return (
    <div className="console-route">
      <div className="console-bar">
        <Link to="/" className="console-bar__link">
          ← Back to site
        </Link>
        <span className="console-bar__label">Operations console</span>
      </div>
      <ConsoleApp />
    </div>
  );
}
