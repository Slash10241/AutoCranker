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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const amber: [number, number, number] = [245, 158, 11];
    const dark: [number, number, number] = [30, 30, 30];
    const muted: [number, number, number] = [120, 120, 120];

    // ===== Header band =====
    doc.setFillColor(...amber);
    doc.rect(0, 0, pageWidth, 26, "F");
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(GARAGE_INFO.name, margin, 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(GARAGE_INFO.tagline, margin, 20);

    // Right-aligned doc meta inside header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("QUOTATION", pageWidth - margin, 14, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`#${c.id}`, pageWidth - margin, 20, { align: "right" });

    // ===== Garage contact block =====
    doc.setTextColor(...muted);
    doc.setFontSize(8.5);
    let y = 33;
    doc.text(GARAGE_INFO.address, margin, y);
    doc.text(`${GARAGE_INFO.phone}  ·  ${GARAGE_INFO.email}  ·  ${GARAGE_INFO.website}`, margin, y + 4);

    // Divider
    y += 10;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);

    // ===== Bill-to / Vehicle two-column block =====
    y += 7;
    const colW = (pageWidth - margin * 2) / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text("BILL TO", margin, y);
    doc.text("VEHICLE", margin + colW, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...dark);
    doc.text(cu.name, margin, y + 6);
    doc.text(cu.phone, margin, y + 11);
    doc.text(cu.email, margin, y + 16);

    doc.text(`${v.year} ${v.make} ${v.model}`, margin + colW, y + 6);
    doc.text(`Plate: ${v.plate}`, margin + colW, y + 11);
    doc.text(`VIN: ${v.vin}`, margin + colW, y + 16);

    // ===== Issue / Service meta =====
    y += 24;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text("ISSUE DATE", margin, y);
    doc.text("VALID UNTIL", margin + 50, y);
    doc.text("SERVICE", margin + 100, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...dark);
    const issue = new Date();
    const valid = new Date(); valid.setDate(valid.getDate() + 14);
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    doc.text(fmt(issue), margin, y + 6);
    doc.text(fmt(valid), margin + 50, y + 6);
    doc.text(c.service, margin + 100, y + 6, { maxWidth: pageWidth - margin - (margin + 100) });

    // ===== Line items table =====
    const partsSubtotal = c.lineItems.filter((li) => li.type === "part").reduce((s, li) => s + li.qty * li.unitCost, 0);
    const laborSubtotal = c.lineItems.filter((li) => li.type === "labor").reduce((s, li) => s + li.qty * li.unitCost, 0);
    const taxRate = 0.0875;
    const tax = total * taxRate;
    const grand = total + tax;

    autoTable(doc, {
      startY: y + 16,
      head: [["#", "Description", "Type", "Qty", "Unit", "Amount"]],
      body: c.lineItems.map((li, i) => [
        String(i + 1),
        li.name,
        li.type === "labor" ? "Labor" : "Part",
        li.qty.toString(),
        `$${li.unitCost.toFixed(2)}`,
        `$${(li.qty * li.unitCost).toFixed(2)}`,
      ]),
      styles: { fontSize: 9.5, cellPadding: 3, textColor: dark },
      headStyles: { fillColor: dark, textColor: 255, fontStyle: "bold", fontSize: 9 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        2: { cellWidth: 18 },
        3: { halign: "right", cellWidth: 16 },
        4: { halign: "right", cellWidth: 24 },
        5: { halign: "right", cellWidth: 28 },
      },
      margin: { left: margin, right: margin },
    });

    let endY = (doc as any).lastAutoTable.finalY + 8;

    // ===== Totals box (right aligned) =====
    const totalsX = pageWidth - margin - 70;
    const rowH = 6;
    const drawRow = (label: string, value: string, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(bold ? 11 : 9.5);
      doc.text(label, totalsX, endY);
      doc.text(value, pageWidth - margin, endY, { align: "right" });
      endY += rowH;
    };
    doc.setTextColor(...dark);
    drawRow("Parts subtotal", `$${partsSubtotal.toFixed(2)}`);
    drawRow("Labor subtotal", `$${laborSubtotal.toFixed(2)}`);
    drawRow("Subtotal", `$${total.toFixed(2)}`);
    drawRow(`Tax (${(taxRate * 100).toFixed(2)}%)`, `$${tax.toFixed(2)}`);
    endY += 1;
    doc.setDrawColor(...amber);
    doc.setLineWidth(0.5);
    doc.line(totalsX, endY - 2, pageWidth - margin, endY - 2);
    endY += 3;
    drawRow("TOTAL DUE", `$${grand.toFixed(2)}`, true);

    // ===== Notes / Terms =====
    endY += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text("TERMS & NOTES", margin, endY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...dark);
    const terms = [
      "· Quotation valid for 14 days from issue date.",
      "· Parts pricing subject to change based on supplier availability.",
      "· Additional repairs discovered during service will be quoted separately for approval.",
      "· Approved work authorizes Coppi Garage to perform the listed services.",
    ];
    terms.forEach((t, i) => doc.text(t, margin, endY + 6 + i * 4.5));

    // ===== Footer =====
    const footY = doc.internal.pageSize.getHeight() - 10;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, footY - 4, pageWidth - margin, footY - 4);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`${GARAGE_INFO.name} · ${GARAGE_INFO.website}`, margin, footY);
    doc.text("Thank you for your business.", pageWidth - margin, footY, { align: "right" });

    doc.save(`${GARAGE_INFO.name.replace(/\s+/g, "-")}-quotation-${c.id}.pdf`);
    setPdfGenerated(true);
    toast.success("Quotation PDF generated");
  };

  const sendEstimate = () => {
    updateCase((c) => ({
      ...c, status: "Awaiting Customer Approval", pipelineStep: 2,
      timeline: [...c.timeline, { at: new Date().toISOString(), label: "Estimate sent to customer" }],
    }));
    toast.success("Estimate sent");
    navigate({ to: "/owner/cases" });
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
                disabled={!pdfGenerated}
                className="bg-amber text-[color:var(--amber-foreground)] hover:bg-amber/90"
              >
                <Send className="mr-2 h-4 w-4" /> Send estimate to customer
              </Button>
            </div>
            {!pdfGenerated && c.lineItems.length > 0 && (
              <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Generate the PDF quotation to enable sending
              </p>
            )}
          </section>

        </div>

        <div className="space-y-6">
          <section className="space-y-3 rounded-lg border border-border bg-surface/40 p-4">
            <div>
              <Label>Assigned technician</Label>
              <Select value={c.mechanicId} onValueChange={(v) => updateCase((c) => ({ ...c, mechanicId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{state.mechanics.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Internal notes</Label>
              <Textarea value={c.internalNotes} onChange={(e) => updateCase((c) => ({ ...c, internalNotes: e.target.value }))} className="mt-1" />
            </div>
          </section>

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
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="grid aspect-square place-items-center rounded-md bg-surface-2 font-mono text-[10px] text-muted-foreground">
              {emptyLabel} {i + 1}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
