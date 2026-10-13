import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import "./App.css";
import ConsultationWorkspace from "./clinical/ConsultationWorkspace";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConsultationWorkspace />
  </React.StrictMode>,
);
