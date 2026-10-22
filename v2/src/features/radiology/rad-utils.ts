import { RAD_MAP, type RadExam } from "@v2/domain/catalog"
import type { ServiceOrder } from "@v2/domain/types"

export const MODALITIES: RadExam["modality"][] = ["XR", "US", "CT", "MR", "Echo"]
export const MODALITY_LABEL: Record<RadExam["modality"], string> = { XR: "X-ray", US: "Ultrasound", CT: "CT", MR: "MRI", Echo: "Echo" }

export const orderExams = (order: ServiceOrder) => order.testCodes.map((c) => RAD_MAP[c]).filter(Boolean)
export const orderModalities = (order: ServiceOrder) => [...new Set(orderExams(order).map((e) => e.modality))]

export const reportComplete = (report: string) => report.includes("FINDINGS:") && report.includes("IMPRESSION:") && report.trim().length > 30
