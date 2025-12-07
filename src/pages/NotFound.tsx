import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // No logging for security - don't expose route access attempts
  }, [location.pathname]);

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center bg-background">
      <div className="text-center w-full">
        <h1 className="mb-6 text-9xl font-black tracking-tight text-foreground">404</h1>
        <p className="text-4xl font-semibold text-muted-foreground">Oops! Page not found</p>
      </div>
    </div>
  );
};

export default NotFound;
