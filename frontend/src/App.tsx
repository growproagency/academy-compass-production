import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { OrgProvider } from "./contexts/OrgContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import MyTasks from "./pages/MyTasks";
import Profile from "./pages/Profile";
import AdminPanel from "./pages/AdminPanel";
import SuperAdmin from "./pages/SuperAdmin";
import Calendar from "./pages/Calendar";
import Archive from "./pages/Archive";
import StrategicOrganizer from "./pages/StrategicOrganizer";
import StrategicOrganizerPreview from "./pages/StrategicOrganizerPreview";
import Announcements from "./pages/Announcements";
import MemberScorecard from "./pages/MemberScorecard";
import AuthCallback from "./pages/AuthCallback";
import SetPassword from "./pages/SetPassword";
import { CommandPalette } from "./components/CommandPalette";


function Router() {
  return (
    <Switch>
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/set-password" component={SetPassword} />
      <Route path="/strategic-organizer/preview" component={StrategicOrganizerPreview} />
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/projects" component={Projects} />
            <Route path="/projects/:id" component={ProjectDetail} />
            <Route path="/my-tasks" component={MyTasks} />
            <Route path="/profile" component={Profile} />
            <Route path="/admin" component={AdminPanel} />
            <Route path="/super-admin" component={SuperAdmin} />
            <Route path="/calendar" component={Calendar} />
            <Route path="/archive" component={Archive} />
            <Route path="/strategic-organizer" component={StrategicOrganizer} />
            <Route path="/announcements" component={Announcements} />
            <Route path="/members/:id/scorecard" component={MemberScorecard} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <OrgProvider>
        <ThemeProvider defaultTheme="light" switchable>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <CommandPalette />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </OrgProvider>
    </ErrorBoundary>
  );
}
