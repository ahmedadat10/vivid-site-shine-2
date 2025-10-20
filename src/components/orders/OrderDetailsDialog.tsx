import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/pricing";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Pencil, Save, X, Download, Search, Plus, Trash2, Share2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

interface OrderDetailsDialogProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OrderDetailsDialog({ orderId, open, onOpenChange }: OrderDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsToDelete, setItemsToDelete] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { role } = useUserRole();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order-details', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              code,
              description
            )
          )
        `)
        .eq('id', orderId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!orderId && open,
  });

  const calculateTotal = () => {
    const items = isEditing ? editedItems : order?.order_items;
    if (!items) return 0;
    return items.reduce((sum: number, item: any) => {
      const itemPrice = parseFloat(item.unit_price) * item.quantity;
      const discountAmount = itemPrice * (parseFloat(item.discount || 0) / 100);
      return sum + (itemPrice - discountAmount);
    }, 0);
  };

  const calculateDiscountPercent = () => {
    const items = isEditing ? editedItems : order?.order_items;
    if (!items || items.length === 0) return 0;

    // Calculate total before discount
    const totalBeforeDiscount = items.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.unit_price) * item.quantity);
    }, 0);

    // Calculate discount percentage based on role and order total
    let discountPercent = 0;
    switch (role) {
      case 'dealer_6':
        if (totalBeforeDiscount > 1063900) {
          discountPercent = 6;
        } else if (totalBeforeDiscount > 510205) {
          discountPercent = 2;
        }
        break;
      case 'dealer_4':
        if (totalBeforeDiscount > 1041700) {
          discountPercent = 4;
        } else if (totalBeforeDiscount > 510205) {
          discountPercent = 2;
        }
        break;
      case 'dealer_marketing':
        if (totalBeforeDiscount > 2500000) {
          discountPercent = 4;
        }
        break;
    }

    return discountPercent;
  };

  const getTotalWithDiscount = () => {
    const items = isEditing ? editedItems : order?.order_items;
    if (!items || items.length === 0) return 0;
    
    // First calculate total before any discount
    const totalBeforeDiscount = items.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.unit_price) * item.quantity);
    }, 0);
    
    // Calculate discount percentage based on total
    const discountPercent = calculateDiscountPercent();
    
    // Apply discount to the total
    return totalBeforeDiscount * (1 - discountPercent / 100);
  };

  // Search products for adding new items
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
    enabled: searchQuery.length >= 2 && isEditing,
  });

  const handleEdit = () => {
    setIsEditing(true);
    setEditedItems(order?.order_items ? JSON.parse(JSON.stringify(order.order_items)) : []);
    setItemsToDelete([]);
    setSearchQuery("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedItems([]);
    setItemsToDelete([]);
    setSearchQuery("");
  };

  const addProduct = (product: any) => {
    const pricing = Array.isArray(product.product_pricing) 
      ? product.product_pricing[0] 
      : product.product_pricing;
    
    if (!pricing || (!pricing.dealer_price && !pricing.retail_price)) {
      toast({
        title: "Error",
        description: "Product pricing not found",
        variant: "destructive",
      });
      return;
    }

    // Check if product already exists in the order
    const existingItem = editedItems.find(item => item.product_id === product.id);
    if (existingItem) {
      toast({
        title: "Info",
        description: "Product already in order. Update quantity instead.",
      });
      return;
    }

    // Use retail price for counter_staff, dealer price for others
    const unitPrice = role === 'counter_staff' || !role 
      ? pricing.retail_price 
      : pricing.dealer_price;

    const newItem = {
      id: `new-${Date.now()}`, // Temporary ID for new items
      product_id: product.id,
      quantity: 1,
      unit_price: unitPrice,
      discount: 0,
      products: {
        code: product.code,
        description: product.description,
      },
      isNew: true, // Flag to identify new items
    };

    setEditedItems([newItem, ...editedItems]);
    setSearchQuery("");
  };

  const deleteItem = (itemId: string, isNew: boolean) => {
    if (isNew) {
      // Remove from editedItems if it's a new item
      setEditedItems(editedItems.filter(item => item.id !== itemId));
    } else {
      // Mark for deletion if it's an existing item
      setItemsToDelete([...itemsToDelete, itemId]);
      setEditedItems(editedItems.filter(item => item.id !== itemId));
    }
  };

  const updateOrderMutation = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error("No order ID");

      // Calculate the current discount percentage
      const discountPercent = calculateDiscountPercent();

      // Separate items with 0 quantity - these should be deleted
      const itemsWithZeroQty = editedItems.filter(item => item.quantity === 0);
      const validItems = editedItems.filter(item => item.quantity > 0);

      // Add items with 0 quantity to delete list (if they're not new)
      const allItemsToDelete = [
        ...itemsToDelete,
        ...itemsWithZeroQty.filter(item => !item.isNew).map(item => item.id)
      ];

      // Delete removed items and items with 0 quantity
      if (allItemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .in('id', allItemsToDelete);

        if (deleteError) throw deleteError;
      }

      // Check if order would be empty
      if (validItems.length === 0) {
        throw new Error("Order must have at least one item with quantity greater than 0");
      }

      // Update existing items and insert new items (only valid items)
      for (const item of validItems) {
        if (item.isNew) {
          // Insert new item
          const { error: insertError } = await supabase
            .from('order_items')
            .insert({
              order_id: orderId,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount: discountPercent,
            });

          if (insertError) throw insertError;
        } else {
          // Update existing item (quantity and discount)
          const { error: updateError } = await supabase
            .from('order_items')
            .update({
              quantity: item.quantity,
              discount: discountPercent,
            })
            .eq('id', item.id);

          if (updateError) throw updateError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-details', orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsEditing(false);
      toast({
        title: "Order updated",
        description: "Order has been successfully updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExportCSV = () => {
    if (!order?.order_items) return;

    const headers = [
      "linenumb",
      "itemcode",
      "m_itemname",
      "itemtext",
      "itemqnty",
      "m_itemunit",
      "itemrate",
      "itemamnt",
      "discperc",
      "discamnt",
      "taxxperc",
      "taxxamnt",
      "nettamnt",
      "m_itemstok",
      "itemclos"
    ];

    const rows = order.order_items.map((item: any, index: number) => {
      return [
        index + 1,
        `"${item.products?.code || ""}"`,
        `"${item.products?.description || ""}"`,
        "",
        item.quantity,
        "PCS",
        "",
        "",
        `${item.discount || 0}%`,
        "",
        "18%",
        "",
        "",
        "",
        ""
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${order.order_number || order.id.slice(0, 8).toUpperCase()}-Order-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "Order exported to CSV file",
    });
  };

  const handleShareWhatsApp = async () => {
    if (!order?.order_items) return;

    try {
      // Generate CSV content
      const headers = [
        "linenumb",
        "itemcode",
        "m_itemname",
        "itemtext",
        "itemqnty",
        "m_itemunit",
        "itemrate",
        "itemamnt",
        "discperc",
        "discamnt",
        "taxxperc",
        "taxxamnt",
        "nettamnt",
        "m_itemstok",
        "itemclos"
      ];

      const rows = order.order_items.map((item: any, index: number) => {
        return [
          index + 1,
          `"${item.products?.code || ""}"`,
          `"${item.products?.description || ""}"`,
          "",
          item.quantity,
          "PCS",
          "",
          "",
          `${item.discount || 0}%`,
          "",
          "18%",
          "",
          "",
          "",
          ""
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      // Get current user ID for folder organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const fileName = `${user.id}/${order.order_number || order.id.slice(0, 8).toUpperCase()}-Order-${Date.now()}.csv`;
      
      // Upload to Supabase Storage (now private bucket)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('order-exports')
        .upload(fileName, new Blob([csvContent], { type: 'text/csv' }), {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get signed URL (valid for 1 hour)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('order-exports')
        .createSignedUrl(uploadData.path, 3600);

      if (signedUrlError) throw signedUrlError;

      const downloadLink = signedUrlData.signedUrl;
      const orderNumber = order.order_number || `#${order.id.slice(0, 6).toUpperCase()}`;
      
      const message = `Order ${orderNumber} - Download CSV:\n${downloadLink}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      
      window.open(whatsappUrl, '_blank');

      toast({
        title: "Opening WhatsApp",
        description: "Share download link for order CSV",
      });
    } catch (error: any) {
      toast({
        title: "Failed to share",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateItemField = (index: number, field: string, value: any) => {
    const newItems = [...editedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditedItems(newItems);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <DialogTitle className="text-sm sm:text-base">Order Details</DialogTitle>
              <DialogDescription className="text-xs">
                Order {order?.order_number || `#${order?.id.slice(0, 6).toUpperCase()}`}
              </DialogDescription>
            </div>
            <div className="flex gap-1 flex-shrink-0 mr-6 sm:mr-0">
              {!isEditing ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleExportCSV} className="h-7 px-2 text-xs">
                    <Download className="h-3 w-3 sm:mr-1" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleShareWhatsApp} className="h-7 px-2 text-xs">
                    <Share2 className="h-3 w-3 sm:mr-1" />
                    <span className="hidden sm:inline">Share</span>
                  </Button>
                  <Button size="sm" onClick={handleEdit} className="h-7 px-2 text-xs">
                    <Pencil className="h-3 w-3 sm:mr-1" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={handleCancel} className="h-7 px-2 text-xs">
                    <X className="h-3 w-3 sm:mr-1" />
                    <span className="hidden sm:inline">Cancel</span>
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => updateOrderMutation.mutate()} 
                    disabled={editedItems.filter(item => item.quantity > 0).length === 0 || updateOrderMutation.isPending} 
                    className="h-7 px-2 text-xs"
                  >
                    <Save className="h-3 w-3 sm:mr-1" />
                    <span className="hidden sm:inline">Save</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-6 text-xs">Loading order details...</div>
        ) : !order ? (
          <div className="text-center py-6 text-xs">Order not found</div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {/* Order Info */}
            <div className="p-2 sm:p-3 bg-muted rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium text-xs sm:text-sm">{new Date(order.created_at).toLocaleString()}</p>
              </div>
            </div>

            {/* Add Product Search (only when editing) */}
            {isEditing && (
              <div className="space-y-2">
                <Label className="text-xs">Add Products to Order</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search by code or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-7 h-8 text-xs"
                  />
                </div>
                {products && products.length > 0 && (
                  <div className="border rounded-lg max-h-40 overflow-y-auto">
                    {products.map((product: any) => (
                      <button
                        key={product.id}
                        onClick={() => addProduct(product)}
                        className="w-full flex items-center justify-between p-2 hover:bg-muted transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-xs truncate">{product.code}</div>
                          <div className="text-xs text-muted-foreground truncate">{product.description}</div>
                        </div>
                        <Plus className="h-3 w-3 text-primary flex-shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Order Items */}
            <div className="w-full overflow-x-auto">
              <h3 className="font-semibold mb-2 text-xs sm:text-sm">Order Items</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] sm:text-xs px-0 whitespace-nowrap">Code</TableHead>
                    <TableHead className="text-[10px] sm:text-xs px-0 hidden lg:table-cell">Desc</TableHead>
                    <TableHead className="text-[10px] sm:text-xs px-0 text-center whitespace-nowrap">Qty</TableHead>
                    <TableHead className="text-[10px] sm:text-xs px-0 text-right whitespace-nowrap hidden md:table-cell">Price</TableHead>
                    <TableHead className="text-[10px] sm:text-xs px-0 text-right whitespace-nowrap">Disc%</TableHead>
                    <TableHead className="text-[10px] sm:text-xs px-0 text-right whitespace-nowrap">Total</TableHead>
                    {isEditing && <TableHead className="w-6 px-0"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(isEditing ? editedItems : order.order_items)?.map((item: any, index: number) => {
                    const discountPercent = isEditing ? calculateDiscountPercent() : (item.discount || 0);
                    const itemPrice = parseFloat(item.unit_price) * item.quantity;
                    const discountAmount = itemPrice * (discountPercent / 100);
                    const itemTotal = itemPrice - discountAmount;
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-[10px] sm:text-xs px-0 truncate max-w-[100px] sm:max-w-none">{item.products?.code}</TableCell>
                        <TableCell className="text-[10px] sm:text-xs px-0 hidden lg:table-cell truncate max-w-[100px]">{item.products?.description}</TableCell>
                        <TableCell className="text-center px-0">
                          {isEditing ? (
                             <Input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateItemField(index, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-14 sm:w-20 text-center h-8 sm:h-9 text-xs sm:text-sm px-1"
                            />
                          ) : (
                            <span className="text-[10px] sm:text-xs">{item.quantity}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-[10px] sm:text-xs px-0 hidden md:table-cell">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right text-[10px] sm:text-xs px-0">{discountPercent}%</TableCell>
                        <TableCell className="text-right font-semibold text-[10px] sm:text-xs px-0">{formatCurrency(itemTotal)}</TableCell>
                        {isEditing && (
                          <TableCell className="px-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0"
                              onClick={() => deleteItem(item.id, item.isNew)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Total */}
            <div className="flex justify-end items-center gap-2 sm:gap-4 p-2 sm:p-3 bg-muted rounded-lg">
              <span className="text-xs sm:text-base font-semibold">Order Total:</span>
              <span className="text-sm sm:text-xl font-bold text-primary">{formatCurrency(getTotalWithDiscount())}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
