import fs from 'node:fs'
import path from 'node:path'

import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

interface CliOptions {
  base: string
  current: string
  output?: string
  threshold: number
}

function parseArgs(argv: string[]): CliOptions {
  const options: Partial<CliOptions> = {}

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]
    switch (arg) {
      case '--base':
        options.base = next
        i += 1
        break
      case '--current':
        options.current = next
        i += 1
        break
      case '--output':
        options.output = next
        i += 1
        break
      case '--threshold':
        options.threshold = Number(next)
        i += 1
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!options.base || !options.current) {
    throw new Error('Arguments --base and --current are required.')
  }

  return {
    base: path.resolve(options.base),
    current: path.resolve(options.current),
    output: options.output ? path.resolve(options.output) : undefined,
    threshold: options.threshold ?? 0.05,
  }
}

function loadPng(filePath: string): PNG {
  const buffer = fs.readFileSync(filePath)
  return PNG.sync.read(buffer)
}

function resizePng(
  source: PNG,
  targetWidth: number,
  targetHeight: number
): PNG {
  const target = new PNG({ width: targetWidth, height: targetHeight })
  const xRatio = source.width / targetWidth
  const yRatio = source.height / targetHeight

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const srcX = x * xRatio
      const srcY = y * yRatio
      const x0 = Math.floor(srcX)
      const y0 = Math.floor(srcY)
      const x1 = Math.min(x0 + 1, source.width - 1)
      const y1 = Math.min(y0 + 1, source.height - 1)
      const dx = srcX - x0
      const dy = srcY - y0

      const dstIdx = (y * targetWidth + x) * 4
      for (let c = 0; c < 4; c++) {
        const topLeft = source.data[(y0 * source.width + x0) * 4 + c]
        const topRight = source.data[(y0 * source.width + x1) * 4 + c]
        const bottomLeft = source.data[(y1 * source.width + x0) * 4 + c]
        const bottomRight = source.data[(y1 * source.width + x1) * 4 + c]

        const top = topLeft + (topRight - topLeft) * dx
        const bottom = bottomLeft + (bottomRight - bottomLeft) * dx
        target.data[dstIdx + c] = Math.round(top + (bottom - top) * dy)
      }
    }
  }
  return target
}

function normalizeSize(base: PNG, current: PNG): [PNG, PNG, number, number] {
  if (base.width === current.width && base.height === current.height) {
    return [base, current, base.width, base.height]
  }
  console.warn(
    `Size mismatch: base=${base.width}x${base.height}, current=${current.width}x${current.height}. Resizing current to match base.`
  )
  const resized = resizePng(current, base.width, base.height)
  return [base, resized, base.width, base.height]
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2))

    const basePng = loadPng(options.base)
    const currentPng = loadPng(options.current)

    console.log(`baseSize: ${basePng.width}x${basePng.height}`)
    console.log(`currentSize: ${currentPng.width}x${currentPng.height}`)

    const [normalizedBase, normalizedCurrent, width, height] = normalizeSize(
      basePng,
      currentPng
    )

    const diffPng = new PNG({ width, height })
    const diffPixels = pixelmatch(
      normalizedBase.data,
      normalizedCurrent.data,
      diffPng.data,
      width,
      height,
      { threshold: 0.1, includeAA: true }
    )

    const totalPixels = width * height
    const diffRatio = totalPixels > 0 ? diffPixels / totalPixels : 0
    const result = diffRatio <= options.threshold ? 'PASS' : 'FAIL'

    if (options.output) {
      fs.mkdirSync(path.dirname(options.output), { recursive: true })
      fs.writeFileSync(options.output, PNG.sync.write(diffPng))
    }

    console.log(`diffPixels: ${diffPixels}`)
    console.log(`diffRatio: ${(diffRatio * 100).toFixed(4)}%`)
    console.log(`result: ${result}`)

    if (result === 'FAIL') {
      process.exitCode = 1
    }
  } catch (error: unknown) {
    console.error('Failed to compare screenshots')
    console.error(error)
    process.exitCode = 1
  }
}

main()
