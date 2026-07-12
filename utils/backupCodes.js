const crypto = require("crypto");
const bcrypt = require("bcryptjs");

/** Generates N human-friendly backup codes like "XJ4K-9QRT" */
function generatePlainCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

async function hashCodes(plainCodes) {
  const hashed = [];
  for (const code of plainCodes) {
    const codeHash = await bcrypt.hash(code, 10);
    hashed.push({ codeHash, used: false });
  }
  return hashed;
}

async function verifyAndConsumeCode(user, plainCode) {
  if (!user.twoFactor?.backupCodes?.length) return false;
  for (const entry of user.twoFactor.backupCodes) {
    if (entry.used) continue;
    const match = await bcrypt.compare(plainCode.trim().toUpperCase(), entry.codeHash);
    if (match) {
      entry.used = true;
      return true;
    }
  }
  return false;
}

module.exports = { generatePlainCodes, hashCodes, verifyAndConsumeCode };
