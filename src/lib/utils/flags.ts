// Flag utility functions for displaying country flags
export function getFlagIcon(countryName: string): string {
  const countryToFlagCode: { [key: string]: string } = {
    "Italy": "it",
    "France": "fr", 
    "Spain": "es",
    "United States": "us",
    "Germany": "de",
  };
  
  const flagCode = countryToFlagCode[countryName] || "xx"; // Default to unknown flag
  return `flag-icon flag-icon-${flagCode}`;
}

export function getCountryFlag(countryName: string): string {
  const countryToFlagCode: { [key: string]: string } = {
    "Italy": "🇮🇹",
    "France": "🇫🇷",
    "Spain": "🇪🇸", 
    "United States": "🇺🇸",
    "Germany": "🇩🇪",
  };
  
  return countryToFlagCode[countryName] || "🏳️";
}
