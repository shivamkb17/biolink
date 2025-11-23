/**
 * Admin Overview Page
 * Dashboard with statistics and insights
 */

import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Link as LinkIcon, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminOverview() {
  const [_, setLocation] = useLocation();

  // Fetch admin stats
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admin/stats"],
    retry: false,
  });

  // Redirect to login if unauthorized
  if (error && (error as any)?.status === 401) {
    setLocation("/login");
    return null;
  }

  // Redirect to home if forbidden (not admin)
  if (error && (error as any)?.status === 403) {
    setLocation("/");
    return null;
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  const stats = data?.stats || {};
  const recentUsers = data?.recentUsers || [];
  const topProfiles = data?.topProfiles || [];

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Profiles",
      value: stats.totalProfiles || 0,
      icon: FileText,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total Links",
      value: stats.totalLinks || 0,
      icon: LinkIcon,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Recent Users (7d)",
      value: stats.recentUsersCount || 0,
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-gray-500 mt-1">Welcome to the admin dashboard</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        {stat.title}
                      </p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">
                        {stat.value.toLocaleString()}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Users */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Users</CardTitle>
            </CardHeader>
            <CardContent>
              {recentUsers.length === 0 ? (
                <p className="text-gray-500 text-sm">No recent users</p>
              ) : (
                <div className="space-y-4">
                  {recentUsers.map((user: any) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.email}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Profiles */}
          <Card>
            <CardHeader>
              <CardTitle>Top Profiles by Views</CardTitle>
            </CardHeader>
            <CardContent>
              {topProfiles.length === 0 ? (
                <p className="text-gray-500 text-sm">No profiles yet</p>
              ) : (
                <div className="space-y-4">
                  {topProfiles.map((profile: any) => (
                    <div key={profile.id} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {profile.displayName}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          /{profile.pageName}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-500">
                          {profile.profileViews?.toLocaleString() || 0} views
                        </span>
                        <span className="text-gray-500">
                          {profile.linkClicks?.toLocaleString() || 0} clicks
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
