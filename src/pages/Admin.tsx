import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Upload, Users } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import ProductImport from "@/components/admin/ProductImport";
import UserManagement from "@/components/admin/UserManagement";

const Admin = () => {
  const { role, loading } = useUserRole();
  const [activeTab, setActiveTab] = useState("import");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-muted-foreground">Access denied. Admin role required.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 shadow-glow">
          <Shield className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Admin Panel
          </h1>
          <p className="text-muted-foreground">Manage products, users, and roles</p>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Administration</CardTitle>
          <CardDescription>Import products and manage user access</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="import" className="gap-2">
                <Upload className="h-4 w-4" />
                Product Import
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                User Management
              </TabsTrigger>
            </TabsList>

            <TabsContent value="import" className="space-y-4 mt-6">
              <ProductImport />
            </TabsContent>

            <TabsContent value="users" className="space-y-4 mt-6">
              <UserManagement />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;
