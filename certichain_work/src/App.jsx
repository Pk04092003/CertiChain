import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Templates from "./pages/Templates";
import TemplateEditor from "./pages/TemplateEditor";
import BulkIssue from "./pages/BulkIssue";
import GenerateCertificate from "./pages/GenerateCertificate";
import Certificates from "./pages/Certificates";
import CertificateDetails from "./pages/CertificateDetails";
import Verification from "./pages/Verification";
import VerificationSearch from "./pages/VerificationSearch";
import Settings from "./pages/Settings";
import EmailParticipants from "./pages/EmailParticipants";
import Login from "./pages/Login";
import Analytics from "./pages/Analytics";
import AuditLogs from "./pages/AuditLogs";
import RoleGate from "./components/RoleGate";

const Admin = ({ children }) => (
  <RoleGate allowed={["Admin"]}>{children}</RoleGate>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />

        <Route path="/dashboard" element={<Admin><Dashboard /></Admin>} />
        <Route path="/templates" element={<Admin><Templates /></Admin>} />
        <Route path="/templates/new" element={<Admin><TemplateEditor /></Admin>} />
        <Route path="/templates/:id/edit" element={<Admin><TemplateEditor /></Admin>} />
        <Route path="/issue-certificate" element={<Admin><BulkIssue /></Admin>} />
        <Route path="/bulk-issue" element={<Admin><BulkIssue /></Admin>} />
        <Route path="/generate" element={<Admin><GenerateCertificate /></Admin>} />
        <Route path="/email-participants" element={<Admin><EmailParticipants /></Admin>} />
        <Route path="/certificates" element={<Admin><Certificates /></Admin>} />
        <Route path="/certificates/:id" element={<Admin><CertificateDetails /></Admin>} />
        <Route path="/analytics" element={<Admin><Analytics /></Admin>} />
        <Route path="/audit-logs" element={<Admin><AuditLogs /></Admin>} />
        <Route path="/settings" element={<Admin><Settings /></Admin>} />

        {/* Public Viewer flow — no account or login required. */}
        <Route path="/verify" element={<VerificationSearch />} />
        <Route path="/verify/:certificateId" element={<Verification />} />
      </Routes>
    </BrowserRouter>
  );
}
