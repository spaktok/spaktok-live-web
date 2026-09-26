export interface Product {
  id: string
  name: string
  description: string
  priceInCents: number
}

export const PRODUCTS: Product[] = [
  { id: '1', name: 'Wireless Noise-Cancelling Headphones', description: 'Premium wireless headphones', priceInCents: 29900 },
  { id: '2', name: 'Limited Edition Luxury Handbag', description: 'Luxury handbag', priceInCents: 18900 },
  { id: '3', name: 'Smart Health Watch', description: 'Smart watch with health sensors', priceInCents: 19900 },
  { id: '4', name: 'Korean Skincare Set', description: 'Complete skincare set', priceInCents: 7900 },
  { id: '5', name: 'Lightweight Running Shoes', description: 'Performance running shoes', priceInCents: 12900 },
  { id: '6', name: 'Smart Voice-Controlled LED Lamp', description: 'Smart home lighting', priceInCents: 4500 },
]

export function getProduct(productId: string) {
  return PRODUCTS.find((product) => product.id === productId)
}

