import type { ImageInput } from '../../ai/types'

/** Downscale a photo to at most `maxSide` px and return JPEG base64 (iPhone photos are far too large to send raw). */
export function fileToImageInput(file: File, maxSide = 1280): Promise<ImageInput> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); return reject(new Error('Canvas unavailable')) }
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      canvas.width = 0
      canvas.height = 0
      resolve({ mediaType: 'image/jpeg', base64: dataUrl.split(',')[1] })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the photo')) }
    img.src = url
  })
}
