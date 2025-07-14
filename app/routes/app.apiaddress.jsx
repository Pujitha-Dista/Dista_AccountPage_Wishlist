import { json } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customerId");
  const storeUrl = url.searchParams.get("storeUrl");
  if (!customerId) {
    return json({ message: "Missing customerId" }, { status: 400 });
  }

  const customerGID = `gid://shopify/Customer/${customerId}`;

  const query = `
    query GetCustomerAddresses($id: ID!) {
      customer(id: $id) {
        addresses(first: 10) {
              id
              address1
              address2
              city
              province
              country
              zip
              phone
              firstName
              lastName
              company

        }
        defaultAddress {
          address1
          address2
          city
          company
          country
          firstName
          id
          lastName
          phone
          zip
          province
        }
      }
    }
  `;

  const storeHostname = storeUrl;
  const session = await prisma.session.findFirst({
    where: { shop: storeHostname },
    orderBy: { expires: "desc" },
  });

  if (!session || !session.accessToken) {
    return json({ error: "Authentication required. Please reinstall the app." }, {
      status: 401,
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  }

  const accessToken = session.accessToken

  try {
    const response = await fetch(`https://${storeHostname}/admin/api/2024-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": `${accessToken}`,
      },
      body: JSON.stringify({
        query,
        variables: { id: customerGID },
      }),
    });

    const jsonResponse = await response.json();
    const addresses = jsonResponse?.data?.customer?.addresses || [];
    const defaultAddress = jsonResponse?.data?.customer?.defaultAddress || null;
    const lastAddress = addresses.length > 0 ? addresses[addresses.length - 1] : null;
    const mappedAddresses = addresses.map(addr => ({
      ...addr,
      first_name: addr.firstName,
      last_name: addr.lastName,
    }));
    const lastAddressMapped = lastAddress ? {
      ...lastAddress,
      first_name: lastAddress.firstName,
      last_name: lastAddress.lastName,
    } : null;
    const defaultAddressMapped = defaultAddress ? {
      ...defaultAddress,
      first_name: defaultAddress.firstName,
      last_name: defaultAddress.lastName,
    } : null;
    return json({
      allAddress: mappedAddresses,
      address: lastAddressMapped,
      defaultAddress: defaultAddressMapped,
    });

  } catch (error) {
    return json({ message: "Internal Server Error" }, { status: 500 });
  }
};
