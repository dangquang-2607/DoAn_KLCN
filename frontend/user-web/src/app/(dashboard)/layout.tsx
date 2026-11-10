import DashboardLayout from "@/dung-chung/layouts/DashboardLayout";

// Mọi route trong nhóm dashboard đều đi qua cùng lớp bảo vệ phiên và điều hướng.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
