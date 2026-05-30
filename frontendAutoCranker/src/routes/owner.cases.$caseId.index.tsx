import { useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useStore, statusColor } from "@/lib/store";
import { type LineItem, CASE_STATUSES, type CaseStatus, GARAGE_INFO } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ArrowLeft, Send, Trash2, Plus, MessageCircle, Bot, Camera, ClipboardCheck, Wrench, Sparkles, Loader2, FileText } from "lucide-react";
import carPhoto1 from "@/assets/car-photo-1.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { buildQuotationPdf, quotationPdfToBase64 } from "@/lib/build-quotation-pdf";
import { formatDateTimeUTC } from "@/lib/format-date";
import { seedChatSummaries } from "@/lib/mock-chats";
import { api } from "@/lib/api";

export const Route = createFileRoute("/owner/cases/$caseId/")({
  component: CaseDetailPage,
});

function CaseDetailPage() {
  const { caseId } = Route.useParams();
  const { state, update, patchBackendCase } = useStore();
  const navigate = useNavigate();
  const c = state.cases.find((x) => x.id === caseId);

  if (!c) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h2 className="font-display text-2xl font-bold">Case not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">Case {caseId} doesn't exist.</p>
        <Link to="/owner/cases" className="mt-6 inline-flex items-center gap-2 rounded-md bg-amber px-4 py-2 text-sm font-semibold text-[color:var(--amber-foreground)]">
          <ArrowLeft className="h-4 w-4" /> Back to board
        </Link>
      </div>
    );
  }

  const v = state.vehicles.find((x) => x.id === c.vehicleId)!;
  const cu = state.customers.find((x) => x.id === c.customerId)!;
  const [summaryLoading, setSummaryLoading] = useState(false);
  const chatSummary: string = c.chatSummary ?? seedChatSummaries[caseId] ?? "";
  const total = c.lineItems.reduce((s, li) => s + li.qty * li.unitCost, 0);
  const inspectionReport: string = c.inspectionReport ?? "";
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [pdfGenerated, setPdfGenerated] = useState(false);

  const handleGenerateChatSummary = async () => {
    if (!c._backendId) {
      toast.error("This case is not synced with the backend");
      return;
    }
    setSummaryLoading(true);
    try {
      const { summary } = await api.generateChatSummary(c._backendId);
      updateCase((prev) => ({ ...prev, chatSummary: summary }));
    } catch {
      toast.error("Failed to generate summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  const updateCase = (fn: (c: any) => any) =>
    update((s) => ({ ...s, cases: s.cases.map((x) => x.id === caseId ? fn(x) : x) }));

  const setInspectionReport = (text: string) =>
    updateCase((prev) => ({ ...prev, inspectionReport: text }));

  const invalidatePdf = () => setPdfGenerated(false);

  const addItem = () => {
    const li: LineItem = { id: "li" + Date.now(), name: "New item", qty: 1, unitCost: 0, type: "part" };
    updateCase((c) => ({ ...c, lineItems: [...c.lineItems, li] }));
    invalidatePdf();
  };
  const updateItem = (id: string, patch: Partial<LineItem>) => {
    updateCase((c) => ({ ...c, lineItems: c.lineItems.map((li: LineItem) => li.id === id ? { ...li, ...patch } : li) }));
    invalidatePdf();
  };
  const removeItem = (id: string) => {
    updateCase((c) => ({ ...c, lineItems: c.lineItems.filter((li: LineItem) => li.id !== id) }));
    invalidatePdf();
  };

  const handleGenerateQuotation = async () => {
    if (!inspectionReport.trim()) {
      toast.error("Write an inspection report first");
      return;
    }
    if (!c._backendId) {
      toast.error("This case is not synced with the backend");
      return;
    }
    setGenerating(true);
    try {
      await api.submitInspection(c._backendId, { raw_notes: inspectionReport });
      const quotation = await api.generateQuotation(c._backendId);
      const items: LineItem[] = quotation.items.map((item, i) => ({
        id: `li-${quotation.id}-${i}`,
        name: item.description,
        qty: item.quantity,
        unitCost: item.unit_price,
        type: item.item_type === "labor" ? "labor" : "part",
      }));
      updateCase((prev) => ({
        ...prev,
        lineItems: items,
        status: "Awaiting Customer Approval",
        pipelineStep: 2,
        internalNotes: quotation.internal_summary ?? prev.internalNotes,
        timeline: [
          ...prev.timeline,
          { at: new Date().toISOString(), label: "AI quotation generated" },
        ],
      }));
      invalidatePdf();
      toast.success(`Generated ${items.length} line items (${quotation.currency} ${quotation.total.toFixed(2)})`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to generate quotation";
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const setStatus = (s: CaseStatus) => {
    updateCase((c) => ({
      ...c, status: s,
      timeline: [...c.timeline, { at: new Date().toISOString(), label: `Moved to ${s}` }],
    }));
    patchBackendCase(caseId, s).catch(() => {
      toast.error("Status saved locally but failed to sync with server");
    });
    toast.success(`Moved to ${s}`);
  };

  const generatePdf = () => {
    if (c.lineItems.length === 0) return;
    const doc = buildQuotationPdf(c, cu, v, c.lineItems);
    doc.save(`${GARAGE_INFO.name.replace(/\s+/g, "-")}-quotation-${c.id}.pdf`);
    setPdfGenerated(true);
  };

  const sendEstimate = async () => {
    if (c.lineItems.length === 0) {
      toast.error("Add line items before sending an estimate");
      return;
    }
    if (!c._backendId) {
      toast.error("This case is not synced with the backend");
      return;
    }

    setSending(true);
    try {
      const doc = buildQuotationPdf(c, cu, v, c.lineItems);
      const pdfBase64 = quotationPdfToBase64(doc);
      let summaryText: string | undefined;
      try {
        const quotation = await api.getQuotation(c._backendId);
        summaryText = quotation.customer_explanation ?? undefined;
      } catch {
        // no persisted quotation yet — send intro only
      }

      await api.sendQuotationToCustomer(c._backendId, {
        pdf_base64: pdfBase64,
        filename: `quotation-${c.id}.pdf`,
        summary_text: summaryText,
      });

      updateCase((prev) => ({
        ...prev,
        status: "Awaiting Customer Approval",
        pipelineStep: 2,
        timeline: [
          ...prev.timeline,
          { at: new Date().toISOString(), label: "Estimate sent to customer" },
        ],
      }));
      patchBackendCase(caseId, "Awaiting Customer Approval").catch(() => {
        toast.error("Sent to WhatsApp but failed to sync case status");
      });
      navigate({ to: "/owner/cases" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to send estimate";
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/owner/cases" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-amber">
        <ArrowLeft className="h-3 w-3" /> Back to board
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-amber">{c.id}</div>
          <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">{c.service}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Opened {c.daysOpen} day(s) ago</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/owner/cases/$caseId/chat"
            params={{ caseId }}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground hover:border-amber/60 hover:text-amber"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp transcript
          </Link>
          <span className={cn("rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider", statusColor(c.status))}>{c.status}</span>
          <Select value={c.status} onValueChange={(v) => setStatus(v as CaseStatus)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface/40 p-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Customer</div>
              <div className="text-sm">{cu.name}</div>
              <div className="font-mono text-xs text-muted-foreground">{cu.phone}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Vehicle</div>
              <div className="text-sm">{v.year} {v.make} {v.model}</div>
              <div className="font-mono text-xs text-muted-foreground">{v.plate} · {v.vin}</div>
            </div>
            <div className="col-span-2 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Bot className="h-3 w-3" /> AI chat summary
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateChatSummary}
                  disabled={summaryLoading}
                  className="h-7 text-xs"
                >
                  {summaryLoading
                    ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Generating…</>
                    : <><Sparkles className="mr-1 h-3 w-3" /> Generate summary</>
                  }
                </Button>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/90">
                {chatSummary || <span className="text-muted-foreground italic">No summary yet — click "Generate summary" to create one.</span>}
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Vehicle photos</h4>
                <p className="mt-1 text-xs text-muted-foreground">Check-in snapshots taken at drop-off and inspection findings from the bay.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PhotoDialog
                  title="Check-in photos"
                  trigger={<><Camera className="h-3.5 w-3.5" /> View check-in photos</>}
                  emptyLabel="Check-in"
                  count={4}
                />
                <PhotoDialog
                  title="Inspection photos"
                  trigger={<><ClipboardCheck className="h-3.5 w-3.5" /> View inspection photos</>}
                  emptyLabel="Inspection"
                  count={6}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Wrench className="h-3 w-3" /> Inspection report
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">Technician's findings from the inspection bay. Used by AI to draft the quotation.</p>
              </div>
              <Button
                size="sm"
                onClick={handleGenerateQuotation}
                disabled={generating}
                className="bg-amber text-[color:var(--amber-foreground)] hover:bg-amber/90"
              >
                {generating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                {generating ? "Generating..." : "Generate quotation"}
              </Button>
            </div>
            <Textarea
              value={inspectionReport}
              onChange={(e) => setInspectionReport(e.target.value)}
              placeholder="e.g. Front brake pads worn to 2mm, rotors scored. Left CV boot torn with grease leak. Engine air filter heavily clogged. Recommend pad+rotor replacement, CV axle replacement, and air filter swap."
              className="mt-3 min-h-[120px]"
            />
          </section>

          <section>
            <div className="flex items-center justify-between">
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Estimate builder</h4>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="mr-1 h-3 w-3" /> Add line</Button>
            </div>

            <div className="mt-2 overflow-hidden rounded-md border border-border bg-surface/40">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-surface-2/60">
                  <tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Part / Labor</th>
                    <th className="w-[110px] px-3 py-2 text-left font-medium">Type</th>
                    <th className="w-[80px] px-3 py-2 text-right font-medium">Qty</th>
                    <th className="w-[120px] px-3 py-2 text-right font-medium">Cost / unit</th>
                    <th className="w-[120px] px-3 py-2 text-right font-medium">Total</th>
                    <th className="w-[40px] px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {c.lineItems.map((li) => (
                    <tr key={li.id} className="border-t border-border align-middle">
                      <td className="px-2 py-1.5">
                        <Input
                          value={li.name}
                          onChange={(e) => updateItem(li.id, { name: e.target.value })}
                          placeholder={li.type === "labor" ? "Labor description" : "Part name"}
                          className="h-8 border-transparent bg-transparent focus-visible:border-border"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={li.type} onValueChange={(v: any) => updateItem(li.id, { type: v })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="part">Part</SelectItem>
                            <SelectItem value="labor">Labor</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          min={0}
                          value={li.qty}
                          onChange={(e) => updateItem(li.id, { qty: parseFloat(e.target.value) || 0 })}
                          className="h-8 text-right"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={li.unitCost}
                            onChange={(e) => updateItem(li.id, { unitCost: parseFloat(e.target.value) || 0 })}
                            className="h-8 pl-5 text-right"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-sm tabular-nums">
                        ${(li.qty * li.unitCost).toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          onClick={() => removeItem(li.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {c.lineItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center font-mono text-xs text-muted-foreground">
                        No line items yet. Click "Add line" to start building the estimate.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-md bg-amber/10 px-4 py-3">
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Total</span>
              <span className="font-display text-2xl font-bold text-amber">${total.toFixed(2)}</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                onClick={generatePdf}
                disabled={c.lineItems.length === 0}
                variant="outline"
              >
                <FileText className="mr-2 h-4 w-4" /> Generate PDF quotation
              </Button>
              <Button
                onClick={sendEstimate}
                disabled={c.lineItems.length === 0 || sending}
                className="bg-amber text-[color:var(--amber-foreground)] hover:bg-amber/90"
              >
                {sending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" /> Send estimate to customer</>
                )}
              </Button>
            </div>
            {!pdfGenerated && c.lineItems.length > 0 && (
              <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Optional: download a PDF preview before sending to WhatsApp
              </p>
            )}
          </section>

        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-surface/40 p-4">
            <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Timeline</h4>
            <ol className="mt-3 space-y-2 border-l border-border pl-3">
              {c.timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[15px] top-1.5 h-2 w-2 rounded-full bg-amber" />
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">{formatDateTimeUTC(t.at)}</div>
                  <div className="text-sm">{t.label}</div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function PhotoDialog({ title, trigger, emptyLabel, count }: { title: string; trigger: ReactNode; emptyLabel: string; count: number }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground hover:border-amber/60 hover:text-amber">
          {trigger}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: count }).map((_, i) =>
            i === 0 ? (
              <img
                key={i}
                src={carPhoto1}
                alt={`${emptyLabel} 1`}
                className="aspect-square w-full rounded-md object-cover"
              />
            ) : (
              <div key={i} className="grid aspect-square place-items-center rounded-md bg-surface-2 font-mono text-[10px] text-muted-foreground">
                {emptyLabel} {i + 1}
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
