import { useState, FormEvent } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Link as LinkIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setNeedsVerification(false);

    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        email,
        password,
      });

      if (response.ok) {
        toast({
          title: "Login successful!",
          description: "Redirecting to your dashboard...",
        });
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 500);
      } else {
        const error = await response.json();
        if (error.needsVerification) setNeedsVerification(true);

        toast({
          title: "Login failed",
          description: error.error || "Invalid email or password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      await apiRequest("POST", "/api/auth/resend-verification", { email });
      toast({
        title: "Verification email sent",
        description: "Please check your email inbox.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to resend verification email",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-secondary/10 to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <Link href="/">
            <a className="inline-flex items-center gap-3 mb-2 hover:opacity-80 transition-opacity">
              <LinkIcon className="w-10 h-10 text-primary" />
              <span className="text-3xl font-display font-bold text-charcoal">
                LinkBoard
              </span>
            </a>
          </Link>
          <p className="text-gray-600">
            Welcome back! Log in to your account.
          </p>
        </div>

        <Card className="shadow-xl border-gray-200">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-display font-bold">
              Log In
            </CardTitle>
            <CardDescription>
              Enter your email and password to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {needsVerification && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-800 font-medium">
                      Email not verified
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      Please verify your email address before logging in.
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      className="text-amber-700 hover:text-amber-800 p-0 h-auto mt-2"
                      onClick={handleResendVerification}
                    >
                      Resend verification email
                    </Button>
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 placeholder:text-gray-400"
                  />
                </div>
              </div>

              {/* Password Field with Toggle */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password">
                    <a className="text-sm text-primary hover:text-primary-light transition-colors">
                      Forgot password?
                    </a>
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 pr-10 placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary-light text-white font-semibold py-3"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Log In"}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link href="/register">
                <a className="text-primary hover:text-primary-light font-semibold transition-colors">
                  Sign up
                </a>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-500">
          <Link href="/">
            <a className="hover:text-gray-700 transition-colors">← Back to home</a>
          </Link>
        </div>
      </div>
    </div>
  );
}
