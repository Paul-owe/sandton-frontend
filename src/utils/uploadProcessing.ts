const MAX_IMAGE_WIDTH = 2200
const MAX_IMAGE_HEIGHT = 2200
const JPEG_QUALITY = 0.86
const MAX_SCAN_CROP = 0.35

export type ScanCrop = {
  top: number
  right: number
  bottom: number
  left: number
}

export type ScanPageDraft = {
  id: string
  file: File
  previewUrl: string
  rotation: 0 | 90 | 180 | 270
  crop: ScanCrop
}

export const defaultScanCrop = (): ScanCrop => ({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
})

export async function prepareDocumentUploadFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file
  }

  const bitmap = await loadImageBitmap(file)
  try {
    const { width, height } = scaleDimensions(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      return file
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)

    const blob = await canvasToJpegBlob(canvas)
    if (!blob) {
      return file
    }

    return new File([blob], toJpegFileName(file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    bitmap.close?.()
  }
}

export async function buildScannedPdfFile(pages: ScanPageDraft[], fileName = 'scanned-document.pdf'): Promise<File> {
  if (pages.length === 0) {
    throw new Error('Add at least one scan page before building the PDF.')
  }

  const { PDFDocument } = await import('pdf-lib')
  const pdfDocument = await PDFDocument.create()

  for (const page of pages) {
    const jpegFile = await renderScanPageToJpeg(page)
    const imageBytes = await jpegFile.arrayBuffer()
    const image = await pdfDocument.embedJpg(imageBytes)
    const pdfPage = pdfDocument.addPage([image.width, image.height])
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    })
  }

  const pdfBytes = await pdfDocument.save()
  const normalizedPdfBytes = Uint8Array.from(pdfBytes)
  return new File([normalizedPdfBytes], toPdfFileName(fileName), {
    type: 'application/pdf',
    lastModified: Date.now(),
  })
}

export async function renderScanPageToJpeg(page: Pick<ScanPageDraft, 'file' | 'rotation' | 'crop'>): Promise<File> {
  const bitmap = await loadImageBitmap(page.file)
  try {
    const crop = clampCrop(page.crop)
    const sourceWidth = bitmap.width
    const sourceHeight = bitmap.height
    const cropLeft = Math.round(sourceWidth * crop.left)
    const cropTop = Math.round(sourceHeight * crop.top)
    const cropRight = Math.round(sourceWidth * crop.right)
    const cropBottom = Math.round(sourceHeight * crop.bottom)

    const croppedWidth = Math.max(1, sourceWidth - cropLeft - cropRight)
    const croppedHeight = Math.max(1, sourceHeight - cropTop - cropBottom)
    const scaled = scaleDimensions(croppedWidth, croppedHeight)
    const rotation = normalizeRotation(page.rotation)
    const rotatedLandscape = rotation === 90 || rotation === 270

    const canvas = document.createElement('canvas')
    canvas.width = rotatedLandscape ? scaled.height : scaled.width
    canvas.height = rotatedLandscape ? scaled.width : scaled.height

    const context = canvas.getContext('2d')
    if (!context) {
      return page.file
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    applyRotationTransform(context, rotation, canvas.width, canvas.height)
    context.drawImage(
      bitmap,
      cropLeft,
      cropTop,
      croppedWidth,
      croppedHeight,
      0,
      0,
      scaled.width,
      scaled.height,
    )

    const blob = await canvasToJpegBlob(canvas)
    if (!blob) {
      return page.file
    }

    return new File([blob], toJpegFileName(page.file.name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    bitmap.close?.()
  }
}

function clampCrop(crop?: Partial<ScanCrop>): ScanCrop {
  const nextCrop = {
    top: clampFraction(crop?.top ?? 0),
    right: clampFraction(crop?.right ?? 0),
    bottom: clampFraction(crop?.bottom ?? 0),
    left: clampFraction(crop?.left ?? 0),
  }

  const horizontalTotal = nextCrop.left + nextCrop.right
  if (horizontalTotal > 0.8) {
    const scale = 0.8 / horizontalTotal
    nextCrop.left *= scale
    nextCrop.right *= scale
  }

  const verticalTotal = nextCrop.top + nextCrop.bottom
  if (verticalTotal > 0.8) {
    const scale = 0.8 / verticalTotal
    nextCrop.top *= scale
    nextCrop.bottom *= scale
  }

  return nextCrop
}

function clampFraction(value: number) {
  return Math.min(MAX_SCAN_CROP, Math.max(0, Number.isFinite(value) ? value : 0))
}

function normalizeRotation(rotation: number = 0): 0 | 90 | 180 | 270 {
  const normalized = ((rotation % 360) + 360) % 360
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized
  }
  return 0
}

function applyRotationTransform(
  context: CanvasRenderingContext2D,
  rotation: 0 | 90 | 180 | 270,
  width: number,
  height: number,
) {
  switch (rotation) {
    case 90:
      context.translate(width, 0)
      context.rotate(Math.PI / 2)
      break
    case 180:
      context.translate(width, height)
      context.rotate(Math.PI)
      break
    case 270:
      context.translate(0, height)
      context.rotate(-Math.PI / 2)
      break
    default:
      break
  }
}

async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, {
      imageOrientation: 'from-image',
      premultiplyAlpha: 'default',
      colorSpaceConversion: 'default',
    })
  }

  const image = await loadHtmlImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to prepare image for upload.')
  }
  context.drawImage(image, 0, 0)
  return createImageBitmap(canvas)
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Unable to read the selected image.'))
    }
    image.src = url
  })
}

function scaleDimensions(width: number, height: number) {
  const ratio = Math.min(1, MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height)
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', JPEG_QUALITY)
  })
}

function toJpegFileName(name: string) {
  const baseName = name.replace(/\.[^.]+$/, '')
  return `${baseName || 'capture'}.jpg`
}

function toPdfFileName(name: string) {
  const baseName = name.replace(/\.[^.]+$/, '')
  return `${baseName || 'scanned-document'}.pdf`
}
