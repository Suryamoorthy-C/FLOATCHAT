import { useEffect, useRef, useState } from "react";
import { AtSign, Mail, Pencil, ShieldCheck } from "lucide-react";
import "./ProfileCard.css";

function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "FC"
  );
}

function boundedNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

export default function ProfileCard({
  name = "FLOATCHAT member",
  title = "Ocean workspace",
  handle = "",
  email = "",
  status = "Online",
  description = "",
  contactText = "Contact",
  avatarUrl = "",
  iconUrl = "",
  holo = 0.8,
  glare = 0.5,
  tiltStrength = 12,
  parallax = 8,
  radius = 16,
  enableTilt = true,
  intro = true,
  showUserInfo = true,
  enableMobileTilt = false,
  theme = "dark",
  className = "",
  titleId = "profile-card-name",
  onContactClick,
  children,
}) {
  const cardRef = useRef(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => setAvatarFailed(false), [avatarUrl]);

  function handlePointerMove(event) {
    const card = cardRef.current;
    if (!card || !enableTilt) return;
    if (event.pointerType === "touch" && !enableMobileTilt) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const bounds = card.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    const strength = Math.max(0, Math.min(20, Number(tiltStrength) || 0));
    const offset = Math.max(0, Math.min(16, Number(parallax) || 0));

    card.style.setProperty("--profile-pointer-x", `${x * 100}%`);
    card.style.setProperty("--profile-pointer-y", `${y * 100}%`);
    card.style.setProperty("--profile-rotate-x", `${(0.5 - y) * strength}deg`);
    card.style.setProperty("--profile-rotate-y", `${(x - 0.5) * strength}deg`);
    card.style.setProperty("--profile-shift-x", `${(x - 0.5) * offset}px`);
    card.style.setProperty("--profile-shift-y", `${(y - 0.5) * offset}px`);
    card.dataset.tilted = "true";
  }

  function resetPointer() {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--profile-pointer-x", "50%");
    card.style.setProperty("--profile-pointer-y", "50%");
    card.style.setProperty("--profile-rotate-x", "0deg");
    card.style.setProperty("--profile-rotate-y", "0deg");
    card.style.setProperty("--profile-shift-x", "0px");
    card.style.setProperty("--profile-shift-y", "0px");
    card.dataset.tilted = "false";
  }

  const cardStyle = {
    "--profile-holo": boundedNumber(holo, 0.8),
    "--profile-glare": boundedNumber(glare, 0.5),
    "--profile-radius": `${Math.max(8, Math.min(32, Number(radius) || 16))}px`,
    "--profile-card-icon": iconUrl ? `url("${iconUrl}")` : "none",
  };
  const cardClass = [
    "profile-card",
    `profile-card--${theme === "light" ? "light" : "dark"}`,
    intro ? "profile-card--intro" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      ref={cardRef}
      className={cardClass}
      style={cardStyle}
      aria-labelledby={showUserInfo ? titleId : undefined}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      onPointerCancel={resetPointer}
      data-tilted="false"
    >
      <div className="profile-card__avatar-wrap" aria-hidden="true">
        <div className="profile-card__avatar">
          {avatarUrl && !avatarFailed ? (
            <img src={avatarUrl} alt="" onError={() => setAvatarFailed(true)} />
          ) : (
            <span>{initials(name)}</span>
          )}
        </div>
        <i className="profile-card__presence" />
      </div>

      {showUserInfo && (
        <div className="profile-card__info">
          <div className="profile-card__heading-row">
            <div className="profile-card__name-block">
              <p className="profile-card__eyebrow">Profile</p>
              <h2 id={titleId}>{name || "Your name"}</h2>
            </div>
            {title && (
              <span className="profile-card__role">
                <ShieldCheck size={13} aria-hidden="true" /> {title}
              </span>
            )}
          </div>
          <div className="profile-card__meta-row">
            {handle && (
              <span className="profile-card__handle">
                <AtSign size={13} aria-hidden="true" /> {handle}
              </span>
            )}
            {status && (
              <span className="profile-card__status">
                <i aria-hidden="true" /> {status}
              </span>
            )}
          </div>
          {email && (
            <p className="profile-card__email">
              <Mail size={15} aria-hidden="true" /> {email}
            </p>
          )}
          {description && <p className="profile-card__description">{description}</p>}
        </div>
      )}

      <div className="profile-card__actions">
        {onContactClick && (
          <button
            className="account-button account-button--soft profile-card__action"
            type="button"
            onClick={onContactClick}
          >
            <Pencil size={15} aria-hidden="true" /> {contactText}
          </button>
        )}
        {children}
      </div>
    </section>
  );
}
