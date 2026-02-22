declare module "bcrypt";
declare module "yamljs";
declare module "swagger-ui-express";
declare module "pg";

// Allow importing .yaml files if needed
declare module "*.yaml";

declare global {
  namespace Express {
    interface Request {
      // Populated by requestId middleware; optional so existing code stays compatible
      requestId?: string;
    }
  }
}
