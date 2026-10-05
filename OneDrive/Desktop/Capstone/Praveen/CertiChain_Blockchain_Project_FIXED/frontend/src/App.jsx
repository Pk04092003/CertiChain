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
import EmailCertificate from "./pages/EmailCertificate";
import Login from "./pages/Login";
import Analytics from "./pages/Analytics";
import AuditLogs from "./pages/AuditLogs";
import RoleGate from "./components/RoleGate";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/templates" element={<RoleGate allowed={["Institution Admin","Issuer"]}><Templates /></RoleGate>} />
        <Route path="/templates/new" element={<RoleGate allowed={["Institution Admin","Issuer"]}><TemplateEditor /></RoleGate>} />
        <Route path="/templates/:id/edit" element={<RoleGate allowed={["Institution Admin","Issuer"]}><TemplateEditor /></RoleGate>} />
        <Route path="/issue-certificate" element={<RoleGate allowed={["Institution Admin","Issuer"]}><BulkIssue /></RoleGate>} />
        <Route path="/email-participants" element={<RoleGate allowed={["Institution Admin","Issuer"]}><EmailParticipants /></RoleGate>} />
        <Route path="/email-certificate/:id" element={<RoleGate allowed={["Institution Admin","Issuer"]}><EmailCertificate /></RoleGate>} />
        <Route path="/bulk-issue" element={<RoleGate allowed={["Institution Admin","Issuer"]}><BulkIssue /></RoleGate>} />
        <Route path="/generate" element={<RoleGate allowed={["Institution Admin","Issuer"]}><GenerateCertificate /></RoleGate>} />
        <Route path="/certificates" element={<Certificates />} />
        <Route path="/certificates/:id" element={<CertificateDetails />} />
        <Route path="/analytics" element={<RoleGate allowed={["Institution Admin","Issuer","Viewer"]}><Analytics /></RoleGate>} />
        <Route path="/audit-logs" element={<RoleGate allowed={["Institution Admin","Issuer"]}><AuditLogs /></RoleGate>} />
        <Route path="/verify" element={<VerificationSearch />} />
        <Route path="/verify/:certificateId" element={<Verification />} />
        <Route path="/settings" element={<RoleGate allowed={["Institution Admin"]}><Settings /></RoleGate>} />
      </Routes>
    </BrowserRouter>
  );
}
