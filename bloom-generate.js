// bloom-generate.js - Working Generation Script
import fs from "fs";

const BLOOM_API_KEY = process.env.BLOOM_API_KEY || "";
const BLOOM_API_BASE = "https://www.trybloom.ai/api/v1";
const BRAND_ID = "fb99d62d-6df1-469f-bfc3-ee173410c0a0";

if (!BLOOM_API_KEY) {
    console.log("ERROR: BLOOM_API_KEY not set");
    console.log("Run: $env:BLOOM_API_KEY = \"bloom_sk_YOUR_KEY\"");
    process.exit(1);
}

async function generateImage() {
    console.log("🎨 Generating image...");
    console.log("Brand ID:", BRAND_ID);
    
    const url = `${BLOOM_API_BASE}/images/generations`;
    console.log("Requesting:", url);
    
    const payload = {
        brandSessionId: BRAND_ID,
        prompt: "Modern social media ad for AI automation platform showing business growth and innovation with purple and blue gradient, professional, clean, futuristic",
        aspectRatio: "16:9",
        imageSize: "2K",
        model: "pro",
        variantCount: 2
    };
    
    console.log("Payload:", JSON.stringify(payload, null, 2));
    
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "x-api-key": BLOOM_API_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    console.log("Response Status:", response.status);
    console.log("Full Response:", JSON.stringify(data, null, 2));
    
    if (!response.ok) {
        console.error("❌ API Error:", data);
        return;
    }
    
    if (data.imageIds && data.imageIds.length > 0) {
        console.log("✅ Generation started! Image IDs:", data.imageIds);
        
        // Wait for images
        for (const id of data.imageIds) {
            console.log(`⏳ Waiting for image ${id}...`);
            await new Promise(r => setTimeout(r, 5000));
            const img = await fetch(`${BLOOM_API_BASE}/images/${id}?wait=true`, {
                headers: { "x-api-key": BLOOM_API_KEY }
            });
            const imgData = await img.json();
            console.log(`✅ Image ready:`, imgData.imageUrl || imgData.url);
        }
    } else {
        console.log("⚠️ No images generated. Response:", data);
    }
}

generateImage().catch(console.error);