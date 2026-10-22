import { OrderWorklistPage } from "@/features/laboratory/order-worklist"

/** Radiology shares the order worklist with the lab; imaging specifics live in `rad-parts`. */
export default function RadiologyPage() {
  return <OrderWorklistPage kind="rad" />
}
