import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { productSchema } from "@/lib/validation";

const AddProductDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { role } = useUserRole();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    code: "",
    description: "",
    retailPrice: "",
    dealerPrice: "",
    stock: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (role !== 'admin') {
      toast.error("Only admins can add products");
      return;
    }

    setLoading(true);

    try {
      // Validate input data
      const validatedData = productSchema.parse({
        code: formData.code,
        description: formData.description,
        retailPrice: parseFloat(formData.retailPrice),
        dealerPrice: parseFloat(formData.dealerPrice),
        stock: parseInt(formData.stock),
      });
      // Get or create default unit
      let { data: unitData } = await supabase
        .from('units')
        .select('id')
        .eq('name', 'PCS')
        .maybeSingle();

      if (!unitData) {
        const { data: newUnit, error: unitError } = await supabase
          .from('units')
          .insert({ name: 'PCS' })
          .select('id')
          .single();

        if (unitError) throw unitError;
        unitData = newUnit;
      }

      // Insert product
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          code: validatedData.code,
          description: validatedData.description,
          unit_id: unitData.id
        })
        .select('id')
        .single();

      if (productError) throw productError;

      // Insert pricing
      const { error: pricingError } = await supabase
        .from('product_pricing')
        .insert({
          product_id: product.id,
          retail_price: validatedData.retailPrice,
          dealer_price: validatedData.dealerPrice
        });

      if (pricingError) throw pricingError;

      // Insert stock
      const { error: stockError } = await supabase
        .from('stock')
        .insert({
          product_id: product.id,
          location: 'TRU',
          quantity: validatedData.stock
        });

      if (stockError) throw stockError;

      toast.success("Product added successfully");
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setOpen(false);
      setFormData({
        code: "",
        description: "",
        retailPrice: "",
        dealerPrice: "",
        stock: "",
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        toast.error(error.message || "Failed to add product");
      }
    } finally {
      setLoading(false);
    }
  };

  if (role !== 'admin') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-primary hover:shadow-glow transition-all duration-300">
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Enter the product details below. All fields are required.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Product Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., AD 1001"
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Adaptor Universal"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="retailPrice">Retail Price (UGX)</Label>
                <Input
                  id="retailPrice"
                  type="number"
                  step="0.01"
                  value={formData.retailPrice}
                  onChange={(e) => setFormData({ ...formData, retailPrice: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dealerPrice">Dealer Price (UGX)</Label>
                <Input
                  id="dealerPrice"
                  type="number"
                  step="0.01"
                  value={formData.dealerPrice}
                  onChange={(e) => setFormData({ ...formData, dealerPrice: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="stock">Initial Stock Quantity</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="0"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gradient-primary">
              {loading ? "Adding..." : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductDialog;
