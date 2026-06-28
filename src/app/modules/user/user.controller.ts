import { Request, Response } from "express";
import catchAsync from "../../../shared/catchAsync";
import { userServices } from "./user.service";
import sendResponse from "../../middleware/sendResponse";
import { StatusCodes } from "http-status-codes";
import { getResponseMessage } from "../../helper/languageHelper";


const createUserController = catchAsync(async (req: Request, res: Response) => {
    const body = req.body
    const language = req.language || 'en';
    const result = await userServices.createUserIntoDB(body, language)
    sendResponse(res, { statusCode: StatusCodes.CREATED, message: getResponseMessage("user.created", language), data: result, success: true })
})


const changePasswordController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user
    const body = req.body as any
    const language = req.language || 'en';
    const result = await userServices.changePasswordIntoDB(id, body, language)
    sendResponse(res, { statusCode: StatusCodes.OK, message: getResponseMessage("user.updated", language), data: result, success: true })
})

const updateUserController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user
    const body = req?.body as any
    const image = req?.file as any
    const language = req.language || 'en';
    const result = await userServices.updateUserIntoDB(id, body, image, language)
    sendResponse(res, { statusCode: StatusCodes.OK, message: getResponseMessage("user.updated", language), data: result, success: true })
})

const getMyProfileController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user
    const language = req.language || 'en';
    const result = await userServices.getMyProfile(id, language)
    sendResponse(res, { statusCode: StatusCodes.OK, message: getResponseMessage("user.retrieved", language), data: result, success: true })
})

const getUserByIdController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params
    const language = req.language || 'en';
    const result = await userServices.getUserById(id, language)
    sendResponse(res, { statusCode: StatusCodes.OK, message: getResponseMessage("user.retrieved", language), data: result, success: true })
})

const deleteUserController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params
    const language = req.language || 'en';
    const result = await userServices.deleteUserFromDB(id, language)
    sendResponse(res, { statusCode: StatusCodes.OK, message: getResponseMessage("user.deleted", language), data: result, success: true })
})

const deleteMeController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user
    const language = req.language || 'en';
    const result = await userServices.deleteUserFromDB(id, language)
    sendResponse(res, { statusCode: StatusCodes.OK, message: getResponseMessage("user.deleted", language), data: result, success: true })
})

const getAllUsersController = catchAsync(async (req: Request, res: Response) => {
    const language = req.language || 'en';
    const result = await userServices.getAllUsersFromDB(req.query, language) as any
    sendResponse(res, { 
        statusCode: StatusCodes.OK, 
        message: getResponseMessage("user.retrieved", language), 
        data: result.data, 
        success: true,
        meta: result.meta
    })
})

const getReferralInfoController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user
    const language = req.language || 'en';
    const result = await userServices.getReferralInfo(id, language)
    sendResponse(res, { 
        statusCode: StatusCodes.OK, 
        message: "Referral information retrieved successfully", 
        data: result, 
        success: true 
    })
})

const sendReferralInviteController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user
    const { recipientUserId } = req.body
    const language = req.language || 'en';
    
    if (!recipientUserId) {
        sendResponse(res, { 
            statusCode: StatusCodes.BAD_REQUEST, 
            message: "recipientUserId is required", 
            data: null, 
            success: false 
        });
        return;
    }
    
    const result = await userServices.sendReferralInvite(id, recipientUserId, language)
    sendResponse(res, { 
        statusCode: StatusCodes.OK, 
        message: result.message, 
        data: result, 
        success: true 
    })
})

const acceptReferralCodeController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user
    const { referralCode } = req.body
    const language = req.language || 'en';
    
    if (!referralCode) {
        sendResponse(res, { 
            statusCode: StatusCodes.BAD_REQUEST, 
            message: "referralCode is required", 
            data: null, 
            success: false 
        });
        return;
    }
    
    const result = await userServices.acceptReferralCode(id, referralCode, language)
    sendResponse(res, { 
        statusCode: StatusCodes.OK, 
        message: result.message, 
        data: result, 
        success: true 
    })
})

const addReferralCodeController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user
    const { referralCode } = req.body
    const language = req.language || 'en';
    
    if (!referralCode) {
        sendResponse(res, { 
            statusCode: StatusCodes.BAD_REQUEST, 
            message: "referralCode is required", 
            data: null, 
            success: false 
        });
        return;
    }
    
    const result = await userServices.addReferralCode(id, referralCode, language)
    sendResponse(res, { 
        statusCode: StatusCodes.OK, 
        message: result.message, 
        data: result, 
        success: true 
    })
})

const getMyReferralConnectionsController = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.user
    const language = req.language || 'en';
    const result = await userServices.getMyReferralConnections(id, language)
    sendResponse(res, { 
        statusCode: StatusCodes.OK, 
        message: "Referral connections retrieved successfully", 
        data: result, 
        success: true 
    })
})

export const userController = { 
    createUserController, 
    updateUserController, 
    changePasswordController, 
    getMyProfileController, 
    getUserByIdController, 
    deleteUserController, 
    deleteMeController,
    getAllUsersController,
    getReferralInfoController,
    sendReferralInviteController,
    acceptReferralCodeController,
    addReferralCodeController,
    getMyReferralConnectionsController,
}