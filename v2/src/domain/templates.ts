/**
 * Note templates. Clinicians in a busy clinic re-type the same structure 30+ times a day;
 * a template gives the skeleton, the clinician fills in the specifics.
 */
export interface SoapTemplate {
  id: string
  name: string
  subjective: string
  objective: string
  assessment: string
  plan: string
}

export const SOAP_TEMPLATES: SoapTemplate[] = [
  {
    id: "general",
    name: "General visit",
    subjective: "CC: \nHPI: \nPMH: \nMeds: \nAllergies: reviewed",
    objective: "General: alert, in no acute distress\nHEENT: normal\nCV: RRR, no murmurs\nLungs: clear bilaterally\nAbdomen: soft, non-tender\nExtremities: no edema, cap refill < 2 s",
    assessment: "",
    plan: "Treatment: \nPatient education: \nFollow-up: ",
  },
  {
    id: "chronic",
    name: "Chronic disease follow-up",
    subjective: "Routine follow-up. Current symptoms: \nMedication adherence: \nSide effects: ",
    objective: "BP: \nWeight: \nExam: unremarkable",
    assessment: "Controlled / not at goal",
    plan: "Continue current regimen. Lifestyle counselling. Recheck labs in 3 months.",
  },
  {
    id: "peds",
    name: "Pediatric sick visit",
    subjective: "CC: \nIntake & fluids: \nWet diapers / voiding: \nImmunizations: up to date / behind",
    objective: "General: \nWeight / percentile: \nHydration: no signs of dehydration\nDanger signs: none",
    assessment: "",
    plan: "Weight-based dosing. Return precautions reviewed with caregiver.",
  },
  {
    id: "progress",
    name: "Inpatient progress note",
    subjective: "Overnight events: \nPain / sleep / appetite: ",
    objective: "Vitals reviewed. Exam: \nLabs / imaging today: \nI/O: ",
    assessment: "Hospital day #: \nCourse: improving / unchanged / worsening",
    plan: "Continue: \nPending: \nDispo / EDD: ",
  },
  {
    id: "ed",
    name: "ED primary survey",
    subjective: "CC & onset: \nMechanism (trauma): \nSAMPLE: ",
    objective: "A: patent\nB: \nC: \nD: GCS \nE: ",
    assessment: "",
    plan: "Initial management: \nWork-up: \nDisposition: ",
  },
]
