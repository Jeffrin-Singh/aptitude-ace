import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, BookOpen, BarChart3, LogOut, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const userLinks = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/practice", label: "Practice", icon: BookOpen },
    { to: "/performance", label: "My Performance", icon: BarChart3 },
  ] as const;

  const adminLinks = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/users", label: "Users", icon: Users },
  ] as const;

  const links = role === "admin" ? adminLinks : userLinks;

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="p-6 flex items-center gap-3 border-b border-sidebar-border">
          <div className="w-10 h-10 rounded-xl bg-sidebar-accent flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-sidebar-accent-foreground" />
          </div>
          <div>
            <div className="font-bold text-sm">TCS NQT</div>
            <div className="text-xs opacity-70">Practice Platform</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {links.map((l) => {
            const active = l.exact ? pathname === l.to : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "hover:bg-white/5",
                )}
              >
                <l.icon className="w-4 h-4" />
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="px-3 py-2">
            <div className="text-xs opacity-70">Signed in as</div>
            <div className="text-sm truncate">{user?.email}</div>
            <div className="text-xs inline-block mt-1 px-2 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground font-medium capitalize">
              {role}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-sidebar-foreground hover:bg-white/5 hover:text-sidebar-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
