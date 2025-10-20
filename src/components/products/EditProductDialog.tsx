import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { productSchema } from "@/lib/validation";

interface EditProductDialogProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EditProductDialog = ({ product, open, onOpenChange }: EditProductDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const pricing = product.product_pricing;
  const [formData, setFormData] = useState({
    code: product.code || "",
    description: product.description || "",
    retailPrice: pricing?.retail_price || 0,
    dealerPrice: pricing?.dealer_price || 0,
  });

  const updateProductMutation = useMutation({
    mutationFn: async () => {
      // Validate input data
      const validatedData = productSchema.parse({
        code: formData.code,
        description: formData.description,
        retailPrice: formData.retailPrice,
        dealerPrice: formData.dealerPrice,
        stock: 0, // Not updating stock here, so just pass validation
      });

      // Update product basic info
      const { error: productError } = await supabase
        .from("products")
        .update({
          code: validatedData.code,
          description: validatedData.description,
        })
        .eq("id", product.id);

      if (productError) throw productError;

      // Update pricing
      const { error: pricingError } = await supabase
        .from("product_pricing")
        .update({
          retail_price: validatedData.retailPrice,
          dealer_price: validatedData.dealerPrice,
        })
        .eq("product_id", product.id);

      if (pricingError) throw pricingError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      const message = error.name === 'ZodError' 
        ? error.errors[0].message 
        : error.message;
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProductMutation.mutateAsync();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>Update product details and pricing</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Product Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="retailPrice">Retail Price</Label>
              <Input
                id="retailPrice"
                type="number"
                step="0.01"
                value={formData.retailPrice}
                onChange={(e) => setFormData({ ...formData, retailPrice: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dealerPrice">Dealer Price</Label>
              <Input
                id="dealerPrice"
                type="number"
                step="0.01"
                value={formData.dealerPrice}
                onChange={(e) => setFormData({ ...formData, dealerPrice: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductDialog;
