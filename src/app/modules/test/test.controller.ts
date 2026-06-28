import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import sendResponse from "../../middleware/sendResponse";
import { StatusCodes } from "http-status-codes";
import { sendStepReminders } from "../../../utils/cron/jobs/sendStepReminders";

// Test step reminder notification manually
const testStepReminderController = catchAsync(async (req: Request, res: Response) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧪 MANUAL TEST TRIGGERED - Step Reminder Notification`);
    console.log(`${'='.repeat(80)}\n`);

    try {
        await sendStepReminders();
        
        sendResponse(res, {
            statusCode: StatusCodes.OK,
            message: "Step reminder test completed! Check console logs for details.",
            data: {
                testTime: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }),
                note: "Check server console and PM2 logs for detailed output"
            },
            success: true
        });
    } catch (error: any) {
        sendResponse(res, {
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            message: "Step reminder test failed",
            data: { error: error.message },
            success: false
        });
    }
});

export const testController = {
    testStepReminderController
};
