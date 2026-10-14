import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSessionUser } from "../authStore";

export default function RoleGate({ allowed = [], children }) {
  const navigate = useNavigate();
  const user = getSessionUser();
  const ok = allowed.length === 0 ? Boolean(user) : Boolean(user && allowed.includes(user.role));

  useEffect(() => {
    if (!ok) navigate("/login", { replace: true });
  }, [ok, navigate]);

  if (!ok) return <div className="min-h-[40vh]" />;
  return children;
}
