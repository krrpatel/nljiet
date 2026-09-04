import React, { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

// "Need help? Contact Admin" link using the WhatsApp number configured by the
// admin in Admin Settings — never hardcoded in the frontend.
export default function WhatsAppHelp({ className }) {
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    let cancelled = false;
    base44.entities.AdminSettings.list()
      .then((settings) => { if (!cancelled) setCfg(settings[0] || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!cfg?.whatsapp_enabled || !cfg?.whatsapp_number) return null;

  const digits = String(cfg.whatsapp_number).replace(/[^0-9]/g, "");
  if (!digits) return null;
  const message = cfg.support_message || "Hello, I need help with my student portal account.";
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={
        className ||
        "inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
      }
    >
      <MessageCircle className="w-4 h-4" aria-hidden="true" />
      Need help? Contact Admin
    </a>
  );
}