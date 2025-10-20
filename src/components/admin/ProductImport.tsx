import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { productSchema } from "@/lib/validation";

interface ProductRow {
  code: string;
  description: string;
  stock: number;
  dealerPrice: number;
  retailPrice: number;
}

interface ImportResult {
  newItems: string[];
  pricesUpdated: string[];
  stockUpdated: string[];
  errors: number;
}

const ProductImport = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const parseExcelFile = (file: File): Promise<ProductRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);

          const products: ProductRow[] = json
            .map((row: any) => {
              try {
                const parsed = {
                  code: String(row['Item No.'] || '').trim(),
                  description: String(row['Item Description'] || '').trim(),
                  stock: parseInt(String(row['Total'] || '0').replace(/,/g, '')) || 0,
                  dealerPrice: parseFloat(String(row['SPDLR'] || '0').replace(/,/g, '')) || 0,
                  retailPrice: parseFloat(String(row['RE'] || '0').replace(/,/g, '')) || 0,
                };
                
                // Validate each product row
                productSchema.parse(parsed);
                return parsed;
              } catch (error) {
                console.warn('Invalid product row:', row, error);
                return null;
              }
            })
            .filter((p): p is ProductRow => p !== null && !!p.code && !!p.description);

          resolve(products);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const processBatch = async (batch: ProductRow[], unitId: string) => {
    const results = await Promise.allSettled(
      batch.map(async (product) => {
        const changes = {
          code: product.code,
          isNew: false,
          priceUpdated: false,
          stockUpdated: false
        };

        // Check if product exists
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id, product_pricing(retail_price, dealer_price), stock(quantity)')
          .eq('code', product.code)
          .maybeSingle();

        let productId: string;

        if (existingProduct) {
          // Update existing product
          await supabase
            .from('products')
            .update({
              description: product.description,
              unit_id: unitId,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProduct.id);

          productId = existingProduct.id;

          // Check if prices changed
          const existingPricing = Array.isArray(existingProduct.product_pricing) 
            ? existingProduct.product_pricing[0] 
            : existingProduct.product_pricing;
          
          if (existingPricing) {
            if (existingPricing.retail_price !== product.retailPrice || 
                existingPricing.dealer_price !== product.dealerPrice) {
              changes.priceUpdated = true;
            }
          } else {
            changes.priceUpdated = true;
          }
        } else {
          // Insert new product
          const { data: newProduct } = await supabase
            .from('products')
            .insert({
              code: product.code,
              description: product.description,
              unit_id: unitId
            })
            .select('id')
            .single();

          productId = newProduct!.id;
          changes.isNew = true;
          changes.priceUpdated = true; // New products always have prices set
        }

        // Upsert pricing
        await supabase
          .from('product_pricing')
          .upsert({
            product_id: productId,
            retail_price: product.retailPrice,
            dealer_price: product.dealerPrice
          }, {
            onConflict: 'product_id'
          });

        // Check and update stock for TRU location
        const { data: existingStock } = await supabase
          .from('stock')
          .select('id, quantity')
          .eq('product_id', productId)
          .eq('location', 'TRU')
          .maybeSingle();

        if (existingStock) {
          if (existingStock.quantity !== product.stock) {
            changes.stockUpdated = true;
          }
          await supabase
            .from('stock')
            .update({ quantity: product.stock })
            .eq('id', existingStock.id);
        } else {
          changes.stockUpdated = true;
          await supabase
            .from('stock')
            .insert({
              product_id: productId,
              location: 'TRU',
              quantity: product.stock
            });
        }

        return changes;
      })
    );

    return results;
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setImporting(true);
    setProgress(null);
    const importDetails: ImportResult = {
      newItems: [],
      pricesUpdated: [],
      stockUpdated: [],
      errors: 0
    };

    try {
      const products = await parseExcelFile(file);
      toast.info(`Processing ${products.length} products in batches...`);

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

      const unitId = unitData.id;
      const BATCH_SIZE = 50;
      
      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        const batchResults = await processBatch(batch, unitId);
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            const changes = result.value;
            if (changes.isNew) {
              importDetails.newItems.push(changes.code);
            }
            if (changes.priceUpdated && !changes.isNew) {
              importDetails.pricesUpdated.push(changes.code);
            }
            if (changes.stockUpdated && !changes.isNew) {
              importDetails.stockUpdated.push(changes.code);
            }
          } else {
            importDetails.errors++;
          }
        });
        
        setProgress({ 
          current: Math.min(i + BATCH_SIZE, products.length), 
          total: products.length 
        });
      }

      setResult(importDetails);
      setProgress(null);
      
      const totalProcessed = importDetails.newItems.length + 
        importDetails.pricesUpdated.length + 
        importDetails.stockUpdated.length;
      
      toast.success(`Import complete! ${totalProcessed} products processed`);
      if (importDetails.errors > 0) {
        toast.warning(`${importDetails.errors} products failed`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error("Failed to import products");
      setProgress(null);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="file">Upload Excel File</Label>
          <p className="text-sm text-muted-foreground mb-2">
            Upload an Excel file with columns: Item No., Item Description, Total, SPDLR, RE
          </p>
          <Input
            id="file"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={importing}
          />
        </div>

        {file && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Selected file: {file.name}
            </AlertDescription>
          </Alert>
        )}

        {progress && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Processing: {progress.current} / {progress.total} products ({Math.round((progress.current / progress.total) * 100)}%)
            </AlertDescription>
          </Alert>
        )}

        {result && !progress && (
          <div className="space-y-3">
            <Alert variant={result.errors > 0 ? "destructive" : "default"}>
              {result.errors > 0 ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-semibold">Import Summary:</div>
                  
                  {result.newItems.length > 0 && (
                    <div>
                      <div className="font-medium text-green-600">New Items Added ({result.newItems.length}):</div>
                      <div className="text-sm mt-1 max-h-32 overflow-y-auto">
                        {result.newItems.join(', ')}
                      </div>
                    </div>
                  )}
                  
                  {result.pricesUpdated.length > 0 && (
                    <div>
                      <div className="font-medium text-blue-600">Prices Updated ({result.pricesUpdated.length}):</div>
                      <div className="text-sm mt-1 max-h-32 overflow-y-auto">
                        {result.pricesUpdated.join(', ')}
                      </div>
                    </div>
                  )}
                  
                  {result.stockUpdated.length > 0 && (
                    <div>
                      <div className="font-medium text-orange-600">Stock Updated ({result.stockUpdated.length}):</div>
                      <div className="text-sm mt-1 max-h-32 overflow-y-auto">
                        {result.stockUpdated.join(', ')}
                      </div>
                    </div>
                  )}
                  
                  {result.errors > 0 && (
                    <div className="font-medium text-red-600">
                      Failed: {result.errors} products
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={!file || importing}
          className="gradient-primary"
        >
          <Upload className="mr-2 h-4 w-4" />
          {importing ? "Importing..." : "Import Products"}
        </Button>
      </div>
    </div>
  );
};

export default ProductImport;
