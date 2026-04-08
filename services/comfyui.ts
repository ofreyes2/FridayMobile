/**
 * ComfyUI Service - Image Generation
 * Handles Flux Dev image generation via ComfyUI API
 */

import { comfyuiUrl } from '@/services/knightswatch';

/**
 * Get the ComfyUI endpoint from the KNIGHTSWATCH connection manager.
 */
export const getComfyUIEndpoint = async (): Promise<string> => {
  return comfyuiUrl();
};


/**
 * Generate image using Flux Dev model
 */
export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const endpoint = await getComfyUIEndpoint();
    const randomSeed = Math.floor(Math.random() * 1000000000);

    // Create workflow with prompt and random seed
    const workflow = {
      '1': {
        class_type: 'UNETLoader',
        inputs: { unet_name: 'flux1-dev.safetensors', weight_dtype: 'default' },
      },
      '2': {
        class_type: 'DualCLIPLoader',
        inputs: {
          clip_name1: 'clip_l.safetensors',
          clip_name2: 't5xxl_fp16.safetensors',
          type: 'flux',
          device: 'default',
        },
      },
      '3': { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' } },
      '4': {
        class_type: 'CLIPTextEncodeFlux',
        inputs: {
          clip: ['2', 0],
          clip_l: prompt,
          t5xxl: prompt,
          guidance: 3.5,
        },
      },
      '5': {
        class_type: 'EmptySD3LatentImage',
        inputs: { width: 1024, height: 1024, batch_size: 1 },
      },
      '6': {
        class_type: 'KSampler',
        inputs: {
          model: ['1', 0],
          positive: ['4', 0],
          negative: ['4', 0],
          latent_image: ['5', 0],
          seed: randomSeed,
          steps: 20,
          cfg: 1.0,
          sampler_name: 'euler',
          scheduler: 'simple',
          denoise: 1.0,
        },
      },
      '7': {
        class_type: 'VAEDecode',
        inputs: { samples: ['6', 0], vae: ['3', 0] },
      },
      '8': {
        class_type: 'SaveImage',
        inputs: { images: ['7', 0], filename_prefix: 'friday' },
      },
    };

    // Queue workflow
    console.log('[ComfyUI] Queuing workflow...');
    const queueResponse = await fetch(`${endpoint}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!queueResponse.ok) {
      throw new Error('Failed to queue image generation');
    }

    const queueData: any = await queueResponse.json();
    const promptId = queueData.prompt_id;
    console.log('[ComfyUI] Queued with prompt ID:', promptId);

    // Poll for results
    let historyData = null;
    let attempts = 0;
    const maxAttempts = 120; // 4 minutes max (120 * 2 seconds)

    while (!historyData && attempts < maxAttempts) {
      attempts++;
      console.log(`[ComfyUI] Polling... (attempt ${attempts})`);

      try {
        const historyResponse = await fetch(`${endpoint}/history/${promptId}`);
        const history: any = await historyResponse.json();

        if (history && history[promptId]) {
          historyData = history[promptId];
          console.log('[ComfyUI] Generation complete!');
          break;
        }
      } catch (error) {
        console.log('[ComfyUI] Error polling history:', error);
      }

      // Wait 2 seconds before next poll
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (!historyData) {
      throw new Error('Image generation timeout - ComfyUI took too long');
    }

    // Extract image filename from history
    const outputs: any = historyData.outputs;
    if (!outputs || !outputs['8'] || !outputs['8'].images || outputs['8'].images.length === 0) {
      throw new Error('No image output found in generation results');
    }

    const imageFilename = outputs['8'].images[0].filename;
    console.log('[ComfyUI] Image filename:', imageFilename);

    // Fetch image as base64
    const imageUrl = `${endpoint}/view/${imageFilename}`;
    console.log('[ComfyUI] Fetching image from:', imageUrl);

    const imageResponse = await fetch(imageUrl);
    const blob = await imageResponse.blob();

    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data:image/...;base64, prefix if present
        const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;
        resolve(base64Data);
      };
      reader.onerror = reject;
    });

    reader.readAsDataURL(blob);
    const base64Image = await base64Promise;

    console.log('[ComfyUI] Image converted to base64, length:', base64Image.length);
    return base64Image;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ComfyUI] Error generating image:', errorMessage);
    throw error;
  }
};
