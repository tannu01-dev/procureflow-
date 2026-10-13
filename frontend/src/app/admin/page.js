import WorkspaceDashboard from "@/components/WorkspaceDashboard";

export default function AdminPage() {
  return <WorkspaceDashboard requiredRole="company_admin" />;
}