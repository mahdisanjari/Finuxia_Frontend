import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import PageSpinner from "./components/PageSpinner";

// Public pages: each its own small chunk, and none of them imports the signed-in application. A prospective client
// opening a booking link on a phone downloads the shell and that one page, nothing else.
const Login = lazy(() => import("./pages/Login"));
const BookingPublic = lazy(() => import("./pages/BookingPublic"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const SupportPublic = lazy(() => import("./pages/SupportPublic"));
const ZoomIntegrationDocs = lazy(() => import("./pages/ZoomIntegrationDocs"));

// The signed-in application (layout, contexts, every page's route) loads only for an address that is not a public page.
const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/book/:slug" element={<BookingPublic />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/support" element={<SupportPublic />} />
        <Route path="/docs/zoom" element={<ZoomIntegrationDocs />} />
        <Route path="*" element={<AuthenticatedApp />} />
      </Routes>
    </Suspense>
  );
}
