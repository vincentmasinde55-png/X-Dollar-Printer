import { Navigate, useLocation } from "react-router-dom";

/**
 * Wraps routes that require a logged-in user.
 * Redirects to /login (preserving the intended destination) if no token is found.
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}