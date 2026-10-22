/**
 * Medication badges shown wherever a drug is listed: ISMP high-alert, controlled-substance
 * schedule (DEA "C-II" in the US, "CD2" under the UK Misuse of Drugs Regulations) and
 * non-formulary status.
 */
import { Chip } from "@heroui/react"
import type { Region } from "@v2/domain/region"
import type { InventoryItem } from "@v2/domain/types"

/** Controlled-substance badge: DEA schedule (US) or Misuse of Drugs Regulations schedule (UK). */
const controlledLabel = (schedule: string, region: Region) => (region === "us" ? `C-${schedule}` : `CD${schedule}`)

export function DrugBadges({ item, region }: { item: InventoryItem; region: Region }) {
  return (
    <>
      {item.highAlert && (
        <Chip size="sm" color="danger" variant="soft" title="ISMP high-alert medication">
          High-alert
        </Chip>
      )}
      {item.controlled && (
        <Chip size="sm" color="warning" variant="soft" title={region === "us" ? `DEA Schedule ${item.controlled}` : `Schedule ${item.controlled} controlled drug`}>
          {controlledLabel(item.controlled, region)}
        </Chip>
      )}
      {item.category === "drug" && item.formulary === false && (
        <Chip size="sm" variant="soft">
          Non-formulary
        </Chip>
      )}
    </>
  )
}
