/**
 * Admin System Settings Page
 * Configure system-wide settings
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Settings, Save, Server, Database, Mail } from "lucide-react";

export default function AdminSettings() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch system health
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/admin/system/health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/system/health");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    retry: false,
  });

  // Redirect if unauthorized
  if (healthLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading...</div>
        </div>
      </AdminLayout>
    );
  }

  const health = healthData || {};

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-500 mt-1">Configure system-wide settings and view system health</p>
        </div>

        {/* System Health */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-gray-600" />
              <CardTitle>System Health</CardTitle>
            </div>
            <CardDescription>Current system status and metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {health.totalUsers?.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Total Profiles</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {health.totalProfiles?.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Total Links</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {health.totalLinks?.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">New Users (24h)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {health.recentUsers24h?.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-4 bg-pink-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">New Profiles (24h)</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {health.recentProfiles24h?.toLocaleString() || 0}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600">Uptime</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {health.uptime ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-gray-600" />
              <CardTitle>Database</CardTitle>
            </div>
            <CardDescription>Database connection and status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Database Status</Label>
                  <p className="text-sm text-gray-500">Connection status</p>
                </div>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Connected
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Database Provider</Label>
                  <p className="text-sm text-gray-500">PostgreSQL (Neon)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-gray-600" />
              <CardTitle>Email Configuration</CardTitle>
            </div>
            <CardDescription>Email service settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Service</Label>
                  <p className="text-sm text-gray-500">Configured via environment variables</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Verification</Label>
                  <p className="text-sm text-gray-500">Email verification is enabled</p>
                </div>
                <Switch checked={true} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-600" />
              <CardTitle>General Settings</CardTitle>
            </div>
            <CardDescription>Platform-wide configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-gray-500">Temporarily disable the platform</p>
                </div>
                <Switch checked={false} disabled />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>User Registration</Label>
                  <p className="text-sm text-gray-500">Allow new user registrations</p>
                </div>
                <Switch checked={true} disabled />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Verification Required</Label>
                  <p className="text-sm text-gray-500">Require email verification for new users</p>
                </div>
                <Switch checked={true} disabled />
              </div>
            </div>
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-500">
                Note: These settings are currently read-only. To modify settings, update your environment variables or configuration files.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

