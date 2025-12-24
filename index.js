import { Client, GatewayIntentBits } from "discord.js";
import fs from "fs/promises";

const TOKEN = "";
// Fill in your bot token above!

const safeSlug = (v) =>
    String(v ?? "bot")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "");

const ensureDir = async (dir) => {
    try {
        await fs.mkdir(dir, { recursive: true });
        return true;
    } catch (e) {
        console.error(`[FS] Failed to create dir "${dir}":`, e?.message ?? e);
        return false;
    }
};

const collectAndWriteBotInfo = async (client) => {
    const outDir = "./bots";
    const ok = await ensureDir(outDir);
    if (!ok) return;

    const botName = client.user?.displayName || client.user?.username || "bot";
    const fileName = `${safeSlug(botName)}.json`;
    const filePath = `${outDir}/${fileName}`;

    const servers = {};
    let fetched = 0;

    for (const [id, guild] of client.guilds.cache) {
        console.log(`[GUILD] Processing ${id} - ${guild.name}`);
        try {
            await guild.fetch().catch(() => null);

            let ownerId = guild.ownerId ?? null;
            if (!ownerId) {
                try {
                    const owner = await guild.fetchOwner();
                    ownerId = owner?.id ?? null;
                } catch { }
            }

            servers[id] = {
                id: guild.id,
                name: guild.name,
                memberCount: guild.memberCount ?? null,
                ownerId,
                createdAt: guild.createdAt?.toISOString?.() ?? null,
                large: Boolean(guild.large),
                preferredLocale: guild.preferredLocale ?? null,
                verificationLevel: guild.verificationLevel ?? null,
                nsfwLevel: guild.nsfwLevel ?? null,
                premiumTier: guild.premiumTier ?? null,
                premiumSubscriptionCount: guild.premiumSubscriptionCount ?? null,
                iconURL: guild.iconURL?.({ size: 256 }) ?? null,
                bannerURL: guild.bannerURL?.({ size: 512 }) ?? null
            };

            fetched++;
        } catch (e) {
            console.error(`[GUILD] Failed for ${id}:`, e?.message ?? e);
        }
    }

    const botInfo = {
        meta: {
            generatedAt: new Date().toISOString(),
            guildCount: client.guilds.cache.size,
            guildEntriesWritten: Object.keys(servers).length,
            guildEntriesFetched: fetched
        },
        bot: {
            id: client.user?.id ?? null,
            username: client.user?.username ?? null,
            displayName: client.user?.displayName ?? null,
            tag: client.user?.tag ?? null,
            createdAt: client.user?.createdAt?.toISOString?.() ?? null,
            verified: client.user?.verified ?? null,
            avatarURL: client.user?.displayAvatarURL?.({ size: 256 }) ?? null
        },
        stats: {
            cachedUsers: client.users.cache.size,
            cachedChannels: client.channels.cache.size,
            pingMs: Number.isFinite(client.ws.ping) ? client.ws.ping : null,
            uptimeMs: client.uptime ?? null,
            memory: (() => {
                try {
                    const m = process.memoryUsage();
                    return {
                        rss: m.rss,
                        heapTotal: m.heapTotal,
                        heapUsed: m.heapUsed,
                        external: m.external
                    };
                } catch {
                    return null;
                }
            })(),
            node: {
                version: process.version,
                platform: process.platform,
                arch: process.arch
            },
            discordjs: {
                intents: client.options.intents?.toArray?.() ?? null
            }
        },
        servers
    };

    try {
        console.clear();
        await fs.writeFile(filePath, JSON.stringify(botInfo, null, 2), "utf8");
        console.log("Informations of the bot:");
        console.log(`Name: ${botName}`);
        console.log(`ID: ${botInfo.bot.id}`);
        console.log(`Servers: ${botInfo.meta.guildCount}`);
        console.log(`Ping: ${botInfo.stats.pingMs ?? "n/a"}ms`);
        console.log(`Uptime: ${botInfo.stats.uptimeMs ?? 0}ms`);
        console.log(`Created at: ${botInfo.bot.createdAt}`);
        console.log(`Saved to: ${filePath}`);
        console.log();
    } catch (e) {
        console.error(`[FS] Failed to write "${filePath}":`, e?.message ?? e);
    }
};

const main = async () => {
    console.clear();
    if (!TOKEN) {
        console.error("Missing DISCORD_TOKEN (env) or TOKEN in script.");
        process.exitCode = 1;
        return;
    }

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

    client.on("error", (e) => console.error("[CLIENT] error:", e?.message ?? e));
    client.on("warn", (w) => console.warn("[CLIENT] warn:", w));
    client.on("shardError", (e) => console.error("[SHARD] error:", e?.message ?? e));

    client.once("clientReady", async () => {
        try {
            await collectAndWriteBotInfo(client);
        } catch (e) {
            console.error("[RUN] Failed:", e?.message ?? e);
        } finally {
            try {
                await client.destroy();
            } catch { }
        }
    });

    try {
        await client.login(TOKEN);
    } catch (e) {
        console.error("[LOGIN] Failed:", e?.message ?? e);
        process.exitCode = 1;
    }
};

main();
