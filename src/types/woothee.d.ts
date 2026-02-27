declare module "woothee" {
  interface WootheeResult {
    name: string;
    category: string;
    os: string;
    version: string;
    vendor: string;
    os_version: string;
  }

  function parse(ua: string): WootheeResult;
  function isCrawler(ua: string): boolean;

  export { parse, isCrawler };
  export default { parse, isCrawler };
}
