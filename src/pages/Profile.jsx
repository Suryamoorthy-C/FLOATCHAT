import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  LogOut,
  ImagePlus,
  ShieldCheck,
  Sparkles,
  Waves,
  X,
} from "lucide-react";
import { Link } from "../router";
import { api } from "../api";
import SpotlightCard from "../components/SpotlightCard";
import Stepper, { Step } from "../components/Stepper";
import ProfileCard from "../components/ProfileCard";
import samplePayload from "../../docs/profile-subscription.example.json";
import "./Profile.css";
import "./ProfileTheme.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY_THRESHOLDS = {
  min_temperature_c: "",
  max_temperature_c: "",
  min_pressure_dbar: "",
  max_pressure_dbar: "",
};

function thresholdFormValues(values = {}) {
  return Object.fromEntries(Object.keys(EMPTY_THRESHOLDS).map((key) => [
    key,
    values[key] === null || values[key] === undefined ? "" : String(values[key]),
  ]));
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function getCycleMetrics(subscription, now = Date.now()) {
  const start = new Date(subscription?.currentPeriodStart).getTime();
  const end = new Date(subscription?.currentPeriodEnd).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { progress: 0, daysRemaining: 0, valid: false };
  }
  const progress = Math.min(
    100,
    Math.max(0, ((now - start) / (end - start)) * 100),
  );
  return {
    progress,
    daysRemaining: Math.max(0, Math.ceil((end - now) / DAY_MS)),
    valid: true,
  };
}

function priceLabel(plan, isCurrent) {
  if (plan.monthlyPrice === null || plan.monthlyPrice === undefined) {
    return isCurrent ? "Current plan" : plan.priceLabel || "Contact us";
  }
  if (plan.monthlyPrice === 0) return "Free";
  if (plan.monthlyPriceLabel) return plan.monthlyPriceLabel;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: plan.currency || "USD",
    maximumFractionDigits: 0,
  }).format(plan.monthlyPrice);
}

const PLAN_ICON = {
  "starter-float": Waves,
  "pro-pearl-analyst": Sparkles,
  "enterprise-fleet": CreditCard,
};

/**
 * Account & subscription view.
 *
 * Props:
 *   data: { profile, subscription, plans } — replace the demo payload with API data.
 *   onProfileSave(profile), onLogout(), onPlanChange(plan) — connect auth/billing APIs.
 *
 * No billing, logout, or server persistence is performed unless the matching
 * callback is supplied by the host application.
 */
