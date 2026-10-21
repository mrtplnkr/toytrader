const path = require("path");
const os = require("os");
const fs = require("fs");
const { AndroidSdkToolsInstaller } = require("@bubblewrap/cli/dist/lib/AndroidSdkToolsInstaller");
const { InquirerPrompt } = require("@bubblewrap/cli/dist/lib/Prompt");
const { Config } = require("@bubblewrap/core");

const DEFAULT_CONFIG_FOLDER = path.join(os.homedir(), ".bubblewrap");
const DEFAULT_SDK_FOLDER = path.join(DEFAULT_CONFIG_FOLDER, "android_sdk");
const CONFIG_PATH = path.join(DEFAULT_CONFIG_FOLDER, "config.json");

// The existing SDK at %LOCALAPPDATA%\Android\Sdk (installed 2022) ships an
// old cmdline-tools sdkmanager that throws NoClassDefFoundError against
// JDK 17 (javax.xml.bind was removed from the JDK in Java 9+, old
// sdkmanager still expects it) - installing bubblewrap's own current SDK
// avoids relying on that old, now-incompatible sdkmanager build.
const prompt = new InquirerPrompt();

(async () => {
  await fs.promises.mkdir(DEFAULT_SDK_FOLDER, { recursive: true });
  const installer = new AndroidSdkToolsInstaller(process, prompt);
  await installer.install(DEFAULT_SDK_FOLDER);
  console.log("Android SDK installed at:", DEFAULT_SDK_FOLDER);

  const existing = await Config.loadConfig(CONFIG_PATH);
  const config = new Config(existing.jdkPath, DEFAULT_SDK_FOLDER);
  await config.saveConfig(CONFIG_PATH);
  console.log("config.json updated");
})().catch((err) => {
  console.error("Android SDK install failed:", err);
  process.exit(1);
});
