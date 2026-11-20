/* App.tsx — shell: routes, bottom navigation, error boundary */

import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import {
  HashRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import {
  Clock,
  Home as HomeIcon,
  Library,
  Settings as SettingsIcon,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { InstallSuggestion } from "@/components/InstallSuggestion";
import { ErrorDialog } from "@/components/ErrorDialog";
import {
  DownloadsDialog,
  DownloadsFloatingButton,
  useDownloadsOpen,
} from "@/components/DownloadsPopup";
import { Button } from "@/components/ui/button";
import { Home } from "@/views/Home";
import { Branch } from "@/views/Branch";
import { Book } from "@/views/Book";
import { Library as LibraryView } from "@/views/Library";
import { Settings } from "@/views/Settings";
import { Reader } from "@/reader/Reader";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; showDialog: boolean }
> {
  state = { error: null as Error | null, showDialog: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught UI error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <>
          <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
            <h1 className="text-lg font-bold">Something went wrong</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              {this.state.error.message || "An unexpected error occurred."}
            </p>
            <Button onClick={() => window.location.reload()}>
              Reload the app
            </Button>
            <Button
              variant="ghost"
              onClick={() => this.setState({ showDialog: true })}
            >
              Show details
            </Button>
          </div>
          <ErrorDialog
            open={this.state.showDialog}
            onOpenChange={(showDialog) => this.setState({ showDialog })}
            title="Unexpected error"
            message="The app hit an error it could not recover from. Reloading usually fixes it."
            detail={this.state.error.stack || this.state.error.message}
            actionLabel="Reload"
            onAction={() => window.location.reload()}
          />
        </>
      );
    }
    return this.props.children;
  }
}

function ReadLast() {
  const navigate = useNavigate();
  useEffect(() => {
    const last = localStorage.getItem("ptg:lastRead");
    void navigate(last ? `/read/${last}` : "/", { replace: true });
  }, [navigate]);
  return (
    <p className="pt-10 text-center text-sm text-muted-foreground">Opening…</p>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
      <p className="text-lg font-semibold">Page not found</p>
      <Button asChild>
        <Link to="/">Go Home</Link>
      </Button>
    </div>
  );
}

function Shell() {
  const location = useLocation();
  const isReader = location.pathname.startsWith("/read");
  const hasLast = Boolean(localStorage.getItem("ptg:lastRead"));
  const [dlOpen, setDlOpen] = useDownloadsOpen();

  return (
    <div className="min-h-svh bg-background text-foreground">
      <main className="mx-auto w-full">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/branch/:branchId" element={<Branch />} />
          <Route path="/book/:bookId" element={<Book />} />
          <Route path="/library" element={<LibraryView />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/read/:chapterId" element={<Reader />} />
          <Route path="/read-last" element={<ReadLast />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {!isReader ? (
        <DownloadsFloatingButton onOpen={() => setDlOpen(true)} />
      ) : null}
      <DownloadsDialog open={dlOpen} onOpenChange={setDlOpen} />

      {!isReader ? (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur"
        >
          <div className="mx-auto flex max-w-2xl">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <HomeIcon className="size-5" aria-hidden="true" />
              Home
            </NavLink>
            <NavLink
              to="/library"
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <Library className="size-5" aria-hidden="true" />
              Library
            </NavLink>
            {hasLast ? (
              <NavLink
                to="/read-last"
                className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground"
              >
                <Clock className="size-5" aria-hidden="true" />
                Last Read
              </NavLink>
            ) : null}
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <SettingsIcon className="size-5" aria-hidden="true" />
              Settings
            </NavLink>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Shell />
      </HashRouter>
      <Toaster position="top-center" richColors />
      <InstallSuggestion />
    </ErrorBoundary>
  );
}
