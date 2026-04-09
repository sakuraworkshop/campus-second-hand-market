import { Routes, useLocation } from "react-router-dom";
import { adminRoutes } from "./admin-routes";
import { publicRoutes } from "./public-routes";

const AppRoutes = () => {
  const location = useLocation();

  return (
    <div key={location.pathname} className="page-route-enter">
      <Routes>{publicRoutes}{adminRoutes}</Routes>
    </div>
  );
};

export default AppRoutes;
