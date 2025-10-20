import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, TrendingUp, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  // Fetch products count
  const { data: productsData } = useQuery({
    queryKey: ['products-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch orders count
  const { data: ordersData } = useQuery({
    queryKey: ['orders-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch recent orders
  const { data: recentOrders } = useQuery({
    queryKey: ['recent-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          created_at,
          order_items (
            quantity,
            unit_price
          )
        `)
        .order('created_at', { ascending: false })
        .limit(4);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch top products
  const { data: topProducts } = useQuery({
    queryKey: ['top-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          description,
          order_items (
            quantity,
            unit_price
          )
        `)
        .limit(4);
      if (error) throw error;
      return data || [];
    },
  });

  const stats = [
    {
      title: "Total Products",
      value: productsData?.toString() || "0",
      change: "+12%",
      icon: Package,
      gradient: "from-purple-500 to-violet-500",
    },
    {
      title: "Active Orders",
      value: ordersData?.toString() || "0",
      change: "+8%",
      icon: ShoppingCart,
      gradient: "from-violet-500 to-purple-600",
    },
    {
      title: "Revenue",
      value: "$0",
      change: "+23%",
      icon: DollarSign,
      gradient: "from-purple-600 to-indigo-600",
    },
    {
      title: "Growth",
      value: "0%",
      change: "+5%",
      icon: TrendingUp,
      gradient: "from-indigo-600 to-purple-500",
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index} className="glass-card hover:shadow-glow transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient}`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-green-600 font-medium mt-1">
                {stat.change} from last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest transactions from your store</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders && recentOrders.length > 0 ? (
                recentOrders.map((order: any) => {
                  const totalAmount = order.order_items?.reduce(
                    (sum: number, item: any) => sum + (item.quantity * parseFloat(item.unit_price)),
                    0
                  ) || 0;
                  return (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-semibold text-primary">${totalAmount.toFixed(2)}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          order.status === "completed" ? "bg-green-100 text-green-700" :
                          order.status === "processing" ? "bg-blue-100 text-blue-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground py-4">No orders yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>Best selling items this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topProducts && topProducts.length > 0 ? (
                topProducts.map((product: any, index: number) => {
                  const sales = product.order_items?.reduce(
                    (sum: number, item: any) => sum + item.quantity,
                    0
                  ) || 0;
                  const revenue = product.order_items?.reduce(
                    (sum: number, item: any) => sum + (item.quantity * parseFloat(item.unit_price)),
                    0
                  ) || 0;
                  return (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <p className="font-medium">{product.description}</p>
                        <p className="text-sm text-muted-foreground">{sales} sales</p>
                      </div>
                      <p className="font-semibold text-primary">${revenue.toFixed(2)}</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground py-4">No products yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
