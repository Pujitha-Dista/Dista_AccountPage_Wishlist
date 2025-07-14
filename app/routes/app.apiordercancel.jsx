import { json } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const orderId = body.orderId;
    const storeUrl = body.storeUrl
    const storeHostname = storeUrl; 
    if (!orderId) {
      return json(
        { success: false, message: "Missing orderId" },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    let cancelType = await prisma.menuSettings.findFirst({
      where: {  shop : storeHostname },
    });

    if (cancelType?.cancelOrderBehavior === "script") {
      return json(
        { success: false, redirection: true },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
    
    const latestSession = await prisma.session.findFirst({
      where: { shop : storeHostname },
    });
    if (!latestSession?.accessToken) {
      return json(
        { success: false, message: "Admin session or access token not found." },
        { status: 401, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const response = await fetch(
      `https://${storeHostname}/admin/api/2023-10/orders/${orderId}/cancel.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": latestSession.accessToken,
        },
      }
    );

    if (response.ok) {
      return json(
        { success: true },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    } else {
      return json(
        { success: false, message: "Failed to cancel the order." },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

  } catch (error) {
    return json(
      { success: false, message: "Internal Server Error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
};

