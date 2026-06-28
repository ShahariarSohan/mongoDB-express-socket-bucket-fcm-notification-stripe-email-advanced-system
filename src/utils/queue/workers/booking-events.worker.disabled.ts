// File temporarily disabled due to missing Prisma models (booking, payment, service, review, room, chat)
// These files contain workers for booking/payment events and WebSocket functionality
// Will be re-enabled when proper schema is implemented

import logger from "../../logger";

export function disabledBookingEventsWorker() {
    logger.warn("Booking events worker is disabled - missing Prisma booking model");
}

// Export disabled to prevent import errors
export default disabledBookingEventsWorker;
