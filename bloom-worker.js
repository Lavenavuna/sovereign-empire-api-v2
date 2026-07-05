// bloom-worker.js - Bloom AI Automation for PowerShell
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import fs from 'fs';
import path from 'path';

// ============================================
// CONFIGURATION
// ============================================
const BLOOM_API_KEY = process.env.BLOOM_API_KEY || 'YOUR_BLOOM_API_KEY_HERE';
const BLOOM_API_BASE = 'https://www.trybloom.ai/api/v1';

if (!BLOOM_API_KEY || BLOOM_API_KEY === 'YOUR_BLOOM_API_KEY_HERE') {
    console.log('⚠️  Please set BLOOM_API_KEY environment variable');
    console.log('   Run: $env:BLOOM_API_KEY = "bloom_sk_..."');
}

// ============================================
// BLOOM API FUNCTIONS
// ============================================
async function bloomFetch(path, options = {}) {
    const url = `${BLOOM_API_BASE}${path}`;
    const response = await fetch(url, {
        ...options,
        headers: {
            'x-api-key': BLOOM_API_KEY,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error(`❌ Bloom API Error: ${response.status}`, data);
        throw new Error(data.error?.message || 'Bloom API error');
    }
    
    return data;
}

// Upload a reference image
export async function uploadReferenceImage(brandSessionId, imagePath) {
    console.log(`📤 Uploading image: ${imagePath}`);
    
    const formData = new FormData();
    formData.append('brandSessionId', brandSessionId);
    
    const imageBuffer = fs.readFileSync(imagePath);
    const blob = new Blob([imageBuffer]);
    formData.append('file', blob, path.basename(imagePath));
    
    const response = await fetch(`${BLOOM_API_BASE}/images`, {
        method: 'POST',
        headers: {
            'x-api-key': BLOOM_API_KEY
        },
        body: formData
    });
    
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || 'Upload failed');
    }
    
    console.log(`✅ Image uploaded: ${data.imageId}`);
    return data.imageId;
}

// Generate creative assets
export async function generateCreative(opts) {
    console.log(`🎨 Generating creative for brand: ${opts.brandSessionId}`);
    console.log(`   Prompt: ${opts.prompt}`);
    
    const data = await bloomFetch('/images/generations', {
        method: 'POST',
        body: JSON.stringify({
            brandSessionId: opts.brandSessionId,
            prompt: opts.prompt,
            aspectRatio: opts.aspectRatio || '16:9',
            imageSize: opts.imageSize || '2K',
            model: opts.model || 'pro',
            variantCount: opts.variantCount || 1,
            referenceImageIds: opts.referenceImageIds || []
        })
    });
    
    console.log(`✅ Generation started: ${data.imageIds?.length || 0} images`);
    return data.imageIds;
}

// Get generated image (waits for completion)
export async function getImage(imageId) {
    console.log(`⏳ Waiting for image: ${imageId}`);
    const data = await bloomFetch(`/images/${imageId}?wait=true`);
    console.log(`✅ Image ready: ${data.imageUrl}`);
    return data;
}

// Generate and wait for results
export async function generateAndWait(opts) {
    const imageIds = await generateCreative(opts);
    const results = [];
    
    for (const id of imageIds) {
        const image = await getImage(id);
        results.push(image);
    }
    
    return results;
}

