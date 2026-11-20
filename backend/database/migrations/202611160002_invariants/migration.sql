ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK ("role" IN ('customer', 'counter', 'kitchen', 'rider', 'owner'));
ALTER TABLE "Product" ADD CONSTRAINT "Product_price_check" CHECK ("pricePaise" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_values_check" CHECK ("quantity" BETWEEN 1 AND 20 AND "unitPaise" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_money_check" CHECK (
  "subtotalPaise" >= 0 AND "taxPaise" >= 0 AND "deliveryPaise" >= 0 AND
  "totalPaise" = "subtotalPaise" + "taxPaise" + "deliveryPaise" AND "version" >= 0
);
ALTER TABLE "Order" ADD CONSTRAINT "Order_fulfilment_check" CHECK ("fulfilment" IN ('pickup', 'delivery'));
ALTER TABLE "Order" ADD CONSTRAINT "Order_status_check" CHECK ("status" IN ('awaiting_acceptance', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'collected', 'rejected'));
ALTER TABLE "Order" ADD CONSTRAINT "Order_payment_check" CHECK ("paymentStatus" IN ('pending', 'paid', 'failed', 'expired', 'partially_refunded', 'refunded'));
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_amount_check" CHECK ("amountPaise" >= 0);
