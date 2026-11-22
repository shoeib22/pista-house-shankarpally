export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["health"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/menu": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["menu"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/outlet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["outlet"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["pauseOutlet"];
        trace?: never;
    };
    "/auth/development": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["developmentLogin"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["logout"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["orders"];
        put?: never;
        post: operations["createOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["orderAction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/development-payment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["developmentPayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/menu/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["setAvailability"];
        trace?: never;
    };
    "/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["audit"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/riders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["riders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rider/availability": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["riderAvailability"];
        trace?: never;
    };
    "/rider/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["riderTasks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/assignment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["assignRider"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/assignments/{id}/staff-actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["assignmentStaffAction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rider/tasks/{id}/actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["riderTaskAction"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rider/tasks/{id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["completeDelivery"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/delivery-code": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["issueDeliveryCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["passwordLogin"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/accept-invitation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["acceptInvitation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["changePassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["accountSessions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/sessions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["revokeOwnSession"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["logoutAllSessions"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/team": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["teamMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/team/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["teamInvitations"];
        put?: never;
        post: operations["inviteTeammate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/team/invitations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: operations["revokeInvitation"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/team/{id}/recovery-invitation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["inviteAccountRecovery"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/team/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch: operations["setAccountStatus"];
        trace?: never;
    };
    "/orders/{id}/tracking": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read an authorized delivery tracking snapshot */
        get: operations["deliveryTracking"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/route": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read configured road route and non-traffic-aware travel estimate */
        get: operations["deliveryRoute"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/eta": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read a staged delivery estimate (preparation, assignment, pickup, road travel, handoff) as a labelled, non-traffic-aware range */
        get: operations["deliveryEta"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/maps/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Explicit area or landmark search through the configured Photon-compatible provider */
        get: operations["searchMapPlaces"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rider/offer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the rider's current live auto-dispatch offer (area, distance and item count only) */
        get: operations["riderOffer"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rider/offers/{id}/respond": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Accept or decline a live offer; accepting creates the delivery assignment */
        post: operations["respondRiderOffer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/rider/tasks/{id}/route": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Road route from the rider's supplied position to the outlet and customer pin for their own active delivery */
        get: operations["riderRoute"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dispatch/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Owner and counter view of live offers and orders that need manual assignment */
        get: operations["dispatchStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/outlet/auto-dispatch": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Switch automatic rider offers on or off (owner only; off by default) */
        patch: operations["setAutoDispatch"];
        trace?: never;
    };
    "/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Customer self-registration with a mobile number and passphrase (private beta only; the number is not verified) */
        post: operations["registerCustomer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/addresses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the signed-in customer's saved delivery addresses (default first) */
        get: operations["listSavedAddresses"];
        put?: never;
        /** Save an address (the same street address and postcode updates the existing entry; up to 10) */
        post: operations["saveAddress"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/addresses/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Edit one of the customer's saved addresses */
        put: operations["updateSavedAddress"];
        post?: never;
        /** Delete a saved address (the next most recent becomes the default if needed) */
        delete: operations["deleteSavedAddress"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/addresses/{id}/default": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Make a saved address the default */
        patch: operations["setDefaultAddress"];
        trace?: never;
    };
    "/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The signed-in account's name, handle and email verification status */
        get: operations["accountSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/email": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add or change the customer's email and send a 6-digit verification code */
        post: operations["setCustomerEmail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/email/resend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Send a new verification code (one per minute; older codes stop working) */
        post: operations["resendEmailCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/email/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Verify the email with the 6-digit code (single use, 10 minutes, 5 wrong guesses) */
        post: operations["verifyEmail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/forgot": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request a passphrase reset code by mobile number or email; the answer is the same whether or not an account matches */
        post: operations["forgotPassphrase"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Set a new passphrase with the emailed code; signs the account out everywhere */
        post: operations["resetPassphrase"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Which payment provider the server uses and whether it is the test provider */
        get: operations["paymentConfig"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/payments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start (or resume) paying for an order; the amount is always the order's server-side total */
        post: operations["startPayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/payment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Payment state of an order: latest attempt, retry allowed, refunds (customer own order; owner/counter any) */
        get: operations["orderPaymentStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** The customer says they finished paying. Never trusted: any gateway proof is verified and the server asks the gateway */
        post: operations["confirmPayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/{id}/simulate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Test payments only: choose success, failure or pending */
        post: operations["simulatePayment"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/webhook/{provider}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Signed gateway notifications. Public by design: the signature over the raw body is the credential. Duplicate deliveries are ignored */
        post: operations["paymentWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/refunds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Refunds on an order */
        get: operations["listOrderRefunds"];
        put?: never;
        /** Owner refund, full or partial; idempotent by Idempotency-Key and never more than was paid */
        post: operations["refundOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/reconcile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Payments open too long, amount mismatches and refunds needing attention (owner) */
        get: operations["paymentReconciliation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/payments/reconcile/run": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Check open payments with the gateway now and apply timeouts (owner) */
        post: operations["runPaymentReconciliation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support/tickets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The customer's own requests, with unread-reply flags */
        get: operations["listSupportRequests"];
        put?: never;
        /** Customer opens a help request, optionally about one of their own orders (max 3 open, 5 new per hour) */
        post: operations["createSupportRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support/tickets/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** One request's conversation (internal staff notes are never included); marks replies as read */
        get: operations["getSupportRequest"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support/tickets/{id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Customer replies; reopens a resolved request for 7 days */
        post: operations["replyToSupportRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support/tickets/{id}/close": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Customer closes their request */
        post: operations["closeSupportRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support/tickets/{id}/rating": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Customer rates a finished request 1-5, once */
        post: operations["rateSupportRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support/inbox": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Staff queue: filter needs_reply|waiting|finished|all, mine=true, search; overdue and high priority first */
        get: operations["supportInbox"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support/inbox/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Staff view: full thread including private notes, the customer and the order */
        get: operations["supportRequestDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Assign, set priority or change status; leaves a private trail */
        patch: operations["updateSupportRequest"];
        trace?: never;
    };
    "/support/inbox/{id}/reply": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Reply to the customer (sets pending_customer or resolved) or add a private note */
        post: operations["staffReplyToSupportRequest"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Queue size, overdue, resolved today, average first-reply time and customer rating */
        get: operations["supportStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The signed-in user's notification inbox, newest first */
        get: operations["listNotifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications/unread-count": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Number of unread notifications */
        get: operations["unreadNotificationCount"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications/preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Reminder and promotion opt-ins and quiet hours */
        get: operations["getNotificationPreferences"];
        /** Change notification opt-ins */
        put: operations["setNotificationPreferences"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mark notifications read */
        post: operations["markNotificationsRead"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications/{id}/open": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record that a notification was tapped */
        post: operations["markNotificationOpened"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications/report": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Owner report: sends, opens, conversions and holdout lift per campaign */
        get: operations["notificationReport"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/notifications/test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Send a test notification to the caller's own devices */
        post: operations["sendTestNotification"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/devices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Register a phone push token */
        post: operations["registerDevice"];
        /** Forget a phone push token */
        delete: operations["removeDevice"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/cart": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Tell the server what is in the cart (for the abandoned-cart reminder) */
        put: operations["syncCartSnapshot"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/support/attachments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** A photo on a support request (image bytes) */
        get: operations["getSupportPhoto"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Actor: {
            id: string;
            outletId: string;
            name: string;
            /** @enum {string} */
            role: "customer" | "counter" | "kitchen" | "rider" | "owner";
            developmentOnly: boolean;
        };
        Product: {
            id: string;
            name: string;
            description: string;
            category: string;
            pricePaise: number;
            vegetarian: boolean;
            available: boolean;
        };
        OrderItem: {
            productId: string;
            name: string;
            quantity: number;
            unitPaise: number;
        };
        OrderEvent: {
            action: string;
            /** Format: date-time */
            createdAt: string;
        };
        Order: {
            id: string;
            number: number;
            outletId: string;
            customerId: string;
            /** @enum {string} */
            fulfilment: "pickup" | "delivery";
            /** @enum {string} */
            status: "awaiting_acceptance" | "accepted" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "collected" | "rejected" | "delivery_failed";
            /** @enum {string} */
            paymentStatus: "pending" | "paid" | "failed" | "expired" | "partially_refunded" | "refunded";
            subtotalPaise: number;
            taxPaise: number;
            deliveryPaise: number;
            totalPaise: number;
            /** Format: date-time */
            createdAt: string;
            version: number;
            items: components["schemas"]["OrderItem"][];
            events: components["schemas"]["OrderEvent"][];
            assignments: components["schemas"]["AssignmentSummary"][];
            /** @description Address snapshot. Omitted for kitchen role. */
            deliveryAddress?: Record<string, never> | null;
        };
        /** @description deliveryAddress is required for delivery and forbidden for pickup. The server validates an active approved postal delivery zone and calculates its charge. */
        Checkout: {
            /** @enum {string} */
            fulfilment: "pickup" | "delivery";
            items: {
                productId: string;
                quantity: number;
            }[];
            deliveryAddress?: components["schemas"]["DeliveryAddress"];
        };
        Action: {
            /** @enum {string} */
            action: "accept" | "reject" | "prepare" | "ready" | "collect";
            version: number;
            reason?: string;
        };
        Error: {
            message: string;
            statusCode: number;
        };
        /** @description Delivery address with an optional entrance pin. Supply both latitude and longitude together; the approved PIN-code zone still determines serviceability. */
        DeliveryAddress: {
            recipient: string;
            phone: string;
            line1: string;
            city: string;
            postalCode: string;
            landmark?: string;
            latitude?: number;
            longitude?: number;
        };
        AssignmentSummary: {
            id: string;
            riderId: string;
            /** @enum {string} */
            status: "assigned" | "picked_up" | "failed" | "returned" | "unassigned" | "delivered";
            isActive: boolean;
            version: number;
            /** Format: date-time */
            createdAt: string;
            rider: {
                name: string;
            };
            failureReason?: string | null;
        };
        Rider: {
            id: string;
            name: string;
            riderAvailable: boolean;
        };
        RiderTask: {
            id: string;
            riderId: string;
            /** @enum {string} */
            status: "assigned" | "picked_up" | "failed" | "returned" | "unassigned" | "delivered";
            isActive: boolean;
            version: number;
            /** Format: date-time */
            createdAt: string;
            rider: {
                name: string;
            };
            failureReason?: string | null;
            order: {
                id: string;
                number: number;
                status: string;
                paymentStatus: string;
                totalPaise: number;
                /** @description Present only for active assigned/picked-up jobs. Removed from history and failed tasks. */
                deliveryAddress: Record<string, never> | null;
                items: {
                    name: string;
                    quantity: number;
                }[];
                /** Format: date-time */
                createdAt: string;
            };
            events: {
                action: string;
                reason?: string | null;
                /** Format: date-time */
                createdAt: string;
            }[];
        };
        AccountSession: {
            id: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            expiresAt: string;
            /** @enum {string} */
            authMethod: "password" | "development";
            current: boolean;
        };
        TeamMember: {
            id: string;
            outletId: string;
            name: string;
            role: string;
            /** Format: date-time */
            disabledAt?: string | null;
            riderAvailable: boolean;
            credential?: {
                handle: string;
            } | null;
            developmentOnly: boolean;
        };
        Invitation: {
            id: string;
            name: string;
            handle: string;
            /** @enum {string} */
            role: "counter" | "kitchen" | "rider";
            /** @enum {string} */
            kind: "create" | "reset";
            userId?: string | null;
            /** Format: date-time */
            expiresAt: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            usedAt?: string | null;
            /** Format: date-time */
            revokedAt?: string | null;
            developmentOnly: boolean;
        };
        AccountAccess: {
            token: string;
            /** Format: date-time */
            expiresAt: string;
            user: components["schemas"]["Actor"];
        };
        IssuedInvitation: {
            id: string;
            name: string;
            handle: string;
            /** @enum {string} */
            role: "counter" | "kitchen" | "rider";
            /** @enum {string} */
            kind: "create" | "reset";
            userId?: string | null;
            /** Format: date-time */
            expiresAt: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            usedAt?: string | null;
            /** Format: date-time */
            revokedAt?: string | null;
            token: string;
            developmentOnly: boolean;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    health: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        status: string;
                        development: boolean;
                        payments: string;
                        otp: string;
                        push: string;
                        petpooja: string;
                        /** @enum {string} */
                        deliveryVerification: "configured" | "not_configured";
                        /** @enum {string} */
                        staffAuthentication: "password";
                    };
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    menu: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Product"][];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    outlet: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        paused: boolean;
                        latitude?: number | null;
                        longitude?: number | null;
                    };
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    pauseOutlet: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    paused: boolean;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        name: string;
                        paused: boolean;
                        latitude?: number | null;
                        longitude?: number | null;
                    };
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    developmentLogin: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    identity: "customer" | "customer2" | "counter" | "kitchen" | "owner" | "rider" | "rider2";
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        token: string;
                        user: components["schemas"]["Actor"];
                        development: boolean;
                    };
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Actor"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    orders: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Order"][];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    createOrder: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Checkout"];
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Order"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    orderAction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["Action"];
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Order"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    developmentPayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    eventId: string;
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Order"];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    setAvailability: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    available: boolean;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    audit: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        id: string;
                        action: string;
                        resourceId: string;
                        detail?: string | null;
                        /** Format: date-time */
                        createdAt: string;
                    }[];
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Missing or expired session */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Permission denied */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Resource not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Stale version, invalid state or idempotency conflict */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Provider is not configured */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    riders: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Rider"][];
                };
            };
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Rider"][];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    riderAvailability: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    available: boolean;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Rider"];
                };
            };
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Rider"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    riderTasks: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        available: boolean;
                        tasks: components["schemas"]["RiderTask"][];
                    };
                };
            };
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        available: boolean;
                        tasks: components["schemas"]["RiderTask"][];
                    };
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    assignRider: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    riderId: string;
                    version: number;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssignmentSummary"];
                };
            };
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AssignmentSummary"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    assignmentStaffAction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    action: "unassign" | "confirm_return";
                    version: number;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    riderTaskAction: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    action: "pickup" | "fail";
                    version: number;
                    reason?: string;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    completeDelivery: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    code: string;
                    version: number;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    issueDeliveryCode: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        /** Format: date-time */
                        expiresAt: string;
                        assignmentId: string;
                    };
                };
            };
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        code: string;
                        /** Format: date-time */
                        expiresAt: string;
                        assignmentId: string;
                    };
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state or unconfigured verification */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    passwordLogin: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    handle: string;
                    password: string;
                    /** @enum {string} */
                    audience: "employee" | "owner" | "rider";
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountAccess"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    acceptInvitation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    token: string;
                    password: string;
                    /** @enum {string} */
                    audience: "employee" | "owner" | "rider";
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountAccess"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    changePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    currentPassword: string;
                    password: string;
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountAccess"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    accountSessions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountSession"][];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    revokeOwnSession: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    logoutAllSessions: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    teamMembers: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeamMember"][];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    teamInvitations: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Invitation"][];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    inviteTeammate: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                    handle: string;
                    /** @enum {string} */
                    role: "counter" | "kitchen" | "rider";
                };
            };
        };
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IssuedInvitation"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    revokeInvitation: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    inviteAccountRecovery: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Success */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IssuedInvitation"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    setAccountStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    disabled: boolean;
                };
            };
        };
        responses: {
            /** @description Success */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        ok: boolean;
                    };
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Invalid request, denied access, stale state, throttled or busy */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    deliveryTracking: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Order-scoped snapshot; no rider location for terminal deliveries. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Order unavailable to this account */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    deliveryRoute: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Provider route or available:false; requires fresh GPS and a destination pin. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Order unavailable to this account */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    deliveryEta: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Stage list with minutesLow/minutesHigh and confidence, or available:false; requires a delivery pin. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Order unavailable to this account */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    searchMapPlaces: {
        parameters: {
            query: {
                q: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Up to five validated map search results */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        places?: {
                            label?: string;
                            latitude?: number;
                            longitude?: number;
                        }[];
                    };
                };
            };
            /** @description Authentication required */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Search throttled */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Search provider unavailable; use manual map pin */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    riderOffer: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The live offer or offer:null, plus server time. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    respondRiderOffer: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description Result; 409 if the offer expired or the order moved on. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    riderRoute: {
        parameters: {
            query: {
                lat: number;
                lon: number;
            };
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Route, legs and stops, or available:false. Position is not stored. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    dispatchStatus: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Auto-dispatch state, live offers and orders needing a rider. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    setAutoDispatch: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description The outlet's auto-dispatch setting. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    registerCustomer: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description A signed-in customer session with phoneVerified:false. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description A customer with this mobile number already exists */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Too many attempts */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Customer sign-up is not available in this build */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listSavedAddresses: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Saved addresses. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Customer access required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    saveAddress: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description The saved address. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Invalid address */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Customer access required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Address limit reached */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    updateSavedAddress: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description The updated address. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Address not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    deleteSavedAddress: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description ok. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Address not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    setDefaultAddress: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The updated address. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Address not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    accountSummary: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Account summary. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    setCustomerEmail: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description email, verified and sent flags. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Invalid email */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Wait before asking for another code */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Daily email limit reached */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    resendEmailCode: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description verified and sent flags. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Wait before asking for another code */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    verifyEmail: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description verified:true. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Wrong or expired code */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Email already verified on another account */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    forgotPassphrase: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description Generic confirmation message. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Too many attempts */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Not available in this build */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    resetPassphrase: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description ok. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Wrong or expired code, or weak passphrase */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Too many attempts */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    paymentConfig: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description provider, simulated, currency, sessionMinutes, maxAttempts. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Payments are not configured, or test payments are disabled */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    startPayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description paymentId, provider, amountPaise, expiresAt and the gateway's public checkout values (never secrets). */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Order is already paid or can no longer be paid */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Too many payment attempts */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Payment service unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    orderPaymentStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Payment status. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Order not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    confirmPayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description Updated payment status. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Payment proof could not be verified */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    simulatePayment: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description Updated payment status. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Only available with test payments */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    paymentWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                provider: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description ok, ignored or duplicate. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Invalid or missing signature */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Not the active provider */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listOrderRefunds: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Refunds. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    refundOrder: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description The refund. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Owner only */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Nothing to refund, too much, or a full refund of an order still in progress */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description The gateway could not process the refund (recorded as failed) */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    paymentReconciliation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Items needing a look. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Owner only */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    runPaymentReconciliation: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Counts checked, expired, closed and retried. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Owner only */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listSupportRequests: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Requests. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Customer access required */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    createSupportRequest: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description The new request with its first message. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Order not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Too many open requests */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Too many new requests */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getSupportRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The request and its public messages. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Request not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    replyToSupportRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description The updated request. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Closed or resolved too long ago */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Sending too fast */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    closeSupportRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The updated request. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    rateSupportRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description The updated request. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Not finished, or already rated */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    supportInbox: {
        parameters: {
            query?: {
                filter?: string;
                mine?: string;
                search?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Requests with waiting time and overdue flag. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Owner or counter only */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    supportRequestDetail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Detail. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Request not found */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    updateSupportRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description Updated detail. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Invalid change */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    staffReplyToSupportRequest: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description Updated detail. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Closed: reopen before replying to the customer */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    supportStats: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Statistics. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listNotifications: {
        parameters: {
            query?: {
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    unreadNotificationCount: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getNotificationPreferences: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    setNotificationPreferences: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    markNotificationsRead: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    markNotificationOpened: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    notificationReport: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    sendTestNotification: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    registerDevice: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    removeDevice: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    syncCartSnapshot: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    [key: string]: unknown;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        [key: string]: unknown;
                    };
                };
            };
            /** @description Invalid request */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getSupportPhoto: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "image/*": string;
                };
            };
            /** @description Session expired or revoked */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
}
