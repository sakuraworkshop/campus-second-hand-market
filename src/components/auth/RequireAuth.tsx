import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getToken } from "@/lib/auth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const token = getToken();

  if (!token) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}

