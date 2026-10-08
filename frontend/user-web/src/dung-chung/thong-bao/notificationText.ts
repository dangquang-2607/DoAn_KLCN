import { money } from "../tien-ich/finance";

export function notificationText(text: string, currency = "VND") {
  return text
    .replace(/(-?\d+(?:\.\d+)?)\s*VND/g, (_, amount: string) => money(amount, currency))
    .replace(/(-?\d+(?:\.\d+)?)(?=\s*→)/g, (amount) => money(amount, currency));
}
