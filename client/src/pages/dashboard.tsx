import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { LogOut, Eye, Settings, Link as LinkIcon, BarChart3, Palette } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import ProfileSection from "@/components/profile-section";
import SocialLinksList from "@/components/social-links-list";
import AddLinkModal from "@/components/add-link-modal";
import EditProfileModal from "@/components/edit-profile-modal";
import EditLinkModal from "@/components/edit-link-modal";
import ThemeBuilderModal from "@/components/theme-builder-modal";
import BioPagesManager from "@/components/bio-pages-manager";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { type Profile, type SocialLink } from "@shared/schema";
import { useState } from "react";

interface ProfileData {
  profile: Profile;
  links: SocialLink[];
}

/**
 * Dashboard page that displays and manages the authenticated user's profile, links, and analytics.
 *
 * Shows a loading state while authentication or profile data is loading, presents profile settings,
 * quick stats, link management with add/edit modals, and a link to detailed analytics. If the user
 * is not authenticated, displays an unauthorized toast and redirects to /api/login.
 *
 * @returns The JSX element for the dashboard UI; renders `null` when the user is unauthenticated or missing a profile.
 */
export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isEditLinkModalOpen, setIsEditLinkModalOpen] = useState(false);
  const [isThemeBuilderModalOpen, setIsThemeBuilderModalOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<SocialLink | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You need to log in to access the dashboard.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  // Get all bio pages for the user
  const { data: bioPages = [], isLoading: bioPagesLoading } = useQuery<Profile[]>({
    queryKey: ["/api/bio-pages"],
    enabled: !!user?.id,
  });

  // Get the default profile data if user has profiles
  const { data, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile", user?.profile?.pageName],
    enabled: !!user?.profile?.pageName,
  });

  const handleLogout = async () => {
    try {
      const response = await apiRequest("POST", "/api/auth/logout");
      if (response.ok) {
        // Clear any cached data
        queryClient.clear();
        // Redirect to home page
        window.location.href = "/";
      } else {
        toast({
          title: "Logout failed",
          description: "There was an error logging out. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditLink = (link: SocialLink) => {
    setSelectedLink(link);
    setIsEditLinkModalOpen(true);
  };

  if (isLoading || bioPagesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // If user has no bio pages, show welcome screen
  if (bioPages.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Link href="/">
                <a className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <LinkIcon className="w-6 h-6 text-primary" />
                  <span className="text-xl font-display font-bold text-charcoal">LinkHub</span>
                </a>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden md:inline">
                {user?.email}
              </span>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Log Out</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Welcome Content */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-3xl font-display font-bold text-charcoal mb-4">
              Welcome to LinkHub!
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              Create your first bio page to get started. You can create multiple pages for different purposes.
            </p>
            <BioPagesManager userId={user?.id || ""} />
          </div>
        </main>
      </div>
    );
  }

  // If user has bio pages but no current profile data, show bio pages manager
  if (!data && bioPages.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Link href="/">
                <a className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <LinkIcon className="w-6 h-6 text-primary" />
                  <span className="text-xl font-display font-bold text-charcoal">LinkHub</span>
                </a>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden md:inline">
                {user?.email}
              </span>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Log Out</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Bio Pages Management */}
        <main className="max-w-4xl mx-auto px-4 py-8">
          <BioPagesManager userId={user?.id || ""} />
        </main>
      </div>
    );
  }

  // If user has no profile data at all, show loading or error
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile data...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider profileId={data?.profile?.id}>
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/">
              <a className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <LinkIcon className="w-6 h-6 text-primary" />
                <span className="text-xl font-display font-bold text-charcoal">LinkBoard</span>
              </a>
            </Link>
            <div className="hidden md:flex items-center gap-4">
              <Link href={`/${user?.profile?.pageName}`}>
                <a className="text-gray-600 hover:text-charcoal transition-colors flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  <span>View Profile</span>
                </a>
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden md:inline">
              {user?.email}
            </span>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="flex items-center gap-2"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Log Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-card shadow-lg p-6 mb-8 text-white">
          <h1 className="text-2xl md:text-3xl font-display font-bold mb-2">
            Welcome back, {user?.profile?.displayName || user?.email}!
          </h1>
          <p className="opacity-90">
            Manage your links and track your performance from your dashboard.
          </p>
        </div>

        {/* Quick Stats */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-card shadow p-4">
              <div className="text-gray-600 text-sm mb-1">Profile Views</div>
              <div className="text-2xl font-bold text-charcoal">{data.profile.profileViews || 0}</div>
            </div>
            <div className="bg-white rounded-card shadow p-4">
              <div className="text-gray-600 text-sm mb-1">Total Clicks</div>
              <div className="text-2xl font-bold text-charcoal">{data.profile.linkClicks || 0}</div>
            </div>
            <div className="bg-white rounded-card shadow p-4 col-span-2 md:col-span-1">
              <div className="text-gray-600 text-sm mb-1">Active Links</div>
              <div className="text-2xl font-bold text-charcoal">{data.links.length}</div>
            </div>
          </div>
        )}

        {/* Admin Panel - Only show for admin users */}
        {user?.isAdmin && (
          <div className="mb-6">
            <AdminPanel />
          </div>
        )}

        {/* Bio Pages Management - Additional Section */}
        <div className="bg-white rounded-card shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display font-bold text-charcoal flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-primary" />
              Bio Pages Management
            </h2>
          </div>
          <BioPagesManager userId={user?.id || ""} />
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-card shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display font-bold text-charcoal flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Current Page Settings
            </h2>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsThemeBuilderModalOpen(true)}
                variant="outline"
                className="flex items-center gap-2"
                data-testid="button-theme-builder"
              >
                <Palette className="w-4 h-4" />
                Customize Theme
              </Button>
              <Button
                onClick={() => setIsEditProfileModalOpen(true)}
                className="bg-primary hover:bg-primary-light text-white"
                data-testid="button-edit-profile"
              >
                Edit Profile
              </Button>
            </div>
          </div>
          {data && (
            <ProfileSection
              profile={data.profile}
              isEditMode={false}
              onEditProfile={() => setIsEditProfileModalOpen(true)}
              userEmail={user?.email}
            />
          )}
        </div>

        {/* Links Management */}
        <div className="bg-white rounded-card shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-display font-bold text-charcoal flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-primary" />
              Manage Links
            </h2>
            <Button
              onClick={() => setIsAddLinkModalOpen(true)}
              className="bg-primary hover:bg-primary-light text-white"
              data-testid="button-add-link"
            >
              + Add Link
            </Button>
          </div>
          {data && (
            <SocialLinksList 
              links={data.links} 
              isEditMode={true}
              profileId={data.profile.id}
              onEditLink={handleEditLink}
            />
          )}
        </div>

        {/* Analytics Link */}
        {data && (
          <div className="text-center">
            <Link href={`/analytics/${data.profile.id}`}>
              <a className="inline-flex items-center gap-2 text-primary hover:text-primary-light transition-colors font-semibold">
                <BarChart3 className="w-5 h-5" />
                View Detailed Analytics
              </a>
            </Link>
          </div>
        )}
      </main>

      {/* Modals */}
      {data && (
        <>
          <AddLinkModal
            isOpen={isAddLinkModalOpen}
            onClose={() => setIsAddLinkModalOpen(false)}
            profileId={data.profile.id}
          />

          <EditProfileModal
            isOpen={isEditProfileModalOpen}
            onClose={() => setIsEditProfileModalOpen(false)}
            profile={data.profile}
          />

          <EditLinkModal
            isOpen={isEditLinkModalOpen}
            onClose={() => setIsEditLinkModalOpen(false)}
            link={selectedLink}
          />

          <ThemeBuilderModal
            isOpen={isThemeBuilderModalOpen}
            onClose={() => setIsThemeBuilderModalOpen(false)}
            profileId={data.profile.id}
          />
        </>
      )}
      </div>
    </ThemeProvider>
  );
}