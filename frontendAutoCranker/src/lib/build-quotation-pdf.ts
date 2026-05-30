import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { GARAGE_INFO, type Case, type Customer, type LineItem, type Vehicle } from "@/lib/mock-data";

export function buildQuotationPdf(
  c: Case,
  cu: Customer,
  v: Vehicle,
  lineItems: LineItem[],
): jsPDF {
  const total = lineItems.reduce((s, li) => s + li.qty * li.unitCost, 0);
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const amber: [number, number, number] = [245, 158, 11];
  const dark: [number, number, number] = [30, 30, 30];
  const muted: [number, number, number] = [120, 120, 120];

  doc.setFillColor(...amber);
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(GARAGE_INFO.name, margin, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(GARAGE_INFO.tagline, margin, 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("QUOTATION", pageWidth - margin, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`#${c.id}`, pageWidth - margin, 20, { align: "right" });

  doc.setTextColor(...muted);
  doc.setFontSize(8.5);
  let y = 33;
  doc.text(GARAGE_INFO.address, margin, y);
  doc.text(`${GARAGE_INFO.phone}  ·  ${GARAGE_INFO.email}  ·  ${GARAGE_INFO.website}`, margin, y + 4);

  y += 10;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);

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
  if (cu.phone && !cu.phone.startsWith("demo_")) doc.text(cu.phone, margin, y + 11);
  if (cu.email) doc.text(cu.email, margin, y + 16);

  doc.text(`${v.year} ${v.make} ${v.model}`, margin + colW, y + 6);
  if (v.plate) doc.text(`Plate: ${v.plate}`, margin + colW, y + 11);
  if (v.vin) doc.text(`VIN: ${v.vin}`, margin + colW, y + 16);

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
  const valid = new Date();
  valid.setDate(valid.getDate() + 14);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  doc.text(fmt(issue), margin, y + 6);
  doc.text(fmt(valid), margin + 50, y + 6);
  doc.text(c.service, margin + 100, y + 6, { maxWidth: pageWidth - margin - (margin + 100) });

  const partsSubtotal = lineItems.filter((li) => li.type === "part").reduce((s, li) => s + li.qty * li.unitCost, 0);
  const laborSubtotal = lineItems.filter((li) => li.type === "labor").reduce((s, li) => s + li.qty * li.unitCost, 0);
  const taxRate = 0.0875;
  const tax = total * taxRate;
  const grand = total + tax;

  autoTable(doc, {
    startY: y + 16,
    head: [["#", "Description", "Type", "Qty", "Unit", "Amount"]],
    body: lineItems.map((li, i) => [
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

  let endY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

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

  const footY = doc.internal.pageSize.getHeight() - 10;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, footY - 4, pageWidth - margin, footY - 4);
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(`${GARAGE_INFO.name} · ${GARAGE_INFO.website}`, margin, footY);
  doc.text("Thank you for your business.", pageWidth - margin, footY, { align: "right" });

  return doc;
}

export function quotationPdfToBase64(doc: jsPDF): string {
  return doc.output("datauristring").split(",")[1] ?? "";
}
