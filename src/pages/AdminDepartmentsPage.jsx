import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/PageHeader";

export default function AdminDepartmentsPage() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [form, setForm] = useState({ name: "", code: "", description: "", active: true, admin_user_ids: [] });
  const [addAdminUserId, setAddAdminUserId] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [depts, usrs] = await Promise.all([
      api.entities.Departments.list(),
      api.functions.invoke("adminUsers", {}).then(result => result.data?.users || []).catch(() => []),
    ]);
    setDepartments(depts);
    setUsers(usrs);
    setLoading(false);
  }

  function openCreate() {
    setEditingDept(null);
    setForm({ name: "", code: "", description: "", active: true, admin_user_ids: [] });
    setAdminEmail("");
    setDialogOpen(true);
  }

  function openEdit(dept) {
    setEditingDept(dept);
    setForm({ name: dept.name, code: dept.code, description: dept.description || "", active: dept.active !== false, admin_user_ids: dept.admin_user_ids || [] });
    setAdminEmail("");
    setDialogOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingDept) {
        await api.entities.Departments.update(editingDept.id, form);
        toast({ title: "Department updated" });
      } else {
        await api.entities.Departments.create(form);
        toast({ title: "Department created" });
      }
      setDialogOpen(false);
      await loadData();
    } catch (error) {
      toast({ title: "Could not save department", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function addAdmin() {
    if (!addAdminUserId || form.admin_user_ids.includes(addAdminUserId)) return;
    setForm(f => ({ ...f, admin_user_ids: [...f.admin_user_ids, addAdminUserId] }));
    setAddAdminUserId("");
  }

  function removeAdmin(uid) {
    setForm(f => ({ ...f, admin_user_ids: f.admin_user_ids.filter(id => id !== uid) }));
  }

  async function addAdminByEmail() {
    const email = adminEmail.trim();
    if (!email) return;
    setAddingAdmin(true);
    try {
      const result = await api.functions.invoke("resolveAdminUser", { email });
      const user = result.data;
      if (!user?.id) throw new Error("Supabase Auth did not return a user UUID.");
      setUsers(current => current.some(existing => existing.id === user.id) ? current : [...current, user]);
      setForm(current => current.admin_user_ids.includes(user.id) ? current : { ...current, admin_user_ids: [...current.admin_user_ids, user.id] });
      setAdminEmail("");
      toast({ title: "Admin mapped", description: `${user.email} (${user.id}) added to this department.` });
    } catch (error) {
      toast({ title: "Could not map admin email", description: error.message, variant: "destructive" });
    } finally {
      setAddingAdmin(false);
    }
  }

  function getUserName(uid) {
    const u = users.find(u => u.id === uid);
    return u ? `${u.full_name} (${u.email})` : uid;
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Manage CSE, AIML, DS departments and their admins"
        action={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Department</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {departments.map(dept => (
          <Card key={dept.id} className={!dept.active ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-primary">{dept.code}</span>
                  {!dept.active && <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(dept)}><Pencil className="h-4 w-4" /></Button>
              </div>
              <p className="text-sm text-muted-foreground">{dept.name}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Dept Admins: {(dept.admin_user_ids || []).length}</span>
                </div>
                {(dept.admin_user_ids || []).length > 0 && (
                  <div className="space-y-1">
                    {dept.admin_user_ids.map(uid => {
                      const u = users.find(u => u.id === uid);
                      return <p key={uid} className="text-xs bg-muted rounded px-2 py-1">{u ? u.full_name : uid}</p>;
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingDept ? "Edit Department" : "Add Department"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Department Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div><Label>Code (e.g. CSE)</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required maxLength={10} /></div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
              <Label>Active (students can see this dept)</Label>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <Label className="text-sm font-semibold">Department Admins</Label>
              <p className="text-xs text-muted-foreground">Enter the email already registered in Supabase Auth. The server resolves it to the Auth UUID before saving.</p>
              <div className="flex gap-2">
                <Input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@example.com" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAdminByEmail(); } }} />
                <Button type="button" variant="outline" onClick={addAdminByEmail} disabled={addingAdmin}>{addingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add email"}</Button>
              </div>
              {users.length > 0 && <p className="text-xs text-muted-foreground">Or select a loaded Auth user:</p>}
              <div className="flex gap-2">
                <Select value={addAdminUserId} onValueChange={setAddAdminUserId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {users.filter(u => !form.admin_user_ids.includes(u.id)).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addAdmin}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-1">
                {form.admin_user_ids.map(uid => (
                  <div key={uid} className="flex items-center justify-between bg-muted rounded px-2 py-1 text-sm">
                    <span>{getUserName(uid)}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-6 text-destructive" onClick={() => removeAdmin(uid)}>Remove</Button>
                  </div>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save Department
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
