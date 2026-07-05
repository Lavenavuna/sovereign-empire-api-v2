// bloom-simple.js - Complete Working Version
import fs from "fs";

const BLOOM_API_KEY = process.env.BLOOM_API_KEY || "";
const BLOOM_API_BASE = "https://www.trybloom.ai/api/v1";

if (!BLOOM_API_KEY) {
    console.log("ERROR: BLOOM_API_KEY not set");
    console.log("Run: $env:BLOOM_API_KEY = \"bloom_sk_YOUR_KEY\"");
    process.exit(1);
}

async function bloomFetch(path, options = {}) {
    const url = BLOOM_API_BASE + path;
    console.log("Requesting:", url);
    
    const response = await fetch(url, {
        ...options,
        headers: {
            "x-api-key": BLOOM_API_KEY,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error("API Error:", response.status);
        console.error("Error details:", JSON.stringify(data, null, 2));
        throw new Error(data.error?.message || data.message || "API error");
    }
    return data;
}

async function testConnection() {
    console.log("Testing API connection...");
    try {
        const data = await bloomFetch("/brands");
        console.log("SUCCESS: Connected!");
        console.log("Brands found:", data.length || 0);
        return data;
    } catch (e) {
        console.error("Failed:", e.message);
        throw e;
    }
}

async function createBrand(name, description) {
    console.log("Creating brand:", name);
    const data = await bloomFetch("/brands", {
        method: "POST",
        body: JSON.stringify({
            name: name,
            description: description || "",
            url: "https://sovereign-empire-api-v2-production.up.railway.app"
        })
    });
    console.log("Full response:", JSON.stringify(data, null, 2));
    const brandId = data.id || data.brandId || data._id || data.data?.id;
    console.log("Brand created with ID:", brandId);
    return { id: brandId, data };
}

async function generateCreative(opts) {
    console.log("Generating:", opts.prompt);
    const data = await bloomFetch("/images/generations", {
        method: "POST",
        body: JSON.stringify({
            brandSessionId: opts.brandSessionId,
            prompt: opts.prompt,
            aspectRatio: opts.aspectRatio || "16:9",
            imageSize: opts.imageSize || "2K",
            model: opts.model || "pro",
            variantCount: opts.variantCount || 1
        })
    });
    console.log("Generation started:", data.imageIds?.length || 0, "images");
    return data.imageIds;
}

async function getImage(imageId) {
    console.log("Waiting for image:", imageId);
    const data = await bloomFetch("/images/" + imageId + "?wait=true");
    console.log("Ready:", data.imageUrl);
    return data;
}

async function generateAndWait(opts) {
    const imageIds = await generateCreative(opts);
    const results = [];
    for (const id of imageIds || []) {
        results.push(await getImage(id));
    }
    return results;
}

async function runBatchCampaign(config) {
    console.log("\nBATCH CAMPAIGN");
    console.log("=".repeat(50));
    
    let brandId = config.brandSessionId;
    if (!brandId) {
        const result = await createBrand(config.brandName || "Auto Brand", config.brandDesc || "");
        brandId = result.id;
        if (!brandId) {
            console.error("Failed to get brand ID, using fallback");
            console.log("Please check your Bloom dashboard for the brand ID");
            return;
        }
    }
    
    const prompts = config.prompts || [
        "Modern social media ad for AI automation platform",
        "Professional LinkedIn banner for tech company",
        "Engaging Instagram post about AI innovation"
    ];
    
    const results = [];
    for (const prompt of prompts) {
        console.log("\nProcessing:", prompt);
        try {
            const result = await generateAndWait({
                brandSessionId: brandId,
                prompt: prompt,
                aspectRatio: "16:9",
                variantCount: 1
            });
            results.push({ prompt, result });
        } catch (e) {
            console.error("Failed:", e.message);
            results.push({ prompt, error: e.message });
        }
    }
    
    const output = { brandId, results, timestamp: new Date().toISOString() };
    fs.writeFileSync("./bloom-batch-results.json", JSON.stringify(output, null, 2));
    console.log("\nResults saved to: bloom-batch-results.json");
    return output;
}

async function main() {
    const command = process.argv[2] || "help";
    console.log("BLOOM AI");
    console.log("=".repeat(40));
    
    switch (command) {
        case "test":
            await testConnection();
            break;
        case "brand":
            const name = process.argv[3] || "Sovereign Empire";
            const desc = process.argv[4] || "";
            await createBrand(name, desc);
            break;
        case "generate":
            const brandId = process.argv[3];
            const prompt = process.argv[4] || "Create a professional ad";
            if (!brandId) {
                console.log("Usage: node bloom-simple.js generate <brandSessionId> [prompt]");
                break;
            }
            const result = await generateAndWait({ brandSessionId: brandId, prompt });
            console.log("Generated:", result[0]?.imageUrl);
            break;
        case "batch":
            const brandName = process.argv[3] || "Sovereign Empire";
            await runBatchCampaign({ brandName });
            break;
        default:
            console.log("Bloom AI Commands:");
            console.log("  test           - Test API connection");
            console.log("  brand [name]   - Create a brand");
            console.log("  generate <id> [prompt] - Generate creative");
            console.log("  batch [name]   - Run batch campaign");
            console.log("");
            console.log("Examples:");
            console.log("  node bloom-simple.js test");
            console.log("  node bloom-simple.js brand \"My Brand\"");
            console.log("  node bloom-simple.js generate brand-123 \"Create an ad\"");
            console.log("  node bloom-simple.js batch \"My Brand\"");
    }
}

main();
