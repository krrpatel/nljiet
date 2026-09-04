import React, { useState, useEffect } from "react";
import { usePortal } from "@/lib/portalContext";
import { api } from "@/api/client";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Save, MessageCircle, Bot } from "lucide-react";

export default function AdminSettingsPage() {
  const { portal, refresh } = usePortal();
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);

  useEffect(() => {
    if (portal?.adminSettings[0]) setSettings({ ...portal.adminSettings[0] });
    else if (portal) setSettings({ minimum_attendance_percentage: 75, maximum_lectures: 250, active_semester: 1, whatsapp_enabled: false, whatsapp_number: "", support_message: "" });
  }, [portal]);

  if (!settings) return <div className="animate-pulse h-72 rounded-lg bg-muted" />;

  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        whatsapp_number: settings.whatsapp_number,
        whatsapp_enabled: settings.whatsapp_enabled,
        support_message: settings.support_message,
        minimum_attendance_percentage: Number(settings.minimum_attendance_percentage),
        maximum_lectures: Math.min(250, Math.max(1, Number(settings.maximum_lectures) || 250)),
        current_academic_year_id: settings.current_academic_year_id || null,
        active_semester: Number(settings.active_semester),
        updated_at: new Date().toISOString(),
      };
      if (settings.id) await api.entities.AdminSettings.update(settings.id, payload);
      else await api.entities.AdminSettings.create(payload);
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

  const testAi = async () => {
    setAiTesting(true);
    try { const result = await api.functions.invoke("testAi", { provider: settings.ai_provider || "openai", model: settings.ai_model || "gpt-4o-mini" }); toast({ title: "AI API connected", description: result.data?.message || "Test completed successfully." }); }
    catch (e) { toast({ title: "AI API test failed", description: e.message, variant: "destructive" }); }
    finally { setAiTesting(false); }
  };

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
              <Label>Maximum total lectures</Label>
              <Input type="number" min={1} max={250} value={settings.maximum_lectures ?? 250} onChange={(e) => update("maximum_lectures", Math.min(250, Math.max(1, Number(e.target.value) || 1)))} />
              <p className="mt-1 text-xs text-muted-foreground">Used by the student planner to calculate how many lectures can be missed. Maximum allowed: 250.</p>
            </div>
            <div>
              <Label>Active Semester</Label>
              <Input type="number" value={settings.active_semester} onChange={(e) => update("active_semester", e.target.value)} />
            </div>
            <div>
              <Label>Current Academic Year</Label>
              <Select value={settings.current_academic_year_id || ""} onValueChange={(v) => update("current_academic_year_id", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {portal.years.map((y) => <SelectItem key={y.id} value={y.id}>{y.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle><Bot className="mr-2 inline h-5 w-5" />AI Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>AI Provider</Label><Select value={settings.ai_provider || "openai"} onValueChange={(v) => update("ai_provider", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="openai">OpenAI-compatible</SelectItem><SelectItem value="hcnsec">HCNSec</SelectItem><SelectItem value="openrouter">OpenRouter</SelectItem><SelectItem value="gemini">Google Gemini</SelectItem><SelectItem value="mock">Offline mock</SelectItem></SelectContent></Select></div>
            <div><Label>Current AI Model</Label><Input value={settings.ai_model || (settings.ai_provider === "hcnsec" ? "DeepSeek-V4-Pro" : "gpt-4o-mini")} onChange={(e) => update("ai_model", e.target.value)} placeholder="DeepSeek-V4-Pro" /></div>
            <Button type="button" variant="outline" onClick={testAi} disabled={aiTesting}>{aiTesting ? "Testing..." : "Test AI API"}</Button>
            <p className="text-xs text-muted-foreground">API keys stay server-side in environment variables.</p>
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
