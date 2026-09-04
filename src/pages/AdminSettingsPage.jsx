import React, { useState, useEffect } from "react";
import { usePortal } from "@/lib/portalContext";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Save, MessageCircle } from "lucide-react";

export default function AdminSettingsPage() {
  const { portal, refresh } = usePortal();
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (portal?.adminSettings[0]) setSettings({ ...portal.adminSettings[0] });
  }, [portal]);

  if (!settings) return <div className="animate-pulse h-72 rounded-lg bg-muted" />;

  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.AdminSettings.update(settings.id, {
        whatsapp_number: settings.whatsapp_number,
        whatsapp_enabled: settings.whatsapp_enabled,
        support_message: settings.support_message,
        minimum_attendance_percentage: Number(settings.minimum_attendance_percentage),
        current_academic_year_id: settings.current_academic_year_id,
        active_semester: Number(settings.active_semester),
        updated_at: new Date().toISOString(),
      });
      toast({ title: "Settings saved" });
      refresh();
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const whatsappUrl = settings.whatsapp_number
    ? `https://wa.me/${settings.whatsapp_number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(settings.support_message || "")}`
    : null;

  return (
    <div>
      <PageHeader title="Admin Settings" description="Configure portal-wide options" action={<Button onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Attendance Requirement</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Minimum Attendance %</Label>
              <Input type="number" min={50} max={100} value={settings.minimum_attendance_percentage} onChange={(e) => update("minimum_attendance_percentage", e.target.value)} />
            </div>
            <div>
              <Label>Active Semester</Label>
              <Input type="number" value={settings.active_semester} onChange={(e) => update("active_semester", e.target.value)} />
            </div>
            <div>
              <Label>Current Academic Year</Label>
              <Select value={settings.current_academic_year_id} onValueChange={(v) => update("current_academic_year_id", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {portal.years.map((y) => <SelectItem key={y.id} value={y.id}>{y.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>WhatsApp Support</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Enable WhatsApp contact button</Label>
                <p className="text-xs text-muted-foreground">Shown on login & forgot-password pages</p>
              </div>
              <Switch checked={settings.whatsapp_enabled} onCheckedChange={(v) => update("whatsapp_enabled", v)} />
            </div>
            <div>
              <Label>WhatsApp Number</Label>
              <Input placeholder="e.g. 919876543210" value={settings.whatsapp_number || ""} onChange={(e) => update("whatsapp_number", e.target.value)} />
            </div>
            <div>
              <Label>Support Message</Label>
              <Textarea value={settings.support_message || ""} onChange={(e) => update("support_message", e.target.value)} />
            </div>
            {whatsappUrl && settings.whatsapp_enabled && (
              <Button asChild variant="outline">
                <a href={whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" /> Preview WhatsApp Link</a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}