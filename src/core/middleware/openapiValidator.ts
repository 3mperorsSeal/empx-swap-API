import Ajv, { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { NextFunction, Request, Response } from "express";
import path from "path";
import YAML from "yamljs";

const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: true });
addFormats(ajv);

type Validators = {
  params?: ValidateFunction;
  query?: ValidateFunction;
  body?: ValidateFunction;
};

const validatorsByOperation = new Map<string, Validators>();

function deref(schema: any, components: any, currentBaseDir?: string): any {
  if (!schema || typeof schema !== "object") return schema;
  if (schema.$ref && typeof schema.$ref === "string") {
    const ref = schema.$ref as string;
    // Internal component reference
    const match = ref.match(/^#\/components\/schemas\/(.+)$/);
    if (match) {
      const name = match[1];
      const s = components?.schemas?.[name];
      if (!s) return schema;
      return deref(s, components, currentBaseDir);
    }

    // External reference (file path)
    const [filePart, fragPart] = ref.split("#");
    if (filePart) {
      // Try resolving relative to provided base dir or top-level openapi dir
      const baseCandidates = [] as string[];
      if (currentBaseDir) baseCandidates.push(currentBaseDir);
      // default baseDir (directory of openapi.yaml)
      const defaultBase = path.join(__dirname, "..", "..");
      baseCandidates.push(defaultBase);
      baseCandidates.push(path.join(defaultBase, "openapi"));
      for (const base of baseCandidates) {
        const tryPath = path.resolve(base, filePart);
        try {
          const targetDoc = YAML.load(tryPath) as any;
          const targetComponents = targetDoc.components || {};
          if (!fragPart || fragPart === "")
            return deref(targetDoc, targetComponents, path.dirname(tryPath));
          const frag = fragPart.replace(/^\//, "");
          const parts = frag
            .split("/")
            .map((p: string) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
          let node: any = targetDoc;
          for (const key of parts) {
            if (node == null) {
              node = null;
              break;
            }
            node = node[key];
          }
          if (node == null) continue;
          return deref(node, targetComponents, path.dirname(tryPath));
        } catch (e) {
          // try next base
        }
      }
      // couldn't resolve external ref; return original schema to allow AJV to throw with context
      return schema;
    }
    return schema;
  }
  const out: any = Array.isArray(schema) ? [] : {};
  for (const k of Object.keys(schema)) {
    out[k] = deref((schema as any)[k], components, currentBaseDir);
  }
  return out;
}

function buildValidatorsFromOpenApi() {
  const specPath = path.join(__dirname, "..", "..", "openapi.yaml");
  const doc = YAML.load(specPath) as any;
  const components = doc.components || {};
  const baseDir = path.dirname(specPath);

  function resolveExternalRef(
    ref: string,
  ): { node: any; components: any } | null {
    // ref examples: './openapi/quotes.yaml#/paths/~1v1~1{chainId}~1quote~1fast'
    const [filePart, fragPart] = ref.split("#");
    if (!filePart) return null;
    // Try resolving relative to the baseDir (where openapi.yaml lives)
    const tryPaths = [
      path.resolve(baseDir, filePart),
      path.resolve(baseDir, "openapi", filePart),
    ];
    for (const filePath of tryPaths) {
      try {
        const targetDoc = YAML.load(filePath) as any;
        const components = targetDoc.components || {};
        if (!fragPart || fragPart === "")
          return { node: targetDoc, components };
        // fragPart starts with '/'
        const frag = fragPart.replace(/^\//, "");
        const parts = frag
          .split("/")
          .map((p: string) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
        let node: any = targetDoc;
        for (const key of parts) {
          if (node == null) return null;
          node = node[key];
        }
        return { node, components };
      } catch (e) {
        // try next candidate path
      }
    }
    return null;
  }

  // Pre-add component schemas to AJV for refs if needed
  if (components.schemas) {
    for (const [name, schema] of Object.entries(components.schemas)) {
      // add with key '#/components/schemas/Name' not necessary if we deref, but add for safety
      ajv.addSchema(schema as object, `#/components/schemas/${name}`);
    }
  }

  const paths = doc.paths || {};
  for (const [p, methods] of Object.entries(paths)) {
    let methodsObj = methods as any;
    let pathLocalComponents = components;
    // If the path item itself is a $ref to an external file, resolve it
    if (methodsObj && methodsObj.$ref && typeof methodsObj.$ref === "string") {
      const resolvedPathItem = resolveExternalRef(methodsObj.$ref as string);
      if (resolvedPathItem && resolvedPathItem.node) {
        methodsObj = resolvedPathItem.node as any;
        pathLocalComponents = resolvedPathItem.components || components;
        if (
          resolvedPathItem.components &&
          typeof resolvedPathItem.components === "object"
        ) {
          for (const [name, schema] of Object.entries(
            resolvedPathItem.components as any,
          )) {
            try {
              ajv.addSchema(schema as object, `#/components/schemas/${name}`);
            } catch (e) {
              // ignore duplicate schema adds
            }
          }
        }
      }
    }
    for (const [m, op] of Object.entries(methodsObj)) {
      let opAny = op as any;
      let localComponents = pathLocalComponents;
      // resolve external $ref for path item operations (rare)
      if (opAny && opAny.$ref && typeof opAny.$ref === "string") {
        const resolved = resolveExternalRef(opAny.$ref as string);
        if (resolved && resolved.node) {
          opAny = resolved.node as any;
          localComponents = resolved.components || pathLocalComponents;
          // register external component schemas with AJV so deref'd $ref work
          if (resolved.components && typeof resolved.components === "object") {
            for (const [name, schema] of Object.entries(
              resolved.components as any,
            )) {
              try {
                ajv.addSchema(schema as object, `#/components/schemas/${name}`);
              } catch (e) {
                // ignore duplicate schema adds
              }
            }
          }
        }
      }
      const operationId = opAny.operationId as string | undefined;
      if (!operationId) continue;
      const validators: Validators = {};

      // parameters
      const params = (opAny.parameters || []) as any[];
      const pathParams: any = { type: "object", properties: {}, required: [] };
      const queryParams: any = { type: "object", properties: {}, required: [] };
      for (const pdef of params) {
        const name = pdef.name;
        const schema = pdef.schema || { type: "string" };
        if (pdef.in === "path") {
          pathParams.properties[name] = deref(schema, localComponents, baseDir);
          if (pdef.required) pathParams.required.push(name);
        } else if (pdef.in === "query") {
          queryParams.properties[name] = deref(
            schema,
            localComponents,
            baseDir,
          );
          if (pdef.required) queryParams.required.push(name);
        }
      }
      if (Object.keys(pathParams.properties).length > 0) {
        validators.params = ajv.compile(pathParams) as ValidateFunction;
      }
      if (Object.keys(queryParams.properties).length > 0) {
        validators.query = ajv.compile(queryParams) as ValidateFunction;
      }

      // requestBody
      const rb = opAny.requestBody as any | undefined;
      if (
        rb &&
        rb.content &&
        rb.content["application/json"] &&
        rb.content["application/json"].schema
      ) {
        const bodySchema = deref(
          rb.content["application/json"].schema,
          localComponents,
          baseDir,
        );
        validators.body = ajv.compile(bodySchema) as ValidateFunction;
      }

      validatorsByOperation.set(operationId, validators);
    }
  }
}

// Build on import
import logger from "../logger";
try {
  buildValidatorsFromOpenApi();
} catch (e) {
  logger.error("openapiValidator.build_error", { err: e });
}

export function validateOperation(operationId: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const validators = validatorsByOperation.get(operationId) as
      | Validators
      | undefined;
    if (!validators) return next();

    if (validators.params) {
      const ok = validators.params(req.params);
      if (!ok)
        return res
          .status(400)
          .json({ error: "invalid_params", details: validators.params.errors });
    }
    if (validators.query) {
      const ok = validators.query(req.query as any);
      if (!ok)
        return res
          .status(400)
          .json({ error: "invalid_query", details: validators.query.errors });
    }
    if (validators.body) {
      const ok = validators.body(req.body);
      if (!ok)
        return res
          .status(400)
          .json({ error: "invalid_request", details: validators.body.errors });
    }
    next();
  };
}
