import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Check if user is admin
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tables, format = 'csv' } = await req.json();

    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return new Response(JSON.stringify({ error: 'No tables specified' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allowedTables = ['products', 'product_pricing', 'orders', 'order_items', 'user_roles', 'stock', 'activity_logs'];
    const validTables = tables.filter(t => allowedTables.includes(t));

    if (validTables.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid tables specified' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const exportData: Record<string, any[]> = {};

    // Fetch data from each table
    for (const table of validTables) {
      let query = supabaseClient.from(table).select('*');
      
      // Limit activity logs to prevent huge exports
      if (table === 'activity_logs') {
        query = query.order('created_at', { ascending: false }).limit(1000);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error(`Error fetching ${table}:`, error);
        continue;
      }

      exportData[table] = data || [];
    }

    if (format === 'json') {
      return new Response(JSON.stringify({ data: exportData }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convert to CSV format
    let csv = '';
    
    for (const [tableName, rows] of Object.entries(exportData)) {
      if (rows.length === 0) continue;

      csv += `\n### ${tableName.toUpperCase()} ###\n`;
      
      // Get headers from first row
      const headers = Object.keys(rows[0]);
      csv += headers.join(',') + '\n';

      // Add data rows
      for (const row of rows) {
        const values = headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          
          // Handle objects and arrays
          if (typeof value === 'object') {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }
          
          // Escape quotes and wrap in quotes if contains comma
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          
          return stringValue;
        });
        
        csv += values.join(',') + '\n';
      }
      
      csv += '\n';
    }

    return new Response(JSON.stringify({ csv }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
