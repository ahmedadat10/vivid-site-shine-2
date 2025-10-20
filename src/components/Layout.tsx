import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Package, ShoppingCart, LogOut, Menu, Shield, FileText } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useAuth } from "@/integrations/supabase/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import tronicLogo from "@/assets/tronic-logo.png";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, signOut, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
    } else if (!loading && user && !roleLoading && role !== 'admin') {
      // Non-admin users should only access orders page
      if (location.pathname !== '/orders') {
        navigate("/orders");
      }
    }
  }, [user, loading, navigate, role, roleLoading, location.pathname]);

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Logged out successfully");
      navigate("/");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-subtle">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const menuItems = [
    ...(role === 'admin' ? [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
      { icon: Package, label: "Products", path: "/products" },
    ] : []),
    { icon: ShoppingCart, label: "Orders", path: "/orders" },
    ...(role === 'admin' ? [
      { icon: FileText, label: "All Orders", path: "/admin/orders" },
      { icon: FileText, label: "Activity Logs", path: "/admin/audit" },
      { icon: FileText, label: "Backup & Export", path: "/admin/backup" },
      { icon: Shield, label: "Admin", path: "/admin" }
    ] : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row w-full gradient-subtle">
      {/* Mobile Header */}
      <header className="lg:hidden gradient-primary text-white shadow-glow">
        <div className="p-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <img src={tronicLogo} alt="Tronic" className="h-8 w-auto" />
            <div>
              <h2 className="text-sm font-bold">TRU ORDERS</h2>
              <p className="text-xs text-white/70">{user?.email?.split('@')[0] || 'User'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-white hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        
        {isSidebarOpen && (
          <nav className="p-3 flex gap-2 overflow-x-auto border-b border-white/10">
            {menuItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                size="sm"
                className={`text-white hover:bg-white/10 transition-all duration-200 whitespace-nowrap ${
                  isActive(item.path) ? "bg-white/20 shadow-lg" : ""
                }`}
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 whitespace-nowrap"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </nav>
        )}
      </header>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex ${
          isSidebarOpen ? "w-64" : "w-20"
        } gradient-primary text-white transition-all duration-300 flex-col shadow-glow`}
      >
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          {isSidebarOpen && (
            <div className="flex items-center gap-3">
              <img src={tronicLogo} alt="Tronic" className="h-10 w-auto" />
              <div>
                <h2 className="text-xl font-bold">TRU ORDERS</h2>
                <p className="text-xs text-white/70">{user?.email?.split('@')[0] || 'User'}</p>
              </div>
            </div>
          )}
          {!isSidebarOpen && (
            <img src={tronicLogo} alt="Tronic" className="h-8 w-auto mx-auto" />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-white hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              className={`w-full justify-start text-white hover:bg-white/10 transition-all duration-200 ${
                isActive(item.path) ? "bg-white/20 shadow-lg" : ""
              } ${!isSidebarOpen && "justify-center"}`}
              onClick={() => navigate(item.path)}
            >
              <item.icon className={`h-5 w-5 ${isSidebarOpen && "mr-3"}`} />
              {isSidebarOpen && item.label}
            </Button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <Button
            variant="ghost"
            className={`w-full justify-start text-white hover:bg-white/10 ${!isSidebarOpen && "justify-center"}`}
            onClick={handleLogout}
          >
            <LogOut className={`h-5 w-5 ${isSidebarOpen && "mr-3"}`} />
            {isSidebarOpen && "Logout"}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="w-full p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
