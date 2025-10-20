import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Edit, Trash2, Package } from "lucide-react";
import AddProductDialog from "@/components/products/AddProductDialog";
import EditProductDialog from "@/components/products/EditProductDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { calculatePrice, formatCurrency } from "@/lib/pricing";

const Products = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const { role, loading: roleLoading } = useUserRole();
  const pageSize = 50;

  // Fetch products with pricing and stock - server-side search and pagination
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', searchQuery, page],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          id,
          code,
          description,
          units (name),
          product_pricing (
            retail_price,
            dealer_price
          ),
          stock (
            location,
            quantity
          )
        `, { count: 'exact' });

      // Server-side search
      if (searchQuery) {
        query = query.or(`code.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      query = query
        .order('code')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      return { products: data || [], totalCount: count || 0 };
    },
  });

  const products = productsData?.products || [];
  const totalPages = Math.ceil((productsData?.totalCount || 0) / pageSize);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Products
          </h1>
          <p className="text-muted-foreground">Manage your product inventory</p>
        </div>
        <AddProductDialog />
      </div>

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product Inventory</CardTitle>
              <CardDescription>A list of all products in your store</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading || roleLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No products found</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product: any) => {
                  const totalStock = product.stock?.reduce(
                    (sum: number, s: any) => sum + s.quantity,
                    0
                  ) || 0;
                  const pricing = product.product_pricing;
                  const price = calculatePrice(
                    {
                      retailPrice: pricing?.retail_price || 0,
                      dealerPrice: pricing?.dealer_price || 0,
                    },
                    role,
                    0
                  );
                  
                  return (
                    <TableRow key={product.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{product.code}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500">
                            <Package className="h-4 w-4 text-white" />
                          </div>
                          {product.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.units?.name || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatCurrency(price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={totalStock > 100 ? "default" : totalStock > 50 ? "secondary" : "destructive"}>
                          {totalStock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {role === 'admin' && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-8 w-8 p-0"
                              onClick={() => setEditingProduct(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, productsData?.totalCount || 0)} of {productsData?.totalCount || 0} products
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
          )}
        </CardContent>
      </Card>

      {editingProduct && (
        <EditProductDialog
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
        />
      )}
    </div>
  );
};

export default Products;
