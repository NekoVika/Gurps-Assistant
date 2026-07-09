import React, { useState, useEffect, useCallback } from "react";
import type { WizardDef } from "../lib/wizards";

type WizardModalProps = {
  wizard: WizardDef | null;
  dynamicOptions?: { episodes: string[]; chapters: string[]; encounters: string[] };
  onClose: () => void;
  /** Structured generation path — the only generation path now. */
  onSubmitStructured: (compiledPrompt: string, schema: Record<string, any>, targetPath: string, pydanticModel: string | undefined, answers: Record<string, string>) => Promise<void>;
  onCreateStub: (targetPath: string, templatePath: string, variables: Record<string, string>) => void;
};

export const WizardModal: React.FC<WizardModalProps> = ({
  wizard, dynamicOptions, onClose, onSubmitStructured, onCreateStub
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset whenever wizard changes
  useEffect(() => {
    if (wizard) {
      setCurrentStepIndex(0);
      setGenerating(false);
      setGenError(null);
      setFieldErrors({});
      const initial: Record<string, string> = {};
      wizard.steps.forEach(step => {
        step.fields.forEach(f => {
          if (f.type === "select" && f.options && f.options.length > 0) {
            initial[f.id] = f.options[0];
          } else if (
            f.type === "dynamic-select" && f.optionsSource &&
            dynamicOptions && dynamicOptions[f.optionsSource]?.length > 0
          ) {
            initial[f.id] = dynamicOptions[f.optionsSource][0];
          } else {
            initial[f.id] = "";
          }
        });
      });
      setAnswers(initial);
    }
  }, [wizard]);

  // ── Step logic (hoisted above hooks that depend on it) ─────────────────────

  const visibleSteps = wizard ? wizard.steps.filter(step => !step.condition || step.condition(answers)) : [];
  const currentStep = visibleSteps[currentStepIndex];
  const visibleFields = currentStep ? currentStep.fields.filter(f => !f.condition || f.condition(answers)) : [];
  const isLastStep = currentStepIndex === visibleSteps.length - 1;
  const totalSteps = visibleSteps.length;

  // ── Interpolation ──────────────────────────────────────────────────────────

  function interpolate(template: string | ((ans: Record<string, string>) => string)) {
    let result = typeof template === "function" ? template(answers) : template;
    for (const [key, val] of Object.entries(answers)) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), val || `[${key}]`);
    }
    return result;
  }

  // ── Field validation ───────────────────────────────────────────────────────

  function validateCurrentStep(): boolean {
    const errors: Record<string, string> = {};
    visibleFields.forEach(f => {
      if (f.required && (!answers[f.id] || answers[f.id].trim() === "")) {
        errors[f.id] = "This field is required.";
      }
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNext() {
    if (!validateCurrentStep()) return;
    setCurrentStepIndex(i => i + 1);
    setFieldErrors({});
  }

  // ── Submit handlers ────────────────────────────────────────────────────────

  async function handleAiSubmit() {
    if (!validateCurrentStep()) return;
    setGenError(null);

    if (!wizard!.outputSchema) {
      setGenError("This wizard does not have a structured output schema configured. Generation is not available.");
      return;
    }

    setGenerating(true);
    try {
      const prompt = interpolate(wizard!.aiPromptTemplate);
      const targetPath = interpolate(wizard!.stubTargetPath);
      await onSubmitStructured(prompt, wizard!.outputSchema, targetPath, wizard!.pydanticModel, answers);
      // Success: parent closes the modal via setActiveWizard(null)
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }

  function handleStubSubmit() {
    if (!validateCurrentStep()) return;
    const targetPath = interpolate(wizard!.stubTargetPath);
    onCreateStub(targetPath, interpolate(wizard!.stubTemplatePath), answers);
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!wizard || generating) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    if (e.key === "Enter" && !e.shiftKey) {
      // Only advance/submit if the focused element is NOT a textarea
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "textarea") return;
      e.preventDefault();
      if (!isLastStep) {
        handleNext();
      }
      // Don't auto-submit on Enter at the last step — generation is expensive
    }
  }, [wizard, generating, isLastStep, answers, visibleFields]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!wizard) return null;

  // ── Styles ─────────────────────────────────────────────────────────────────

  const fieldStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", padding: "8px 12px",
    background: "rgba(0,0,0,0.3)", border: "1px solid rgba(149,181,255,0.2)",
    borderRadius: "4px", color: "white", outlineOffset: "-1px"
  };
  const fieldErrorStyle: React.CSSProperties = {
    ...fieldStyle, borderColor: "rgba(248,81,73,0.6)"
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", justifyContent: "center", alignItems: "center",
      zIndex: 9999
    }}>
      <div className="panel inspector" style={{
        width: "620px", maxWidth: "90vw", maxHeight: "88vh",
        display: "flex", flexDirection: "column", padding: "24px",
        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
        border: "1px solid rgba(149, 181, 255, 0.2)",
        position: "relative", overflow: "hidden"
      }}>

        {/* ── Generating overlay ── */}
        {generating && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            background: "rgba(8,15,30,0.88)", backdropFilter: "blur(6px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "20px",
            borderRadius: "24px"
          }}>
            <div style={{
              width: "48px", height: "48px",
              border: "3px solid rgba(149,181,255,0.2)",
              borderTopColor: "#9fbeff",
              borderRadius: "50%",
              animation: "wiz-spin 0.8s linear infinite"
            }} />
            <p style={{ margin: 0, color: "#c9dfff", fontSize: "1rem", fontWeight: 500 }}>
              Generating…
            </p>
            <p style={{ margin: 0, color: "#8b949e", fontSize: "0.85rem" }}>
              This may take up to a minute.
            </p>
          </div>
        )}

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid rgba(149, 181, 255, 0.12)", paddingBottom: "16px" }}>
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "1.4em", fontWeight: 600, color: "#fff" }}>✨ {wizard.title}</h2>
            <p style={{ margin: 0, fontSize: "0.9em", color: "#8b949e" }}>{wizard.description}</p>
          </div>
          <button onClick={onClose} disabled={generating} style={{ background: "transparent", border: "none", color: "#8b949e", cursor: "pointer", fontSize: "1.2rem", padding: "4px 8px" }}>✕</button>
        </div>

        {/* ── Step progress indicator ── */}
        {totalSteps > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <span style={{ fontSize: "0.8em", color: "#8b949e", whiteSpace: "nowrap" }}>
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
            <div style={{ display: "flex", gap: "6px", flex: 1 }}>
              {visibleSteps.map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: "3px", borderRadius: "2px",
                  background: i <= currentStepIndex
                    ? "linear-gradient(90deg, #5b9cf6, #9fbeff)"
                    : "rgba(149,181,255,0.15)",
                  transition: "background 0.3s ease"
                }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Step content ── */}
        <div style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", padding: "4px 12px 4px 4px", margin: "0 -4px" }}>
          {currentStep?.title && <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1em", color: "#c9dfff" }}>{currentStep.title}</h3>}
          {currentStep?.description && <p style={{ margin: "0 0 8px 0", fontSize: "0.9em", color: "#8b949e" }}>{currentStep.description}</p>}

          {visibleFields.map(f => (
            <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "0.85em", fontWeight: 600, color: "#c9dfff" }}>
                {f.label} {f.required && <span style={{ color: "#f85149" }}>*</span>}
              </label>

              {f.type === "text" && (
                <input
                  type="text"
                  value={answers[f.id] || ""}
                  onChange={e => { setAnswers({ ...answers, [f.id]: e.target.value }); setFieldErrors({ ...fieldErrors, [f.id]: "" }); }}
                  placeholder={f.placeholder}
                  style={fieldErrors[f.id] ? fieldErrorStyle : fieldStyle}
                />
              )}

              {f.type === "textarea" && (
                <textarea
                  value={answers[f.id] || ""}
                  onChange={e => { setAnswers({ ...answers, [f.id]: e.target.value }); setFieldErrors({ ...fieldErrors, [f.id]: "" }); }}
                  placeholder={f.placeholder}
                  rows={4}
                  style={{ ...(fieldErrors[f.id] ? fieldErrorStyle : fieldStyle), resize: "vertical" }}
                />
              )}

              {f.type === "select" && f.options && (
                <select
                  value={answers[f.id] || ""}
                  onChange={e => { setAnswers({ ...answers, [f.id]: e.target.value }); setFieldErrors({ ...fieldErrors, [f.id]: "" }); }}
                  style={fieldErrors[f.id] ? fieldErrorStyle : fieldStyle}
                >
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}

              {f.type === "dynamic-select" && f.optionsSource && dynamicOptions && (
                <select
                  value={answers[f.id] || ""}
                  onChange={e => { setAnswers({ ...answers, [f.id]: e.target.value }); setFieldErrors({ ...fieldErrors, [f.id]: "" }); }}
                  style={fieldErrors[f.id] ? fieldErrorStyle : fieldStyle}
                >
                  {dynamicOptions[f.optionsSource]?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}

              {/* Inline field error */}
              {fieldErrors[f.id] && (
                <span style={{ fontSize: "0.78em", color: "#f85149" }}>⚠ {fieldErrors[f.id]}</span>
              )}
            </div>
          ))}

          {/* Generation error banner with retry */}
          {genError && (
            <div style={{
              marginTop: "8px", padding: "12px 16px",
              background: "rgba(248,81,73,0.08)", border: "1px solid rgba(248,81,73,0.3)",
              borderRadius: "8px", color: "#ffb4b4", fontSize: "0.85em",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px"
            }}>
              <div>
                <strong>Generation failed:</strong> {genError}
              </div>
              <button
                onClick={handleAiSubmit}
                className="chip-button ghost-button"
                style={{ padding: "4px 12px", width: "auto", fontSize: "0.85em", whiteSpace: "nowrap", color: "#ffb4b4", borderColor: "rgba(248,81,73,0.3)" }}
              >
                ↻ Retry
              </button>
            </div>
          )}
        </div>

        {/* ── Footer buttons ── */}
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", paddingTop: "20px", borderTop: "1px solid rgba(149, 181, 255, 0.12)", marginTop: "16px" }}>
          <div>
            {currentStepIndex > 0 && !generating && (
              <button onClick={() => { setCurrentStepIndex(i => i - 1); setFieldErrors({}); }} className="chip-button ghost-button" style={{ padding: "8px 16px", width: "auto" }}>
                Back
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end", flex: 1 }}>
            {!isLastStep ? (
              <button onClick={handleNext} className="chip-button primary-button" style={{ padding: "8px 16px", width: "auto" }}>
                Next →
              </button>
            ) : (
              <>
                <button onClick={handleStubSubmit} disabled={generating} className="chip-button ghost-button" style={{ padding: "8px 16px", width: "auto" }}>
                  📝 Generate Manual Stub
                </button>
                <button onClick={handleAiSubmit} disabled={generating} className="chip-button primary-button" style={{ padding: "8px 16px", width: "auto" }}>
                  {generating ? "Generating…" : "✨ Run AI Workflow"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Spinner keyframe — injected once into the document */}
      <style>{`@keyframes wiz-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
