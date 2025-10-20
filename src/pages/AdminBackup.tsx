import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, Database, Package, Users, ShoppingCart } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const AdminBackup = () => {
  const { toast } = useToast();
  const [selectedTables, setSelectedTables] = useState<string[]>([
    'products',
    'product_pricing',
    'orders',
    'order_items',
    'user_roles',
    'stock',
  ]);

  const tables = [
    { name: 'products', label: 'Products', icon: Package },
    { name: 'product_pricing', label: 'Product Pricing', icon: Database },
    { name: 'orders', label: 'Orders', icon: ShoppingCart },
    { name: 'order_items', label: 'Order Items', icon: FileSpreadsheet },
    { name: 'user_roles', label: 'User Roles', icon: Users },
    { name: 'stock', label: 'Stock', icon: Database },
    { name: 'activity_logs', label: 'Activity Logs', icon: FileSpreadsheet },
  ];

  const toggleTable = (tableName: string) => {
    setSelectedTables(prev =>
      prev.includes(tableName)
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
  };

  const exportMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('export-database', {
        body: { tables: selectedTables }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Create a download link for the CSV file
      const blob = new Blob([data.csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: "Database export downloaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const exportJSON = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('export-database', {
        body: { tables: selectedTables, format: 'json' }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export successful",
        description: "Database export downloaded as JSON",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Database Backup & Export</h1>
        <p className="text-muted-foreground mt-2">
          Export your database tables for backup or data analysis
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Select Tables to Export</CardTitle>
            <CardDescription>Choose which tables you want to include in the export</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tables.map((table) => {
              const Icon = table.icon;
              return (
                <div key={table.name} className="flex items-center space-x-3">
                  <Checkbox
                    id={table.name}
                    checked={selectedTables.includes(table.name)}
                    onCheckedChange={() => toggleTable(table.name)}
                  />
                  <label
                    htmlFor={table.name}
                    className="flex items-center space-x-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{table.label}</span>
                  </label>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export as CSV</CardTitle>
              <CardDescription>
                Download selected tables as a CSV file for use in Excel or other spreadsheet applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => exportMutation.mutate()}
                disabled={selectedTables.length === 0 || exportMutation.isPending}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {exportMutation.isPending ? 'Exporting...' : 'Export to CSV'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export as JSON</CardTitle>
              <CardDescription>
                Download selected tables as a JSON file for programmatic use or backup
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                variant="secondary"
                onClick={() => exportJSON.mutate()}
                disabled={selectedTables.length === 0 || exportJSON.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                {exportJSON.isPending ? 'Exporting...' : 'Export to JSON'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="text-sm">Export Information</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Exports include all data from selected tables</p>
              <p>• Activity logs are limited to the most recent 1000 entries</p>
              <p>• Large exports may take a few moments to process</p>
              <p>• Store backups securely as they contain sensitive data</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminBackup;
