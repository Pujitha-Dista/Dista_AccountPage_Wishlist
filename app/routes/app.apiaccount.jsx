import { json } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const action = async ({ request }) => {
  try {
    const body = await request.json();
    const id = body.id;
    const firstName = body.firstName;
    const lastName = body.lastName;
    const phone = body.phone;
    const gender = body.gender;
    const dob = body.dob;
    const storeUrl = body.storeUrl
    const mutation = {
      query: `
      mutation customerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            firstName
            lastName
            phone
            metafields(first: 10) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
      variables: {
        input: {
          id: `gid://shopify/Customer/${id}`,
          firstName,
          lastName,
          phone,
          metafields: [
            {
              namespace: "profile",
              key: "gender",
              type: "single_line_text_field",
              value: gender || ""
            },
            {
              namespace: "profile",
              key: "dob",
              type: "single_line_text_field",
              value: dob || ""
            }
          ]
        }
      }
    };

    const storeHostname = storeUrl; 
    const session = await prisma.session.findFirst({
      where: { shop: storeHostname}
    });

    if (!session || !session.accessToken) {
      return json({ error: "Authentication required. Please reinstall the app." }, {
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }
    const accessToken =session.accessToken

    try {
      const response = await fetch(`https://${storeHostname}/admin/api/2023-07/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": `${accessToken}`,
        },
        body: JSON.stringify(mutation)
      });
      const result = await response.json();
      if (result.data?.customerUpdate?.userErrors?.length) {
        return json(
          { success: false },
          { message: result.data.customerUpdate.userErrors },
          { headers: { "Access-Control-Allow-Origin": "*" } }
        );
      }
      return json(
        { success: true },
        { customer: result.data.customerUpdate.customer },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    } catch (err) {
      return json(
        { message: "Internal Server Error" },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }
  } catch (error) {
    return json(
      { message: "Internal Server Error" },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
};