import { Product } from "@/types/product";

export const printerProducts: Product[] = [
  {
    id: "hp-laserjet-m1005",
    name: "HP LaserJet M1005 Multifunction",
    brand: "HP",
    category: "Printers",
    slug: "hp-laserjet-m1005",
    description: "The HP LaserJet M1005 is a reliable multifunction laser printer perfect for home offices and small businesses. Features print, scan, and copy capabilities with sharp text output.",
    features: [
      "Print, Scan & Copy",
      "Up to 14 ppm print speed",
      "600 x 600 dpi resolution",
      "150-sheet input tray",
      "USB connectivity",
      "Compact design"
    ],
    specifications: {
      "Print Speed": "14 ppm",
      "Resolution": "600 x 600 dpi",
      "Paper Capacity": "150 sheets",
      "Connectivity": "USB 2.0",
      "Dimensions": "442 x 395 x 260 mm",
      "Weight": "8.5 kg"
    },
    images: [
      "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&h=400&fit=crop",
      "https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?w=600&h=400&fit=crop"
    ],
    rentalPlans: [
      { id: "3m", duration: 3, label: "3 Months", monthlyRent: 599, securityDeposit: 2000 },
      { id: "6m", duration: 6, label: "6 Months", monthlyRent: 499, securityDeposit: 1500 },
      { id: "12m", duration: 12, label: "12 Months", monthlyRent: 399, securityDeposit: 1000 }
    ],
    deliveryFee: 299,
    installationFee: 199,
    rating: 4.5,
    reviewCount: 128,
    inStock: true,
    tags: ["Bestseller", "Office"]
  },
  {
    id: "epson-l3250",
    name: "Epson EcoTank L3250 Wi-Fi",
    brand: "Epson",
    category: "Printers",
    slug: "epson-l3250",
    description: "The Epson L3250 is an eco-friendly ink tank printer with Wi-Fi connectivity. Ideal for high-volume printing with ultra-low cost per page.",
    features: [
      "Print, Scan & Copy",
      "Wi-Fi & Wi-Fi Direct",
      "High-capacity ink tanks",
      "Up to 33 ppm print speed",
      "Borderless printing",
      "Mobile printing support"
    ],
    specifications: {
      "Print Speed": "33 ppm (draft)",
      "Resolution": "5760 x 1440 dpi",
      "Paper Capacity": "100 sheets",
      "Connectivity": "Wi-Fi, USB",
      "Ink Type": "EcoTank",
      "Weight": "4.5 kg"
    },
    images: [
      "https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?w=600&h=400&fit=crop",
      "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&h=400&fit=crop"
    ],
    rentalPlans: [
      { id: "3m", duration: 3, label: "3 Months", monthlyRent: 699, securityDeposit: 2500 },
      { id: "6m", duration: 6, label: "6 Months", monthlyRent: 599, securityDeposit: 2000 },
      { id: "12m", duration: 12, label: "12 Months", monthlyRent: 499, securityDeposit: 1500 }
    ],
    deliveryFee: 299,
    installationFee: 249,
    rating: 4.7,
    reviewCount: 256,
    inStock: true,
    tags: ["Eco-Friendly", "Wireless"]
  },
  {
    id: "canon-pixma-g3010",
    name: "Canon PIXMA G3010 Ink Tank",
    brand: "Canon",
    category: "Printers",
    slug: "canon-pixma-g3010",
    description: "Canon PIXMA G3010 offers wireless all-in-one printing with refillable ink tanks. Perfect for home and small office use with low running costs.",
    features: [
      "Print, Scan & Copy",
      "Wireless connectivity",
      "Refillable ink tanks",
      "Up to 8.8 ipm print speed",
      "4800 x 1200 dpi",
      "Cloud printing ready"
    ],
    specifications: {
      "Print Speed": "8.8 ipm (color)",
      "Resolution": "4800 x 1200 dpi",
      "Paper Capacity": "100 sheets",
      "Connectivity": "Wi-Fi, USB",
      "Ink Type": "MegaTank",
      "Weight": "6.4 kg"
    },
    images: [
      "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&h=400&fit=crop",
      "https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?w=600&h=400&fit=crop"
    ],
    rentalPlans: [
      { id: "3m", duration: 3, label: "3 Months", monthlyRent: 649, securityDeposit: 2200 },
      { id: "6m", duration: 6, label: "6 Months", monthlyRent: 549, securityDeposit: 1800 },
      { id: "12m", duration: 12, label: "12 Months", monthlyRent: 449, securityDeposit: 1200 }
    ],
    deliveryFee: 299,
    installationFee: 199,
    rating: 4.6,
    reviewCount: 189,
    inStock: true,
    tags: ["Popular", "Wireless"]
  },
  {
    id: "brother-dcp-t520w",
    name: "Brother DCP-T520W Ink Tank",
    brand: "Brother",
    category: "Printers",
    slug: "brother-dcp-t520w",
    description: "Brother DCP-T520W is a versatile ink tank printer with wireless capability and high-yield ink bottles for cost-effective printing.",
    features: [
      "Print, Scan & Copy",
      "Wireless & Mobile printing",
      "High-yield ink bottles",
      "Up to 17 ppm print speed",
      "2-line LCD display",
      "Auto-off power saving"
    ],
    specifications: {
      "Print Speed": "17 ppm (mono)",
      "Resolution": "1200 x 6000 dpi",
      "Paper Capacity": "150 sheets",
      "Connectivity": "Wi-Fi, USB",
      "Ink Type": "Refill Tank",
      "Weight": "7.5 kg"
    },
    images: [
      "https://images.unsplash.com/photo-1588681664899-f142ff2dc9b1?w=600&h=400&fit=crop",
      "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=600&h=400&fit=crop"
    ],
    rentalPlans: [
      { id: "3m", duration: 3, label: "3 Months", monthlyRent: 749, securityDeposit: 2800 },
      { id: "6m", duration: 6, label: "6 Months", monthlyRent: 649, securityDeposit: 2300 },
      { id: "12m", duration: 12, label: "12 Months", monthlyRent: 549, securityDeposit: 1800 }
    ],
    deliveryFee: 349,
    installationFee: 249,
    rating: 4.4,
    reviewCount: 95,
    inStock: true,
    tags: ["Value", "Office"]
  }
];

export const getProductBySlug = (slug: string): Product | undefined => {
  return printerProducts.find(p => p.slug === slug);
};

export const getProductById = (id: string): Product | undefined => {
  return printerProducts.find(p => p.id === id);
};
