import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Part } from "@/lib/mock-data";

export const Route = createFileRoute("/owner/inventory")({
  component: Inventory,
});

function Inventory() {
  const { state, update } = useStore();
  const cats = ["All", ...Array.from(new Set(state.inventory.map((p) => p.category)))];
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = state.inventory.filter((p) =>
    (cat === "All" || p.category === cat) &&
    (q === "" || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()))
  );

  const add = (form: FormData) => {
    const part: Part = {
      id: "p" + Date.now(),
      name: form.get("name") as string,
      sku: form.get("sku") as string,
      category: form.get("category") as string,
      stock: Number(form.get("stock")),
      reorderLevel: Number(form.get("reorder")),
      unitCost: Number(form.get("cost")),
      supplier: form.get("supplier") as string,
    };
    update((s) => ({ ...s, inventory: [...s.inventory, part] }));
    toast.success("Part added");
    setOpen(false);
  };

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Track parts and reorder levels." action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber text-[color:var(--amber-foreground)] hover:bg-amber/90"><Plus className="mr-2 h-4 w-4" /> Add part</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add part</DialogTitle></DialogHeader>
            <form action={add} className="space-y-3">
              <div><Label>Name</Label><Input name="name" required className="mt-1" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>SKU</Label><Input name="sku" required className="mt-1" /></div>
                <div><Label>Category</Label><Input name="category" defaultValue="Parts" className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Stock</Label><Input name="stock" type="number" defaultValue="0" className="mt-1" /></div>
                <div><Label>Reorder</Label><Input name="reorder" type="number" defaultValue="5" className="mt-1" /></div>
                <div><Label>Unit cost</Label><Input name="cost" type="number" defaultValue="0" className="mt-1" /></div>
              </div>
              <div><Label>Supplier</Label><Input name="supplier" className="mt-1" /></div>
              <DialogFooter><Button type="submit" className="bg-amber text-[color:var(--amber-foreground)]">Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      } />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search part or SKU…" className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card className="bg-surface">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Part</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Reorder</th>
                  <th className="px-4 py-3 text-right">Unit cost</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const low = p.stock <= p.reorderLevel;
                  return (
                    <tr key={p.id} className={cn("border-t border-border", low && "bg-amber/5")}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.name}</div>
                        {low && <span className="font-mono text-[10px] uppercase tracking-widest text-amber">Reorder</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                      <td className="px-4 py-3"><span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase">{p.category}</span></td>
                      <td className={cn("px-4 py-3 text-right font-mono", low && "text-amber font-bold")}>{p.stock}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">{p.reorderLevel}</td>
                      <td className="px-4 py-3 text-right font-mono">${p.unitCost}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.supplier}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
