import swaggerJSDoc from "swagger-jsdoc";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "My Express API",
      version: "1.0.0",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}/api/v1`,
      },
      {
        url: `${process.env.PROD_SERVER_URL}`,
      },
    ],
  },
  apis: ["./src/app/**/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);

// Optional config for UI
export const swaggerUiOptions = {
  explorer: false,
};
