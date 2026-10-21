import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./app/app"
import { useStore } from "./store"
import { onExternalWrite } from "./store/storage"
import "./index.css"

// Keep tabs in sync (e.g. the queue display on a second monitor follows the registration desk).
onExternalWrite("medisphere-data", () => void useStore.persist.rehydrate())

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
