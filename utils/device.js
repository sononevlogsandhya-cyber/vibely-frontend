const UAParser = require("ua-parser-js");

function describeRequest(req) {
  const uaString = req.headers["user-agent"] || "";
  const parser = new UAParser(uaString);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  const browserLabel = browser.name ? `${browser.name} ${browser.version || ""}`.trim() : "Unknown browser";
  const osLabel = os.name ? `${os.name} ${os.version || ""}`.trim() : "Unknown OS";
  const deviceType = device.type || "desktop";

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "";

  return {
    deviceLabel: `${browser.name || "Unknown"} on ${os.name || "Unknown OS"}`,
    browser: browserLabel,
    os: osLabel,
    deviceType,
    ip,
    location: "", // plug a geo-IP service here later if needed (e.g. ipapi.co)
  };
}

module.exports = { describeRequest };
