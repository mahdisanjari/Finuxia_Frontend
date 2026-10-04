import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import BookingPublic from "./pages/BookingPublic";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import MyDay from "./pages/MyDay";
import Meetings from "./pages/Meetings";
import About from "./pages/About";
import Clients from "./pages/Clients";
import Groups from "./pages/Groups";
import ClientDetail from "./pages/ClientDetail";
import FollowUps from "./pages/FollowUps";
import Reports from "./pages/Reports";
import Import from "./pages/Import";
import Guide from "./pages/Guide";
import Documents from "./pages/Documents";
import BookingRequests from "./pages/BookingRequests";
import BookingLinks from "./pages/BookingLinks";
import StrategyPrep from "./pages/StrategyPrep";
import Presentations from "./pages/Presentations";
import SalesPackagePrep from "./pages/SalesPackagePrep";
import Subscribe from "./pages/Subscribe";
import Billing from "./pages/Billing";
import NotFound from "./pages/NotFound";
import PaymentReturn from "./pages/PaymentReturn";
import ModuleGate from "./components/ModuleGate";
import Tickets from "./pages/Tickets";
import TicketDetail from "./pages/TicketDetail";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import SupportPublic from "./pages/SupportPublic";
import ZoomIntegrationDocs from "./pages/ZoomIntegrationDocs";

export default function App() {
  return (
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

      {/* Subscription gate lives outside Layout so it's full-page and the
          Layout redirect below never loops. */}
      <Route
        path="/subscribe"
        element={
          <ProtectedRoute>
            <Subscribe />
          </ProtectedRoute>
        }
      />

      {/* Where the payment provider sends the customer back to. Outside Layout like /subscribe, so an account
          whose trial has ended (the very person paying) is not bounced away before the page can confirm anything. */}
      <Route path="/billing/success" element={<ProtectedRoute><PaymentReturn outcome="success" /></ProtectedRoute>} />
      <Route path="/billing/cancel" element={<ProtectedRoute><PaymentReturn outcome="cancel" /></ProtectedRoute>} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-day" element={<MyDay />} />
        <Route path="/meetings" element={<Meetings />} />
        <Route path="/about" element={<About />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/follow-ups" element={<ModuleGate moduleKey="followups" moduleName="Automated Follow-Ups"><FollowUps /></ModuleGate>} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/import" element={<Import />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/booking-requests" element={<BookingRequests />} />
        <Route path="/booking-links" element={<BookingLinks />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/tickets/:id" element={<TicketDetail />} />
        <Route path="/advisor-assistant/presentations" element={<Presentations />} />
        <Route path="/advisor-assistant/strategy-prep" element={<StrategyPrep />} />
        <Route path="/advisor-assistant/sales-package" element={<ModuleGate moduleKey="sales_package_prep" moduleName="Sales Package Prep"><SalesPackagePrep /></ModuleGate>} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/billing" element={<Billing />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
