import { Router } from "express";
import { downloadController } from "./download.controller";

const route = Router();

route.get("/", downloadController.smartDownload);

export const downloadRoutes = route;
