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
import { signInWithEmail, signUpWithEmail } from "@/const";
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
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

const LOGO_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663339590706/WvLXdhXdLHC4BeaXfe7Szz/academy-compass-logo_1137a27d.jpg";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: FolderKanban, label: "Rocks", path: "/projects" },
  { icon: CheckSquare, label: "My To-Dos", path: "/my-tasks" },
  { icon: Megaphone, label: "Announcements", path: "/announcements" },
  { icon: CalendarDays, label: "Calendar", path: "/calendar" },
  { icon: Archive, label: "Archive", path: "/archive" },
  { icon: LayoutGrid, label: "Strategic Organizer", path: "/strategic-organizer" },
];

const adminItems = [
  { icon: Shield, label: "Admin Panel", path: "/admin" },
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

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

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
  const isAdmin = user?.role === "admin";

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

  // Prefetch rocks data so it's already cached when the user navigates to the Rocks tab
  trpc.projects.listWithStats.useQuery();

  // Overdue count badge for My Tasks
  const { data: stats } = trpc.dashboard.stats.useQuery();
  const overdueCount = stats?.overdueTasks ?? 0;

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
                  <span className="font-extrabold tracking-tight text-sm gradient-text truncate flex-1">
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
                      {isAdmin && (
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") await signInWithEmail(email, password);
      else await signUpWithEmail(email, password);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
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
        {loading ? "Loading…" : mode === "signin" ? "Sign in" : "Create account"}
      </Button>
      <button
        onClick={() => setMode(m => m === "signin" ? "signup" : "signin")}
        className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
      >
        {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
