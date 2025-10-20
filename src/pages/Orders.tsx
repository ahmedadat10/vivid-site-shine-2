import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye } from "lucide-react";
import CreateOrderDialog from "@/components/orders/CreateOrderDialog";
import OrderDetailsDialog from "@/components/orders/OrderDetailsDialog";
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
import { useAuth } from "@/integrations/supabase/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { formatCurrency } from "@/lib/pricing";
import { toast } from "@/hooks/use-toast";

const Orders = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const { user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  
  // Fetch only current user's orders
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['orders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
      .from('orders')
        .select(`
          id,
          order_number,
          created_at,
          user_id,
          order_items (
            id,
            quantity,
            unit_price,
            discount
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleViewOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailsDialogOpen(true);
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-500 w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold mb-0.5 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Orders
          </h1>
          <p className="text-muted-foreground text-xs">Manage and track your orders</p>
        </div>
        <Button 
          className="gradient-primary hover:shadow-glow transition-all duration-300 w-full sm:w-auto text-xs"
          size="sm"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="mr-1.5 h-3 w-3" />
          Create Order
        </Button>
      </div>

      <CreateOrderDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
      />

      <OrderDetailsDialog
        orderId={selectedOrderId}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />

      <Card className="glass-card">
        <CardHeader className="p-3 sm:p-4">
          <div>
            <CardTitle className="text-sm sm:text-base">My Orders</CardTitle>
            <CardDescription className="text-xs">View and manage your orders</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading || roleLoading ? (
            <div className="text-center py-6 text-muted-foreground text-xs">Loading orders...</div>
          ) : error ? (
            <div className="text-center py-6 text-red-600 text-xs">Error loading orders: {error.message}</div>
          ) : !orders || orders.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs">No orders found</div>
          ) : (
            <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-8 px-2 text-xs whitespace-nowrap">Order ID</TableHead>
                      <TableHead className="h-8 px-2 text-xs whitespace-nowrap">Date & Time</TableHead>
                      <TableHead className="h-8 px-2 text-xs whitespace-nowrap">Items</TableHead>
                      <TableHead className="h-8 px-2 text-xs text-right whitespace-nowrap">Amount</TableHead>
                      <TableHead className="h-8 px-2 text-xs text-right whitespace-nowrap w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order: any) => {
                      const itemCount = order.order_items?.length || 0;
                      const totalAmount = order.order_items?.reduce(
                        (sum: number, item: any) => {
                          const itemPrice = parseFloat(item.unit_price) * item.quantity;
                          const discountAmount = itemPrice * (parseFloat(item.discount || 0) / 100);
                          return sum + (itemPrice - discountAmount);
                        },
                        0
                      ) || 0;
                      
                      return (
                        <TableRow key={order.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="py-2 px-2 font-medium text-xs">{order.order_number || `#${order.id.slice(0, 6).toUpperCase()}`}</TableCell>
                          <TableCell className="py-2 px-2 text-muted-foreground text-[10px] sm:text-xs">
                            <div className="flex flex-col">
                              <span>{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                              <span className="text-[9px] sm:text-[10px]">{new Date(order.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2 px-2">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{itemCount}</Badge>
                          </TableCell>
                          <TableCell className="py-2 px-2 text-right font-semibold text-primary text-xs">
                            {formatCurrency(totalAmount)}
                          </TableCell>
                          <TableCell className="py-2 px-2 text-right">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 w-6 p-0"
                              onClick={() => handleViewOrder(order.id)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Orders;
