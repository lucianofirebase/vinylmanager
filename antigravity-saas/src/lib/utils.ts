export function formatCurrency(price: number, currencyCode?: string | null): string {
  const currency = currencyCode || 'USD';
  const formattedPrice = price.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  
  switch (currency) {
    case 'EUR':
      return `€${formattedPrice}`;
    case 'UYU':
      return `$ ${formattedPrice} UYU`;
    case 'ARS':
      return `$ ${formattedPrice} ARS`;
    case 'USD':
    default:
      return `$${formattedPrice}`;
  }
}
