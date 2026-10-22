/** WHO Surgical Safety Checklist (2009), aligned with the Joint Commission Universal Protocol. */
export const WHO_CHECKLIST: { phase: "sign-in" | "time-out" | "sign-out"; title: string; when: string; items: { id: string; label: string }[] }[] = [
  {
    phase: "sign-in",
    title: "Sign in",
    when: "Before induction of anaesthesia",
    items: [
      { id: "si-identity", label: "Patient has confirmed identity, site, procedure and consent" },
      { id: "si-site", label: "Site marked (Universal Protocol)" },
      { id: "si-consent", label: "Signed informed consent on the chart" },
      { id: "si-anesthesia", label: "Anaesthesia machine & medication check complete; pulse oximeter on and working" },
      { id: "si-allergy", label: "Known allergies reviewed" },
      { id: "si-airway", label: "Difficult airway / aspiration risk assessed" },
      { id: "si-blood", label: "Risk of > 500 mL blood loss (7 mL/kg in children) planned for" },
    ],
  },
  {
    phase: "time-out",
    title: "Time out",
    when: "Before skin incision",
    items: [
      { id: "to-team", label: "All team members introduced by name and role" },
      { id: "to-confirm", label: "Patient name, procedure and incision site confirmed" },
      { id: "to-antibiotic", label: "Antibiotic prophylaxis given within the last 60 minutes" },
      { id: "to-imaging", label: "Essential imaging displayed" },
    ],
  },
  {
    phase: "sign-out",
    title: "Sign out",
    when: "Before the patient leaves the operating room",
    items: [
      { id: "so-procedure", label: "Name of the procedure recorded" },
      { id: "so-count", label: "Instrument, sponge and needle counts complete" },
      { id: "so-specimen", label: "Specimen labelled (including patient name)" },
      { id: "so-concerns", label: "Equipment problems and key recovery concerns addressed" },
    ],
  },
]
