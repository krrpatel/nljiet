import React, { useMemo } from "react";
import { usePortal } from "@/lib/portalContext";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, Receipt, AlertCircle, ExternalLink } from "lucide-react";

export default function FeesPage() {
  const { student, academic, portal, loading } = usePortal();

  const fee = academic?.feeStatus;
  const receipts = academic?.feeReceipts || [];
  const totalPaid = useMemo(() => receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0), [receipts]);
  const outstanding = Number(fee?.outstanding_amount);
  const payable = Number(fee?.payable_amount);
  const emiAmount = Number(fee?.emi_amount);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 w-32 rounded bg-muted" /><div className="grid grid-cols-3 gap-4">{Array.from({length:3}).map((_,i)=><div key={i} className="h-28 rounded-lg bg-muted" />)}</div></div>;

  return (
    <div>
      <PageHeader title="Fees" description={`${student?.full_name || "Student"} • ${student?.enrollment_number || "—"}`} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Outstanding" value={fee && Number.isFinite(outstanding) ? `₹${outstanding.toLocaleString("en-IN")}` : "—"} sub={fee?.emi_enabled ? "EMI enabled" : "—"} icon={AlertCircle} accent={outstanding > 0 ? "rose" : "emerald"} />
        <StatCard label="Payable Now" value={fee && Number.isFinite(payable) ? `₹${payable.toLocaleString("en-IN")}` : "—"} sub={fee?.due_date ? `Due ${new Date(fee.due_date).toLocaleDateString()}` : "—"} icon={Wallet} accent="amber" />
        <StatCard label="Total Paid" value={`₹${totalPaid.toLocaleString()}`} sub={`${receipts.length} receipts`} icon={Receipt} accent="emerald" />
      </div>

      {fee?.emi_enabled && emiAmount > 0 && (
        <Card className="mt-4 border-blue-200 bg-blue-50">
          <CardContent className="py-4 text-sm text-blue-800">
            EMI plan active — pay <span className="font-semibold">₹{emiAmount.toLocaleString("en-IN")}</span> per installment.
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>Previous Receipts</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher</TableHead><TableHead>Date</TableHead><TableHead>Fee Type</TableHead>
                <TableHead>Transaction</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((r, index) => (
                <TableRow key={r.id || r.voucher_number || index}>
                  <TableCell className="font-medium">{r.voucher_number}</TableCell>
                  <TableCell>{r.receipt_date ? new Date(r.receipt_date).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{r.fee_type}</TableCell>
                  <TableCell className="text-muted-foreground">{r.transaction_number}</TableCell>
                  <TableCell className="text-right font-semibold">₹{(Number(r.amount) || 0).toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    {r.external_receipt_url && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={r.external_receipt_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {receipts.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No receipts on record yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
