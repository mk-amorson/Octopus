// Next compiles this file for both the edge and the Node.js runtimes
// (middleware lives in edge, route handlers in Node). To keep the
// node-only node-manager bootstrap out of the edge bundle we put the
// real work in a sibling `instrumentation.node.ts` and dynamic-import
// it only when the runtime actually is Node. Webpack's static
// analyser honours this exact pattern (see Next docs on
// instrumentation).

export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    await import("./instrumentation.node");
  }
}
