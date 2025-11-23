/**
 * Admin Profiles Management Page
 * View, search, filter, and manage all bio profiles
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, Eye, MousePointerClick, ChevronLeft, ChevronRight, Search, Download } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function AdminProfiles() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterBy, setFilterBy] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // Build query params
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: "20",
    ...(search && { search }),
    ...(filterBy !== "all" && { filterBy }),
    ...(sortBy && { sortBy }),
    ...(sortOrder && { sortOrder }),
  });

  // Fetch profiles
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admin/profiles", page, search, filterBy, sortBy, sortOrder],
    queryFn: async () => {
      const res = await fetch(`/api/admin/profiles?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    retry: false,
  });

  // Export to CSV
  const handleExport = async () => {
    try {
      const res = await fetch("/api/admin/profiles/export");
      if (!res.ok) throw new Error("Failed to export");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `profiles-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Success",
        description: "Profiles exported successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export profiles",
        variant: "destructive",
      });
    }
  };

  // Handle search change - reset to page 1
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // Handle filter change - reset to page 1
  const handleFilterChange = (value: string) => {
    setFilterBy(value);
    setPage(1);
  };

  // Redirect if unauthorized
  if (error && (error as any)?.status === 401) {
    setLocation("/login");
    return null;
  }

  if (error && (error as any)?.status === 403) {
    setLocation("/");
    return null;
  }

  const profiles = data?.profiles || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile Management</h1>
            <p className="text-gray-500 mt-1">
              Manage all bio profiles ({pagination.total} total)
            </p>
          </div>
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search profiles..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterBy} onValueChange={handleFilterChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Profiles</SelectItem>
                  <SelectItem value="default">Default Only</SelectItem>
                  <SelectItem value="secondary">Secondary Only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Created Date</SelectItem>
                  <SelectItem value="views">Profile Views</SelectItem>
                  <SelectItem value="clicks">Link Clicks</SelectItem>
                  <SelectItem value="pageName">Page Name</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={setSortOrder}>
                <SelectTrigger>
                  <SelectValue placeholder="Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Profiles Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Profiles</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Loading profiles...</p>
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No profiles found</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Display Name</TableHead>
                        <TableHead>Page Name</TableHead>
                        <TableHead>Bio</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Stats</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((profile: any) => (
                        <TableRow key={profile.id}>
                          <TableCell className="font-medium">
                            {profile.displayName}
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                              /{profile.pageName}
                            </code>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {profile.bio}
                          </TableCell>
                          <TableCell>
                            {profile.isDefault ? (
                              <Badge variant="default">Default</Badge>
                            ) : (
                              <Badge variant="outline">Secondary</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-3 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {profile.profileViews?.toLocaleString() || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <MousePointerClick className="h-3 w-3" />
                                {profile.linkClicks?.toLocaleString() || 0}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(profile.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`/${profile.pageName}`, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-500">
                      Page {pagination.page} of {pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                        disabled={page === pagination.totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
