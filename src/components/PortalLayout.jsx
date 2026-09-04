import React, { useState } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard,
  CalendarCheck,
  GraduationCap,
  ClipboardList,
  Wallet,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  GraduationCap as Logo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PortalProvider, usePortal } from "@/lib/portalContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/results", label: "Results", icon: GraduationCap },
  { to: "/assignments", label: "Assignments", icon: ClipboardList },
  { to: "/fees", label: "Fees", icon: Wallet },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/admin", label: "Admin", icon: Settings },
];

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { student } = usePortal();
  const studentName = student?.full_name;

  const handleLogout = async () => {
    await base44.auth.logout();
    navigate("/login");
  };

  const NavItems = () => (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = location.pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-background lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Logo className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">CSE Portal</p>
            <p className="text-xs text-muted-foreground">Academic Nexus</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavItems />
        </div>
        <div className="border-t p-3">
          <div className="mb-2 px-3 text-xs text-muted-foreground">
            Signed in as
            <p className="truncate text-sm font-medium text-foreground">{studentName || "Student"}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Logo className="h-4 w-4" />
          </div>
          <span className="font-semibold">CSE Portal</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-background shadow-xl">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <span className="font-semibold">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="py-4">
              <NavItems />
            </div>
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function PortalLayout() {
  return (
    <PortalProvider>
      <Shell />
    </PortalProvider>
  );
}