// ============================================
// POWERSHELL TEST FUNCTION
// ============================================
export async function quickTest() {
    console.log('\n🧪 TESTING BLOOM AI AUTOMATION');
    console.log('='.repeat(50));
    
    // Check API key
    if (!BLOOM_API_KEY || BLOOM_API_KEY === 'YOUR_BLOOM_API_KEY_HERE') {
        console.log('❌ No API key found!');
        console.log('   Set it with: $env:BLOOM_API_KEY = "bloom_sk_..."');
        return;
    }
    
    console.log('✅ API key found');
    
    // Test API connection
    try {
        console.log('\n📡 Testing API connection...');
        const models = await bloomFetch('/models');
        console.log('✅ Connected to Bloom API');
        console.log(`   Available models: ${models.length || 'N/A'}`);
    } catch (error) {
        console.error('❌ API connection failed:', error.message);
        return;
    }
    
    // Test brand session (create a test brand)
    console.log('\n🏷️  Creating test brand session...');
    try {
        const brand = await bloomFetch('/brands', {
            method: 'POST',
            body: JSON.stringify({
                name: 'Test Brand - PowerShell Automation',
                description: 'Created via PowerShell automation test'
            })
        });
        
        console.log(`✅ Brand created: ${brand.id}`);
        console.log(`   Name: ${brand.name}`);
        
        // Test creative generation
        console.log('\n🎨 Testing creative generation...');
        const result = await generateAndWait({
            brandSessionId: brand.id,
            prompt: 'Modern, clean, professional social media ad for a tech company',
            aspectRatio: '16:9',
            variantCount: 1
        });
        
        console.log('\n✅ Test complete!');
        console.log(`   Generated image: ${result[0]?.imageUrl || 'N/A'}`);
        console.log(`   Brand ID: ${brand.id} (save this for future use)`);
        
        // Save results
        const output = {
            brandId: brand.id,
            imageUrl: result[0]?.imageUrl,
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync('./bloom-test-result.json', JSON.stringify(output, null, 2));
        console.log('\n📁 Results saved to: bloom-test-result.json');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// ============================================
// BULLMQ WORKER SETUP (for 24/7 automation)
// ============================================
const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null
});

const bloomQueue = new Queue('bloom-creative', { connection });

const bloomWorker = new Worker('bloom-creative', async (job) => {
    console.log(`🔄 Processing job: ${job.id}`);
    console.log(`   Client: ${job.data.clientId}`);
    console.log(`   Prompt: ${job.data.prompt}`);
    
    const result = await generateAndWait({
        brandSessionId: job.data.brandSessionId,
        prompt: job.data.prompt,
        aspectRatio: job.data.aspectRatio || '16:9',
        variantCount: job.data.variantCount || 1,
        referenceImageIds: job.data.referenceImageIds || []
    });
    
    // Save result
    const outputFile = `./bloom-results-${job.id}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`✅ Job ${job.id} complete`);
    console.log(`📁 Results saved to: ${outputFile}`);
    
    return result;
}, { connection });

bloomWorker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
});

bloomWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job.id} failed:`, err.message);
});

// Add a job to the queue
export async function addCreativeJob(clientId, brandSessionId, prompt) {
    const job = await bloomQueue.add('generate', {
        clientId,
        brandSessionId,
        prompt,
        aspectRatio: '16:9',
        variantCount: 1
    });
    console.log(`📋 Job added: ${job.id}`);
    return job;
}

// ============================================
// MAIN - RUN FROM POWERSHELL
// ============================================
async function main() {
    console.log('🌸 BLOOM AI AUTOMATION');
    console.log('='.repeat(50));
    console.log('1. Quick Test (run once)');
    console.log('2. Start Worker (24/7 automation)');
    console.log('3. Add a job to the queue');
    console.log('4. Upload a reference image');
    console.log('5. Exit');
    console.log('='.repeat(50));
    
    // Auto-run test if no args
    if (process.argv.length < 3) {
        await quickTest();
        console.log('\n💡 To start the worker: node bloom-worker.js worker');
        return;
    }
    
    const command = process.argv[2];
    
    switch (command) {
        case 'test':
            await quickTest();
            break;
        case 'worker':
            console.log('🚀 Starting 24/7 Bloom AI Worker...');
            console.log('📋 Waiting for jobs...');
            break;
        case 'add':
            const clientId = process.argv[3] || 'test-client';
            const brandId = process.argv[4] || 'test-brand';
            const prompt = process.argv[5] || 'Generate a modern ad for my business';
            await addCreativeJob(clientId, brandId, prompt);
            break;
        case 'upload':
            const brandSessionId = process.argv[3];
            const imagePath = process.argv[4];
            if (!brandSessionId || !imagePath) {
                console.log('Usage: node bloom-worker.js upload <brandSessionId> <imagePath>');
            } else {
                await uploadReferenceImage(brandSessionId, imagePath);
            }
            break;
        default:
            console.log('Unknown command. Available: test, worker, add, upload');
    }
}

main();