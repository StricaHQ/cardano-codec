// entry for the standalone browser bundle: script-tag users have no module
// system to bring their own cbors/Buffer, and the parsers dispatch on
// instanceof of the copies bundled here, so decode and parse must share them
export * from "./index";
export * as cbors from "@stricahq/cbors";
export { Buffer } from "buffer";