export default function Profile({
  data = samplePayload,
  onProfileSave,
  onLogout,
  onPlanChange,
  now,
}) {
  const [profile, setProfile] = useState(data.profile || samplePayload.profile);
  const [subscription, setSubscription] = useState(
    data.subscription || samplePayload.subscription,
  );
  const [plans, setPlans] = useState(data.plans || samplePayload.plans);
  const [thresholds, setThresholds] = useState(thresholdFormValues(profile.thresholds));
  const [notice, setNotice] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdLoading, setThresholdLoading] = useState(true);
  const [avatarError, setAvatarError] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const dialogRef = useRef(null);
  const [draft, setDraft] = useState({
    name: profile.name,
    email: profile.email,
    role: profile.role,
    avatarUrl: profile.avatarUrl || "",
  });

  useEffect(() => {
    setProfile(data.profile || samplePayload.profile);
    setSubscription(data.subscription || samplePayload.subscription);
    setPlans(data.plans || samplePayload.plans);
  }, [data]);

  useEffect(() => {
    const userId = data.profile?.id || samplePayload.profile.id;
    const controller = new AbortController();
    setThresholdLoading(true);
    api.userThresholds(userId, { signal: controller.signal })
      .then((saved) => setThresholds(thresholdFormValues(saved.thresholds)))
      .catch((error) => {
        if (error.name !== "AbortError") setThresholds(thresholdFormValues(data.profile?.thresholds));
      })
      .finally(() => setThresholdLoading(false));
    return () => controller.abort();
  }, [data.profile?.id]);

  useEffect(() => {
    const userId = data.profile?.id || samplePayload.profile.id;
    const controller = new AbortController();
    api.userProfile(userId, { signal: controller.signal })
      .then((saved) => {
        setProfile((current) => current.id === userId
          ? { ...current, avatarUrl: saved.avatarUrl || null }
          : current);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [data.profile?.id]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (editOpen && !dialog.open) dialog.showModal();
    if (!editOpen && dialog.open) dialog.close();
  }, [editOpen]);

  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === subscription.planId) || null,
    [plans, subscription.planId],
  );
  const cycle = getCycleMetrics(subscription, now ?? Date.now());

  const openEditor = () => {
    setDraft({
      name: profile.name || "",
      email: profile.email || "",
      role: profile.role || "",
      avatarUrl: profile.avatarUrl || "",
    });
    setAvatarFile(null);
    setAvatarRemoved(false);
    setAvatarError("");
    setEditOpen(true);
  };

  function selectAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png"]).has(file.type)) {
      setAvatarError("Choose a JPEG or PNG image.");
      event.target.value = "";
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setAvatarError("Choose an image that is 4 MiB or smaller.");
      event.target.value = "";
      return;
    }
    setAvatarFile(file);
    setAvatarRemoved(false);
    event.target.value = "";

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDraft((current) => ({ ...current, avatarUrl: reader.result }));
        setAvatarError("");
      } else {
        setAvatarError("This image could not be loaded. Please choose another.");
      }
    };
    reader.onerror = () => setAvatarError("This image could not be loaded. Please choose another.");
    reader.readAsDataURL(file);
  }

  async function saveProfile(event) {
    event.preventDefault();
    let nextProfile = { ...profile, ...draft };
    setSaving(true);
    try {
      const userId = profile.id || samplePayload.profile.id;
      if (avatarFile) {
        const stored = await api.uploadUserAvatar(userId, avatarFile);
        nextProfile = { ...nextProfile, avatarUrl: stored.avatarUrl };
      } else if (avatarRemoved) {
        await api.deleteUserAvatar(userId);
        nextProfile = { ...nextProfile, avatarUrl: null };
      }
      if (onProfileSave) {
        const result = await onProfileSave(nextProfile);
        if (result?.ok === false)
          throw new Error(result.message || "The profile could not be saved.");
      }
      setProfile(nextProfile);
      setAvatarFile(null);
      setAvatarRemoved(false);
      setNotice(avatarFile || avatarRemoved
        ? onProfileSave
          ? "Profile and photo updated."
          : "Profile photo saved. Other profile details remain preview-only until onProfileSave is connected."
        : onProfileSave
          ? "Profile updated."
          : "Profile updated in this preview only. Connect onProfileSave to persist it.");
      setEditOpen(false);
    } catch (error) {
      setNotice(
        error?.message || "Profile could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveThresholds(event) {
    event.preventDefault();
    const userId = profile.id || samplePayload.profile.id;
    if (!profile.email) {
      setNotice("Add an email address to your profile before enabling email alerts.");
      return;
    }
    for (const [minKey, maxKey, label] of [
      ["min_temperature_c", "max_temperature_c", "temperature"],
      ["min_pressure_dbar", "max_pressure_dbar", "pressure / depth"],
    ]) {
      const min = thresholds[minKey] === "" ? null : Number(thresholds[minKey]);
      const max = thresholds[maxKey] === "" ? null : Number(thresholds[maxKey]);
      if (min !== null && max !== null && min >= max) {
        setNotice(`Minimum ${label} must be lower than maximum ${label}.`);
        return;
      }
    }
    const payload = {
      email: profile.email,
      thresholds: Object.fromEntries(Object.entries(thresholds).map(([key, value]) => [
        key,
        value === "" ? null : Number(value),
      ])),
    };
    setThresholdSaving(true);
    try {
      const saved = await api.saveUserThresholds(userId, payload);
      setThresholds(thresholdFormValues(saved.thresholds));
      setNotice("Your custom alert thresholds have been saved.");
    } catch (error) {
      setNotice(error.message || "Threshold settings could not be saved. Check the API connection and try again.");
    } finally {
      setThresholdSaving(false);
    }
  }

  async function logout() {
    if (!onLogout) {
      setNotice(
        "No session was ended. Connect onLogout to your authentication provider.",
      );
      return;
    }
    try {
      await onLogout();
      setNotice("Sign-out request completed.");
    } catch (error) {
      setNotice(error?.message || "Could not log out. Please try again.");
    }
  }

  async function requestPlanChange(plan) {
    if (!onPlanChange) {
      setNotice(
        `No plan was changed. Connect onPlanChange to your billing flow to continue with ${plan.name}.`,
      );
      return;
    }
    try {
      const result = await onPlanChange(plan);
      if (result?.ok === false)
        throw new Error(
          result.message || "The plan request could not be completed.",
        );
      setNotice(
        result?.message ||
          `Your ${plan.name} plan request was sent to the billing flow.`,
      );
    } catch (error) {
      setNotice(
        error?.message ||
          "The plan request could not be completed. Please try again.",
      );
    }
  }

  const ActivePlanIcon = PLAN_ICON[currentPlan?.id] || ShieldCheck;

  return (
    <main className="account-page">
      <div className="account-orbit account-orbit--one" aria-hidden="true" />
      <div className="account-orbit account-orbit--two" aria-hidden="true" />
      <div className="account-shell">
        <nav className="account-nav" aria-label="Account navigation">
          <Link className="account-brand" to="/" aria-label="FLOATCHAT home">
            <span className="account-brand__mark">
              <Waves size={17} strokeWidth={2.2} />
            </span>
            <span>
              FLOATCHAT
              <span className="account-brand__sub">OCEAN INTELLIGENCE</span>
            </span>
          </Link>
          <Link className="account-back" to="/">
            <ArrowLeft size={15} aria-hidden="true" />{" "}
            <span>Back to dashboard</span>
          </Link>
        </nav>

        <header className="account-heading">
          <div>
            <p className="account-eyebrow">
              ACCOUNT CENTER <span>·</span> PROFILE & BILLING
            </p>
            <h1>Your account</h1>
            <p className="account-heading__lede">
              Manage your profile, monitor your plan, and explore fleet
              coverage.
            </p>
          </div>
          <span className="account-demo-tag">
            <i aria-hidden="true" /> DEMO ACCOUNT
          </span>
        </header>

        {notice && (
          <div className="account-notice" role="status" aria-live="polite">
            <CheckCircle2 size={17} aria-hidden="true" />
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss message"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <ProfileCard
          className="account-profile-card"
          titleId="profile-name"
          name={profile.name || "Your name"}
          title={profile.role || "Role not set"}
          handle={profile.id}
          email={profile.email || "Email not set"}
          status={
            subscription.status === "active"
              ? "Active plan"
              : String(subscription.status || "Demo profile")
          }
          description="Your personal details are visible only to your workspace."
          contactText="Edit profile"
          avatarUrl={profile.avatarUrl}
          holo={0.8}
          glare={0.5}
          tiltStrength={12}
          parallax={8}
          radius={16}
          enableTilt
          intro
          showUserInfo
          enableMobileTilt={false}
          theme="dark"
          onContactClick={openEditor}
        >
          <button
            className="account-button account-button--logout"
            type="button"
            onClick={logout}
          >
            <LogOut size={15} aria-hidden="true" /> Log out
          </button>
        </ProfileCard>

        <section className="account-thresholds" aria-labelledby="thresholds-title">
          <div className="account-thresholds__heading">
            <div>
              <p className="account-eyebrow">SENSOR ALERTS <span>·</span> PERSONAL LIMITS</p>
              <h2 id="thresholds-title">Custom threshold alerts</h2>
              <p>Choose the temperature and pressure bounds that matter for your operation. Leave a bound blank to disable it.</p>
            </div>
            <span className="account-thresholds__unit">EMAIL TO {profile.email || "NO EMAIL SET"}</span>
          </div>
          <form className="account-threshold-form" onSubmit={saveThresholds}>
            <fieldset disabled={thresholdSaving || thresholdLoading}>
              <legend className="u-visually-hidden">Custom sensor threshold ranges</legend>
              <div className="account-threshold-row">
                <div className="account-threshold-row__label">
                  <strong>Temperature</strong><span>°C</span>
                </div>
                <label>
                  <span>Minimum</span>
                  <input type="number" step="any" min="-5" max="60" inputMode="decimal" value={thresholds.min_temperature_c} onChange={(event) => setThresholds({ ...thresholds, min_temperature_c: event.target.value })} aria-label="Minimum temperature in degrees Celsius" />
                </label>
                <label>
                  <span>Maximum</span>
                  <input type="number" step="any" min="-5" max="60" inputMode="decimal" value={thresholds.max_temperature_c} onChange={(event) => setThresholds({ ...thresholds, max_temperature_c: event.target.value })} aria-label="Maximum temperature in degrees Celsius" />
                </label>
              </div>
              <div className="account-threshold-row">
                <div className="account-threshold-row__label">
                  <strong>Pressure / depth</strong><span>dbar</span>
                </div>
                <label>
                  <span>Minimum</span>
                  <input type="number" step="any" min="0" max="12000" inputMode="decimal" value={thresholds.min_pressure_dbar} onChange={(event) => setThresholds({ ...thresholds, min_pressure_dbar: event.target.value })} aria-label="Minimum pressure in dbar" />
                </label>
                <label>
                  <span>Maximum</span>
                  <input type="number" step="any" min="0" max="12000" inputMode="decimal" value={thresholds.max_pressure_dbar} onChange={(event) => setThresholds({ ...thresholds, max_pressure_dbar: event.target.value })} aria-label="Maximum pressure in dbar" />
                </label>
              </div>
            </fieldset>
            <div className="account-threshold-form__footer">
              <p>{thresholdLoading ? "Loading saved limits…" : "Alerts are sent only when an incoming reading is outside a configured bound."}</p>
              <button className="account-button account-button--save" type="submit" disabled={thresholdSaving || thresholdLoading}>
                {thresholdSaving ? "Saving…" : "Save thresholds"}
              </button>
            </div>
          </form>
        </section>

        <section
          className="account-plan-overview"
          aria-labelledby="active-plan-title"
        >
          <div className="account-plan-overview__main">
            <div className="account-section-topline">
              <div className="account-section-icon">
                <ActivePlanIcon size={18} aria-hidden="true" />
              </div>
              <div>
                <p className="account-label">CURRENT SUBSCRIPTION</p>
                <h2 id="active-plan-title">
                  {currentPlan?.name || "No active plan"}
                </h2>
              </div>
              <span
                className="account-status"
                data-status={subscription.status || "inactive"}
              >
                <i aria-hidden="true" />
                {subscription.status === "active"
                  ? "ACTIVE"
                  : String(subscription.status || "inactive").toUpperCase()}
              </span>
            </div>
            <div className="account-cycle-meta">
              <span>
                <CalendarDays size={14} aria-hidden="true" /> Billing cycle
              </span>
              <strong>
                {formatDate(subscription.currentPeriodStart)} <span>→</span>{" "}
                {formatDate(subscription.currentPeriodEnd)}
              </strong>
            </div>
            <div className="account-progress-block">
              <div className="account-progress-copy">
                <span>
                  {cycle.valid
                    ? `${cycle.daysRemaining} days remaining`
                    : "Cycle dates unavailable"}
                </span>
                <span>
                  {cycle.valid
                    ? `${Math.round(cycle.progress)}% elapsed`
                    : "Update billing dates"}
                </span>
              </div>
              <div
                className="account-progress-track"
                role="progressbar"
                aria-label="Billing cycle elapsed"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(cycle.progress)}
              >
                <span style={{ width: `${cycle.progress}%` }} />
              </div>
            </div>
          </div>
          <aside className="account-cycle-aside">
            <p className="account-label">PLAN TIMELINE</p>
            <Stepper
              initialStep={1}
              backButtonText="Back"
              nextButtonText="Continue"
              indicator="numbers"
              orientation="horizontal"
              transition="slide"
              width={360}
              radius={18}
              frame
              linear={false}
              disableStepIndicators={false}
              showFooter
              completeButtonText="Complete"
              ariaLabel="Plan timeline"
            >
              <Step title="Plan started">
                <div className="account-date-row">
                  <span className="account-date-marker account-date-marker--start" />
                  <div>
                    <small>PLAN STARTED</small>
                    <strong>{formatDate(subscription.startedAt)}</strong>
                  </div>
                </div>
              </Step>
              <Step title="Renews / ends">
                <div className="account-date-row">
                  <span className="account-date-marker account-date-marker--end" />
                  <div>
                    <small>RENEWS / ENDS</small>
                    <strong>{formatDate(subscription.currentPeriodEnd)}</strong>
                  </div>
                </div>
              </Step>
            </Stepper>
            <p className="account-cycle-foot">
              <Clock3 size={13} aria-hidden="true" /> Dates shown in UTC
            </p>
          </aside>
        </section>

        <section
          className="account-plans-section"
          aria-labelledby="plan-options-title"
        >
          <div className="account-plans-heading">
            <div>
              <p className="account-eyebrow">
                FIND YOUR FIT <span>·</span> FLEET PLANS
              </p>
              <h2 id="plan-options-title">A clearer view of your ocean.</h2>
              <p>
                Choose the visibility and tools your operation needs. Your team
                can review changes before anything is billed.
              </p>
            </div>
            <div className="account-secure-note account-pricing-draft">
              <ShieldCheck size={15} aria-hidden="true" /> DRAFT PRICING · NO CHECKOUT
            </div>
          </div>
          <div className="account-plan-grid">
            {plans.map((plan) => {
              const isCurrent = plan.id === subscription.planId;
              const Icon = PLAN_ICON[plan.id] || Sparkles;
              return (
                <SpotlightCard
                  className={`account-plan-card${isCurrent ? " is-current" : ""}${plan.id === "enterprise-fleet" ? " is-enterprise" : ""}`}
                  key={plan.id}
                  theme="dark"
                  spotlightColor="#ffffff"
                  intensity={0.15}
                  spotlightSize={240}
                  softness={0.7}
                  shape="circle"
                  borderGlow={0.6}
                  proximity={80}
                  smoothing={0.3}
                  grain={0}
                  ambient={false}
                  flare
                  radius={15}
                >
                  {isCurrent && (
                    <span className="account-current-ribbon">
                      <CheckCircle2 size={13} aria-hidden="true" /> CURRENT PLAN
                    </span>
                  )}
                  {!isCurrent && plan.id === "enterprise-fleet" && (
                    <span className="account-featured-ribbon">FLEET SCALE</span>
                  )}
                  <div className="account-plan-icon">
                    <Icon size={18} aria-hidden="true" />
                  </div>
                  <h3>{plan.name}</h3>
                  <p className="account-plan-description">{plan.description}</p>
                  <div className="account-plan-price">
                    <strong>{priceLabel(plan, isCurrent)}</strong>
                    {plan.monthlyPrice > 0 && (
                      <span>{plan.monthlyPrice == null ? "" : "/ month"}</span>
                    )}
                  </div>
                  {plan.annualPriceLabel && (
                    <p className="account-plan-annual">{plan.annualPriceLabel}</p>
                  )}
                  <ul className="account-feature-list">
                    {(plan.features || []).map((feature, index) => {
                      const featureLabel = typeof feature === "string" ? feature : feature.label;
                      const isPlanned = typeof feature !== "string" && feature.status === "planned";
                      return (
                        <li
                          key={`${featureLabel}-${index}`}
                          className={isPlanned ? "account-feature-is-planned" : "account-feature-is-available"}
                        >
                          <span className="account-feature-icon">
                            {isPlanned ? (
                              <Clock3 size={12} aria-hidden="true" />
                            ) : (
                              <Check size={13} aria-hidden="true" />
                            )}
                          </span>
                          <span className="account-feature-copy">{featureLabel}</span>
                          {isPlanned && <small className="account-feature-status">Planned</small>}
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    className={`account-plan-cta${isCurrent ? " account-plan-cta--current" : ""}${plan.id === "enterprise-fleet" ? " account-plan-cta--primary" : ""}`}
                    type="button"
                    disabled={isCurrent || saving}
                    onClick={() => requestPlanChange(plan)}
                  >
                    {isCurrent
                      ? "Current plan"
                      : plan.id === "enterprise-fleet"
                        ? "Upgrade plan"
                        : "Choose Starter"}
                    {!isCurrent && <ArrowRight size={15} aria-hidden="true" />}
                  </button>
                </SpotlightCard>
              );
            })}
          </div>
          <p className="account-plan-disclaimer">
            <ShieldCheck size={14} aria-hidden="true" /> Draft commercial proposal: prices and package mapping are illustrative. Items marked Planned are not currently available. This page does not process payments or enforce plan access.
          </p>
        </section>

        <footer className="account-footer">
          <span>
            <Waves size={14} aria-hidden="true" /> Built for teams working with
            the ocean.
          </span>
          <span>DEMO DATA · NO BILLING ACTIONS ARE PROCESSED HERE</span>
        </footer>
      </div>

      <dialog
        className="account-dialog"
        ref={dialogRef}
        aria-labelledby="edit-profile-title"
        onCancel={(event) => {
          event.preventDefault();
          setEditOpen(false);
        }}
      >
        <form className="account-edit-form" onSubmit={saveProfile}>
          <div className="account-dialog-heading">
            <div>
              <p className="account-eyebrow">ACCOUNT DETAILS</p>
              <h2 id="edit-profile-title">Edit profile</h2>
            </div>
            <button
              className="account-dialog-close"
              type="button"
              onClick={() => setEditOpen(false)}
              aria-label="Close edit profile"
            >
              <X size={18} />
            </button>
          </div>
          <label htmlFor="account-name">Full name</label>
          <input
            id="account-name"
            name="name"
            autoComplete="name"
            value={draft.name}
            required
            maxLength={100}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
          <label htmlFor="account-email">Email address</label>
          <input
            id="account-email"
            name="email"
            type="email"
            autoComplete="email"
            value={draft.email}
            required
            maxLength={254}
            onChange={(event) =>
              setDraft({ ...draft, email: event.target.value })
            }
          />
          <label htmlFor="account-role">Role</label>
          <input
            id="account-role"
            name="role"
            value={draft.role}
            required
            maxLength={120}
            placeholder="e.g. Marine Researcher"
            onChange={(event) =>
              setDraft({ ...draft, role: event.target.value })
            }
          />
          <div className="account-avatar-upload">
            <div className="account-avatar-upload__preview" aria-hidden="true">
              {draft.avatarUrl ? (
                <img src={draft.avatarUrl} alt="" />
              ) : (
                <span>{draft.name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "FC"}</span>
              )}
            </div>
            <div className="account-avatar-upload__controls">
              <label className="account-button account-button--soft" htmlFor="account-avatar-file">
                <ImagePlus size={15} aria-hidden="true" /> Upload photo
              </label>
              <input
                id="account-avatar-file"
                className="account-avatar-upload__input"
                type="file"
                accept="image/jpeg,image/png"
                onChange={selectAvatar}
                aria-describedby="account-avatar-help account-avatar-error"
              />
              {draft.avatarUrl && (
                <button
                  className="account-avatar-upload__remove"
                  type="button"
                  onClick={() => {
                    setDraft((current) => ({ ...current, avatarUrl: "" }));
                    setAvatarFile(null);
                    setAvatarRemoved(true);
                    setAvatarError("");
                  }}
                >
                  Remove photo
                </button>
              )}
              <small id="account-avatar-help">JPEG or PNG · up to 4 MiB</small>
              {avatarError && <small id="account-avatar-error" className="account-avatar-upload__error" role="alert">{avatarError}</small>}
            </div>
          </div>
          <p className="account-dialog-note">
            In this preview, changes stay in the browser unless onProfileSave is
            connected. The selected photo is displayed on your profile card after saving.
          </p>
          <div className="account-dialog-actions">
            <button
              className="account-button account-button--soft"
              type="button"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
            <button
              className="account-button account-button--save"
              type="submit"
              disabled={saving || Boolean(avatarError)}
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
