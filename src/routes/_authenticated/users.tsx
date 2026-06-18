import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser, adminDeleteUser } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Loader2, Copy, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users — Admin" }] }),
  component: UsersPage,
});

type UserRow = {
  user_id: string;
  email: string;
  full_name: string;
  role: "admin" | "user";
  total_quizzes: number;
  avg_score_pct: number;
  last_active: string | null;
  created_at: string;
};

function UsersPage() {
  const { role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password: string } | null>(null);
  const createFn = useServerFn(adminCreateUser);
  const deleteFn = useServerFn(adminDeleteUser);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)("admin_list_users");
    if (error) toast.error(error.message);
    setRows((data ?? []) as UserRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (role !== "admin") {
      navigate({ to: "/" });
      return;
    }
    loadUsers();
  }, [role, authLoading, navigate]);

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`Delete ${u.full_name || u.email}? This permanently removes their account and history.`)) return;
    try {
      await deleteFn({ data: { user_id: u.user_id } });
      toast.success("User deleted");
      loadUsers();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    }
  };

  if (authLoading || role !== "admin") {
    return (
      <div className="p-8 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  const userRows = rows.filter((r) => r.role !== "admin");

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="w-7 h-7 text-accent" /> Users
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage practice accounts and review each user's progress.
          </p>
        </div>
        <Button
          className="bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => setOpenCreate(true)}
        >
          <UserPlus className="w-4 h-4 mr-2" /> Create User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All users ({userRows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : userRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users yet. Click "Create User" to add one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground uppercase border-b">
                  <tr>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Quizzes</th>
                    <th className="py-2 pr-4">Avg Score</th>
                    <th className="py-2 pr-4">Last Active</th>
                    <th className="py-2 pr-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {userRows.map((u) => (
                    <tr key={u.user_id} className="hover:bg-muted/40">
                      <td className="py-3 pr-4">
                        <Link
                          to="/users/$userId"
                          params={{ userId: u.user_id }}
                          className="font-medium text-accent hover:underline"
                        >
                          {u.full_name || "—"}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{u.email}</td>
                      <td className="py-3 pr-4">{u.total_quizzes}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="font-semibold">
                          {Number(u.avg_score_pct).toFixed(0)}%
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {u.last_active
                          ? new Date(u.last_active).toLocaleString()
                          : "Never"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(u)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        onCreated={(info) => {
          setOpenCreate(false);
          setCreatedInfo(info);
          loadUsers();
        }}
        createFn={createFn}
      />

      <Dialog open={!!createdInfo} onOpenChange={(o) => !o && setCreatedInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success" /> User created
            </DialogTitle>
            <DialogDescription>
              Share these credentials with the user. The password will not be shown again.
            </DialogDescription>
          </DialogHeader>
          {createdInfo && (
            <div className="space-y-3">
              <CredentialRow label="Email" value={createdInfo.email} />
              <CredentialRow label="Password" value={createdInfo.password} />
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                if (createdInfo)
                  navigator.clipboard.writeText(
                    `Email: ${createdInfo.email}\nPassword: ${createdInfo.password}`,
                  );
                toast.success("Copied to clipboard");
              }}
              variant="outline"
            >
              <Copy className="w-4 h-4 mr-2" /> Copy both
            </Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => setCreatedInfo(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted">
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-mono text-sm">{value}</div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success(`${label} copied`);
        }}
      >
        <Copy className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
  createFn,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (info: { email: string; password: string }) => void;
  createFn: (args: { data: { email: string; password: string; full_name: string } }) => Promise<any>;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFullName("");
    setEmail("");
    setPassword("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createFn({ data: { full_name: fullName, email, password } });
      const info = { email, password };
      reset();
      onCreated(info);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Sets up an account directly. The user signs in with the email and password you set.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cu-name">Full name</Label>
            <Input
              id="cu-name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Brother's name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-email">Email</Label>
            <Input
              id="cu-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-pw">Password</Label>
            <div className="flex gap-2">
              <Input
                id="cu-pw"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
              <Button type="button" variant="outline" onClick={generatePassword}>
                Generate
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
