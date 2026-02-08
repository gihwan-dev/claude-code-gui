import fs from 'node:fs'
import path from 'node:path'

import dotenv from 'dotenv'
import { PNG } from 'pngjs'

dotenv.config({ path: ['.env.local', '.env'] })

interface CliOptions {
  fileKey: string
  nodeId: string
  output: string
  scale: number
}

interface FigmaNodeResponse {
  nodes: Record<
    string,
    {
      document: {
        absoluteBoundingBox: {
          x: number
          y: number
          width: number
          height: number
        }
      }
    }
  >
}

interface FigmaImagesResponse {
  err: string | null
  images: Record<string, string | null>
}

function parseFigmaUrl(url: string): { fileKey: string; nodeId: string } {
  const urlObj = new URL(url)

  const branchMatch = urlObj.pathname.match(
    /\/design\/[^/]+\/branch\/([^/]+)\//
  )
  const fileKeyMatch = urlObj.pathname.match(/\/design\/([^/]+)\//)

  const fileKey = branchMatch ? branchMatch[1] : fileKeyMatch?.[1]
  if (!fileKey) {
    throw new Error(`Cannot extract fileKey from URL: ${url}`)
  }

  const nodeIdParam = urlObj.searchParams.get('node-id')
  if (!nodeIdParam) {
    throw new Error(`Cannot extract node-id from URL: ${url}`)
  }

  const nodeId = nodeIdParam.replace('-', ':')

  return { fileKey, nodeId }
}

function parseArgs(argv: string[]): CliOptions {
  const options: Partial<CliOptions> & { url?: string } = {}

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]
    switch (arg) {
      case '--url':
        options.url = next
        i += 1
        break
      case '--file-key':
        options.fileKey = next
        i += 1
        break
      case '--node-id':
        options.nodeId = next
        i += 1
        break
      case '--output':
        options.output = next
        i += 1
        break
      case '--scale':
        options.scale = Number(next)
        i += 1
        break
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (options.url) {
    const parsed = parseFigmaUrl(options.url)
    options.fileKey ??= parsed.fileKey
    options.nodeId ??= parsed.nodeId
  }

  if (!options.fileKey || !options.nodeId) {
    throw new Error(
      'Either --url or both --file-key and --node-id are required.'
    )
  }

  if (!options.output) {
    throw new Error('--output is required.')
  }

  return {
    fileKey: options.fileKey,
    nodeId: options.nodeId,
    output: path.resolve(options.output),
    scale: options.scale ?? 2,
  }
}

async function fetchFigmaImageUrl(
  fileKey: string,
  nodeId: string,
  scale: number,
  token: string
): Promise<string> {
  const url = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${scale}`

  const response = await fetch(url, {
    headers: { 'X-Figma-Token': token },
  })

  if (response.status === 403) {
    throw new Error(
      'Figma API 403 Forbidden: 파일 접근 권한을 확인하세요. 토큰에 해당 파일의 읽기 권한이 필요합니다.'
    )
  }

  if (response.status === 404) {
    throw new Error(
      'Figma API 404 Not Found: fileKey 또는 nodeId가 올바른지 확인하세요.'
    )
  }

  if (!response.ok) {
    throw new Error(
      `Figma API error: ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as FigmaImagesResponse

  if (data.err) {
    throw new Error(`Figma API returned error: ${data.err}`)
  }

  const imageUrl = data.images[nodeId]
  if (!imageUrl) {
    throw new Error(
      `이미지 URL이 null입니다. 노드 "${nodeId}"가 렌더링 가능한 노드인지 확인하세요. (예: Frame, Component, Instance 등)`
    )
  }

  return imageUrl
}

async function fetchNodeDimensions(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<{ width: number; height: number }> {
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`

  const response = await fetch(url, {
    headers: { 'X-Figma-Token': token },
  })

  if (!response.ok) {
    throw new Error(
      `Figma nodes API error: ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as FigmaNodeResponse
  const node = data.nodes[nodeId]

  if (!node?.document?.absoluteBoundingBox) {
    throw new Error(`Node "${nodeId}" does not have absoluteBoundingBox.`)
  }

  const { width, height } = node.document.absoluteBoundingBox
  return { width, height }
}

async function downloadImage(
  imageUrl: string,
  outputPath: string
): Promise<void> {
  const response = await fetch(imageUrl)

  if (!response.ok) {
    throw new Error(
      `Failed to download image: ${response.status} ${response.statusText}`
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, buffer)
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2))

    const token = process.env.FIGMA_TOKEN
    if (!token) {
      throw new Error(
        'FIGMA_TOKEN 환경변수가 설정되지 않았습니다.\n' +
          'Figma Personal Access Token을 생성하세요:\n' +
          '  1. https://www.figma.com/developers/api#access-tokens 에서 토큰 생성\n' +
          '  2. .env 파일에 FIGMA_TOKEN=your_token 추가'
      )
    }

    console.log(
      `Fetching image URL for node ${options.nodeId} from file ${options.fileKey}...`
    )
    const imageUrl = await fetchFigmaImageUrl(
      options.fileKey,
      options.nodeId,
      options.scale,
      token
    )

    console.log('Fetching node dimensions...')
    const dimensions = await fetchNodeDimensions(
      options.fileKey,
      options.nodeId,
      token
    )
    console.log(`nodeWidth: ${dimensions.width}`)
    console.log(`nodeHeight: ${dimensions.height}`)

    console.log('Downloading image...')
    await downloadImage(imageUrl, options.output)

    const pngData = PNG.sync.read(fs.readFileSync(options.output))
    console.log(`imageSize: ${pngData.width}x${pngData.height}`)

    if (pngData.width >= 4096 || pngData.height >= 4096) {
      console.warn('⚠ Figma 4096px 하드 리미트에 도달했을 수 있습니다.')
    }

    const metaPath = options.output.replace(/\.png$/i, '.meta.json')
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          bbox: { width: dimensions.width, height: dimensions.height },
          image: { width: pngData.width, height: pngData.height },
          scale: options.scale,
        },
        null,
        2
      )
    )
    console.log(`Metadata saved: ${metaPath}`)

    console.log(`Screenshot saved: ${options.output}`)
  } catch (error: unknown) {
    console.error('Failed to capture Figma screenshot')
    console.error(error)
    process.exitCode = 1
  }
}

main()
