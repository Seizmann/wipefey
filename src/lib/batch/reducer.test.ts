import { describe, it, expect } from 'vitest'
import { validateFiles, formatBytes, createBatchFile } from './reducer'
import { MAX_FILE_COUNT, MAX_FILE_SIZE } from './types'

// Helper to create a mock File
function mockFile(name: string, size: number, type = 'image/jpeg'): File {
  return new File([new ArrayBuffer(size)], name, { type })
}

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })
})

describe('validateFiles', () => {
  it('accepts valid JPEG files', () => {
    const file = mockFile('photo.jpg', 1024)
    const result = validateFiles([file], 0)
    expect(result.accepted).toHaveLength(1)
    expect(result.rejected).toHaveLength(0)
    expect(result.overflow).toHaveLength(0)
  })

  it('rejects unsupported formats', () => {
    const file = mockFile('doc.pdf', 1024, 'application/pdf')
    const result = validateFiles([file], 0)
    expect(result.accepted).toHaveLength(0)
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]!.reason).toContain('Unsupported format')
  })

  it('rejects files exceeding MAX_FILE_SIZE', () => {
    const file = mockFile('huge.jpg', MAX_FILE_SIZE + 1)
    const result = validateFiles([file], 0)
    expect(result.accepted).toHaveLength(0)
    expect(result.rejected).toHaveLength(1)
    expect(result.rejected[0]!.reason).toContain('25 MB')
  })

  it('handles overflow when batch is near full', () => {
    const files = Array.from({ length: 5 }, (_, i) =>
      mockFile(`photo${i}.jpg`, 1024),
    )
    const result = validateFiles(files, MAX_FILE_COUNT - 2)
    expect(result.accepted).toHaveLength(2)
    expect(result.overflow).toHaveLength(3)
  })

  it('accepts mixed valid and invalid files', () => {
    const valid = mockFile('good.jpg', 1024)
    const badType = mockFile('bad.pdf', 1024, 'application/pdf')
    const badSize = mockFile('big.jpg', MAX_FILE_SIZE + 1)
    const result = validateFiles([valid, badType, badSize], 0)
    expect(result.accepted).toHaveLength(1)
    expect(result.rejected).toHaveLength(2)
  })
})

describe('createBatchFile', () => {
  it('creates a BatchFile in queued status', () => {
    const file = mockFile('test.jpg', 1024)
    const batch = createBatchFile(file, null)
    expect(batch.status).toBe('queued')
    expect(batch.file).toBe(file)
    expect(batch.thumbUrl).toBeNull()
    expect(batch.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('stores thumbUrl when provided', () => {
    const file = mockFile('test.jpg', 1024)
    const batch = createBatchFile(file, 'blob:http://localhost/test')
    expect(batch.thumbUrl).toBe('blob:http://localhost/test')
  })
})
