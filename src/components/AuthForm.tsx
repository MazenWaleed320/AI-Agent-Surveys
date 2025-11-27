import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, Briefcase, ClipboardList, Plus, Minus } from "lucide-react";

const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!", description: "Successfully signed in." });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              full_name: fullName,
              department,
              role,
            },
          },
        });
        if (error) throw error;

        toast({
          title: "Account created!",
          description: "You can now sign in to access the platform.",
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-primary-glow p-4 relative overflow-hidden">
      {/* Animated HR Sign - Top Left */}
      <div className="absolute top-16 left-8 animate-bounce hidden md:block" style={{ animationDelay: '0s', animationIterationCount: 'infinite' }}>
        <div className="flex flex-col items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-border/50">
          <Briefcase className="h-8 w-8 text-primary animate-pulse" style={{ animationIterationCount: 'infinite' }} />
          <span className="text-sm font-semibold text-foreground">HR</span>
        </div>
      </div>

      {/* Animated Positive Sign - Top Right */}
      <div className="absolute top-16 right-8 animate-bounce hidden md:block" style={{ animationDelay: '0.5s', animationIterationCount: 'infinite' }}>
        <div className="flex flex-col items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-border/50">
          <Plus className="h-8 w-8 text-green-500 animate-pulse" style={{ animationIterationCount: 'infinite' }} />
          <span className="text-sm font-semibold text-foreground">Positive</span>
        </div>
      </div>

      {/* Animated Employees Sign - Left Middle */}
      <div className="absolute top-1/2 -translate-y-1/2 left-8 animate-bounce hidden md:block" style={{ animationDelay: '1s', animationIterationCount: 'infinite' }}>
        <div className="flex flex-col items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-border/50">
          <Users className="h-8 w-8 text-primary animate-pulse" style={{ animationIterationCount: 'infinite' }} />
          <span className="text-sm font-semibold text-foreground">Employees</span>
        </div>
      </div>

      {/* Animated Negative Sign - Right Middle */}
      <div className="absolute top-1/2 -translate-y-1/2 right-8 animate-bounce hidden md:block" style={{ animationDelay: '1.5s', animationIterationCount: 'infinite' }}>
        <div className="flex flex-col items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-border/50">
          <Minus className="h-8 w-8 text-red-500 animate-pulse" style={{ animationIterationCount: 'infinite' }} />
          <span className="text-sm font-semibold text-foreground">Negative</span>
        </div>
      </div>

      {/* Animated Surveys Sign - Bottom Center */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 animate-bounce hidden md:block" style={{ animationDelay: '2s', animationIterationCount: 'infinite' }}>
        <div className="flex flex-col items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg p-4 shadow-lg border border-border/50">
          <ClipboardList className="h-8 w-8 text-primary animate-pulse" style={{ animationIterationCount: 'infinite' }} />
          <span className="text-sm font-semibold text-foreground">Surveys</span>
        </div>
      </div>

      {/* Mobile: Show all signs in a grid above the card */}
      <div className="md:hidden absolute top-8 left-1/2 -translate-x-1/2 flex flex-wrap gap-3 w-full max-w-md px-4 justify-center">
        <div className="flex flex-col items-center gap-1 bg-card/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border/50 animate-bounce" style={{ animationDelay: '0s', animationIterationCount: 'infinite' }}>
          <Briefcase className="h-6 w-6 text-primary animate-pulse" style={{ animationIterationCount: 'infinite' }} />
          <span className="text-xs font-semibold text-foreground">HR</span>
        </div>
        <div className="flex flex-col items-center gap-1 bg-card/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border/50 animate-bounce" style={{ animationDelay: '0.5s', animationIterationCount: 'infinite' }}>
          <Plus className="h-6 w-6 text-green-500 animate-pulse" style={{ animationIterationCount: 'infinite' }} />
          <span className="text-xs font-semibold text-foreground">Positive</span>
        </div>
        <div className="flex flex-col items-center gap-1 bg-card/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border/50 animate-bounce" style={{ animationDelay: '1s', animationIterationCount: 'infinite' }}>
          <Users className="h-6 w-6 text-primary animate-pulse" style={{ animationIterationCount: 'infinite' }} />
          <span className="text-xs font-semibold text-foreground">Employees</span>
        </div>
        <div className="flex flex-col items-center gap-1 bg-card/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border/50 animate-bounce" style={{ animationDelay: '1.5s', animationIterationCount: 'infinite' }}>
          <Minus className="h-6 w-6 text-red-500 animate-pulse" style={{ animationIterationCount: 'infinite' }} />
          <span className="text-xs font-semibold text-foreground">Negative</span>
        </div>
        <div className="flex flex-col items-center gap-1 bg-card/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-border/50 animate-bounce" style={{ animationDelay: '2s', animationIterationCount: 'infinite' }}>
          <ClipboardList className="h-6 w-6 text-primary animate-pulse" style={{ animationIterationCount: 'infinite' }} />
          <span className="text-xs font-semibold text-foreground">Surveys</span>
        </div>
      </div>

      <Card className="w-full max-w-md relative z-10">
        <CardHeader>
          <CardTitle>{isLogin ? "Sign In" : "Create Account"}</CardTitle>
          <CardDescription>
            {isLogin ? "Welcome back to the Employee Feedback Platform" : "Join the Employee Feedback Platform"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select value={department} onValueChange={setDepartment} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Engineering">Engineering</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                      <SelectItem value="HR">Human Resources</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="Product">Product</SelectItem>
                      <SelectItem value="Customer Support">Customer Support</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthForm;
