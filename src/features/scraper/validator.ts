import { logger } from "../../lib/logger";

export class Validator {
  validateDate(dateString: string, today: Date): boolean {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;

    // Date must be today or in the future
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    if (date < startOfToday) return false;

    // Date must be within the next 30 days
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 30);
    if (date > maxDate) return false;

    // Year must match current year (or next year if we are in December and date is in January)
    const currentYear = today.getFullYear();
    const eventYear = date.getFullYear();
    if (eventYear !== currentYear && eventYear !== currentYear + 1) return false;

    return true;
  }
}

export const validator = new Validator();
