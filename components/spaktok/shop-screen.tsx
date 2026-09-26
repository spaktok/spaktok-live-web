"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  ShoppingCart,
  Heart,
  Star,
  ChevronLeft,
  Tag,
  Truck,
  Shield,
  Plus,
  Minus,
  X,
  Check,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  seller: {
    username: string;
    avatar: string;
    isVerified: boolean;
  };
  rating: number;
  reviews: number;
  sold: number;
  category: string;
  isLiked: boolean;
}

const categories = [
  { id: "all", name: "الكل", icon: "🌟" },
  { id: "fashion", name: "أزياء", icon: "👗" },
  { id: "electronics", name: "إلكترونيات", icon: "📱" },
  { id: "beauty", name: "جمال", icon: "💄" },
  { id: "home", name: "منزل", icon: "🏠" },
  { id: "sports", name: "رياضة", icon: "⚽" },
];

const mockProducts: Product[] = [
  {
    id: "1",
    name: "سماعات لاسلكية بتقنية إلغاء الضوضاء",
    price: 299,
    originalPrice: 450,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
    seller: { username: "tech_store", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100", isVerified: true },
    rating: 4.8,
    reviews: 1250,
    sold: 5420,
    category: "electronics",
    isLiked: false,
  },
  {
    id: "2",
    name: "حقيبة يد فاخرة - إصدار محدود",
    price: 189,
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400",
    seller: { username: "fashion_queen", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100", isVerified: true },
    rating: 4.9,
    reviews: 890,
    sold: 2100,
    category: "fashion",
    isLiked: true,
  },
  {
    id: "3",
    name: "ساعة ذكية مع مستشعر صحي",
    price: 199,
    originalPrice: 299,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400",
    seller: { username: "gadget_world", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100", isVerified: false },
    rating: 4.6,
    reviews: 567,
    sold: 1890,
    category: "electronics",
    isLiked: false,
  },
  {
    id: "4",
    name: "مجموعة العناية بالبشرة الكورية",
    price: 79,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400",
    seller: { username: "beauty_lab", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100", isVerified: true },
    rating: 4.7,
    reviews: 2340,
    sold: 8900,
    category: "beauty",
    isLiked: true,
  },
  {
    id: "5",
    name: "حذاء رياضي للجري - خفيف الوزن",
    price: 129,
    originalPrice: 180,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
    seller: { username: "sport_zone", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100", isVerified: true },
    rating: 4.8,
    reviews: 1567,
    sold: 4500,
    category: "sports",
    isLiked: false,
  },
  {
    id: "6",
    name: "مصباح LED ذكي مع تحكم صوتي",
    price: 45,
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400",
    seller: { username: "home_smart", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100", isVerified: false },
    rating: 4.5,
    reviews: 890,
    sold: 3200,
    category: "home",
    isLiked: false,
  },
];

interface ShopScreenProps {
  onBack?: () => void;
}

export function ShopScreen({ onBack }: ShopScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [products, setProducts] = useState(mockProducts);
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const filteredProducts = products.filter(
    (p) =>
      (selectedCategory === "all" || p.category === selectedCategory) &&
      (searchQuery === "" || p.name.includes(searchQuery))
  );

  const toggleLike = (productId: string) => {
    setProducts(
      products.map((p) =>
        p.id === productId ? { ...p, isLiked: !p.isLiked } : p
      )
    );
  };

  const addToCart = () => {
    setCartCount(cartCount + 1)
    setSelectedProduct(null)
  }

  const startCheckout = async () => {
    if (!selectedProduct) return
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: selectedProduct.id, quantity: 1 }),
      })
      const payload = await response.json() as { url?: string; error?: string }
      if (!response.ok || !payload.url) throw new Error(payload.error || 'checkout_failed')
      window.location.assign(payload.url)
    } catch {
      setCheckoutError('Der Checkout konnte nicht gestartet werden. Bitte versuche es erneut.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="h-full bg-background flex flex-col relative">
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-[#3155ff] bg-clip-text text-transparent">
              متجر {APP_NAME}
            </h1>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full relative">
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن منتجات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 rounded-full bg-muted/50 border-0"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full h-8 w-8"
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "rounded-full text-xs whitespace-nowrap flex-shrink-0",
                selectedCategory === cat.id && "bg-primary text-primary-foreground"
              )}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-card rounded-2xl overflow-hidden border border-border/50 shadow-sm"
              onClick={() => setSelectedProduct(product)}
            >
              {/* Product Image */}
              <div className="relative aspect-square">
                <img
                  src={product.image || "/placeholder.svg"}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {product.originalPrice && (
                  <Badge className="absolute top-2 right-2 bg-blue-500 text-white text-[10px]">
                    -{Math.round((1 - product.price / product.originalPrice) * 100)}%
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 left-2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(product.id);
                  }}
                >
                  <Heart
                    className={cn(
                      "w-4 h-4",
                      product.isLiked ? "fill-blue-500 text-blue-500" : "text-muted-foreground"
                    )}
                  />
                </Button>
              </div>

              {/* Product Info */}
              <div className="p-3">
                <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{product.name}</p>
                
                <div className="flex items-center gap-1 mt-2">
                  <Avatar className="w-4 h-4">
                    <AvatarImage src={product.seller.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{product.seller.username[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] text-muted-foreground">{product.seller.username}</span>
                  {product.seller.isVerified && (
                    <div className="w-3 h-3 rounded-full bg-sky-500 flex items-center justify-center">
                      <Check className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span className="text-xs">{product.rating}</span>
                  <span className="text-[10px] text-muted-foreground">
                    ({product.reviews.toLocaleString()})
                  </span>
                  <span className="text-[10px] text-muted-foreground mr-auto">
                    {product.sold.toLocaleString()} مبيع
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <span className="text-lg font-bold text-primary">${product.price}</span>
                  {product.originalPrice && (
                    <span className="text-xs text-muted-foreground line-through">
                      ${product.originalPrice}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close handle */}
              <div className="flex justify-center py-3">
                <div className="w-12 h-1.5 bg-muted rounded-full" />
              </div>

              {/* Product image */}
              <div className="relative aspect-square mx-4 rounded-2xl overflow-hidden">
                <img
                  src={selectedProduct.image || "/placeholder.svg"}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm"
                  onClick={() => setSelectedProduct(null)}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Product details */}
              <div className="p-4">
                <h2 className="text-xl font-bold">{selectedProduct.name}</h2>
                
                <div className="flex items-center gap-2 mt-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={selectedProduct.seller.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{selectedProduct.seller.username[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{selectedProduct.seller.username}</span>
                  {selectedProduct.seller.isVerified && (
                    <div className="w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                    <span className="font-medium">{selectedProduct.rating}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({selectedProduct.reviews.toLocaleString()} تقييم)
                  </span>
                  <span className="text-sm text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">
                    {selectedProduct.sold.toLocaleString()} مبيع
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <span className="text-3xl font-bold text-primary">${selectedProduct.price}</span>
                  {selectedProduct.originalPrice && (
                    <>
                      <span className="text-lg text-muted-foreground line-through">
                        ${selectedProduct.originalPrice}
                      </span>
                      <Badge className="bg-blue-500 text-white">
                        وفر {selectedProduct.originalPrice - selectedProduct.price}$
                      </Badge>
                    </>
                  )}
                </div>

                {/* Features */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="flex flex-col items-center p-3 rounded-xl bg-muted/50">
                    <Truck className="w-5 h-5 text-primary mb-1" />
                    <span className="text-xs text-center">شحن مجاني</span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-xl bg-muted/50">
                    <Shield className="w-5 h-5 text-emerald-500 mb-1" />
                    <span className="text-xs text-center">ضمان الجودة</span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-xl bg-muted/50">
                    <Tag className="w-5 h-5 text-amber-500 mb-1" />
                    <span className="text-xs text-center">أفضل سعر</span>
                  </div>
                </div>

                {checkoutError && <p className="mb-3 rounded-xl bg-blue-500/10 px-3 py-2 text-xs text-blue-600" role="alert">{checkoutError}</p>}

                {/* Actions */}
                <div className="flex gap-3 mt-6 pb-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full w-12 h-12 bg-transparent"
                    onClick={() => toggleLike(selectedProduct.id)}
                  >
                    <Heart
                      className={cn(
                        "w-5 h-5",
                        selectedProduct.isLiked ? "fill-blue-500 text-blue-500" : ""
                      )}
                    />
                  </Button>
                  <Button
                    className="flex-1 rounded-full h-12 bg-primary hover:bg-primary/90 text-lg font-semibold"
                    onClick={startCheckout}
                    disabled={checkoutLoading}
                  >
                    <ShoppingCart className="w-5 h-5 ml-2" />
                    {checkoutLoading ? 'Wird geladen…' : 'Jetzt bezahlen'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
