import { z } from 'zod';

export const productSchema = z.object({
  code: z.string()
    .trim()
    .min(1, 'Product code is required')
    .max(50, 'Product code must be less than 50 characters'),
  description: z.string()
    .trim()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters'),
  retailPrice: z.number()
    .positive('Retail price must be positive')
    .min(0, 'Retail price cannot be negative'),
  dealerPrice: z.number()
    .positive('Dealer price must be positive')
    .min(0, 'Dealer price cannot be negative'),
  stock: z.number()
    .int('Stock must be a whole number')
    .min(0, 'Stock cannot be negative'),
});

export type ProductFormData = z.infer<typeof productSchema>;
