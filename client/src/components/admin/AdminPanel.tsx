/**
 * Admin Panel Component
 * Displays admin controls and user list in the dashboard
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import { Users, Shield, ExternalLink, ChevronRight, FileText, Link as LinkIcon } from "lucide-react";

export function AdminPanel() {
  // Fetch admin stats
  const { data: statsData } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    retry: false,
  });

  // Fetch all users
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admin/users", 1],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users?page=1&limit=10`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    retry: false,
  });

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-red-600 text-sm">
            Unable to load admin data. Please check your permissions.
          </p>
        </CardContent>
      </Card>
    );
  }

  const users = data?.users || [];
  const pagination = data?.pagination || { total: 0 };

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-xl">Admin Panel</CardTitle>
            <Badge variant="default" className="bg-blue-600">
              Admin
            </Badge>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              Full Admin Dashboard
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-500 text-sm">Loading users...</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Total Registered Users: <span className="font-semibold text-gray-900">{pagination.total}</span>
              </p>
            </div>
            
            {users.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No users found</p>
            ) : (
              <div className="rounded-md border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: any) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{user.email}</TableCell>
                        <TableCell>
                          {user.isEmailVerified ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                              Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Unverified
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.isAdmin ? (
                            <Badge variant="default" className="bg-blue-100 text-blue-800 text-xs">
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              User
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {pagination.total > 10 && (
              <div className="mt-4 text-center">
                <Link href="/admin/users">
                  <Button variant="outline" size="sm">
                    View All {pagination.total} Users
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

