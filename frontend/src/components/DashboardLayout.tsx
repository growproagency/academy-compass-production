import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { signInWithEmail, signInWithGoogle } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Archive,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Megaphone,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Moon,
  PanelLeft,
  Search,
  Shield,
  Sun,
  User,
} from "lucide-react";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useOrg } from "@/contexts/OrgContext";
import {
  useProjectsWithStats,
  useTasks,
  useCalendarTasks,
  useCalendarMilestones,
  useHealthTrend,
  useUsers,
  useAnnouncements,
  useMyTasks,
} from "@/hooks/useApi";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663339590706/WvLXdhXdLHC4BeaXfe7Szz/academy-compass-logo_1137a27d.jpg";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: CheckSquare, label: "My To-Dos", path: "/my-tasks" },
  { icon: Megaphone, label: "Announcements", path: "/announcements" },
  { icon: CalendarDays, label: "Calendar", path: "/calendar" },
  { icon: Archive, label: "Archive", path: "/archive" },
  { icon: LayoutGrid, label: "Strategic Organizer", path: "/strategic-organizer" },
];

const adminItems = [
  { icon: Shield, label: "Admin Panel", path: "/admin" },
];

const superAdminItems = [
  { icon: Shield, label: "Super Admin", path: "/super-admin" },
];

const SIDEBAR_WIDTH_KEY = "academycompass-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const { org, loading: orgLoading } = useOrg();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading || orgLoading) return <DashboardLayoutSkeleton />;

  if (!org) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3 text-center p-8">
          <p className="text-2xl font-bold">Organization not found</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            This URL doesn't match any organization. Check the address and try again.
          </p>
        </div>
      </div>
    );
  }

  if (user && user.role !== "superadmin" && user.organizationId !== org.id) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3 text-center p-8">
          <p className="text-2xl font-bold">Access denied</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Your account doesn't belong to this organization.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-sm w-full">
          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-primary/20 flex items-center justify-center glow-primary bg-primary/5">
              <img src={LOGO_URL} alt="Academy Compass" className="w-full h-full object-contain" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-extrabold gradient-text tracking-tight">
                Academy Compass
              </h1>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-0.5">
                School Management Platform
              </p>
            </div>
          </div>
          <div className="w-full rounded-xl border border-border bg-card shadow-sm p-6 flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-center text-foreground">Sign in to continue</h2>
            <p className="text-sm text-muted-foreground text-center">
              Access your team's collaborative task management workspace.
            </p>
            <EmailAuthForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isSuperAdmin = user?.role === "superadmin";

  const activeLabel =
    [...menuItems, ...adminItems].find((item) => {
      if (item.path === "/") return location === "/";
      return location.startsWith(item.path);
    })?.label ?? "Academy Compass";

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  // Prefetch data for tabs so it's already cached when the user navigates to them
  useProjectsWithStats();
  useTasks();
  useCalendarTasks();
  useCalendarMilestones();
  useHealthTrend();
  useUsers();
  useAnnouncements();

  // Overdue count badge for My Tasks — derived from the myTasks cache so it
  // updates immediately when a task is toggled (optimistic update).
  const { data: myTasks } = useMyTasks();
  const now = Date.now();
  const overdueCount = (myTasks ?? []).filter(
    (t: any) => t.dueDate && t.dueDate < now && t.status !== "done"
  ).length;

  const NavItem = ({ item }: { item: typeof menuItems[0] }) => {
    const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
    const showBadge = item.path === "/my-tasks" && overdueCount > 0;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={isActive}
          onClick={() => setLocation(item.path)}
          tooltip={item.label}
          className={`h-10 transition-all font-normal rounded-lg ${
            isActive
              ? "bg-primary/10 text-primary border-l-2 border-primary"
              : "hover:bg-secondary"
          }`}
        >
          <item.icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
          <span className={`flex-1 ${isActive ? "text-primary font-medium" : "text-foreground"}`}>{item.label}</span>
          {showBadge && !isCollapsed && (
            <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold shrink-0">
              {overdueCount > 99 ? "99+" : overdueCount}
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-border" disableTransition={isResizing}>
          {/* Header */}
          <SidebarHeader className="h-16 justify-center border-b border-border">
            <div className="flex items-center gap-3 px-2 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-secondary rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg overflow-hidden border border-primary/20 flex items-center justify-center shrink-0 bg-primary/5">
                    <img src={LOGO_URL} alt="Academy Compass" className="w-full h-full object-contain" />
                  </div>
                  <span className="font-extrabold tracking-tight text-sm text-primary truncate flex-1">
                    Academy Compass
                  </span>
                  <button
                    onClick={() => {
                      const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
                      window.dispatchEvent(e);
                    }}
                    className="h-7 w-7 flex items-center justify-center hover:bg-secondary rounded-lg transition-colors focus:outline-none shrink-0"
                    title="Search (⌘K)"
                    aria-label="Open search"
                  >
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Navigation */}
          <SidebarContent className="gap-0 py-3">
            <SidebarMenu className="px-2 gap-0.5">
              {menuItems.map((item) => <NavItem key={item.path} item={item} />)}
            </SidebarMenu>

            {isAdmin && (
              <>
                {!isCollapsed && (
                  <div className="px-4 pt-4 pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                      Administration
                    </p>
                  </div>
                )}
                <SidebarMenu className="px-2 gap-0.5">
                  {adminItems.map((item) => <NavItem key={item.path} item={item} />)}
                  {isSuperAdmin && superAdminItems.map((item) => <NavItem key={item.path} item={item} />)}
                </SidebarMenu>
              </>
            )}
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary transition-colors w-full text-left focus:outline-none group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-8 w-8 border border-border shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate leading-none text-foreground">{user?.name || "User"}</p>
                      {isSuperAdmin ? (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-400/60 text-amber-500 shrink-0">
                          Superadmin
                        </Badge>
                      ) : isAdmin && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary shrink-0">
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1">{user?.email || ""}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setLocation("/profile")} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>My Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                  {theme === "dark" ? (
                    <Sun className="mr-2 h-4 w-4" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4" />
                  )}
                  <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b border-border h-14 items-center justify-between bg-background px-3 sticky top-0 z-40">
            <div className="flex items-center gap-2.5">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md overflow-hidden border border-primary/20 shrink-0 bg-primary/5">
                  <img src={LOGO_URL} alt="" className="w-full h-full object-contain" />
                </div>
                <span className="font-semibold text-sm text-foreground truncate max-w-[160px]">{activeLabel}</span>
              </div>
            </div>
            <button
              onClick={() => {
                const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
                window.dispatchEvent(e);
              }}
              className="h-9 w-9 flex items-center justify-center hover:bg-secondary rounded-lg transition-colors"
              aria-label="Search"
            >
              <Search className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
        <main className="flex-1 p-3 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}

function EmailAuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Google OAuth */}
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full flex items-center gap-2"
        onClick={async () => { setError(null); try { await signInWithGoogle(); } catch (e: any) { setError(e.message); } }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </Button>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <input
        className="border rounded-lg px-3 py-2 text-sm bg-background"
        placeholder="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handle()}
      />
      <input
        className="border rounded-lg px-3 py-2 text-sm bg-background"
        placeholder="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handle()}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button onClick={handle} disabled={loading} size="lg" className="w-full">
        {loading ? "Loading…" : "Sign in"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Access is by invitation only. Contact your admin to get access.
      </p>
    </div>
  );
}
