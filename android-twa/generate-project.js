const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const {
  TwaManifest, TwaGenerator, JdkHelper, KeyTool, Config,
} = require("@bubblewrap/core");
const { InquirerPrompt } = require("@bubblewrap/cli/dist/lib/Prompt");
const { generateTwaProject, generateManifestChecksumFile } = require("@bubblewrap/cli/dist/lib/cmds/shared");

const TARGET_DIR = __dirname;
const MANIFEST_URL = "https://toystrader-a494f.web.app/manifest.json";
const CONFIG_PATH = path.join(require("os").homedir(), ".bubblewrap", "config.json");

// printMessage only - all the actual prompting in bubblewrap's own `init`
// command is bypassed here in favor of the defaults TwaManifest derives
// from the live manifest.json, which were inspected beforehand and already
// match the real app (see conversation).
const prompt = new InquirerPrompt();

function randomPassword() {
  return crypto.randomBytes(18).toString("base64").replace(/[/+=]/g, "x");
}

(async () => {
  const config = await Config.loadConfig(CONFIG_PATH);

  let twaManifest = await TwaManifest.fromWebManifest(MANIFEST_URL);
  twaManifest.signingKey.path = path.join(TARGET_DIR, twaManifest.signingKey.path);
  // The default (21) is older than androidbrowserhelper 2.7.4 (the actual
  // TWA runtime library) requires - its own manifest declares minSdk 24,
  // and Gradle's manifest merger fails outright rather than silently
  // allowing the mismatch.
  twaManifest.minSdkVersion = 24;

  await twaManifest.saveToFile(path.join(TARGET_DIR, "twa-manifest.json"));

  const twaGenerator = new TwaGenerator();
  await generateTwaProject(prompt, twaGenerator, TARGET_DIR, twaManifest);
  await generateManifestChecksumFile(path.join(TARGET_DIR, "twa-manifest.json"), TARGET_DIR);

  // Signing key - same identity-info/keytool flow as bubblewrap init's
  // createSigningKey(), just with generated passwords instead of prompting.
  // These MUST be backed up somewhere safe (password manager) - losing them
  // means losing the ability to ever update this app on the Play Store
  // under this package id, short of Play App Signing key-reset support.
  if (fs.existsSync(twaManifest.signingKey.path)) {
    console.log("\nSigning key already exists, leaving it untouched:", twaManifest.signingKey.path);
  } else {
    const jdkHelper = new JdkHelper(process, config);
    const keytool = new KeyTool(jdkHelper);
    // Modern `keytool -genkeypair` defaults to PKCS12 keystores, which
    // don't support a key password different from the store password - it
    // silently ignores a differing -keypass, so using two different random
    // values here just means apksigner/jarsigner fail to unlock the key
    // later with a confusing BadPaddingException. One password for both.
    const keystorePassword = randomPassword();
    const keyPassword = keystorePassword;

    await keytool.createSigningKey({
      fullName: "ToyTrader",
      organizationalUnit: "ToyTrader",
      organization: "ToyTrader",
      country: "LT",
      password: keystorePassword,
      keypassword: keyPassword,
      alias: twaManifest.signingKey.alias,
      path: twaManifest.signingKey.path,
    });

    const credentialsPath = path.join(TARGET_DIR, "KEYSTORE_CREDENTIALS_DO_NOT_COMMIT.txt");
    fs.writeFileSync(credentialsPath,
      `Keystore: ${twaManifest.signingKey.path}\n` +
      `Alias: ${twaManifest.signingKey.alias}\n` +
      `Keystore password: ${keystorePassword}\n` +
      `Key password: ${keyPassword}\n` +
      `\nBack these up in a password manager immediately, then delete this file.\n` +
      `Losing them means you can never update this app on the Play Store again\n` +
      `under this package id (unless Play App Signing is enrolled and Google\n` +
      `support can reset the upload key).\n`
    );
    console.log("Credentials written to:", credentialsPath);
  }

  console.log("\nProject generated at:", TARGET_DIR);
  console.log("packageId:", twaManifest.packageId);
})().catch((err) => {
  console.error("Project generation failed:", err);
  process.exit(1);
});
