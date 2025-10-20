import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { calculatePrice, formatCurrency } from "@/lib/pricing";
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface OrderItem {
  product_id: string;
  code: string;
  description: string;
  quantity: number;
  unit_price: number;
  retailPrice: number;
  dealerPrice: number;
}

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateOrderDialog({ open, onOpenChange }: CreateOrderDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const { role } = useUserRole();
  const queryClient = useQueryClient();

  // Search products
  const { data: products } = useQuery({
    queryKey: ['products-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          code,
          description,
          product_pricing!inner (
            retail_price,
            dealer_price
          ),
          stock (
            quantity
          )
        `)
        .or(`code.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
    enabled: searchQuery.length >= 2,
  });

  const addProduct = (product: any) => {
    console.log('Adding product:', product);
    // Handle both array and object formats
    const pricing = Array.isArray(product.product_pricing) 
      ? product.product_pricing[0] 
      : product.product_pricing;
    console.log('Product pricing:', pricing);
    if (!pricing || !pricing.retail_price || !pricing.dealer_price) {
      console.error('No pricing found for product:', product);
      toast({
        title: "Error",
        description: "Product pricing not found",
        variant: "destructive",
      });
      return;
    }

    const existingItem = orderItems.find(item => item.product_id === product.id);
    if (existingItem) {
      updateQuantity(product.id, existingItem.quantity + 1);
      return;
    }

    const newItem: OrderItem = {
      product_id: product.id,
      code: product.code,
      description: product.description,
      quantity: 1,
      unit_price: pricing.dealer_price,
      retailPrice: pricing.retail_price,
      dealerPrice: pricing.dealer_price,
    };

    setOrderItems([newItem, ...orderItems]);
    setSearchQuery("");
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    // Allow 0 quantity - items with 0 will be removed on save
    if (newQuantity < 0) {
      return;
    }
    setOrderItems(items =>
      items.map(item =>
        item.product_id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const removeProduct = (productId: string) => {
    setOrderItems(items => items.filter(item => item.product_id !== productId));
  };

  const calculateOrderTotalBeforeDiscount = () => {
    return orderItems.reduce((sum, item) => {
      const basePrice = role === 'counter_staff' || !role ? item.retailPrice : item.dealerPrice;
      return sum + (basePrice * item.quantity);
    }, 0);
  };

  const getDiscountPercent = () => {
    const total = calculateOrderTotalBeforeDiscount();
    
    let discountPercent = 0;
    switch (role) {
      case 'dealer_6':
        if (total > 1063900) {
          discountPercent = 6;
        } else if (total > 510205) {
          discountPercent = 2;
        }
        break;
      case 'dealer_4':
        if (total > 1041700) {
          discountPercent = 4;
        } else if (total > 510205) {
          discountPercent = 2;
        }
        break;
      case 'dealer_marketing':
        if (total > 2500000) {
          discountPercent = 4;
        }
        break;
    }
    return discountPercent;
  };

  const calculateOrderTotal = () => {
    const total = calculateOrderTotalBeforeDiscount();
    const discountPercent = getDiscountPercent();
    return total * (1 - discountPercent / 100);
  };

  const calculateItemPrice = (item: OrderItem) => {
    const basePrice = role === 'counter_staff' || !role ? item.retailPrice : item.dealerPrice;
    const discountPercent = getDiscountPercent();
    return basePrice * (1 - discountPercent / 100);
  };

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      // Filter out items with 0 quantity
      const validItems = orderItems.filter(item => item.quantity > 0);
      
      if (validItems.length === 0) {
        throw new Error("Order must have at least one item with quantity greater than 0");
      }

      const discountPercent = getDiscountPercent();

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items with calculated discount (only valid items)
      const itemsToInsert = validItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: role === 'counter_staff' || !role ? item.retailPrice : item.dealerPrice,
        discount: discountPercent,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return order;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Order created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setOrderItems([]);
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create order: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const orderTotal = calculateOrderTotal();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1 text-base sm:text-lg">
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" />
            Create New Order
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Search for products and add them to the order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Product Search */}
          <div className="space-y-2">
            <Label className="text-xs sm:text-sm">Search Products</Label>
            <div className="relative">
              <Search className="absolute left-2 sm:left-3 top-2.5 sm:top-3 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 sm:pl-9 text-xs sm:text-sm h-8 sm:h-10"
              />
            </div>
            {products && products.length > 0 && (
              <div className="border rounded-lg max-h-32 sm:max-h-48 overflow-y-auto">
                {products.map((product: any) => {
                  const pricing = Array.isArray(product.product_pricing) 
                    ? product.product_pricing[0] 
                    : product.product_pricing;
                  const totalStock = Array.isArray(product.stock) 
                    ? product.stock.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0)
                    : 0;
                  const isOutOfStock = totalStock === 0;
                  const displayPrice = role === 'counter_staff' || !role 
                    ? pricing?.retail_price 
                    : pricing?.dealer_price;

                  return (
                    <button
                      key={product.id}
                      onClick={() => !isOutOfStock && addProduct(product)}
                      disabled={isOutOfStock}
                      className="w-full flex items-center justify-between gap-2 p-2 sm:p-3 hover:bg-muted transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-xs sm:text-sm">{product.code}</span>
                          {isOutOfStock && (
                            <Badge variant="destructive" className="text-[10px] sm:text-xs px-1 py-0">
                              Out of Stock
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{product.description}</div>
                        {displayPrice && (
                          <div className="text-xs font-semibold text-primary mt-0.5">
                            {formatCurrency(displayPrice)}
                          </div>
                        )}
                      </div>
                      {!isOutOfStock && (
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Order Items */}
          {orderItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">Order Items</Label>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] sm:text-xs px-0">Code</TableHead>
                      <TableHead className="text-[10px] sm:text-xs px-0 hidden lg:table-cell">Desc</TableHead>
                      <TableHead className="text-[10px] sm:text-xs text-center px-0">Qty</TableHead>
                      <TableHead className="text-[10px] sm:text-xs text-right px-0 hidden md:table-cell">Price</TableHead>
                      <TableHead className="text-[10px] sm:text-xs text-right px-0">Disc%</TableHead>
                      <TableHead className="text-[10px] sm:text-xs text-right px-0">Total</TableHead>
                      <TableHead className="w-[20px] sm:w-[40px] px-0"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item) => {
                      const unitPrice = calculateItemPrice(item);
                      const itemTotal = unitPrice * item.quantity;
                      const discountPercent = getDiscountPercent();
                      return (
                        <TableRow key={item.product_id}>
                          <TableCell className="font-medium text-[10px] sm:text-xs px-0">
                            <div className="truncate max-w-[100px] sm:max-w-none">{item.code}</div>
                          </TableCell>
                          <TableCell className="text-[10px] sm:text-xs px-0 hidden lg:table-cell truncate max-w-[100px]">{item.description}</TableCell>
                          <TableCell className="px-0">
                            <Input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 0)}
                              className="w-14 sm:w-20 text-center h-8 sm:h-9 text-xs sm:text-sm mx-auto px-1"
                            />
                          </TableCell>
                          <TableCell className="text-right text-[10px] sm:text-xs px-0 hidden md:table-cell">{formatCurrency(unitPrice)}</TableCell>
                          <TableCell className="text-right text-[10px] sm:text-xs px-0">{discountPercent}%</TableCell>
                          <TableCell className="text-right font-semibold text-[10px] sm:text-xs px-0">{formatCurrency(itemTotal)}</TableCell>
                          <TableCell className="px-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0"
                              onClick={() => removeProduct(item.product_id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Order Summary */}
              <div className="flex justify-between items-center p-2 sm:p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Items: {orderItems.length}</div>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {role || 'counter_staff'}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-xs sm:text-sm text-muted-foreground">Total</div>
                  <div className="text-lg sm:text-2xl font-bold text-primary">
                    {formatCurrency(orderTotal)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-10"
          >
            Cancel
          </Button>
          <Button
            onClick={() => createOrderMutation.mutate()}
            disabled={orderItems.filter(item => item.quantity > 0).length === 0 || createOrderMutation.isPending}
            className="gradient-primary w-full sm:w-auto text-xs sm:text-sm h-8 sm:h-10"
          >
            {createOrderMutation.isPending ? "Creating..." : "Create Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
