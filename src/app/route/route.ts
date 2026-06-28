import { Router } from "express"
import { authRoutes } from "../modules/auth/auth.routes"
import { NotificationsRouters } from "../modules/notifications/notification.routes"
import { paymentRoutes } from "../modules/payment/payment.routes"
import { SearchRoutes } from "../modules/search/search.routes"
import { UploadRoutes } from "../modules/upload/upload.route"
import { userRoutes } from "../modules/user/user.routes"
import { shopRoutes } from "../modules/shop/shop.routes"
import { dealRoutes } from "../modules/deal/deal.routes"
import { stepsRoutes } from "../modules/steps/steps.routes"
import { voucherRoutes } from "../modules/voucher/voucher.routes"
import { streakTimerRoutes } from "../modules/streakTimer/streakTimer.routes"
import { subscriptionRoutes } from "../modules/subscription/subscription.routes"
import { favouriteShopRoutes } from "../modules/favouriteShop/favouriteShop.routes"
import { testRoutes } from "../modules/test/test.routes"
import { challengeRoutes } from "../modules/challenge/challenge.routes"
import { downloadRoutes } from "../modules/download/download.routes"

const router = Router()
const routes = [
    {
        path: "/users",
        component: userRoutes
    },
    {
        path: "/auth",
        component: authRoutes
    },
    {
        path: "/shops",
        component: shopRoutes
    },
    {
        path: "/deals",
        component: dealRoutes
    },
    {
        path: "/steps",
        component: stepsRoutes
    },
    {
        path: "/vouchers",
        component: voucherRoutes
    },
    {
        path: "/upload",
        component: UploadRoutes
    },
    {
        path: "/notifications",
        component: NotificationsRouters
    },
    {
        path: "/payments",
        component: paymentRoutes
    },
    {
        path: "/subscriptions",
        component: subscriptionRoutes
    },
    {
        path: "/search",
        component: SearchRoutes
    },
    {
        path: "/streak-timers",
        component: streakTimerRoutes
    },
    {
        path: "/favourite-shops",
        component: favouriteShopRoutes
    },
    {
        path: "/test",
        component: testRoutes
    },
    {
        path: "/challenges",
        component: challengeRoutes
    },
    {
        path: "/download",
        component: downloadRoutes
    },
]

routes.forEach(route => router.use(route.path, route.component))
export default router
