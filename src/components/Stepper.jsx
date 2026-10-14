import { Children, isValidElement, useState } from 'react';
import SpecularButton from './SpecularButton';
import './Stepper.css';

export function Step({ children }) {
  return children;
}

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange,
  onFinalStepCompleted,
  backButtonText = 'Back',
  nextButtonText = 'Continue',
  indicator = 'numbers',
  orientation = 'horizontal',
  transition = 'slide',
  width = 440,
  radius = 24,
  frame = true,
  linear = false,
  disableStepIndicators = false,
  showFooter = true,
  completeButtonText = 'Complete',
  ariaLabel = 'Progress steps',
}) {
  const steps = Children.toArray(children)
    .filter(isValidElement)
    .map((step, index) => ({
      title: step.props.title || `Step ${index + 1}`,
      content: step.props.children,
    }));

  const startAt = Math.min(steps.length - 1, Math.max(0, Math.round(Number(initialStep) || 1) - 1));
  const [activeStep, setActiveStep] = useState(startAt);
  const [direction, setDirection] = useState('forward');
  const [completed, setCompleted] = useState(false);

  if (steps.length === 0) return null;

  const changeStep = nextIndex => {
    if (nextIndex < 0 || nextIndex >= steps.length || nextIndex === activeStep) return;
    if (linear && nextIndex > activeStep + 1) return;
    setDirection(nextIndex > activeStep ? 'forward' : 'backward');
    setActiveStep(nextIndex);
    setCompleted(false);
    onStepChange?.(nextIndex + 1);
  };

  const finish = () => {
    if (completed) return;
    onFinalStepCompleted?.();
    setCompleted(true);
  };

  const widthValue = typeof width === 'number' ? `${width}px` : width;
  const radiusValue = typeof radius === 'number' ? `${radius}px` : radius;
  const panelTransition = transition === 'slide' ? 'slide' : 'fade';

  return (
    <div
      className={`stepper${frame ? ' stepper--frame' : ''}`}
      data-orientation={orientation}
      role="group"
      aria-label={ariaLabel}
      style={{ '--stepper-width': widthValue, '--stepper-radius': radiusValue }}
    >
      {!disableStepIndicators && (
        <ol className="stepper__indicators" aria-label={`${ariaLabel} steps`}>
          {steps.map((step, index) => {
            const canVisit = !linear || index <= activeStep + 1;
            const indicatorText = indicator === 'dots' ? '•' : String(index + 1);
            return (
              <li className="stepper__indicator-item" key={`${step.title}-${index}`}>
                {index < steps.length - 1 && <span className="stepper__connector" aria-hidden="true" />}
                <button
                  className="stepper__indicator"
                  type="button"
                  aria-label={`Go to step ${index + 1}: ${step.title}`}
                  aria-current={index === activeStep ? 'step' : undefined}
                  aria-disabled={!canVisit}
                  disabled={!canVisit}
                  onClick={() => changeStep(index)}
                >
                  {indicatorText}
                </button>
                <span className="stepper__indicator-title">{step.title}</span>
              </li>
            );
          })}
        </ol>
      )}

      <div
        className={`stepper__panel stepper__panel--${panelTransition} stepper__panel--${direction}`}
        key={activeStep}
        aria-live="polite"
      >
        {steps[activeStep].content}
      </div>

      {showFooter && (
        <footer className="stepper__footer">
          <SpecularButton
            type="button"
            size="sm"
            className="stepper__button stepper__button--back"
            disabled={activeStep === 0}
            onClick={() => changeStep(activeStep - 1)}
          >
            {backButtonText}
          </SpecularButton>
          <div className="stepper__footer-end">
            {completed && <span className="stepper__complete-note" role="status">Timeline reviewed</span>}
            {activeStep < steps.length - 1 ? (
              <SpecularButton
                type="button"
                size="sm"
                className="stepper__button stepper__button--next"
                onClick={() => changeStep(activeStep + 1)}
              >
                {nextButtonText}
              </SpecularButton>
            ) : (
              <SpecularButton
                type="button"
                size="sm"
                className="stepper__button stepper__button--next"
                disabled={completed}
                onClick={finish}
              >
                {completeButtonText}
              </SpecularButton>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
