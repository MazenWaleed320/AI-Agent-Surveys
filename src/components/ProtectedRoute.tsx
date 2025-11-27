import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireHRManager?: boolean;
};

const ProtectedRoute = ({ children, requireHRManager = false }: ProtectedRouteProps) => {
  const { role, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (requireHRManager && role !== "hr_manager") {
    return <Navigate to="/surveys" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
