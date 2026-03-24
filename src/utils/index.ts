export const normalizeMsisdn = (phone: string) => {
  return phone.startsWith("0") && phone.length === 10 ? `359${phone.slice(1)}` : phone; 
}