import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ClientsProvider } from "./context/ClientsContext";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import { GoogleCalendarProvider } from "./context/GoogleCalendarContext";
import ErrorBoundary from "./components/layout/ErrorBoundary";
import "./index.css";

// Error tracking (OPS-01) plugs in here: setErrorReporter((error, context) => tracker.capture(error, context)).
// Until then caught errors are logged to the console (src/lib/errorReporting.js).

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary variant="app">
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <GoogleCalendarProvider>
              <ClientsProvider>
                <App />
              </ClientsProvider>
            </GoogleCalendarProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
